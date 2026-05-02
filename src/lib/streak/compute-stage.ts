/**
 * Streak stage computation for Thunderview members and applications.
 *
 * Split into two pieces by design:
 *
 * 1. computeStageForMember(state) — pure function. Takes a precomputed state
 *    snapshot and returns a stage. Easy to exercise from a runnable script
 *    (tmp/streak-precedence-verify.ts) without a DB.
 *
 * 2. getMemberStreakState(memberId) — DB fetcher. Materializes the snapshot
 *    from Supabase. Used by pushMemberToStreak.
 *
 * Application stage is much simpler — only "applied" is ever Streak-relevant
 * for an application row. Approved/rejected applications don't get their own
 * boxes (the member box represents them post-approval).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import type { StreakStage } from "@/lib/streak/stages";

/**
 * Inputs to the precedence ladder. Everything the computation needs, in a
 * single plain object so it round-trips through synthetic test cases trivially.
 */
export type MemberStreakState = {
  /** From members.is_team. Top-precedence — pins box to Team stage. */
  is_team: boolean;
  /** From members.marketing_opted_in. */
  marketing_opted_in: boolean;
  /** From members.kicked_out. */
  kicked_out: boolean;
  /** All email_status values for this member's emails. Empty = no emails. */
  email_statuses: Array<"active" | "bounced" | "complained">;
  /**
   * True iff member has at least one ticket with fulfillment_status in
   * ('purchased','fulfilled') for a dinner whose date is today or later (MT).
   */
  has_upcoming_ticket: boolean;
  /**
   * True iff members.excluded_from_dinner_id is non-null AND that dinner's
   * date is today or later (MT). Stale exclusions (past dinners) are
   * filtered out at fetch time and treated as cleared.
   */
  has_active_exclusion: boolean;
  /** From members.last_dinner_attended. */
  last_dinner_attended: string | null;
};

/**
 * Pure precedence ladder. First match wins. See CLAUDE.md / spec.
 *
 * Team rule (top): is_team pins the box to Team stage regardless of any other
 * state. Team members run dinners; their CRM stage is "operator," not subject.
 * If a team member is also kicked out / bounced / opted out, Team still wins.
 *
 * Bounced rule: only fires when the member has at least one email row AND
 * every row is bounced. A member with zero email rows is not "all bounced"
 * (vacuously true would be wrong) and falls through to subsequent rules.
 */
export function computeStageForMember(state: MemberStreakState): StreakStage {
  if (state.is_team) {
    return "team";
  }

  if (!state.marketing_opted_in || state.kicked_out) {
    return "opted_out";
  }

  if (
    state.email_statuses.length > 0 &&
    state.email_statuses.every((s) => s === "bounced")
  ) {
    return "bounced";
  }

  if (state.has_upcoming_ticket) {
    return "has_ticket";
  }

  if (state.has_active_exclusion) {
    return "not_this_one";
  }

  if (state.last_dinner_attended !== null) {
    return "attended";
  }

  return "approved";
}

/**
 * Application stage: only "applied" is Streak-relevant. Returns null for
 * approved/rejected/already-linked applications — caller should not push
 * those to Streak as standalone boxes.
 */
export function computeStageForApplication(app: {
  status: string;
  member_id: string | null;
}): "applied" | null {
  return app.status === "pending" && app.member_id === null ? "applied" : null;
}

/**
 * Materialize MemberStreakState from Supabase using the service-role client.
 * Bundles 4 reads — fast enough that a join would be overkill, and keeping
 * them separate makes each predicate auditable.
 */
export async function getMemberStreakState(
  memberId: string
): Promise<MemberStreakState> {
  const admin = createAdminClient("system-internal");
  const today = getTodayMT();

  const memberRes = await admin
    .from("members")
    .select(
      "is_team, marketing_opted_in, kicked_out, last_dinner_attended, excluded_from_dinner_id"
    )
    .eq("id", memberId)
    .single();
  if (memberRes.error || !memberRes.data) {
    throw new Error(
      `getMemberStreakState: member ${memberId} not found: ${memberRes.error?.message ?? "no data"}`
    );
  }
  const member = memberRes.data;

  const emailsRes = await admin
    .from("member_emails")
    .select("email_status")
    .eq("member_id", memberId);
  if (emailsRes.error) {
    throw new Error(
      `getMemberStreakState: member_emails query failed: ${emailsRes.error.message}`
    );
  }
  const email_statuses = (emailsRes.data ?? []).map(
    (r) => r.email_status as "active" | "bounced" | "complained"
  );

  // Upcoming ticket check: any purchased/fulfilled ticket whose dinner is today
  // or later. We pull tickets first, then filter by dinner date in memory —
  // a single PostgREST inner-join would also work but keeps the predicate
  // legible to read straight through.
  const ticketsRes = await admin
    .from("tickets")
    .select("dinners!inner(date)")
    .eq("member_id", memberId)
    .in("fulfillment_status", ["purchased", "fulfilled"])
    .gte("dinners.date", today)
    .limit(1);
  if (ticketsRes.error) {
    throw new Error(
      `getMemberStreakState: tickets query failed: ${ticketsRes.error.message}`
    );
  }
  const has_upcoming_ticket = (ticketsRes.data ?? []).length > 0;

  // Active exclusion: excluded_from_dinner_id set AND that dinner is today
  // or later. Stale exclusions (past dinner) are treated as cleared.
  let has_active_exclusion = false;
  if (member.excluded_from_dinner_id) {
    const dinnerRes = await admin
      .from("dinners")
      .select("date")
      .eq("id", member.excluded_from_dinner_id)
      .single();
    if (dinnerRes.error) {
      throw new Error(
        `getMemberStreakState: excluded dinner query failed: ${dinnerRes.error.message}`
      );
    }
    if (dinnerRes.data?.date && dinnerRes.data.date >= today) {
      has_active_exclusion = true;
    }
  }

  return {
    is_team: !!member.is_team,
    marketing_opted_in: !!member.marketing_opted_in,
    kicked_out: !!member.kicked_out,
    email_statuses,
    has_upcoming_ticket,
    has_active_exclusion,
    last_dinner_attended: member.last_dinner_attended,
  };
}
