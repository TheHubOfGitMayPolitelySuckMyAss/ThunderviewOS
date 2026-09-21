/**
 * Vercel Cron: "Known Quantity attendee CSV" — fires daily, no-ops unless
 * YESTERDAY (America/Denver) was a dinner date. Dinners are monthly, so in
 * practice this uploads once a month, the morning after each dinner.
 *
 * On firing day it builds a CSV of the last 90 days of dinner attendees (one
 * row per person, most recent details) and POSTs it to the tokenised KQ
 * intake URL. See `src/lib/known-quantity-csv.ts` for the file's shape and
 * the reason "attendee" means "held a fulfilled ticket."
 *
 * Testing knobs (both require the CRON_SECRET bearer):
 *   ?force=1  run regardless of whether yesterday was a dinner
 *   ?dry=1    build the CSV and report counts, upload nothing
 *
 * A 200 from KQ means the file is stored, NOT that anyone is in the CRM.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { logSystemEvent } from "@/lib/system-events";
import {
  CSV_COLUMNS,
  WINDOW_DAYS,
  collectAttendees,
  subtractDays,
  toCsv,
  uploadCsv,
} from "@/lib/known-quantity-csv";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const dry = url.searchParams.get("dry") === "1";

  try {
    return await runKnownQuantityCsv({ force, dry });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:known-quantity-csv",
      summary: `known-quantity-csv threw: ${error.message}`,
      metadata: {
        context: "cron.known_quantity_csv",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

async function runKnownQuantityCsv({
  force,
  dry,
}: {
  force: boolean;
  dry: boolean;
}) {
  const admin = createAdminClient("cron");
  const today = getTodayMT();
  const yesterday = subtractDays(today, 1);

  const { data: dinner, error: dinnerError } = await admin
    .from("dinners")
    .select("id, date")
    .eq("date", yesterday)
    .maybeSingle();
  if (dinnerError) {
    throw new Error(`dinner lookup failed: ${dinnerError.message}`);
  }

  if (!dinner && !force) {
    await logSystemEvent({
      event_type: "cron.known_quantity_csv",
      actor_label: "cron:known-quantity-csv",
      summary: `known-quantity-csv ran: no dinner on ${yesterday}`,
      metadata: {
        outcome: "no_op",
        checked_date: yesterday,
        reason: "yesterday was not a dinner",
      },
    });
    return NextResponse.json({
      ran: true,
      checked_date: yesterday,
      reason: "yesterday was not a dinner",
    });
  }

  const collected = await collectAttendees(admin, today);
  const csv = toCsv(collected.rows);

  if (dry) {
    return NextResponse.json({
      ran: true,
      dry: true,
      window_days: WINDOW_DAYS,
      window_start: collected.windowStart,
      window_end: collected.windowEnd,
      dinners_in_window: collected.dinnerDates,
      row_count: collected.rows.length,
      rows_without_email: collected.rowsWithoutEmail,
      skipped_unidentifiable: collected.skippedUnidentifiable,
      columns: CSV_COLUMNS,
      bytes: Buffer.byteLength(csv, "utf8"),
    });
  }

  if (collected.rows.length === 0) {
    // KQ rejects an empty file with a 400. Nothing to say, so say nothing.
    await logSystemEvent({
      event_type: "cron.known_quantity_csv",
      actor_label: "cron:known-quantity-csv",
      summary: `known-quantity-csv ran: no attendees in the ${WINDOW_DAYS}-day window`,
      metadata: {
        outcome: "no_op",
        dinner_date: dinner?.date ?? null,
        window_start: collected.windowStart,
        window_end: collected.windowEnd,
        reason: "no attendees in window",
      },
    });
    return NextResponse.json({
      ran: true,
      uploaded: false,
      reason: "no attendees in window",
    });
  }

  const result = await uploadCsv(csv, collected.rows.length);

  if (!result.ok) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:known-quantity-csv",
      summary: `known-quantity-csv upload failed with ${result.status}`,
      metadata: {
        context: "cron.known_quantity_csv",
        cause: "upload_failed",
        status: result.status,
        response: result.body,
        row_count: collected.rows.length,
      },
    });
    return NextResponse.json(
      { ran: true, uploaded: false, status: result.status, response: result.body },
      { status: 500 },
    );
  }

  // Stored, but check that what they parsed is what we meant to send.
  if (result.rowCountMismatch || result.columnMismatch) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:known-quantity-csv",
      summary: result.rowCountMismatch
        ? `known-quantity-csv stored, but KQ parsed ${result.body?.rows} rows for ${collected.rows.length} sent`
        : "known-quantity-csv stored, but KQ parsed a different header",
      metadata: {
        context: "cron.known_quantity_csv",
        cause: result.rowCountMismatch ? "row_count_mismatch" : "column_mismatch",
        sent_rows: collected.rows.length,
        parsed_rows: result.body?.rows ?? null,
        sent_columns: CSV_COLUMNS,
        parsed_columns: result.body?.columns ?? null,
        upload_id: result.body?.id ?? null,
      },
    });
  }

  await logSystemEvent({
    event_type: "cron.known_quantity_csv",
    actor_label: "cron:known-quantity-csv",
    summary: `known-quantity-csv uploaded ${collected.rows.length} attendee(s) for ${collected.windowStart}..${collected.windowEnd}`,
    metadata: {
      outcome:
        result.rowCountMismatch || result.columnMismatch ? "parse_mismatch" : "success",
      dinner_date: dinner?.date ?? null,
      forced: force,
      window_start: collected.windowStart,
      window_end: collected.windowEnd,
      dinners_in_window: collected.dinnerDates,
      row_count: collected.rows.length,
      rows_without_email: collected.rowsWithoutEmail,
      skipped_unidentifiable: collected.skippedUnidentifiable,
      parsed_rows: result.body?.rows ?? null,
      upload_id: result.body?.id ?? null,
    },
  });

  return NextResponse.json({
    ran: true,
    uploaded: true,
    window_start: collected.windowStart,
    window_end: collected.windowEnd,
    row_count: collected.rows.length,
    parsed_rows: result.body?.rows ?? null,
    upload_id: result.body?.id ?? null,
  });
}
