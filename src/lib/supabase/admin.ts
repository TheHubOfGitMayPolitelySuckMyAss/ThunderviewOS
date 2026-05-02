import { createClient } from "@supabase/supabase-js";

/**
 * Why this admin client carries no audit attribution.
 *
 * Callers of `createAdminClient()` must declare the reason — the parameter
 * exists to force a deliberate choice rather than a default. If the call site
 * is a human-driven server action writing to an audited table (members,
 * applications, tickets, credits, member_emails, dinners, dinner_speakers,
 * email_templates, email_events), use `createAdminClientForCurrentActor()`
 * from `./admin-with-actor` instead — otherwise the audit row gets
 * `actor_member_id = NULL` and the change won't appear in the People feed.
 *
 *   cron            — Vercel cron handler. No human actor by definition.
 *   webhook         — External webhook (Stripe, Resend, Streak). No human actor.
 *   public-flow     — Unauthenticated public flow (/apply, marketing pages).
 *   read-only       — Page render or layout query that performs no writes.
 *   system-internal — Library helper called from many contexts where the
 *                     concrete actor is unknowable; system_events / activity
 *                     feed reads, etc. Use sparingly — prefer threading the
 *                     client through from a caller that DOES know its context.
 */
export type UnattributedReason =
  | "cron"
  | "webhook"
  | "public-flow"
  | "read-only"
  | "system-internal";

export function createAdminClient(_reason: UnattributedReason) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
