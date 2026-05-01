/**
 * Streak pipeline stage identifiers (internal) and the exact display names
 * the Thunderview pipeline uses in Streak. Bootstrap matches stages by name,
 * so these strings must match the stage names configured in Streak verbatim.
 */

export type StreakStage =
  | "team"
  | "applied"
  | "approved"
  | "attended"
  | "has_ticket"
  | "not_this_one"
  | "bounced"
  | "opted_out";

export const STAGE_NAMES: Record<StreakStage, string> = {
  team: "Team",
  applied: "Applied",
  approved: "Approved",
  attended: "Attended",
  has_ticket: "Has Ticket",
  not_this_one: "Not This One",
  bounced: "Bounced",
  opted_out: "Opted Out",
};
