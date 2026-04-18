/**
 * Vercel Cron: auto-generate dinner dates 12 months out.
 *
 * Schedule: fires daily at 1pm UTC (7am MT / 6am MDT) via vercel.json.
 * The handler checks whether today (in America/Denver) is "the day after
 * the first Thursday" of the current month. If not, it exits immediately.
 * This daily-fire-with-logic pattern is the standard Vercel Cron workaround
 * for schedules that aren't expressible in cron syntax.
 *
 * When it IS the right day:
 *   1. Compute the target month = today + 12 calendar months
 *   2. If target month is January or July → skip (off months)
 *   3. Otherwise, compute first Thursday of target month
 *   4. INSERT INTO dinners ON CONFLICT DO NOTHING
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT, firstThursdayOf } from "@/lib/format";

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Today in Mountain Time
  const today = getTodayMT(); // YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = today.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);

  // Is today the day after the first Thursday of this month?
  const firstThurs = firstThursdayOf(year, month);
  const firstThursDay = parseInt(firstThurs.split("-")[2]);
  const dayAfterFirstThurs = firstThursDay + 1;

  if (day !== dayAfterFirstThurs) {
    console.log(
      `[generate-dinner] Not scheduled day. Today=${today}, first Thursday=${firstThurs}, day after=${dayAfterFirstThurs}`
    );
    return NextResponse.json({
      ran: false,
      reason: "not scheduled day",
      today,
      firstThursday: firstThurs,
    });
  }

  // Compute target month: 12 calendar months from now
  let targetMonth = month + 12;
  let targetYear = year;
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }

  // Skip January (1) and July (7)
  if (targetMonth === 1 || targetMonth === 7) {
    console.log(
      `[generate-dinner] Skip month. Target=${targetYear}-${String(targetMonth).padStart(2, "0")}`
    );
    return NextResponse.json({
      ran: true,
      skipped: true,
      reason: "skip month",
      targetMonth: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
    });
  }

  // Compute first Thursday of target month
  const targetDate = firstThursdayOf(targetYear, targetMonth);

  // Insert with conflict guard
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dinners")
    .upsert({ date: targetDate }, { onConflict: "date", ignoreDuplicates: true })
    .select("date")
    .single();

  if (error) {
    console.error(`[generate-dinner] Insert error: ${error.message}`);
    return NextResponse.json(
      { ran: true, error: error.message },
      { status: 500 }
    );
  }

  console.log(`[generate-dinner] Inserted dinner: ${targetDate}`);
  return NextResponse.json({
    ran: true,
    inserted: data?.date ?? null,
    targetDate,
  });
}
