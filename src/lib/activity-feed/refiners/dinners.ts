import { changedFields, describeChangedFields } from "../shared";

export function refineDinners(
  meta: {
    op: "INSERT" | "UPDATE" | "DELETE";
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  },
  actor: string | null
): { event_type: string; summary: string } {
  if (meta.op === "INSERT") {
    const date = meta.new_row?.date as string | undefined;
    return { event_type: "dinner.created", summary: `Dinner created (${date ?? ""})` };
  }
  if (meta.op === "DELETE") {
    return { event_type: "dinner.deleted", summary: "Dinner deleted" };
  }
  const fields = changedFields(meta.old_row, meta.new_row);
  const desc = describeChangedFields(fields);
  return {
    event_type: "dinner.updated",
    summary: actor ? `${actor} edited dinner (${desc})` : `Dinner edited (${desc})`,
  };
}
