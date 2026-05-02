import type { FeedRowRaw, AuditMeta } from "./types";
import { refineMembers } from "./refiners/members";
import { refineApplications } from "./refiners/applications";
import { refineTickets } from "./refiners/tickets";
import { refineCredits } from "./refiners/credits";
import { refineMemberEmails } from "./refiners/member-emails";
import { refineDinners } from "./refiners/dinners";
import { refineDinnerSpeakers } from "./refiners/dinner-speakers";
import { refineEmailTemplates } from "./refiners/email-templates";

/**
 * Audit-row refinement: derive event_type and summary from the diff.
 * Returns refined event_type + a human-readable summary.
 */
export function refineAuditRow(
  r: FeedRowRaw,
  nameLookup: Map<string, string>,
  memberCreatedAtLookup: Map<string, string>
): { event_type: string; summary: string } {
  const meta = r.metadata as AuditMeta;

  const actor = r.actor_id ? nameLookup.get(r.actor_id) ?? "Someone" : null;
  const subject = r.subject_member_id ? nameLookup.get(r.subject_member_id) ?? null : null;
  const isSelf = !!actor && !!subject && r.actor_id === r.subject_member_id;

  switch (meta.table_name) {
    case "members":
      return refineMembers(meta, actor, subject, isSelf);
    case "applications":
      return refineApplications(meta, actor, subject, r.occurred_at, memberCreatedAtLookup);
    case "tickets":
      return refineTickets(meta, actor, subject);
    case "credits":
      return refineCredits(meta, actor, subject);
    case "member_emails":
      return refineMemberEmails(meta, actor, subject);
    case "dinners":
      return refineDinners(meta, actor);
    case "dinner_speakers":
      return refineDinnerSpeakers(meta, actor, subject);
    case "email_templates":
      return refineEmailTemplates(meta, actor);
    default:
      return {
        event_type: `${meta.table_name}.${meta.op.toLowerCase()}`,
        summary: `${meta.op} on ${meta.table_name}`,
      };
  }
}
