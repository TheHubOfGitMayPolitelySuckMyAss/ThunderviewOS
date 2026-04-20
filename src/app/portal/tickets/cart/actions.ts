"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getTicketInfo } from "@/lib/ticket-assignment";
import { formatDinnerDisplay } from "@/lib/format";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function purchaseTicket(formData: FormData) {
  const withGuest = formData.get("with_guest") === "true";
  const selectedDinnerId = formData.get("dinner_id") as string;

  if (!selectedDinnerId) redirect("/portal/tickets");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Look up member
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "email, members!inner(id, attendee_stagetypes, has_community_access, kicked_out)"
    )
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    attendee_stagetypes: string[];
    has_community_access: boolean;
    kicked_out: boolean;
  } | null;

  if (
    !member ||
    member.kicked_out ||
    !member.attendee_stagetypes ||
    member.attendee_stagetypes.length === 0
  ) {
    redirect("/portal");
  }

  // Validate selected dinner exists
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date, guests_allowed")
    .eq("id", selectedDinnerId)
    .single();

  if (!dinner) redirect("/portal/tickets");

  // Only allow guest if the dinner has guests_allowed = true
  const actualWithGuest = withGuest && dinner.guests_allowed;

  const { ticketType, price } = getTicketInfo(
    member.attendee_stagetypes,
    member.has_community_access
  );

  const quantity = actualWithGuest ? 2 : 1;
  const amountPaid = actualWithGuest ? price + 40 : price;
  const dinnerDisplay = formatDinnerDisplay(dinner.date);

  const itemName = actualWithGuest
    ? `Thunderview CEO Dinner — ${dinnerDisplay} (with guest)`
    : `Thunderview CEO Dinner — ${dinnerDisplay}`;

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: itemName },
          unit_amount: amountPaid * 100,
        },
        quantity: 1,
      },
    ],
    metadata: {
      member_id: member.id,
      dinner_id: dinner.id,
      ticket_type: ticketType,
      quantity: String(quantity),
      amount_paid: String(amountPaid),
    },
    customer_email: memberEmail!.email,
    success_url: `${origin}/portal/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/portal/tickets`,
  });

  if (!session.url) {
    throw new Error("Failed to create Stripe Checkout Session");
  }

  redirect(session.url);
}
