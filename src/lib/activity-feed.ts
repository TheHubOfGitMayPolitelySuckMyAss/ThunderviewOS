/**
 * Activity feed: unified read API over system_events, email_events,
 * and audit.row_history.
 *
 * Backed by the public.activity_feed Postgres view, which UNIONs the three
 * sources to a common shape. This module:
 *   - Issues filtered/paginated queries against the view
 *   - Refines audit-row event_type based on the old_row/new_row diff
 *   - Renders a human-readable summary for audit rows (bundled-edit display)
 *   - Resolves actor + subject member names in a single trailing lookup
 *
 * Three surfaces: People (human acted, human-meaningful), System (operational
 * failures), and Marketing (anonymous page views from the public site).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";

export type FeedSource = "system_events" | "email_events" | "audit";

export type FeedKind = "people" | "system" | "marketing";

/** Raw row as it lands from the activity_feed view. */
type FeedRowRaw = {
  source: FeedSource;
  source_id: string;
  event_type: string;
  actor_id: string | null;
  actor_label: string | null;
  subject_member_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

/** Enriched row used by the UI. */
export type FeedRow = {
  source: FeedSource;
  source_id: string;
  event_type: string;
  actor_id: string | null;
  actor_label: string | null;
  actor_name: string | null;
  subject_member_id: string | null;
  subject_name: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type FeedFilters = {
  kind: FeedKind;
  page?: number;
  pageSize?: number;
  eventTypes?: string[];
  actorMemberId?: string | null;
  /** Member History scoping: include rows where actor_id = member OR subject_member_id = member */
  scopedToMemberId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
};

export type FeedPage = {
  rows: FeedRow[];
  total: number;
  page: number;
  pageSize: number;
};

// People feed exclusion list (event_type prefixes/exact matches).
// People feed = subset where a human acted AND event is human-meaningful.
const PEOPLE_FEED_EXCLUDED_PREFIXES = ["cron.", "webhook.", "error."];
const PEOPLE_FEED_EXCLUDED_TYPES = new Set(["email.transactional_sent"]);

// System feed = operational failures and warnings worth a human looking at.
// Anything not in this list stays in the underlying tables (system_events,
// audit.row_history, email_events) for ad-hoc SQL but does NOT appear in the
// /admin/operations System tab.
const SYSTEM_FEED_INCLUDED_TYPES = [
  "error.caught",
  "email.bounced",
  "email.complained",
  "email.failed",
];

function isHumanMeaningful(eventType: string): boolean {
  if (PEOPLE_FEED_EXCLUDED_TYPES.has(eventType)) return false;
  for (const p of PEOPLE_FEED_EXCLUDED_PREFIXES) {
    if (eventType.startsWith(p)) return false;
  }
  return true;
}

// Fields hidden from the changed-fields list when diffing audit UPDATEs.
// These are trigger-managed and add noise.
const AUDIT_NOISE_FIELDS = new Set([
  "updated_at",
  "intro_updated_at",
  "ask_updated_at",
  "marketing_opted_out_at",
]);

// Field-label friendly names for changed-field display.
const FIELD_LABELS: Record<string, string> = {
  first_name: "first name",
  last_name: "last name",
  company_name: "company",
  company_website: "website",
  linkedin_profile: "LinkedIn",
  current_intro: "intro",
  current_ask: "ask",
  current_give: "give",
  contact_preference: "contact preference",
  attendee_stagetypes: "role",
  marketing_opted_in: "marketing opt-in",
  is_team: "team status",
  kicked_out: "kicked out",
  has_community_access: "community access",
  profile_pic_url: "profile pic",
  email: "email",
  is_primary: "primary email",
  email_status: "email status",
  status: "status",
  fulfillment_status: "fulfillment status",
  amount_paid: "amount",
  quantity: "quantity",
  ticket_type: "ticket type",
  payment_source: "payment source",
  date: "date",
  venue: "venue",
  address: "address",
  title: "title",
  description: "description",
  guests_allowed: "guests allowed",
  morning_of_sent_at: "morning-of sent",
  rejection_reason: "rejection reason",
  redeemed_ticket_id: "redeemed ticket",
};

function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

/**
 * Page through the activity feed.
 *
 * For People feed, filtering is partly post-filtering (TS) because the spec
 * excludes specific event types AND requires actor_id non-null AND a few
 * derived rules. We over-fetch and trim. At our scale this is fine.
 */
export async function getActivityFeed(filters: FeedFilters): Promise<FeedPage> {
  const admin = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 100);

  const buildQuery = (countOnly: boolean) => {
    let q = admin
      .from("activity_feed")
      .select(
        "source, source_id, event_type, actor_id, actor_label, subject_member_id, summary, metadata, occurred_at",
        countOnly ? { count: "exact", head: true } : { count: "exact" }
      );

    if (filters.kind === "people") {
      q = q.not("actor_id", "is", null);
      q = q.neq("source", "email_events");
      // Excluded prefixes/exact types
      // PostgREST doesn't support array NOT LIKE; do per-prefix with .not("event_type", "like", ...)
      for (const p of PEOPLE_FEED_EXCLUDED_PREFIXES) {
        q = q.not("event_type", "like", `${p}%`);
      }
      for (const t of PEOPLE_FEED_EXCLUDED_TYPES) {
        q = q.neq("event_type", t);
      }
    } else if (filters.kind === "system") {
      q = q.in("event_type", SYSTEM_FEED_INCLUDED_TYPES);
    } else if (filters.kind === "marketing") {
      // Marketing tab = anonymous page views only. Authenticated page views
      // belong in People.
      q = q.eq("event_type", "page.viewed").is("actor_id", null);
    }

    if (filters.eventTypes && filters.eventTypes.length > 0) {
      q = q.in("event_type", filters.eventTypes);
    }

    if (filters.actorMemberId) {
      q = q.eq("actor_id", filters.actorMemberId);
    }

    if (filters.scopedToMemberId) {
      const m = filters.scopedToMemberId;
      q = q.or(`actor_id.eq.${m},subject_member_id.eq.${m}`);
    }

    if (filters.fromDate) {
      q = q.gte("occurred_at", filters.fromDate);
    }
    if (filters.toDate) {
      q = q.lte("occurred_at", filters.toDate);
    }

    return q;
  };

  const offset = (page - 1) * pageSize;
  const q = buildQuery(false)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data: rows, count, error } = await q;
  if (error) {
    console.error("[activity-feed] query failed:", error.message);
    return { rows: [], total: 0, page, pageSize };
  }

  const enriched = await enrichRows((rows ?? []) as FeedRowRaw[]);
  return {
    rows: enriched,
    total: count ?? 0,
    page,
    pageSize,
  };
}

async function enrichRows(rows: FeedRowRaw[]): Promise<FeedRow[]> {
  if (rows.length === 0) return [];

  // Collect all member ids referenced (actor + subject) for one trailing lookup.
  const memberIds = new Set<string>();
  for (const r of rows) {
    if (r.actor_id) memberIds.add(r.actor_id);
    if (r.subject_member_id) memberIds.add(r.subject_member_id);
  }

  const nameLookup = new Map<string, string>();
  // Used by refineApplications to distinguish a fresh approve (member_id row
  // was created in the same RPC tx as the application UPDATE) from a re-
  // application/link (member existed long before the application UPDATE).
  const memberCreatedAtLookup = new Map<string, string>();
  if (memberIds.size > 0) {
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("members")
      .select("id, first_name, last_name, created_at")
      .in("id", Array.from(memberIds));
    for (const m of members ?? []) {
      nameLookup.set(m.id, formatName(m.first_name, m.last_name));
      if (m.created_at) memberCreatedAtLookup.set(m.id, m.created_at);
    }
  }

  return rows.map((r) => {
    const refined =
      r.source === "audit"
        ? refineAuditRow(r, nameLookup, memberCreatedAtLookup)
        : { event_type: r.event_type, summary: r.summary };
    return {
      source: r.source,
      source_id: r.source_id,
      event_type: refined.event_type,
      actor_id: r.actor_id,
      actor_label: r.actor_label,
      actor_name: r.actor_id ? nameLookup.get(r.actor_id) ?? null : null,
      subject_member_id: r.subject_member_id,
      subject_name: r.subject_member_id ? nameLookup.get(r.subject_member_id) ?? null : null,
      summary: refined.summary ?? r.summary ?? defaultSummary(r),
      metadata: r.metadata,
      occurred_at: r.occurred_at,
    };
  });
}

function defaultSummary(r: FeedRowRaw): string {
  if (r.summary) return r.summary;
  // Generic fallback
  return r.event_type;
}

/**
 * Audit-row refinement: derive event_type and summary from the diff.
 * Returns refined event_type + a human-readable summary.
 */
function refineAuditRow(
  r: FeedRowRaw,
  nameLookup: Map<string, string>,
  memberCreatedAtLookup: Map<string, string>
): { event_type: string; summary: string } {
  const meta = r.metadata as {
    table_name: string;
    op: "INSERT" | "UPDATE" | "DELETE";
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  };

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
    case "email_instances":
      return { event_type: `email_instance.${meta.op.toLowerCase()}`, summary: `email_instance.${meta.op.toLowerCase()}` };
    default:
      return {
        event_type: `${meta.table_name}.${meta.op.toLowerCase()}`,
        summary: `${meta.op} on ${meta.table_name}`,
      };
  }
}

function changedFields(
  old_row: Record<string, unknown> | null,
  new_row: Record<string, unknown> | null
): string[] {
  if (!old_row || !new_row) return [];
  const keys = new Set([...Object.keys(old_row), ...Object.keys(new_row)]);
  const diff: string[] = [];
  for (const k of keys) {
    if (AUDIT_NOISE_FIELDS.has(k)) continue;
    const a = old_row[k];
    const b = new_row[k];
    if (!shallowEqual(a, b)) diff.push(k);
  }
  return diff;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => shallowEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function describeChangedFields(fields: string[]): string {
  const visible = fields.filter((f) => !AUDIT_NOISE_FIELDS.has(f));
  if (visible.length === 0) return "(no visible changes)";
  if (visible.length <= 5) {
    return visible.map(labelFor).join(", ");
  }
  return `${visible.length} fields`;
}

// ---- table-specific refiners ----

function refineMembers(
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

// Buffer for deciding fresh-approve vs link from member.created_at vs the
// audit row's changed_at. approve_application creates the member and updates
// the application within a single SECURITY DEFINER tx — typically <1s apart.
// A delta beyond this buffer means the member already existed before the
// approval, i.e. this is a re-application/link, not a fresh approval.
const APPROVE_VS_LINK_BUFFER_MS = 60_000;

function refineApplications(
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

function refineTickets(
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

function refineCredits(
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

function refineMemberEmails(
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

function refineDinners(
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

function refineDinnerSpeakers(
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

function refineEmailTemplates(
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

/**
 * Distinct event_types currently in the feed — used to populate the
 * filter dropdown on the operations page. Honors the kind filter so the
 * People dropdown doesn't include cron/webhook/error types.
 */
export async function getDistinctEventTypes(kind: FeedKind): Promise<string[]> {
  // Fixed-scope feeds return their inclusion list directly so the dropdown
  // shows the relevant types even before any have fired.
  if (kind === "system") {
    return [...SYSTEM_FEED_INCLUDED_TYPES].sort();
  }
  if (kind === "marketing") {
    return ["page.viewed"];
  }

  const admin = createAdminClient();
  let q = admin.from("activity_feed").select("event_type");
  q = q.not("actor_id", "is", null).neq("source", "email_events");
  for (const p of PEOPLE_FEED_EXCLUDED_PREFIXES) {
    q = q.not("event_type", "like", `${p}%`);
  }
  for (const t of PEOPLE_FEED_EXCLUDED_TYPES) {
    q = q.neq("event_type", t);
  }
  const { data } = await q.limit(5000);
  const set = new Set<string>();
  for (const r of (data ?? []) as { event_type: string }[]) {
    set.add(r.event_type);
  }
  return Array.from(set).sort();
}

export { isHumanMeaningful };
