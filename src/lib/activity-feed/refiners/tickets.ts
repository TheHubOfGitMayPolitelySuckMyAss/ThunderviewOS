export function refineTickets(
  meta: {
    op: "INSERT" | "UPDATE" | "DELETE";
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  },
  actor: string | null,
  subject: string | null
): { event_type: string; summary: string } {
  if (meta.op === "INSERT") {
    const newR = meta.new_row ?? {};
    const status = newR.fulfillment_status as string | undefined;
    if (status === "fulfilled") {
      return {
        event_type: "ticket.fulfilled",
        summary: subject ? `Ticket fulfilled for ${subject}` : "Ticket fulfilled",
      };
    }
    return {
      event_type: "ticket.purchased",
      summary: actor && subject && actor === subject ? `${subject} bought a ticket` : subject ? `Ticket purchased for ${subject}` : "Ticket purchased",
    };
  }
  if (meta.op === "DELETE") {
    return { event_type: "ticket.deleted", summary: "Ticket deleted" };
  }
  const old = meta.old_row ?? {};
  const newR = meta.new_row ?? {};
  if (old.fulfillment_status !== newR.fulfillment_status) {
    if (newR.fulfillment_status === "fulfilled") {
      return {
        event_type: "ticket.fulfilled",
        summary: subject ? `Ticket fulfilled for ${subject}` : "Ticket fulfilled",
      };
    }
    if (newR.fulfillment_status === "refunded") {
      return {
        event_type: "ticket.refunded",
        summary: actor && subject ? `${actor} refunded ${subject}'s ticket` : subject ? `${subject}'s ticket refunded` : "Ticket refunded",
      };
    }
    if (newR.fulfillment_status === "credited") {
      return {
        event_type: "ticket.credited",
        summary: actor && subject ? `${actor} credited ${subject}'s ticket` : subject ? `${subject}'s ticket credited` : "Ticket credited",
      };
    }
  }
  // Guest-only refund: quantity 2→1 with status unchanged + amount_paid drop.
  if (
    typeof old.quantity === "number" &&
    typeof newR.quantity === "number" &&
    old.quantity > newR.quantity
  ) {
    return {
      event_type: "ticket.refunded_guest",
      summary: actor && subject ? `${actor} refunded ${subject}'s guest ticket` : subject ? `${subject}'s guest ticket refunded` : "Guest ticket refunded",
    };
  }
  return { event_type: "ticket.updated", summary: "Ticket updated" };
}
