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
import { logSystemEvent } from "@/lib/system-events";
import { safePushMember } from "@/lib/streak/safe-push";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runPostDinner();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:post-dinner",
      summary: `post-dinner cron threw: ${error.message}`,
      metadata: {
        context: "cron.post_dinner",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

async function runPostDinner() {
  // Yesterday in Mountain Time
  const today = getTodayMT();
  const yesterday = new Date(today + "T00:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const admin = createAdminClient("cron");

  // Check if yesterday was a dinner
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .eq("date", yesterdayStr)
    .single();

  if (!dinner) {
    await logSystemEvent({
      event_type: "cron.post_dinner",
      actor_label: "cron:post-dinner",
      summary: `post-dinner ran: no dinner ${yesterdayStr}`,
      metadata: { outcome: "no_op", updated: 0, reason: "no dinner yesterday", yesterday: yesterdayStr },
    });
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
    await logSystemEvent({
      event_type: "cron.post_dinner",
      actor_label: "cron:post-dinner",
      summary: `post-dinner ran: no fulfilled tickets for ${dinner.date}`,
      metadata: {
        outcome: "no_op",
        updated: 0,
        reason: "no fulfilled tickets",
        dinner_id: dinner.id,
        dinner_date: dinner.date,
      },
    });
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
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:post-dinner",
      summary: `post-dinner update failed: ${error.message}`,
      metadata: {
        context: "cron.post_dinner",
        message: error.message,
        dinner_id: dinner.id,
        dinner_date: dinner.date,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }

  console.log(`[post-dinner] Updated ${count} members for dinner ${dinner.date}`);

  // Push attended members to Streak — last_dinner_attended changed, which
  // bumps them from has_ticket → attended (or no-op if precedence higher).
  for (const memberId of memberIds) {
    await safePushMember(memberId, "post_dinner_attended");
  }

  // Not This One cleanup: any member who marked Not This One for the dinner
  // that just happened gets their exclusion cleared (the dinner has passed,
  // so "not this one" no longer applies). Push each so Streak reflects the
  // post-clearance state.
  const { data: excluded } = await admin
    .from("members")
    .select("id")
    .eq("excluded_from_dinner_id", dinner.id);

  const excludedIds = (excluded ?? []).map((m) => m.id);
  let ntoCleared = 0;

  if (excludedIds.length > 0) {
    const { error: clearError } = await admin
      .from("members")
      .update({ excluded_from_dinner_id: null })
      .in("id", excludedIds);

    if (clearError) {
      // Log but don't fail the cron — attendance update already succeeded.
      console.error(`[post-dinner] NTO clear error: ${clearError.message}`);
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "cron:post-dinner",
        summary: `post-dinner NTO clear failed: ${clearError.message}`,
        metadata: {
          context: "cron.post_dinner",
          cause: "nto_clear_failed",
          message: clearError.message,
          dinner_id: dinner.id,
          dinner_date: dinner.date,
        },
      });
    } else {
      ntoCleared = excludedIds.length;
      for (const memberId of excludedIds) {
        await safePushMember(memberId, "post_dinner_not_this_one_clear");
      }
    }
  }

  await logSystemEvent({
    event_type: "cron.post_dinner",
    actor_label: "cron:post-dinner",
    summary: `post-dinner ran: updated ${count} members for ${dinner.date}`,
    metadata: {
      outcome: "success",
      updated: count,
      dinner_id: dinner.id,
      dinner_date: dinner.date,
      member_count: memberIds.length,
      streak_attendance_pushes: memberIds.length,
      streak_nto_cleared: ntoCleared,
    },
  });
  return NextResponse.json({
    ran: true,
    updated: count,
    dinnerDate: dinner.date,
    memberCount: memberIds.length,
    streakAttendancePushes: memberIds.length,
    streakNtoCleared: ntoCleared,
  });
}
