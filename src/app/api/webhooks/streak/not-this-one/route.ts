/**
 * Inbound webhook: Eric moves a Streak box to "Not This One".
 *
 * Streak fires this with the box's key in the payload. We:
 *   1. Verify shared-secret query param.
 *   2. Look up the member by streak_box_key.
 *   3. Resolve the next upcoming dinner via getTargetDinner — that's the
 *      dinner the member is opting out of.
 *   4. Set members.excluded_from_dinner_id = <target dinner id>.
 *   5. Push back to Streak (idempotent in the common case; corrective if
 *      precedence puts the member somewhere higher).
 *
 * The post-dinner cron clears excluded_from_dinner_id once the dinner has
 * passed, so Not This One auto-resolves without manual cleanup.
 *
 * Returns 200 on internal failures after auth (Streak should not retry; the
 * failure is captured in system_events for review).
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import { getTargetDinner } from "@/lib/ticket-assignment";
import { safePushMember } from "@/lib/streak/safe-push";
import {
  extractBoxKey,
  logWebhookFailure,
  malformedResponse,
  okResponse,
  unauthorizedResponse,
  verifyStreakSecret,
} from "@/lib/streak/inbound";

const SOURCE = "streak_not_this_one_webhook" as const;

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

  const targetDinner = await getTargetDinner(member.id, admin);
  if (!targetDinner) {
    await logWebhookFailure({
      source: SOURCE,
      cause: "downstream_db_failure",
      box_key: boxKey,
      member_id: member.id,
      message: "no upcoming dinner found",
    });
    return okResponse({ logged: "no_upcoming_dinner" });
  }

  const { error } = await admin
    .from("members")
    .update({ excluded_from_dinner_id: targetDinner.id })
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
    summary: "Streak Not This One",
    metadata: {
      stage: "not_this_one",
      box_key: boxKey,
      member_id: member.id,
      dinner_id: targetDinner.id,
      dinner_date: targetDinner.date,
    },
  });

  await safePushMember(member.id, "streak_not_this_one_webhook");

  return okResponse();
}
