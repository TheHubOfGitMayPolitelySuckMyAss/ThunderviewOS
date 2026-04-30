/**
 * Service-role Supabase client with explicit audit attribution.
 *
 * Mechanism: attaches an `X-Audit-Actor` header (the current user's
 * members.id UUID) to every request. PostgREST exposes incoming headers as a
 * per-request GUC `request.headers` (a JSON object). The audit trigger reads
 * `request.headers['x-audit-actor']` and writes it to
 * `audit.row_history.actor_member_id`. The activity feed then attributes the
 * row without needing auth.uid().
 *
 * Connection-pooling safety: PostgREST runs each REST request in its own
 * transaction. `request.headers` is set at the start of that transaction and
 * is only visible to SQL executed within it. Once the transaction commits or
 * rolls back, the GUC is gone — so a header value can't leak to a different
 * request that reuses the same physical connection from the pgbouncer pool.
 * This is materially safer than session-level `SET app.actor_id`, which
 * would persist on the connection and bleed across requests.
 *
 * Failure modes:
 *  - If `getCurrentActorMemberId()` returns null (no session, or email
 *    doesn't match any member_email), the header is omitted and the audit
 *    trigger falls back to auth.uid() (which will also be null in service-
 *    role contexts). Result: an unattributed audit row. This is the same
 *    behavior as before this helper existed — no regression.
 *  - If the header value is malformed (not a UUID), the trigger catches the
 *    cast exception and writes NULL. Same outcome as omission.
 *
 * When NOT to use this:
 *  - Cron handlers and webhook handlers — there is no human actor; use the
 *    plain `createAdminClient()`.
 *  - Public flows that don't have an authenticated user (e.g. /apply form
 *    submission). Use `createAdminClient()`.
 */

import { createClient } from "@supabase/supabase-js";
import { getCurrentActorMemberId } from "@/lib/current-actor";

export async function createAdminClientForCurrentActor() {
  const actorMemberId = await getCurrentActorMemberId();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    actorMemberId
      ? {
          global: {
            headers: { "X-Audit-Actor": actorMemberId },
          },
        }
      : undefined
  );
}
