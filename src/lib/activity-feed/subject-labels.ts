import { formatName } from "@/lib/format";
import type { FeedRowRaw, AuditMeta } from "./types";
import { formatDinnerLabel } from "./shared";
import { subjectLabelForPagePath } from "./page-paths";

function computeAuditSubjectLabel(
  r: FeedRowRaw,
  nameLookup: Map<string, string>,
  dinnerLookup: Map<string, string>
): string | null {
  const meta = r.metadata as AuditMeta;
  const row = meta.new_row ?? meta.old_row ?? {};

  switch (meta.table_name) {
    case "members":
      if (!r.subject_member_id) return null;
      return nameLookup.get(r.subject_member_id) ?? "(deleted member)";

    case "applications": {
      const first = (row.first_name as string | null | undefined) ?? "";
      const last = (row.last_name as string | null | undefined) ?? "";
      const name = formatName(first, last) || "(unknown applicant)";
      return `${name} (application)`;
    }

    case "tickets": {
      const memberName = r.subject_member_id
        ? (nameLookup.get(r.subject_member_id) ?? "(deleted member)")
        : null;
      const dinnerId = (row.dinner_id as string | undefined) ?? null;
      const dinnerLabel = dinnerId ? (dinnerLookup.get(dinnerId) ?? null) : null;
      if (memberName && dinnerLabel) return `${memberName} — ${dinnerLabel}`;
      return memberName;
    }

    case "credits":
      if (!r.subject_member_id) return null;
      return `${nameLookup.get(r.subject_member_id) ?? "(deleted member)"} credit`;

    case "member_emails": {
      const email = (row.email as string | undefined) ?? "";
      if (!r.subject_member_id) return email || null;
      const name = nameLookup.get(r.subject_member_id) ?? "(deleted member)";
      return email ? `${name} (${email})` : name;
    }

    case "dinners": {
      const date = (row.date as string | undefined) ?? null;
      if (date) return `Dinner: ${formatDinnerLabel(date)}`;
      const dinnerId = meta.row_pk.id as string | undefined;
      const cached = dinnerId ? dinnerLookup.get(dinnerId) : undefined;
      return cached ? `Dinner: ${cached}` : "Dinner";
    }

    case "dinner_speakers": {
      const memberId = (row.member_id as string | undefined) ?? null;
      const dinnerId = (row.dinner_id as string | undefined) ?? null;
      const speakerName = memberId ? (nameLookup.get(memberId) ?? null) : null;
      const dinnerLabel = dinnerId ? (dinnerLookup.get(dinnerId) ?? null) : null;
      if (speakerName && dinnerLabel) return `${speakerName} (${dinnerLabel})`;
      if (speakerName) return speakerName;
      return dinnerLabel ? `Speaker — ${dinnerLabel}` : null;
    }

    case "email_templates": {
      const slug = (row.slug as string | undefined) ?? null;
      return slug ?? "Email template";
    }

    default:
      return null;
  }
}

export function computeSubjectLabel(
  r: FeedRowRaw,
  nameLookup: Map<string, string>,
  dinnerLookup: Map<string, string>,
  applicationLookup: Map<string, string>
): string | null {
  if (r.source === "audit") {
    return computeAuditSubjectLabel(r, nameLookup, dinnerLookup);
  }
  if (r.event_type === "page.viewed") {
    const path = (r.metadata.path as string | undefined) ?? "";
    return subjectLabelForPagePath(path, nameLookup, dinnerLookup, applicationLookup);
  }
  if (r.source === "email_events") {
    if (r.subject_member_id) {
      return nameLookup.get(r.subject_member_id) ?? (r.metadata.recipient as string | undefined) ?? null;
    }
    return (r.metadata.recipient as string | undefined) ?? null;
  }
  if (r.subject_member_id) {
    return nameLookup.get(r.subject_member_id) ?? null;
  }
  return null;
}
