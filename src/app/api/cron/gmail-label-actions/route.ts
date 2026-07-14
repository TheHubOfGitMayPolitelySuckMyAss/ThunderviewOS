/**
 * Per-minute poll for Gmail label actions (TV Bounce / TV Skip — see
 * src/lib/gmail/label-actions.ts).
 *
 * HEARTBEAT DEVIATION (same as mail-merge-drain): fires 1,440×/day, so it
 * heartbeats (cron.gmail_label_actions) ONLY when it actually processed
 * something — silent when idle or when the Gmail grant predates the
 * gmail.modify scope (not_configured).
 *
 * A thrown error (e.g. token refresh failure) logs error.caught, but at most
 * once per hour — a dead grant would otherwise flood system_events at this
 * cadence. The failure is identical every minute; one row an hour is loud
 * enough.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import { runGmailLabelActions } from "@/lib/gmail/label-actions";

export const maxDuration = 60;

const ERROR_LOG_COOLDOWN_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runGmailLabelActions();

    if (result.outcome === "ran") {
      await logSystemEvent({
        event_type: "cron.gmail_label_actions",
        actor_label: "cron:gmail-label-actions",
        summary: `Gmail label actions: processed ${result.processed}, failed ${result.failed}${result.aborted ? ", aborted" : ""}`,
        metadata: {
          outcome: result.aborted ? "aborted" : "success",
          processed: result.processed,
          failed: result.failed,
        },
      });
    }
    return NextResponse.json({ ran: true, ...result });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    const admin = createAdminClient("cron");
    const since = new Date(Date.now() - ERROR_LOG_COOLDOWN_MS).toISOString();
    const { data: recent } = await admin
      .from("system_events")
      .select("id")
      .eq("event_type", "error.caught")
      .eq("metadata->>context", "cron.gmail_label_actions")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    if (!recent) {
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "cron:gmail-label-actions",
        summary: `gmail-label-actions cron threw: ${error.message.slice(0, 200)}`,
        metadata: {
          context: "cron.gmail_label_actions",
          message: error.message,
          stack: error.stack ?? null,
        },
      });
    }
    return NextResponse.json(
      { ran: true, error: error.message },
      { status: 500 }
    );
  }
}
