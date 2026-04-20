"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getTargetDinner, getTicketInfo } from "@/lib/ticket-assignment";
import { formatDinnerDisplay } from "@/lib/format";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function purchaseTicket(formData: FormData) {
  const withGuest = formData.get("with_guest") === "true";

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

  // Recompute target dinner at submit time
  const targetDinner = await getTargetDinner(member.id, admin);
  if (!targetDinner) redirect("/portal/tickets");

  // Only allow guest for December dinners
  const dinnerMonth =
    new Date(targetDinner.date + "T00:00:00").getMonth() + 1;
  const actualWithGuest = withGuest && dinnerMonth === 12;

  const { ticketType, price } = getTicketInfo(
    member.attendee_stagetypes,
    member.has_community_access
  );

  const quantity = actualWithGuest ? 2 : 1;
  const amountPaid = actualWithGuest ? price + 40 : price;
  const dinnerDisplay = formatDinnerDisplay(targetDinner.date);

  const itemName = actualWithGuest
    ? `Thunderview CEO Dinner — ${dinnerDisplay} (with guest)`
    : `Thunderview CEO Dinner — ${dinnerDisplay}`;

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const successUrl = `${origin}/portal/tickets/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/portal/tickets`;

  console.error("Stripe URL debug:", {
    success_url: successUrl,
    cancel_url: cancelUrl,
    origin_source_value: origin,
    NEXT_PUBLIC_SITE_URL_raw: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SITE_URL_type: typeof process.env.NEXT_PUBLIC_SITE_URL,
  });

  let sessionUrl: string;
  try {
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
        dinner_id: targetDinner.id,
        ticket_type: ticketType,
        quantity: String(quantity),
        amount_paid: String(amountPaid),
      },
      customer_email: memberEmail!.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw new Error("Stripe returned no session URL");
    }
    sessionUrl = session.url;
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    console.error("Stripe Checkout Session creation failed — full error:", {
      message: e.message,
      type: e.type,
      code: e.code,
      param: e.param,
      statusCode: e.statusCode,
      raw: e.raw,
      constructor_name: e.constructor?.toString?.()?.slice(0, 100),
      stack: typeof e.stack === "string" ? e.stack.split("\n").slice(0, 5) : undefined,
    });
    throw err;
  }

  redirect(sessionUrl);
}
