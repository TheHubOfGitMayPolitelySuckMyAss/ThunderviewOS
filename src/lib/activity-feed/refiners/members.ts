import { changedFields, describeChangedFields } from "../shared";

export function refineMembers(
  meta: {
    op: "INSERT" | "UPDATE" | "DELETE";
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  },
  actor: string | null,
  subject: string | null,
  isSelf: boolean
): { event_type: string; summary: string } {
  if (meta.op === "INSERT") {
    return {
      event_type: "member.created",
      summary: actor && subject ? `${actor} added ${subject}` : `Member created${subject ? `: ${subject}` : ""}`,
    };
  }
  if (meta.op === "DELETE") {
    return {
      event_type: "member.deleted",
      summary: actor && subject ? `${actor} deleted ${subject}` : `Member deleted${subject ? `: ${subject}` : ""}`,
    };
  }
  // UPDATE
  const old = meta.old_row ?? {};
  const newR = meta.new_row ?? {};

  // Specific transitions
  if (old.kicked_out === false && newR.kicked_out === true) {
    return {
      event_type: "member.kicked_out",
      summary: actor && subject ? `${actor} removed ${subject}` : subject ? `${subject} removed` : "Member kicked out",
    };
  }
  if (old.kicked_out === true && newR.kicked_out === false) {
    return {
      event_type: "member.reinstated",
      summary: actor && subject ? `${actor} reinstated ${subject}` : subject ? `${subject} reinstated` : "Member reinstated",
    };
  }
  if (old.is_team === false && newR.is_team === true) {
    return {
      event_type: "member.team_added",
      summary: actor && subject ? `${actor} marked ${subject} as team` : subject ? `${subject} marked as team` : "Marked as team",
    };
  }
  if (old.is_team === true && newR.is_team === false) {
    return {
      event_type: "member.team_removed",
      summary: actor && subject ? `${actor} unmarked ${subject} as team` : subject ? `${subject} unmarked as team` : "Unmarked as team",
    };
  }
  if (old.marketing_opted_in === true && newR.marketing_opted_in === false) {
    return {
      event_type: "member.marketing_opted_out",
      summary: subject ? `${subject} opted out of marketing` : "Marketing opt-out",
    };
  }
  if (old.marketing_opted_in === false && newR.marketing_opted_in === true) {
    return {
      event_type: "member.marketing_opted_in",
      summary: subject ? `${subject} opted in to marketing` : "Marketing opt-in",
    };
  }

  // Generic profile edit
  const fields = changedFields(meta.old_row, meta.new_row);
  const desc = describeChangedFields(fields);
  if (isSelf && subject) {
    return {
      event_type: "member.self_edited",
      summary: `${subject} edited their profile (${desc})`,
    };
  }
  if (actor && subject) {
    return {
      event_type: "member.edited",
      summary: `${actor} edited ${subject}'s profile (${desc})`,
    };
  }
  return {
    event_type: "member.edited",
    summary: subject ? `${subject}'s profile edited (${desc})` : `Member profile edited (${desc})`,
  };
}
