/**
 * Vercel Cron: fulfill tickets for the next upcoming dinner.
 *
 * Schedule: fires daily at 14:00 UTC (8am MDT / 7am MST).
 *
 * Uses getTargetDinner() to find the next upcoming dinner (date >= today in MT).
 * Calendar-month gate: only proceeds if the target dinner is in the current
 * or immediately following calendar month (in MT). This handles Jan/Jul skip
 * months — the cron sleeps through Dec 4–31 (next dinner is Feb) and Jun 5–30
 * (next dinner is Aug), and resumes when the calendar rolls over.
 *
 * For each purchased ticket on the target dinner:
 *   1. Send fulfillment email (throwOnError: true)
 *   2. On success: flip ticket to fulfilled
 *   3. On email failure: leave as purchased, log, retry on next run
 *   4. On DB failure after email: log loudly (double-send risk is acceptable)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { getTargetDinner } from "@/lib/ticket-assignment";
import { sendFulfillmentEmail } from "@/lib/email-send";
import { logSystemEvent } from "@/lib/system-events";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runFulfillTickets();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:fulfill-tickets",
      summary: `fulfill-tickets cron threw: ${error.message}`,
      metadata: {
        context: "cron.fulfill_tickets",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

async function runFulfillTickets() {
  const admin = createAdminClient("cron");

  // getTargetDinner uses date >= todayMT, so today's dinner counts as "upcoming"
  const targetDinner = await getTargetDinner("", admin);

  if (!targetDinner) {
    await logSystemEvent({
      event_type: "cron.fulfill_tickets",
      actor_label: "cron:fulfill-tickets",
      summary: "fulfill-tickets ran: no upcoming dinner",
      metadata: { outcome: "no_op", fulfilled: 0, reason: "no upcoming dinner found" },
    });
    return NextResponse.json({
      ran: true,
      fulfilled: 0,
      reason: "no upcoming dinner found",
    });
  }

  // Calendar-month gate: target dinner must be in this month or next month (MT)
  const todayMT = getTodayMT();
  const todayDate = new Date(todayMT + "T00:00:00Z");
  const todayYear = todayDate.getUTCFullYear();
  const todayMonth = todayDate.getUTCMonth(); // 0-indexed

  const dinnerDate = new Date(targetDinner.date + "T00:00:00Z");
  const dinnerYear = dinnerDate.getUTCFullYear();
  const dinnerMonth = dinnerDate.getUTCMonth();

  // Calculate months difference
  const monthsDiff = (dinnerYear - todayYear) * 12 + (dinnerMonth - todayMonth);

  if (monthsDiff > 1) {
    console.log(
      `[fulfill-tickets] Target dinner ${targetDinner.date} is ${monthsDiff} months out — skipping (skip-month gate)`
    );
    await logSystemEvent({
      event_type: "cron.fulfill_tickets",
      actor_label: "cron:fulfill-tickets",
      summary: `fulfill-tickets ran: outside gate (${monthsDiff} months out)`,
      metadata: {
        outcome: "no_op",
        fulfilled: 0,
        reason: "outside gate",
        dinner_id: targetDinner.id,
        dinner_date: targetDinner.date,
        months_out: monthsDiff,
      },
    });
    return NextResponse.json({
      ran: true,
      fulfilled: 0,
      reason: `dinner ${targetDinner.date} is ${monthsDiff} months out — outside gate`,
    });
  }

  // Select purchased tickets for the target dinner (.range for 1k cap safety)
  const { data: tickets } = await admin
    .from("tickets")
    .select("id, member_id")
    .eq("dinner_id", targetDinner.id)
    .eq("fulfillment_status", "purchased")
    .range(0, 999);

  if (!tickets || tickets.length === 0) {
    await logSystemEvent({
      event_type: "cron.fulfill_tickets",
      actor_label: "cron:fulfill-tickets",
      summary: `fulfill-tickets ran: no purchased tickets for ${targetDinner.date}`,
      metadata: {
        outcome: "no_op",
        fulfilled: 0,
        reason: "no purchased tickets",
        dinner_id: targetDinner.id,
        dinner_date: targetDinner.date,
      },
    });
    return NextResponse.json({
      ran: true,
      fulfilled: 0,
      reason: "no purchased tickets for target dinner",
      dinnerDate: targetDinner.date,
    });
  }

  let fulfilled = 0;
  let emailFailed = 0;
  let dbFailed = 0;
  const now = new Date().toISOString();

  for (const ticket of tickets) {
    // Step 1: Send email first
    try {
      await sendFulfillmentEmail(ticket.member_id, targetDinner.id, { throwOnError: true });
    } catch (err) {
      // Email failed — leave ticket as purchased, will retry on next run
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[fulfill-tickets] Email failed for ticket=${ticket.id} member=${ticket.member_id}:`,
        err
      );
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "cron:fulfill-tickets",
        summary: `fulfill-tickets: email send failed for ticket ${ticket.id}`,
        metadata: {
          context: "cron.fulfill_tickets",
          cause: "fulfillment_email_failed",
          message,
          ticket_id: ticket.id,
          member_id: ticket.member_id,
          dinner_id: targetDinner.id,
          dinner_date: targetDinner.date,
        },
      });
      emailFailed++;
      continue;
    }

    // Step 2: Flip ticket to fulfilled
    const { error } = await admin
      .from("tickets")
      .update({
        fulfillment_status: "fulfilled",
        fulfilled_at: now,
      })
      .eq("id", ticket.id);

    if (error) {
      // Email sent but DB update failed — double-send risk on next run.
      // Log loudly so this is visible, not silent.
      console.error(
        `[fulfill-tickets] CRITICAL: Email sent but DB update failed for ticket=${ticket.id} member=${ticket.member_id}:`,
        error.message
      );
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "cron:fulfill-tickets",
        summary: `fulfill-tickets: email sent but DB update failed for ticket ${ticket.id}`,
        metadata: {
          context: "cron.fulfill_tickets",
          cause: "ticket_fulfill_update_failed_after_email",
          severity: "critical",
          message: error.message,
          code: error.code ?? null,
          ticket_id: ticket.id,
          member_id: ticket.member_id,
          dinner_id: targetDinner.id,
          dinner_date: targetDinner.date,
        },
      });
      dbFailed++;
      continue;
    }

    fulfilled++;
  }

  console.log(
    `[fulfill-tickets] Done for dinner ${targetDinner.date}: fulfilled=${fulfilled} emailFailed=${emailFailed} dbFailed=${dbFailed} total=${tickets.length}`
  );

  await logSystemEvent({
    event_type: "cron.fulfill_tickets",
    actor_label: "cron:fulfill-tickets",
    summary: `fulfill-tickets ran: ${fulfilled} fulfilled for ${targetDinner.date}`,
    metadata: {
      fulfilled,
      email_failed: emailFailed,
      db_failed: dbFailed,
      total_tickets: tickets.length,
      dinner_id: targetDinner.id,
      dinner_date: targetDinner.date,
    },
  });

  return NextResponse.json({
    ran: true,
    fulfilled,
    emailFailed,
    dbFailed,
    dinnerDate: targetDinner.date,
    totalTickets: tickets.length,
  });
}
