"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getTargetDinner, getTicketInfo } from "@/lib/ticket-assignment";

export async function purchaseTicket(formData: FormData) {
  const withGuest = formData.get("with_guest") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Use admin client for DB operations (tickets table has no INSERT RLS policy for members)
  const admin = createAdminClient();

  // Look up member
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "members!inner(id, attendee_stagetype, has_community_access, kicked_out)"
    )
    .eq("email", user.email!)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    attendee_stagetype: string | null;
    has_community_access: boolean;
    kicked_out: boolean;
  } | null;

  if (!member || member.kicked_out || !member.attendee_stagetype) {
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
    member.attendee_stagetype,
    member.has_community_access
  );

  const quantity = actualWithGuest ? 2 : 1;
  const amountPaid = actualWithGuest ? price + 40 : price;

  const { error } = await admin.from("tickets").insert({
    member_id: member.id,
    dinner_id: targetDinner.id,
    ticket_type: ticketType,
    quantity,
    amount_paid: amountPaid,
    payment_source: "portal",
    fulfillment_status: "pending",
    purchased_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to purchase ticket: ${error.message}`);
  }

  redirect("/portal/tickets/success");
}
