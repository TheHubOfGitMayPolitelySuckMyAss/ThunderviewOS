"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function refundTicket(
  ticketId: string,
  mode: "full" | "guest_only"
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  if (mode === "guest_only") {
    // Decrement quantity from 2 to 1, halve amount_paid
    const { data: ticket } = await admin
      .from("tickets")
      .select("quantity, amount_paid")
      .eq("id", ticketId)
      .single();

    if (!ticket || ticket.quantity < 2) {
      return { success: false, error: "Ticket does not have a guest to refund" };
    }

    const { error } = await admin
      .from("tickets")
      .update({
        quantity: 1,
        amount_paid: Number(ticket.amount_paid) / 2,
      })
      .eq("id", ticketId);

    if (error) return { success: false, error: error.message };
  } else {
    // Full refund — set fulfillment_status to 'refunded'
    const { error } = await admin
      .from("tickets")
      .update({ fulfillment_status: "refunded" })
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
