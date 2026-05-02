import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import type { FeedRow, FeedRowRaw, AuditMeta } from "./types";
import { formatDinnerLabel } from "./shared";
import { refineAuditRow } from "./refine";
import { computeSubjectLabel } from "./subject-labels";

function defaultSummary(r: FeedRowRaw): string {
  if (r.summary) return r.summary;
  // Generic fallback
  return r.event_type;
}

export async function enrichRows(rows: FeedRowRaw[]): Promise<FeedRow[]> {
  if (rows.length === 0) return [];

  // Collect all entity IDs needed for batch lookups.
  const memberIds = new Set<string>();
  // Dinner IDs that require a DB lookup (not already in a row snapshot).
  const dinnerIds = new Set<string>();
  // Dinner labels extracted from dinners audit row snapshots — free, no query.
  const dinnerLabelFromSnapshot = new Map<string, string>();
  // Application IDs needed only for page.viewed /admin/applications/{id} paths.
  const applicationIds = new Set<string>();

  for (const r of rows) {
    if (r.actor_id) memberIds.add(r.actor_id);
    if (r.subject_member_id) memberIds.add(r.subject_member_id);

    if (r.source === "audit") {
      const meta = r.metadata as AuditMeta;
      const row = meta.new_row ?? meta.old_row ?? {};

      if (meta.table_name === "dinner_speakers") {
        // subject_member_id is NULL for dinner_speakers in the view — collect manually.
        const memberId = row.member_id as string | undefined;
        if (memberId) memberIds.add(memberId);
        const dinnerId = row.dinner_id as string | undefined;
        if (dinnerId) dinnerIds.add(dinnerId);
      } else if (meta.table_name === "tickets") {
        const dinnerId = row.dinner_id as string | undefined;
        if (dinnerId) dinnerIds.add(dinnerId);
      } else if (meta.table_name === "dinners") {
        // Date lives in the snapshot — pre-populate without a query.
        const dinnerId = meta.row_pk.id as string | undefined;
        const date = row.date as string | undefined;
        if (dinnerId && date) dinnerLabelFromSnapshot.set(dinnerId, formatDinnerLabel(date));
      }
    } else if (r.event_type === "page.viewed") {
      const path = (r.metadata.path as string | undefined) ?? "";
      const memberMatch = path.match(
        /\/members\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      );
      if (memberMatch) memberIds.add(memberMatch[1]);
      const dinnerMatch = path.match(
        /\/dinners\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      );
      if (dinnerMatch) dinnerIds.add(dinnerMatch[1]);
      const appMatch = path.match(
        /\/applications\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      );
      if (appMatch) applicationIds.add(appMatch[1]);
    }
  }

  const admin = createAdminClient("system-internal");

  // Batch member lookup.
  const nameLookup = new Map<string, string>();
  // Used by refineApplications to distinguish fresh approve from re-application link.
  const memberCreatedAtLookup = new Map<string, string>();
  if (memberIds.size > 0) {
    const { data: members } = await admin
      .from("members")
      .select("id, first_name, last_name, created_at")
      .in("id", Array.from(memberIds));
    for (const m of members ?? []) {
      nameLookup.set(m.id, formatName(m.first_name, m.last_name));
      if (m.created_at) memberCreatedAtLookup.set(m.id, m.created_at);
    }
  }

  // Batch dinner lookup (only IDs not already known from snapshots).
  const dinnerLookup = new Map<string, string>(dinnerLabelFromSnapshot);
  const missingDinnerIds = Array.from(dinnerIds).filter((id) => !dinnerLookup.has(id));
  if (missingDinnerIds.length > 0) {
    const { data: dinners } = await admin
      .from("dinners")
      .select("id, date")
      .in("id", missingDinnerIds);
    for (const d of dinners ?? []) {
      dinnerLookup.set(d.id, formatDinnerLabel(d.date as string));
    }
  }

  // Batch application lookup (page.viewed paths only).
  const applicationLookup = new Map<string, string>();
  if (applicationIds.size > 0) {
    const { data: apps } = await admin
      .from("applications")
      .select("id, first_name, last_name")
      .in("id", Array.from(applicationIds));
    for (const a of apps ?? []) {
      applicationLookup.set(a.id, formatName(a.first_name as string, a.last_name as string));
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
      subject_label: computeSubjectLabel(r, nameLookup, dinnerLookup, applicationLookup),
      summary: refined.summary ?? r.summary ?? defaultSummary(r),
      metadata: r.metadata,
      occurred_at: r.occurred_at,
    };
  });
}
