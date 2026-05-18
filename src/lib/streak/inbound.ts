/**
 * Helpers shared by the two inbound Streak webhook routes.
 *
 * Auth model: shared secret in the `?secret=` query param. Streak's automation
 * builder (as of Sprint 20) doesn't expose HMAC payload signing or a way to
 * inject custom request headers, so query param is the safe default. Eric
 * configures the URL with the secret appended when wiring the automation.
 *
 * Both webhook handlers share the same response posture: any error AFTER the
 * secret check returns 200 to keep Streak from retrying (the failure is
 * logged to system_events for review). Only secret-check failures return 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { logSystemEvent } from "@/lib/system-events";

export function verifyStreakSecret(req: NextRequest): boolean {
  const expected = process.env.STREAK_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = req.nextUrl.searchParams.get("secret");
  return provided !== null && provided === expected;
}

/**
 * Pull a Streak box key out of a webhook payload, tolerating reasonable
 * template variations the automation builder might emit.
 *
 * Streak's "Outbound webhook" step defaults to `application/x-www-form-urlencoded`
 * unless the Request Payload field contains a valid JSON object literal. The
 * automation builder's variable picker (`{{ boxStageChanged.boxKey }}` and
 * friends) inserts a single value, which Streak then wraps as
 * `payload=<value>`. So in practice we receive form-encoded bodies with a
 * `payload` field, not JSON. Accept both shapes plus a few likely key names
 * so future Streak schema tweaks don't break us silently.
 */
export function extractBoxKey(parsed: unknown, rawBody: string): string | null {
  // JSON object body
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const k of ["box_key", "boxKey", "key", "payload"]) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
  }

  // Form-encoded body (Streak's default when payload isn't JSON)
  if (rawBody) {
    try {
      const params = new URLSearchParams(rawBody);
      for (const k of ["box_key", "boxKey", "key", "payload"]) {
        const v = params.get(k);
        if (v && v.length > 0) return v;
      }
    } catch {
      // not form-encoded either
    }
  }

  return null;
}

export type WebhookFailureCause =
  | "malformed_body"
  | "no_member_for_box"
  | "no_primary_email"
  | "downstream_db_failure";

/**
 * Logs a streak webhook failure as `error.caught` with consistent metadata
 * shape across the inbound webhook handlers.
 */
export async function logWebhookFailure(args: {
  source:
    | "streak_opted_out_webhook"
    | "streak_not_this_one_webhook"
    | "streak_bounced_webhook";
  cause: WebhookFailureCause;
  box_key?: string | null;
  member_id?: string | null;
  message?: string;
  raw_body?: string | null;
}): Promise<void> {
  await logSystemEvent({
    event_type: "error.caught",
    actor_label: "webhook:streak",
    summary: `${args.source} ${args.cause}`,
    metadata: {
      source: args.source,
      cause: args.cause,
      box_key: args.box_key ?? null,
      member_id: args.member_id ?? null,
      message: args.message ?? null,
      raw_body: args.raw_body ?? null,
    },
  });
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function malformedResponse(): NextResponse {
  return NextResponse.json({ error: "Malformed body" }, { status: 400 });
}

export function okResponse(extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...(extra ?? {}) }, { status: 200 });
}
