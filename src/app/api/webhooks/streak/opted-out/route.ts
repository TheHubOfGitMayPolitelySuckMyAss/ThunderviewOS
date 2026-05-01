/**
 * Inbound webhook: Eric moves a Streak box to "Opted Out".
 *
 * Streak fires this with the box's key in the payload. We:
 *   1. Verify shared-secret query param.
 *   2. Look up the member by streak_box_key.
 *   3. Set marketing_opted_in = false (existing trigger flips
 *      marketing_opted_out_at).
 *   4. Push back to Streak — idempotent in the common case, corrective if
 *      precedence puts the member somewhere higher (e.g., kicked_out → still
 *      Opted Out, no-op; bounced + opted_out → bounced wins, box moves to
 *      Bounced — Eric can override later if intent was Opted Out).
 *
 * Returns 200 even on internal failures after auth so Streak doesn't retry
 * indefinitely. All failures land in system_events.
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import { safePushMember } from "@/lib/streak/safe-push";
import {
  extractBoxKey,
  logWebhookFailure,
  malformedResponse,
  okResponse,
  unauthorizedResponse,
  verifyStreakSecret,
} from "@/lib/streak/inbound";

const SOURCE = "streak_opted_out_webhook" as const;

export async function POST(req: NextRequest) {
  if (!verifyStreakSecret(req)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await logWebhookFailure({ source: SOURCE, cause: "malformed_body" });
    return malformedResponse();
  }

  const boxKey = extractBoxKey(body);
  if (!boxKey) {
    await logWebhookFailure({ source: SOURCE, cause: "malformed_body" });
    return malformedResponse();
  }

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("id")
    .eq("streak_box_key", boxKey)
    .single();

  if (!member) {
    await logWebhookFailure({
      source: SOURCE,
      cause: "no_member_for_box",
      box_key: boxKey,
    });
    return okResponse({ skipped: "no_member_for_box" });
  }

  const { error } = await admin
    .from("members")
    .update({ marketing_opted_in: false })
    .eq("id", member.id);

  if (error) {
    await logWebhookFailure({
      source: SOURCE,
      cause: "downstream_db_failure",
      box_key: boxKey,
      member_id: member.id,
      message: error.message,
    });
    return okResponse({ logged: "downstream_db_failure" });
  }

  await logSystemEvent({
    event_type: "webhook.streak",
    actor_label: "webhook:streak",
    subject_member_id: member.id,
    summary: "Streak Opted Out",
    metadata: {
      stage: "opted_out",
      box_key: boxKey,
      member_id: member.id,
    },
  });

  await safePushMember(member.id, "streak_opted_out_webhook");

  return okResponse();
}
