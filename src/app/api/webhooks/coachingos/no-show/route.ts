/**
 * Inbound webhook: Eric hits "Didn't come" on a Thunderview attendee candidate
 * in DigiEric (CoachingOS).
 *
 * The coachingos-attendee-sync cron only sends first-time attendees
 * (last_dinner_attended IS NULL). But the post-dinner cron stamps
 * last_dinner_attended for everyone holding a fulfilled ticket — including
 * no-shows — so without this signal a no-show would never be re-sent even if
 * they attend a future dinner. This arms members.coachingos_resend_requested;
 * the next sync re-includes the member and clears the flag (one-shot pulse,
 * re-armed by each "Didn't come").
 *
 * Auth: bearer COACHINGOS_WEBHOOK_SECRET (shared, bidirectional — the same
 * value DigiEric stores as THUNDERVIEW_WEBHOOK_SECRET). Returns 200 on any
 * post-auth failure so DigiEric doesn't retry-storm; failures land in
 * system_events.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.COACHINGOS_WEBHOOK_SECRET;
  if (!secret) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:coachingos",
      summary: "coachingos no-show webhook: COACHINGOS_WEBHOOK_SECRET missing",
      metadata: { context: "webhook.coachingos_no_show", cause: "missing_env" },
    });
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let memberId: string | undefined;
  try {
    const body = (await req.json()) as { thunderview_member_id?: string };
    memberId = body.thunderview_member_id?.trim();
  } catch {
    // fall through to malformed handling below
  }

  if (!memberId) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:coachingos",
      summary: "coachingos no-show webhook: missing thunderview_member_id",
      metadata: { context: "webhook.coachingos_no_show", cause: "malformed_body" },
    });
    return NextResponse.json({ ok: false, skipped: "malformed_body" });
  }

  const admin = createAdminClient("webhook");

  const { data: member, error } = await admin
    .from("members")
    .update({ coachingos_resend_requested: true })
    .eq("id", memberId)
    .select("id")
    .maybeSingle();

  if (error) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:coachingos",
      subject_member_id: memberId,
      summary: `coachingos no-show webhook: update failed — ${error.message}`,
      metadata: {
        context: "webhook.coachingos_no_show",
        cause: "downstream_db_failure",
        member_id: memberId,
        message: error.message,
      },
    });
    return NextResponse.json({ ok: false, logged: "downstream_db_failure" });
  }

  if (!member) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:coachingos",
      summary: "coachingos no-show webhook: no member for id",
      metadata: {
        context: "webhook.coachingos_no_show",
        cause: "no_member_for_id",
        member_id: memberId,
      },
    });
    return NextResponse.json({ ok: false, skipped: "no_member_for_id" });
  }

  await logSystemEvent({
    event_type: "webhook.coachingos",
    actor_label: "webhook:coachingos",
    subject_member_id: member.id,
    summary: "DigiEric Didn't Come — armed for re-send",
    metadata: {
      action: "no_show_resend_armed",
      member_id: member.id,
    },
  });

  return NextResponse.json({ ok: true });
}
