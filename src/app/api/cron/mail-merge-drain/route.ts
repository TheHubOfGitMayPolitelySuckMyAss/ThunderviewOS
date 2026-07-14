/**
 * Per-minute drain for mail-merge send queues.
 *
 * The send action pushes the first chunk out immediately (after()); this cron
 * finishes the job and auto-resumes any merge stranded by a crash or deploy.
 * Overlap with an in-flight after() drain is safe — recipients are claimed
 * atomically (see claim_mail_merge_recipient / drain.ts).
 *
 * HEARTBEAT DEVIATION: unlike the daily crons, this fires 1,440×/day, so the
 * every-fire-emits-a-row convention would flood system_events. It heartbeats
 * (cron.mail_merge_drain) ONLY when at least one merge is in 'sending' —
 * silent when idle.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import { runMailMergeDrain } from "@/lib/mail-merge/drain";

// Budget 45s of sending per fire; the next fire picks up a minute later.
const DRAIN_BUDGET_MS = 45_000;

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient("cron");
    const { count } = await admin
      .from("mail_merges")
      .select("id", { count: "exact", head: true })
      .eq("status", "sending");

    if (!count) {
      return NextResponse.json({ ran: true, outcome: "idle" });
    }

    const result = await runMailMergeDrain(DRAIN_BUDGET_MS);
    await logSystemEvent({
      event_type: "cron.mail_merge_drain",
      actor_label: "cron:mail-merge-drain",
      summary: `mail-merge drain: sent ${result.processed}, failed ${result.failed}${result.fatal ? ", aborted" : ""}`,
      metadata: {
        outcome: result.fatal ? "aborted" : "success",
        sent: result.processed,
        failed: result.failed,
        fatal: result.fatal,
      },
    });
    return NextResponse.json({ ran: true, ...result });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:mail-merge-drain",
      summary: `mail-merge-drain cron threw: ${error.message}`,
      metadata: {
        context: "cron.mail_merge_drain",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json(
      { ran: true, error: error.message },
      { status: 500 }
    );
  }
}
