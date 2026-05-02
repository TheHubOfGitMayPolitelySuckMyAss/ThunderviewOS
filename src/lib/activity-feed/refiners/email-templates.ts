export function refineEmailTemplates(
  meta: { op: "INSERT" | "UPDATE" | "DELETE"; new_row: Record<string, unknown> | null },
  actor: string | null
): { event_type: string; summary: string } {
  if (meta.op === "UPDATE") {
    const slug = meta.new_row?.slug as string | undefined;
    return {
      event_type: "email_template.updated",
      summary: actor ? `${actor} edited "${slug ?? "template"}"` : `Email template edited: ${slug ?? ""}`,
    };
  }
  return {
    event_type: `email_template.${meta.op.toLowerCase()}`,
    summary: `Email template ${meta.op.toLowerCase()}`,
  };
}
