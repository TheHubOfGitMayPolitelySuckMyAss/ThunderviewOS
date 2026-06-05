/**
 * Vercel Cron: "Morning Of" — fires daily, no-ops unless today MT is a
 * dinner date. On firing day, sends the morning-of email to every fulfilled
 * attendee on that dinner.
 *
 * Idempotent: if dinners.morning_of_sent_at is already populated (e.g. a
 * human hit "Send To Attendees" earlier), the cron skips and heartbeats
 * outcome=already_sent. Manual sends and cron sends use the same underlying
 * helper (sendMorningOfToDinner) so behavior stays in sync.
 *
 * Schedule: 14:00 UTC = 8 AM MDT (summer) / 7 AM MST (winter). DST drift
 * matches prompt-intro-ask. Eric's preference: morning-of-day at ~8 AM MT.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { logSystemEvent } from "@/lib/system-events";
import { sendMorningOfToDinner } from "@/lib/morning-of-send";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runMorningOf();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:morning-of",
      summary: `morning-of cron threw: ${error.message}`,
      metadata: {
        context: "cron.morning_of",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

async function runMorningOf() {
  const admin = createAdminClient("cron");
  const todayMT = getTodayMT();

  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date, morning_of_sent_at")
    .eq("date", todayMT)
    .maybeSingle();

  if (!dinner) {
    await logSystemEvent({
      event_type: "cron.morning_of",
      actor_label: "cron:morning-of",
      summary: `morning-of ran: no dinner on ${todayMT}`,
      metadata: { outcome: "no_op", target_date: todayMT, reason: "no dinner today" },
    });
    return NextResponse.json({ ran: true, sent: 0, target_date: todayMT, reason: "no dinner today" });
  }

  if (dinner.morning_of_sent_at) {
    await logSystemEvent({
      event_type: "cron.morning_of",
      actor_label: "cron:morning-of",
      summary: `morning-of skipped: already sent at ${dinner.morning_of_sent_at}`,
      metadata: {
        outcome: "already_sent",
        dinner_id: dinner.id,
        dinner_date: dinner.date,
        sent_at: dinner.morning_of_sent_at,
      },
    });
    return NextResponse.json({
      ran: true,
      sent: 0,
      dinner_id: dinner.id,
      dinner_date: dinner.date,
      reason: "already sent",
    });
  }

  const { sent, sentAt } = await sendMorningOfToDinner(admin, dinner.id, null);

  await logSystemEvent({
    event_type: "cron.morning_of",
    actor_label: "cron:morning-of",
    summary: `morning-of sent to ${sent} attendees for ${dinner.date}`,
    metadata: {
      outcome: sent > 0 ? "success" : "no_op",
      dinner_id: dinner.id,
      dinner_date: dinner.date,
      recipient_count: sent,
      sent_at: sentAt,
    },
  });

  return NextResponse.json({
    ran: true,
    dinner_id: dinner.id,
    dinner_date: dinner.date,
    sent,
    sent_at: sentAt,
  });
}
