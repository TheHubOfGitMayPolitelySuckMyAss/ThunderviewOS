/**
 * Vercel Cron: "Prompt for Intro/Ask" — fires daily, no-ops unless a dinner
 * is scheduled exactly 2 days out (in America/Denver). On firing day:
 *   - Pull every ticketed member for that dinner (fulfillment_status IN
 *     ('purchased', 'fulfilled')).
 *   - Bucket each member:
 *       * missing  → BOTH current_intro AND current_ask are NULL/empty
 *       * stale    → both filled, but ask_updated_at <= last_dinner_attended
 *                    (same definition as the portal home prefill rule)
 *       * skip     → has fresh ask
 *   - Send the matching template per recipient via sendPromptIntroAskEmail.
 *
 * Per-recipient throwOnError is false so one bad send doesn't take down the
 * batch; each individual failure logs error.caught via the helper.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { sendPromptIntroAskEmail } from "@/lib/email-send";
import { logSystemEvent } from "@/lib/system-events";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runPromptIntroAsk();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:prompt-intro-ask",
      summary: `prompt-intro-ask cron threw: ${error.message}`,
      metadata: {
        context: "cron.prompt_intro_ask",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

function isBlank(v: string | null | undefined): boolean {
  return !v || v.trim() === "";
}

async function runPromptIntroAsk() {
  const admin = createAdminClient("cron");

  // Target date = today MT + 2 days
  const today = new Date(getTodayMT() + "T00:00:00Z");
  today.setUTCDate(today.getUTCDate() + 2);
  const targetDate = today.toISOString().slice(0, 10);

  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .eq("date", targetDate)
    .maybeSingle();

  if (!dinner) {
    await logSystemEvent({
      event_type: "cron.prompt_intro_ask",
      actor_label: "cron:prompt-intro-ask",
      summary: `prompt-intro-ask ran: no dinner on ${targetDate}`,
      metadata: { outcome: "no_op", target_date: targetDate, reason: "no dinner scheduled +2 days out" },
    });
    return NextResponse.json({ ran: true, sent: 0, target_date: targetDate, reason: "no dinner +2 days out" });
  }

  // Ticketed members for the target dinner. fulfillment_status IN
  // ('purchased', 'fulfilled') — both count as "has a ticket." Refunds zero
  // the row out via the refund flow.
  const { data: tickets } = await admin
    .from("tickets")
    .select("member_id")
    .eq("dinner_id", dinner.id)
    .in("fulfillment_status", ["purchased", "fulfilled"])
    .range(0, 999);

  const ticketedMemberIds = Array.from(new Set((tickets ?? []).map((t) => t.member_id as string)));

  if (ticketedMemberIds.length === 0) {
    await logSystemEvent({
      event_type: "cron.prompt_intro_ask",
      actor_label: "cron:prompt-intro-ask",
      summary: `prompt-intro-ask ran: no ticketed members for ${targetDate}`,
      metadata: { outcome: "no_op", dinner_id: dinner.id, dinner_date: targetDate, reason: "no ticketed members" },
    });
    return NextResponse.json({ ran: true, sent: 0, dinner_date: targetDate, reason: "no ticketed members" });
  }

  const { data: members } = await admin
    .from("members")
    .select("id, current_intro, current_ask, ask_updated_at, last_dinner_attended")
    .in("id", ticketedMemberIds);

  let sentMissing = 0;
  let sentStale = 0;
  let skipped = 0;
  for (const m of members ?? []) {
    const intro = m.current_intro as string | null;
    const ask = m.current_ask as string | null;
    const askUpdatedAt = m.ask_updated_at as string | null;
    const lastDinner = m.last_dinner_attended as string | null;

    let situation: "missing" | "stale" | null = null;
    if (isBlank(intro) && isBlank(ask)) {
      situation = "missing";
    } else if (!isBlank(intro) && !isBlank(ask)) {
      // Stale = ask hasn't been updated since the last dinner they attended.
      // Members who have never attended (lastDinner is null) and have a
      // filled ask are NOT stale — leave them alone.
      if (lastDinner && (!askUpdatedAt || askUpdatedAt <= lastDinner)) {
        situation = "stale";
      }
    }
    // Else: intro xor ask filled — treat as "current enough," don't bug them.

    if (!situation) {
      skipped++;
      continue;
    }

    await sendPromptIntroAskEmail(m.id as string, dinner.id, situation);
    if (situation === "missing") sentMissing++;
    else sentStale++;
  }

  await logSystemEvent({
    event_type: "cron.prompt_intro_ask",
    actor_label: "cron:prompt-intro-ask",
    summary: `prompt-intro-ask sent ${sentMissing + sentStale} (missing=${sentMissing}, stale=${sentStale}) for ${targetDate}`,
    metadata: {
      outcome: sentMissing + sentStale > 0 ? "success" : "no_op",
      dinner_id: dinner.id,
      dinner_date: targetDate,
      ticketed_count: ticketedMemberIds.length,
      sent_missing: sentMissing,
      sent_stale: sentStale,
      skipped,
    },
  });

  return NextResponse.json({
    ran: true,
    dinner_date: targetDate,
    sent_missing: sentMissing,
    sent_stale: sentStale,
    skipped,
  });
}
