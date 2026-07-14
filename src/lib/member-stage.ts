/**
 * The member-stage precedence ladder.
 *
 * Born as the Streak pipeline-stage computation; the Streak integration is
 * gone (2026-07, Eric cancelled Streak) but the ladder IS the segmentation
 * model — it now drives mail-merge audiences (src/lib/mail-merge/audience.ts).
 *
 * Pure function: takes a precomputed state snapshot, returns a stage. Every
 * member lands in exactly ONE bucket; first match wins.
 */

export type MemberStage =
  | "team"
  | "applied"
  | "approved"
  | "attended"
  | "investors"
  | "has_ticket"
  | "not_this_one"
  | "bounced"
  | "opted_out";

export const STAGE_LABELS: Record<MemberStage, string> = {
  team: "Team",
  applied: "Applied",
  approved: "Approved",
  attended: "Attended",
  investors: "Investors",
  has_ticket: "Has Ticket",
  not_this_one: "Not This One",
  bounced: "Bounced",
  opted_out: "Opted Out",
};

/**
 * Inputs to the precedence ladder. Everything the computation needs, in a
 * single plain object so it round-trips through synthetic test cases trivially.
 */
export type MemberStageState = {
  /** From members.is_team. Top-precedence — pins the member to Team. */
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
  /**
   * From members.attendee_stagetypes. Drives the Investors carve-out:
   * tagged "Investor" AND NOT "Active CEO (...)". An investor who is also
   * a current CEO is mail-merged as a CEO.
   */
  attendee_stagetypes: string[];
};

/**
 * Pure precedence ladder. First match wins.
 *
 * Team rule (top): is_team pins the member to Team regardless of any other
 * state. Team members run dinners; their stage is "operator," not subject.
 * If a team member is also kicked out / bounced / opted out, Team still wins.
 *
 * Bounced rule: only fires when the member has at least one email row AND
 * every row is bounced. A member with zero email rows is not "all bounced"
 * (vacuously true would be wrong) and falls through to subsequent rules.
 *
 * Mail-merge semantics: investors/attended/approved are the selectable send
 * groups; team is always included; opted_out/bounced/has_ticket/not_this_one
 * are structurally unsendable (ticket-holders are mid-transactional-flow,
 * exclusions asked not to be contacted).
 */
export function computeStageForMember(state: MemberStageState): MemberStage {
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

  // Investors carve-out: sits above Attended/Approved so investor-flavored
  // mail merges target them regardless of attendance history. Active CEO
  // tag wins — a member who is both is treated as a CEO for segmentation.
  if (
    state.attendee_stagetypes.includes("Investor") &&
    !state.attendee_stagetypes.includes("Active CEO (Bootstrapping or VC-Backed)")
  ) {
    return "investors";
  }

  if (state.last_dinner_attended !== null) {
    return "attended";
  }

  return "approved";
}
