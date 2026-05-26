/**
 * Vercel Cron: "Applied, Didn't Convert" — fires daily, no-ops unless a dinner
 * is scheduled exactly 6 days out (in America/Denver). On firing day:
 *   - Pull approved applications submitted strictly after the prior dinner's
 *     date and on or before the upcoming dinner's date (the application window
 *     for this dinner cycle).
 *   - Filter out kicked-out members.
 *   - Filter out members who already hold a ticket (purchased or fulfilled)
 *     for the upcoming dinner.
 *   - Send sendAppliedDidntConvertEmail to each remaining recipient.
 *
 * Per-recipient throwOnError is false so one bad send doesn't take down the
 * batch; each individual failure logs error.caught via the helper.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { sendAppliedDidntConvertEmail } from "@/lib/email-send";
import { logSystemEvent } from "@/lib/system-events";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runAppliedDidntConvert();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:applied-didnt-convert",
      summary: `applied-didnt-convert cron threw: ${error.message}`,
      metadata: {
        context: "cron.applied_didnt_convert",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

async function runAppliedDidntConvert() {
  const admin = createAdminClient("cron");

  // Target date = today MT + 6 days
  const today = new Date(getTodayMT() + "T00:00:00Z");
  today.setUTCDate(today.getUTCDate() + 6);
  const targetDate = today.toISOString().slice(0, 10);

  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .eq("date", targetDate)
    .maybeSingle();

  if (!dinner) {
    await logSystemEvent({
      event_type: "cron.applied_didnt_convert",
      actor_label: "cron:applied-didnt-convert",
      summary: `applied-didnt-convert ran: no dinner on ${targetDate}`,
      metadata: { outcome: "no_op", target_date: targetDate, reason: "no dinner scheduled +6 days out" },
    });
    return NextResponse.json({ ran: true, sent: 0, target_date: targetDate, reason: "no dinner +6 days out" });
  }

  // Prior dinner: strictly before the upcoming one. If none exists (first ever),
  // fall back to a far-past sentinel so the window covers all approved apps.
  const { data: prior } = await admin
    .from("dinners")
    .select("date")
    .lt("date", dinner.date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const priorDate = prior?.date ?? "1900-01-01";

  // Approved applications in the window. "Approved" == member_id IS NOT NULL
  // (the approval RPC sets member_id; rejection sets reviewed_at without member_id).
  const { data: apps } = await admin
    .from("applications")
    .select("member_id")
    .not("member_id", "is", null)
    .gt("submitted_on", priorDate)
    .lte("submitted_on", dinner.date)
    .range(0, 999);

  const candidateMemberIds = Array.from(new Set((apps ?? []).map((a) => a.member_id as string)));

  if (candidateMemberIds.length === 0) {
    await logSystemEvent({
      event_type: "cron.applied_didnt_convert",
      actor_label: "cron:applied-didnt-convert",
      summary: `applied-didnt-convert ran: no approved apps in window for ${targetDate}`,
      metadata: {
        outcome: "no_op",
        dinner_id: dinner.id,
        dinner_date: targetDate,
        prior_dinner_date: priorDate,
        reason: "no approved apps in window",
      },
    });
    return NextResponse.json({ ran: true, sent: 0, dinner_date: targetDate, reason: "no approved apps in window" });
  }

  // Exclude kicked-out
  const { data: members } = await admin
    .from("members")
    .select("id")
    .in("id", candidateMemberIds)
    .eq("kicked_out", false);

  const activeIds = (members ?? []).map((m) => m.id as string);

  if (activeIds.length === 0) {
    await logSystemEvent({
      event_type: "cron.applied_didnt_convert",
      actor_label: "cron:applied-didnt-convert",
      summary: `applied-didnt-convert ran: no active members in window for ${targetDate}`,
      metadata: { outcome: "no_op", dinner_id: dinner.id, dinner_date: targetDate, prior_dinner_date: priorDate },
    });
    return NextResponse.json({ ran: true, sent: 0, dinner_date: targetDate, reason: "all candidates kicked out" });
  }

  // Exclude anyone holding a ticket (purchased or fulfilled) for this dinner
  const { data: ticketed } = await admin
    .from("tickets")
    .select("member_id")
    .eq("dinner_id", dinner.id)
    .in("fulfillment_status", ["purchased", "fulfilled"])
    .in("member_id", activeIds);

  const ticketedSet = new Set((ticketed ?? []).map((t) => t.member_id as string));
  const recipients = activeIds.filter((id) => !ticketedSet.has(id));

  let sent = 0;
  for (const memberId of recipients) {
    await sendAppliedDidntConvertEmail(memberId);
    sent++;
  }

  await logSystemEvent({
    event_type: "cron.applied_didnt_convert",
    actor_label: "cron:applied-didnt-convert",
    summary: `applied-didnt-convert sent ${sent} for ${targetDate}`,
    metadata: {
      outcome: sent > 0 ? "success" : "no_op",
      dinner_id: dinner.id,
      dinner_date: targetDate,
      prior_dinner_date: priorDate,
      candidates: candidateMemberIds.length,
      active_candidates: activeIds.length,
      ticketed_excluded: ticketedSet.size,
      sent,
    },
  });

  return NextResponse.json({
    ran: true,
    dinner_date: targetDate,
    prior_dinner_date: priorDate,
    sent,
    candidates: candidateMemberIds.length,
    ticketed_excluded: ticketedSet.size,
  });
}
