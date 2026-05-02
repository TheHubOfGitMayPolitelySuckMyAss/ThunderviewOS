// Buffer for deciding fresh-approve vs link from member.created_at vs the
// audit row's changed_at. approve_application creates the member and updates
// the application within a single SECURITY DEFINER tx — typically <1s apart.
// A delta beyond this buffer means the member already existed before the
// approval, i.e. this is a re-application/link, not a fresh approval.
export const APPROVE_VS_LINK_BUFFER_MS = 60_000;

export function refineApplications(
  meta: {
    op: "INSERT" | "UPDATE" | "DELETE";
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  },
  actor: string | null,
  subject: string | null,
  occurredAt: string,
  memberCreatedAtLookup: Map<string, string>
): { event_type: string; summary: string } {
  if (meta.op === "INSERT") {
    const newR = meta.new_row ?? {};
    const name = `${newR.first_name ?? ""} ${newR.last_name ?? ""}`.trim() || "applicant";
    return {
      event_type: "application.submitted",
      summary: `${name} applied`,
    };
  }
  if (meta.op === "DELETE") {
    return { event_type: "application.deleted", summary: `Application deleted` };
  }
  const old = meta.old_row ?? {};
  const newR = meta.new_row ?? {};
  if (old.status !== newR.status) {
    if (newR.status === "approved") {
      // Distinguish fresh approve (new member created in the same RPC) from
      // re-application/link (member already existed). The applications table
      // doesn't have a dedicated link flag — both flows write the same
      // columns. The unambiguous signal is whether the linked member's row
      // was created at the same time as this UPDATE.
      const memberId = (newR.member_id as string | null) ?? null;
      const memberCreatedAt = memberId ? memberCreatedAtLookup.get(memberId) : undefined;
      let isLink = false;
      if (memberCreatedAt) {
        const memberCreatedMs = Date.parse(memberCreatedAt);
        const occurredMs = Date.parse(occurredAt);
        if (
          Number.isFinite(memberCreatedMs) &&
          Number.isFinite(occurredMs) &&
          occurredMs - memberCreatedMs > APPROVE_VS_LINK_BUFFER_MS
        ) {
          isLink = true;
        }
      }

      if (isLink) {
        return {
          event_type: "application.linked",
          summary: actor && subject
            ? `${actor} linked an application to ${subject}`
            : subject
              ? `Application linked to ${subject}`
              : "Application linked",
        };
      }
      return {
        event_type: "application.approved",
        summary: actor && subject ? `${actor} approved ${subject}` : subject ? `${subject} approved` : "Application approved",
      };
    }
    if (newR.status === "rejected") {
      return {
        event_type: "application.rejected",
        summary: actor ? `${actor} rejected an application` : "Application rejected",
      };
    }
  }
  return { event_type: "application.updated", summary: "Application updated" };
}
