// People feed exclusion list (event_type prefixes/exact matches).
// People feed = subset where a human acted AND event is human-meaningful.
export const PEOPLE_FEED_EXCLUDED_PREFIXES = ["cron.", "webhook.", "error."];
export const PEOPLE_FEED_EXCLUDED_TYPES = new Set(["email.transactional_sent"]);

// System feed = operational failures and warnings worth a human looking at.
// Anything not in this list stays in the underlying tables (system_events,
// audit.row_history, email_events) for ad-hoc SQL but does NOT appear in the
// /admin/operations System tab.
export const SYSTEM_FEED_INCLUDED_TYPES = [
  "error.caught",
  "email.bounced",
  "email.complained",
  "email.failed",
];

export function isHumanMeaningful(eventType: string): boolean {
  if (PEOPLE_FEED_EXCLUDED_TYPES.has(eventType)) return false;
  for (const p of PEOPLE_FEED_EXCLUDED_PREFIXES) {
    if (eventType.startsWith(p)) return false;
  }
  return true;
}
