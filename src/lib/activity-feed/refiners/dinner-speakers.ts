export function refineDinnerSpeakers(
  meta: { op: "INSERT" | "UPDATE" | "DELETE" },
  actor: string | null,
  subject: string | null
): { event_type: string; summary: string } {
  if (meta.op === "INSERT") {
    return {
      event_type: "speaker.added",
      summary: actor && subject ? `${actor} added ${subject} as speaker` : subject ? `${subject} added as speaker` : "Speaker added",
    };
  }
  if (meta.op === "DELETE") {
    return {
      event_type: "speaker.removed",
      summary: actor && subject ? `${actor} removed ${subject} as speaker` : subject ? `${subject} removed as speaker` : "Speaker removed",
    };
  }
  return { event_type: "speaker.updated", summary: "Speaker updated" };
}
