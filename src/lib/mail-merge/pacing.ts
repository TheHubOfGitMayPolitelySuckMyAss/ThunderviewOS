/**
 * Mail-merge send pacing. Client-safe (no server imports) so the editor and
 * progress UI quote the same rate the drain enforces.
 *
 * THE rate: sends per rolling 60s across ALL merges (it's one Gmail account),
 * enforced atomically by claim_mail_merge_recipient_throttled(). Each drain
 * run (inline at send-start, then every per-minute cron fire) sends at most
 * one minute's allotment, spaced evenly across the run. 5/min is the agent's
 * default after the 2026-09 deliverability misses, not an Eric ruling; tune
 * it here and nowhere else.
 */
export const MAIL_MERGE_SENDS_PER_MINUTE = 5;

/** Wall-clock span one drain run spreads its allotment over (< cron maxDuration 60s). */
const RUN_WINDOW_MS = 50_000;

/** Gap between consecutive sends inside one drain run. */
export const MAIL_MERGE_SEND_SPACING_MS = Math.floor(
  RUN_WINDOW_MS / MAIL_MERGE_SENDS_PER_MINUTE
);

/** Minutes to send `count` emails at the throttle rate. */
export function estimateDrainMinutes(count: number): number {
  if (count <= 0) return 0;
  return Math.ceil(count / MAIL_MERGE_SENDS_PER_MINUTE);
}

/** "about 1 hour 40 minutes" / "about 3 minutes" / "about a minute". */
export function formatDrainDuration(count: number): string {
  const mins = estimateDrainMinutes(count);
  if (mins === 0) return "no time";
  if (mins === 1) return "about a minute";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h !== 1 ? "s" : ""}`);
  if (m) parts.push(`${m} minute${m !== 1 ? "s" : ""}`);
  return `about ${parts.join(" ")}`;
}
