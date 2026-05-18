/**
 * Inbound webhook: Eric moves a Streak box to "Bounced".
 *
 * Realistic trigger: a mail merge bounced as unstructured text (e.g.,
 * "Address not found") that Resend can't classify into a Permanent bounce
 * event, so the Resend webhook never fired. Eric notices the bounce in his
 * inbox and moves the box manually. Streak's box Email column == primary
 * email by invariant, so the bounced address is the member's current primary.
 *
 * Behavior:
 *   1. Verify shared-secret query param.
 *   2. Look up the member by streak_box_key.
 *   3. Resolve the primary member_email and run the shared hard-bounce cascade
 *      (mark bounced, promote a non-bounced secondary if available, push
 *      Streak, emit the standard trio of system events).
 *
 * Returns 200 even on internal failures after auth so Streak doesn't retry
 * indefinitely. All failures land in system_events.
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import { applyHardBounce } from "@/lib/email-bounce";
import {
  extractBoxKey,
  logWebhookFailure,
  malformedResponse,
  okResponse,
  unauthorizedResponse,
  verifyStreakSecret,
} from "@/lib/streak/inbound";

const SOURCE = "streak_bounced_webhook" as const;

export async function POST(req: NextRequest) {
  if (!verifyStreakSecret(req)) {
    return unauthorizedResponse();
  }

  const rawBody = await req.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    await logWebhookFailure({
      source: SOURCE,
      cause: "malformed_body",
      raw_body: rawBody.slice(0, 4000),
    });
    return malformedResponse();
  }

  const boxKey = extractBoxKey(body);
  if (!boxKey) {
    await logWebhookFailure({
      source: SOURCE,
      cause: "malformed_body",
      raw_body: rawBody.slice(0, 4000),
    });
    return malformedResponse();
  }

  const admin = createAdminClient("webhook");

  const { data: member } = await admin
    .from("members")
    .select("id, first_name, last_name")
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

  const { data: primary } = await admin
    .from("member_emails")
    .select("id, email, member_id, is_primary")
    .eq("member_id", member.id)
    .eq("is_primary", true)
    .single();

  if (!primary) {
    await logWebhookFailure({
      source: SOURCE,
      cause: "no_primary_email",
      box_key: boxKey,
      member_id: member.id,
    });
    return okResponse({ skipped: "no_primary_email" });
  }

  await applyHardBounce({
    admin,
    memberEmail: {
      id: primary.id,
      email: primary.email,
      member_id: primary.member_id,
      is_primary: primary.is_primary,
    },
    memberName: formatName(member.first_name, member.last_name),
    actorLabel: "webhook:streak",
    safePushReason: "streak_bounced_webhook",
  });

  return okResponse();
}
