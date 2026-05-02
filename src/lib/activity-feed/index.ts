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
import type {
  FeedFilters,
  FeedKind,
  FeedResult,
  FeedRowRaw,
  EventTypesResult,
} from "./types";
import {
  PEOPLE_FEED_EXCLUDED_PREFIXES,
  PEOPLE_FEED_EXCLUDED_TYPES,
  SYSTEM_FEED_INCLUDED_TYPES,
  isHumanMeaningful,
} from "./filters";
import { enrichRows } from "./enrich";

export type {
  FeedSource,
  FeedKind,
  FeedRow,
  FeedFilters,
  FeedPage,
  FeedResult,
  EventTypesResult,
} from "./types";
export { isHumanMeaningful };

/**
 * Page through the activity feed.
 *
 * For People feed, filtering is partly post-filtering (TS) because the spec
 * excludes specific event types AND requires actor_id non-null AND a few
 * derived rules. We over-fetch and trim. At our scale this is fine.
 */
export async function getActivityFeed(filters: FeedFilters): Promise<FeedResult> {
  const admin = createAdminClient("system-internal");
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

  try {
    const { data: rows, count, error } = await q;
    if (error) {
      console.error("[activity-feed] query failed:", error.message);
      return { ok: false, error: error.message };
    }

    const enriched = await enrichRows((rows ?? []) as FeedRowRaw[]);
    return {
      ok: true,
      rows: enriched,
      total: count ?? 0,
      page,
      pageSize,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[activity-feed] unexpected error:", message);
    return { ok: false, error: message };
  }
}

/**
 * Distinct event_types currently in the feed — used to populate the
 * filter dropdown on the operations page. Honors the kind filter so the
 * People dropdown doesn't include cron/webhook/error types.
 */
export async function getDistinctEventTypes(kind: FeedKind): Promise<EventTypesResult> {
  // Fixed-scope feeds return their inclusion list directly so the dropdown
  // shows the relevant types even before any have fired.
  if (kind === "system") {
    return { ok: true, types: [...SYSTEM_FEED_INCLUDED_TYPES].sort() };
  }
  if (kind === "marketing") {
    return { ok: true, types: ["page.viewed"] };
  }

  try {
    // Server-side DISTINCT via RPC. Replaces a prior client-side dedupe over
    // a row scan that silently truncated at the PostgREST 1k cap, which let
    // rare event_types disappear from the dropdown until they fired recently.
    const admin = createAdminClient("system-internal");
    const { data, error } = await admin.rpc("get_distinct_people_event_types", {
      excluded_prefixes: PEOPLE_FEED_EXCLUDED_PREFIXES,
      excluded_types: Array.from(PEOPLE_FEED_EXCLUDED_TYPES),
    });
    if (error) {
      console.error("[activity-feed] getDistinctEventTypes failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, types: (data ?? []) as string[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[activity-feed] getDistinctEventTypes unexpected error:", message);
    return { ok: false, error: message };
  }
}
