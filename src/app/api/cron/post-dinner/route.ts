/**
 * Vercel Cron: post-dinner updates.
 *
 * Schedule: fires daily at 1pm UTC (same as generate-dinner).
 * Checks if yesterday (in America/Denver) was a dinner date.
 * If yes, updates last_dinner_attended for all members who had a
 * fulfilled ticket for that dinner.
 *
 * This replaces the previous approach of setting last_dinner_attended
 * in the fulfillment trigger (which could set it to a future date).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Yesterday in Mountain Time
  const today = getTodayMT();
  const yesterday = new Date(today + "T00:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const admin = createAdminClient();

  // Check if yesterday was a dinner
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .eq("date", yesterdayStr)
    .single();

  if (!dinner) {
    return NextResponse.json({
      ran: true,
      updated: 0,
      reason: "no dinner yesterday",
      yesterday: yesterdayStr,
    });
  }

  // Get all members with fulfilled tickets for that dinner
  const { data: tickets } = await admin
    .from("tickets")
    .select("member_id")
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled");

  const memberIds = [...new Set((tickets ?? []).map((t) => t.member_id).filter(Boolean))];

  if (memberIds.length === 0) {
    return NextResponse.json({
      ran: true,
      updated: 0,
      reason: "no fulfilled tickets for yesterday's dinner",
      dinnerDate: dinner.date,
    });
  }

  // Update last_dinner_attended for each member (only if this dinner is later)
  const { error, count } = await admin
    .from("members")
    .update({ last_dinner_attended: dinner.date })
    .in("id", memberIds)
    .or(`last_dinner_attended.is.null,last_dinner_attended.lt.${dinner.date}`);

  if (error) {
    console.error(`[post-dinner] Update error: ${error.message}`);
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }

  console.log(`[post-dinner] Updated ${count} members for dinner ${dinner.date}`);
  return NextResponse.json({
    ran: true,
    updated: count,
    dinnerDate: dinner.date,
    memberCount: memberIds.length,
  });
}
