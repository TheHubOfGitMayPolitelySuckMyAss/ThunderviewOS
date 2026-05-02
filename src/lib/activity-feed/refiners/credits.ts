export function refineCredits(
  meta: {
    op: "INSERT" | "UPDATE" | "DELETE";
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  },
  _actor: string | null,
  subject: string | null
): { event_type: string; summary: string } {
  if (meta.op === "INSERT") {
    return {
      event_type: "credit.created",
      summary: subject ? `Credit issued to ${subject}` : "Credit created",
    };
  }
  if (meta.op === "DELETE") {
    return { event_type: "credit.deleted", summary: "Credit deleted" };
  }
  const old = meta.old_row ?? {};
  const newR = meta.new_row ?? {};
  if (old.status !== newR.status && newR.status === "redeemed") {
    return {
      event_type: "credit.redeemed",
      summary: subject ? `Credit redeemed for ${subject}` : "Credit redeemed",
    };
  }
  return { event_type: "credit.updated", summary: "Credit updated" };
}
