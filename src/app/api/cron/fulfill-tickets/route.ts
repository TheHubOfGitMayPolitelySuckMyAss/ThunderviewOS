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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // getTargetDinner uses date >= todayMT, so today's dinner counts as "upcoming"
  const targetDinner = await getTargetDinner("", admin);

  if (!targetDinner) {
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
      console.error(
        `[fulfill-tickets] Email failed for ticket=${ticket.id} member=${ticket.member_id}:`,
        err
      );
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
      dbFailed++;
      continue;
    }

    fulfilled++;
  }

  console.log(
    `[fulfill-tickets] Done for dinner ${targetDinner.date}: fulfilled=${fulfilled} emailFailed=${emailFailed} dbFailed=${dbFailed} total=${tickets.length}`
  );

  return NextResponse.json({
    ran: true,
    fulfilled,
    emailFailed,
    dbFailed,
    dinnerDate: targetDinner.date,
    totalTickets: tickets.length,
  });
}
