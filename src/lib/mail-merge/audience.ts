/**
 * Mail-merge audience engine.
 *
 * Buckets every member with computeStageForMember — the SAME pure precedence
 * ladder that drives Streak stages. When the Streak integration is torn down,
 * compute-stage.ts stays: this module is its consumer.
 *
 * Bucket semantics for mail merges (per Eric):
 *   - Selectable send groups: investors / attended / approved.
 *   - team is ALWAYS included in every merge.
 *   - opted_out and bounced are structurally unreachable (never selectable).
 *   - has_ticket and not_this_one are never merged either — ticket-holders
 *     are mid-transactional-email-flow, exclusions asked not to be contacted.
 *     The buckets stay in the model; there is simply no send path to them.
 *
 * Everything is batch-fetched (4 queries) and computed in memory — 700 members
 * is nothing, and it keeps the ladder in one auditable place instead of
 * duplicating it in SQL.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getTodayMT } from "@/lib/format";
import {
  computeStageForMember,
  type MemberStreakState,
} from "@/lib/streak/compute-stage";
import type { StreakStage } from "@/lib/streak/stages";

/** Buckets an admin can tick on a merge. */
export const SELECTABLE_GROUPS = ["investors", "attended", "approved"] as const;
export type SelectableGroup = (typeof SELECTABLE_GROUPS)[number];

/** Buckets that end up as recipient rows (selectable + always-on team). */
export type SendBucket = SelectableGroup | "team";

export type AudienceMember = {
  member_id: string;
  first_name: string;
  /** Deliverable address (primary active, else any active), or null. */
  email: string | null;
  bucket: SendBucket;
};

export type Audience = {
  /** Member count per ladder bucket — the full ladder, for UI transparency. */
  counts: Record<StreakStage, number>;
  /** Members in sendable buckets (team/investors/attended/approved). */
  sendable: AudienceMember[];
};

type MemberRow = {
  id: string;
  first_name: string;
  is_team: boolean;
  marketing_opted_in: boolean;
  kicked_out: boolean;
  last_dinner_attended: string | null;
  excluded_from_dinner_id: string | null;
  attendee_stagetypes: string[] | null;
};

type EmailRow = {
  member_id: string;
  email: string;
  email_status: "active" | "bounced" | "complained";
  is_primary: boolean;
};

const SEND_BUCKETS: SendBucket[] = ["team", ...SELECTABLE_GROUPS];

export async function computeAudience(): Promise<Audience> {
  const admin = createAdminClient("read-only");
  const today = getTodayMT();

  const [members, emails, upcomingTickets] = await Promise.all([
    fetchAll<MemberRow>((from, to) =>
      admin
        .from("members")
        .select(
          "id, first_name, is_team, marketing_opted_in, kicked_out, last_dinner_attended, excluded_from_dinner_id, attendee_stagetypes"
        )
        .range(from, to)
    ),
    fetchAll<EmailRow>((from, to) =>
      admin
        .from("member_emails")
        .select("member_id, email, email_status, is_primary")
        .range(from, to)
    ),
    fetchAll<{ member_id: string }>((from, to) =>
      admin
        .from("tickets")
        .select("member_id, dinners!inner(date)")
        .in("fulfillment_status", ["purchased", "fulfilled"])
        .gte("dinners.date", today)
        .range(from, to)
    ),
  ]);

  // Exclusion dinners: only fetch the dinners actually referenced.
  const excludedDinnerIds = [
    ...new Set(
      members.map((m) => m.excluded_from_dinner_id).filter(Boolean) as string[]
    ),
  ];
  const activeExclusionDinners = new Set<string>();
  if (excludedDinnerIds.length > 0) {
    const { data: dinners, error } = await admin
      .from("dinners")
      .select("id, date")
      .in("id", excludedDinnerIds);
    if (error) {
      throw new Error(`computeAudience: dinners query failed: ${error.message}`);
    }
    for (const d of dinners ?? []) {
      if (d.date >= today) activeExclusionDinners.add(d.id);
    }
  }

  const emailsByMember = new Map<string, EmailRow[]>();
  for (const e of emails) {
    const list = emailsByMember.get(e.member_id);
    if (list) list.push(e);
    else emailsByMember.set(e.member_id, [e]);
  }
  const ticketedMembers = new Set(upcomingTickets.map((t) => t.member_id));

  const counts = {
    team: 0,
    opted_out: 0,
    bounced: 0,
    has_ticket: 0,
    not_this_one: 0,
    investors: 0,
    attended: 0,
    approved: 0,
    applied: 0,
  } satisfies Record<StreakStage, number>;
  const sendable: AudienceMember[] = [];

  for (const m of members) {
    const memberEmails = emailsByMember.get(m.id) ?? [];
    const state: MemberStreakState = {
      is_team: !!m.is_team,
      marketing_opted_in: !!m.marketing_opted_in,
      kicked_out: !!m.kicked_out,
      email_statuses: memberEmails.map((e) => e.email_status),
      has_upcoming_ticket: ticketedMembers.has(m.id),
      has_active_exclusion:
        !!m.excluded_from_dinner_id &&
        activeExclusionDinners.has(m.excluded_from_dinner_id),
      last_dinner_attended: m.last_dinner_attended,
      attendee_stagetypes: m.attendee_stagetypes ?? [],
    };

    const bucket = computeStageForMember(state);
    counts[bucket] += 1;

    if ((SEND_BUCKETS as string[]).includes(bucket)) {
      const active = memberEmails.filter((e) => e.email_status === "active");
      const chosen = active.find((e) => e.is_primary) ?? active[0] ?? null;
      sendable.push({
        member_id: m.id,
        first_name: m.first_name,
        email: chosen?.email ?? null,
        bucket: bucket as SendBucket,
      });
    }
  }

  return { counts, sendable };
}
