export function refineMemberEmails(
  meta: {
    op: "INSERT" | "UPDATE" | "DELETE";
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  },
  _actor: string | null,
  subject: string | null
): { event_type: string; summary: string } {
  if (meta.op === "INSERT") {
    const email = (meta.new_row?.email as string) ?? "";
    return {
      event_type: "member_email.added",
      summary: subject ? `Email ${email} added to ${subject}` : `Email added: ${email}`,
    };
  }
  if (meta.op === "DELETE") {
    const email = (meta.old_row?.email as string) ?? "";
    return {
      event_type: "member_email.deleted",
      summary: subject ? `Email ${email} removed from ${subject}` : `Email removed: ${email}`,
    };
  }
  const old = meta.old_row ?? {};
  const newR = meta.new_row ?? {};
  if (old.is_primary !== newR.is_primary && newR.is_primary === true) {
    return {
      event_type: "member_email.primary_set",
      summary: subject ? `${(newR.email as string) ?? "Email"} set as ${subject}'s primary` : "Primary email changed",
    };
  }
  if (old.email_status !== newR.email_status) {
    return {
      event_type: "member_email.status_changed",
      summary: `Email status: ${old.email_status} → ${newR.email_status}`,
    };
  }
  return { event_type: "member_email.updated", summary: "Email row updated" };
}
