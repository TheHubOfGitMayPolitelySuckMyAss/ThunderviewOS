/**
 * Vercel Cron: fulfill tickets ~27 days before each dinner.
 *
 * Schedule: fires daily at 1pm UTC.
 * Finds all dinners happening in exactly 27 days (in Mountain Time).
 * For each, flips all `purchased` tickets to `fulfilled` and sends
 * the fulfillment email (dinner details).
 *
 * Tickets for the next-upcoming dinner are already auto-fulfilled at
 * purchase time (Stripe webhook). This cron handles tickets for dinners
 * further in the future that were purchased early.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { sendFulfillmentEmail } from "@/lib/email-send";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayMT();
  // Compute the date 27 days from now
  const targetDate = new Date(today + "T00:00:00");
  targetDate.setDate(targetDate.getDate() + 27);
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  const admin = createAdminClient();

  // Find dinner on the target date
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .eq("date", targetDateStr)
    .single();

  if (!dinner) {
    return NextResponse.json({
      ran: true,
      fulfilled: 0,
      reason: "no dinner in 27 days",
      targetDate: targetDateStr,
    });
  }

  // Find all purchased (not yet fulfilled) tickets for that dinner
  const { data: tickets } = await admin
    .from("tickets")
    .select("id, member_id")
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "purchased");

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({
      ran: true,
      fulfilled: 0,
      reason: "no purchased tickets for this dinner",
      dinnerDate: dinner.date,
    });
  }

  let fulfilled = 0;
  const now = new Date().toISOString();

  for (const ticket of tickets) {
    const { error } = await admin
      .from("tickets")
      .update({
        fulfillment_status: "fulfilled",
        fulfilled_at: now,
      })
      .eq("id", ticket.id);

    if (error) {
      console.error(`[fulfill-tickets] Failed to fulfill ticket ${ticket.id}:`, error.message);
      continue;
    }

    // Send fulfillment email
    sendFulfillmentEmail(ticket.member_id, dinner.id);
    fulfilled++;
  }

  console.log(`[fulfill-tickets] Fulfilled ${fulfilled} tickets for dinner ${dinner.date}`);
  return NextResponse.json({
    ran: true,
    fulfilled,
    dinnerDate: dinner.date,
    totalTickets: tickets.length,
  });
}
