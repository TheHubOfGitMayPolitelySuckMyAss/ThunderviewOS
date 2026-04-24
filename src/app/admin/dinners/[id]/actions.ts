"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function refundTicket(
  ticketId: string,
  mode: "full" | "guest_only"
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  // Fetch ticket with Stripe fields
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, quantity, amount_paid, payment_source, stripe_payment_intent_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { success: false, error: "Ticket not found" };

  const amountPaid = Number(ticket.amount_paid);

  // Determine refund amount in cents
  // Guest-only: refund the $40 guest add-on, not half the total
  const refundCents =
    mode === "guest_only"
      ? 4000
      : Math.round(amountPaid * 100);

  // Stripe refund logic — only for tickets with a payment intent
  let stripeRefundId: string | null = null;

  if (ticket.payment_source === "historical") {
    // Historical ticket — skip Stripe, DB-only
  } else if (!ticket.stripe_payment_intent_id) {
    // Non-historical ticket missing payment intent — data anomaly
    if (ticket.payment_source === "portal") {
      return {
        success: false,
        error: `Data anomaly: portal ticket ${ticketId} has no stripe_payment_intent_id. Cannot issue Stripe refund. Fix the ticket data or refund manually in Stripe dashboard.`,
      };
    }
    // Other payment sources without stripe_payment_intent_id — skip Stripe
  } else {
    // Has stripe_payment_intent_id — issue Stripe refund
    try {
      const refund = await stripe.refunds.create({
        payment_intent: ticket.stripe_payment_intent_id,
        amount: refundCents,
      });
      stripeRefundId = refund.id;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown Stripe error";
      return { success: false, error: `Stripe refund failed: ${message}` };
    }
  }

  // DB updates — only after Stripe succeeds (or is skipped)
  if (mode === "guest_only") {
    if (!ticket || ticket.quantity < 2) {
      return { success: false, error: "Ticket does not have a guest to refund" };
    }

    const { error } = await admin
      .from("tickets")
      .update({
        quantity: 1,
        amount_paid: amountPaid - 40,
        ...(stripeRefundId && { stripe_refund_id: stripeRefundId }),
      })
      .eq("id", ticketId);

    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await admin
      .from("tickets")
      .update({
        fulfillment_status: "refunded",
        ...(stripeRefundId && { stripe_refund_id: stripeRefundId }),
      })
      .eq("id", ticketId);

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/admin/dinners");
  return { success: true };
}

export async function creditTicket(
  ticketId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  // Get ticket to find member_id
  const { data: ticket } = await admin
    .from("tickets")
    .select("member_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { success: false, error: "Ticket not found" };

  // Update ticket status to 'credited'
  const { error: ticketError } = await admin
    .from("tickets")
    .update({ fulfillment_status: "credited" })
    .eq("id", ticketId);

  if (ticketError) return { success: false, error: ticketError.message };

  // Create credit row
  const { error: creditError } = await admin.from("credits").insert({
    member_id: ticket.member_id,
    source_ticket_id: ticketId,
    status: "outstanding",
  });

  if (creditError) return { success: false, error: creditError.message };

  revalidatePath("/admin/dinners");
  return { success: true };
}

export async function updateDinnerField(
  dinnerId: string,
  field: "venue" | "address" | "title" | "description",
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("dinners")
    .update({ [field]: value || null })
    .eq("id", dinnerId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/dinners");
  return { success: true };
}

export async function searchMembersForSpeaker(
  query: string
): Promise<
  { id: string; name: string; company_name: string | null }[]
> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("members")
    .select("id, first_name, last_name, company_name")
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .order("first_name")
    .limit(10);

  return (data || []).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name || ""}`.trim(),
    company_name: m.company_name,
  }));
}

export async function addDinnerSpeaker(
  dinnerId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("dinner_speakers")
    .insert({ dinner_id: dinnerId, member_id: memberId });

  if (error) {
    if (error.code === "23505") return { success: false, error: "Already a speaker" };
    return { success: false, error: error.message };
  }
  revalidatePath("/admin/dinners");
  return { success: true };
}

export async function removeDinnerSpeaker(
  dinnerId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("dinner_speakers")
    .delete()
    .eq("dinner_id", dinnerId)
    .eq("member_id", memberId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/dinners");
  return { success: true };
}
