/**
 * Mail-merge send queue drain.
 *
 * Two invokers share this: the send server action (via next/server after(),
 * so the first chunk goes out the moment Eric clicks Send) and the per-minute
 * /api/cron/mail-merge-drain (which finishes the job and auto-resumes any
 * merge stranded by a crash or deploy). Overlap between the two is safe: each
 * recipient is claimed atomically via claim_mail_merge_recipient_throttled()
 * (FOR UPDATE SKIP LOCKED), so a row can never be sent twice.
 *
 * Pacing: MAIL_MERGE_SENDS_PER_MINUTE (pacing.ts) per rolling 60s across all
 * merges. The claim RPC enforces the cap atomically (advisory lock + count of
 * claims in the last minute), so the inline drain and a cron fire landing in
 * the same minute can't add up to more than one minute's allotment. Each run
 * claims at most that allotment, spaced MAIL_MERGE_SEND_SPACING_MS apart, then
 * exits; the per-minute cron carries the rest. 500 recipients ≈ 100 minutes.
 * (Was ~1/sec until 2026-09-27: a 500-person burst in 9 minutes from one
 * personal mailbox is the bulk-sender pattern the filters punish.)
 *
 * Failure model (loud, never silent):
 *   - Recipient-specific send error → row 'failed' + error.caught, drain
 *     continues.
 *   - Fatal error (revoked grant, missing scope, daily quota) → row released
 *     back to 'pending' (the send did NOT happen), one error.caught, drain
 *     aborts. Cron retries next minute; if the grant is dead it aborts again
 *     (one claim, zero sends) until Eric reconnects Gmail.
 *   - Crash mid-send → row stuck 'processing'; the reaper marks it 'failed
 *     (stalled)' after 30 min rather than retrying, because the crash window
 *     includes "Gmail accepted, we died before recording it" and a retry
 *     could double-send. Claim-one keeps that limbo to ≤1 row per crash.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import { getAccessToken } from "@/lib/gmail/auth";
import {
  buildRawMessage,
  escapeHtml,
  getPrimarySendAs,
  sendMessage,
  GmailFatalError,
  type SendAsIdentity,
} from "@/lib/gmail/send";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { resolveSenderFromName } from "@/lib/gmail/sender-name";
import {
  MAIL_MERGE_SENDS_PER_MINUTE,
  MAIL_MERGE_SEND_SPACING_MS,
} from "@/lib/mail-merge/pacing";

const STALL_MS = 30 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RecipientRow = {
  id: string;
  mail_merge_id: string;
  member_id: string;
  first_name: string;
  email: string | null;
};

type MergeContent = { subject: string; body: string; sent_by: string | null };

/**
 * Personalize the typed body: substitute [member.first_name] (same placeholder
 * syntax as the transactional templates — Eric writes his own greeting) and
 * strip trailing empty paragraphs/breaks so the signature lands exactly one
 * blank line below the last line of text. The signature itself is appended by
 * buildRawMessage.
 */
export function composeMergeHtml(firstName: string, bodyHtml: string): string {
  const personalized = bodyHtml.replace(
    /\[member\.first_name\]/g,
    escapeHtml(firstName)
  );
  return personalized.replace(
    /(?:<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>|\s)+$/gi,
    ""
  );
}

/**
 * One drain run: at most one minute's allotment, spaced out. Returns when the
 * allotment is spent, the rolling-minute cap is hit (another drainer already
 * sent), or the queue is empty.
 */
export async function runMailMergeDrain(): Promise<{
  processed: number;
  failed: number;
  fatal: string | null;
}> {
  const admin = createAdminClient("system-internal");
  let processed = 0;
  let failed = 0;
  let fatal: string | null = null;

  // Reap stalled claims (crashed run) before doing new work.
  const { data: stalled } = await admin
    .from("mail_merge_recipients")
    .update({
      status: "failed",
      error:
        "stalled: claimed but never resolved (crashed mid-send; not retried automatically to avoid a possible double-send)",
    })
    .eq("status", "processing")
    .lt("claimed_at", new Date(Date.now() - STALL_MS).toISOString())
    .select("id, mail_merge_id");
  for (const row of stalled ?? []) {
    failed += 1;
    await logSystemEvent({
      event_type: "error.caught",
      summary: "Mail merge recipient stalled in 'processing'; marked failed",
      metadata: {
        source: "mail_merge_drain",
        cause: "stalled_claim",
        recipient_id: row.id,
        mail_merge_id: row.mail_merge_id,
      },
    });
  }

  // Lazy Gmail setup: only pay for (and only fail on) token + signature work
  // when there is actually a claim to send.
  let sendAs: SendAsIdentity | null = null;
  let fromName: string | null = null;
  let accessToken: string | null = null;
  const mergeCache = new Map<string, MergeContent>();

  for (let attempt = 0; attempt < MAIL_MERGE_SENDS_PER_MINUTE; attempt++) {
    // Spread the allotment across the run instead of bursting it.
    if (attempt > 0) await sleep(MAIL_MERGE_SEND_SPACING_MS);

    const { data: claimed, error: claimError } = await admin
      .rpc("claim_mail_merge_recipient_throttled", {
        p_per_minute: MAIL_MERGE_SENDS_PER_MINUTE,
      })
      .maybeSingle<RecipientRow>();
    if (claimError) {
      fatal = `claim failed: ${claimError.message}`;
      break;
    }
    // Queue drained, or this minute's allotment is already spent (possibly by
    // an overlapping drainer). Either way the next cron fire picks it up.
    if (!claimed) break;

    // One-time Gmail setup, inside the loop so an idle drain never errors.
    if (!accessToken || !sendAs) {
      try {
        accessToken = await getAccessToken();
        sendAs = await getPrimarySendAs(accessToken);
        if (!sendAs) throw new Error("could not load Gmail send-as identity");
        if (!sendAs.signature) {
          throw new Error(
            "Gmail signature is empty — merges require Eric's sig; configure it in Gmail settings"
          );
        }
        // Name of whoever owns the connected account. The send-start action
        // already warned if it resolves to nothing, so stay quiet here.
        fromName = await resolveSenderFromName(sendAs, {
          warn: false,
          context: "mail_merge_drain",
        });
      } catch (err) {
        fatal = err instanceof Error ? err.message : String(err);
        await releaseClaim(admin, claimed.id);
        break;
      }
    }

    if (!claimed.email) {
      // Shouldn't occur (no-email members are frozen as 'skipped'), but if it
      // does, record it rather than crash.
      await admin
        .from("mail_merge_recipients")
        .update({ status: "skipped", error: "no email address on row" })
        .eq("id", claimed.id);
      continue;
    }

    let merge = mergeCache.get(claimed.mail_merge_id);
    if (!merge) {
      const { data, error } = await admin
        .from("mail_merges")
        .select("subject, body, sent_by")
        .eq("id", claimed.mail_merge_id)
        .single();
      if (error || !data) {
        fatal = `merge ${claimed.mail_merge_id} unreadable: ${error?.message}`;
        await releaseClaim(admin, claimed.id);
        break;
      }
      merge = data;
      mergeCache.set(claimed.mail_merge_id, merge);
    }

    const raw = buildRawMessage({
      to: claimed.email,
      fromEmail: sendAs.email,
      fromName,
      subject: merge.subject,
      bodyHtml: composeMergeHtml(claimed.first_name, merge.body),
      signatureHtml: sendAs.signature,
      // Bulk send → one-click unsubscribe header (RFC 8058). Same endpoint
      // and token as the Resend marketing emails; no visible footer.
      listUnsubscribeUrl: buildUnsubscribeUrl(claimed.member_id),
    });

    try {
      const result = await sendMessage(accessToken, raw);
      await admin
        .from("mail_merge_recipients")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          gmail_message_id: result.id,
        })
        .eq("id", claimed.id);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof GmailFatalError) {
        // Send did not happen (non-2xx) — release for retry once the
        // underlying auth/quota problem is fixed.
        fatal = message;
        await releaseClaim(admin, claimed.id);
        break;
      }
      failed += 1;
      await admin
        .from("mail_merge_recipients")
        .update({ status: "failed", error: message.slice(0, 1000) })
        .eq("id", claimed.id);
      await logSystemEvent({
        event_type: "error.caught",
        subject_member_id: claimed.member_id,
        summary: `Mail merge send failed for ${claimed.email}`,
        metadata: {
          source: "mail_merge_drain",
          cause: "send_failed",
          recipient_id: claimed.id,
          mail_merge_id: claimed.mail_merge_id,
          message: message.slice(0, 500),
        },
      });
    }
  }

  if (fatal) {
    await logSystemEvent({
      event_type: "error.caught",
      summary: `Mail merge drain aborted: ${fatal.slice(0, 200)}`,
      metadata: { source: "mail_merge_drain", cause: "drain_aborted", message: fatal.slice(0, 500) },
    });
  }

  await finalizeCompletedMerges(admin);

  return { processed, failed, fatal };
}

async function releaseClaim(
  admin: ReturnType<typeof createAdminClient>,
  recipientId: string
): Promise<void> {
  await admin
    .from("mail_merge_recipients")
    .update({ status: "pending", claimed_at: null })
    .eq("id", recipientId);
}

/**
 * Flip any 'sending' merge with no pending/processing rows left to 'sent' and
 * emit the completion event with per-bucket counts.
 */
async function finalizeCompletedMerges(
  admin: ReturnType<typeof createAdminClient>
): Promise<void> {
  const { data: sendingMerges } = await admin
    .from("mail_merges")
    .select("id, sent_by")
    .eq("status", "sending");

  for (const merge of sendingMerges ?? []) {
    const { count: open } = await admin
      .from("mail_merge_recipients")
      .select("id", { count: "exact", head: true })
      .eq("mail_merge_id", merge.id)
      .in("status", ["pending", "processing"]);
    if (open !== 0) continue;

    const { data: rows } = await admin
      .from("mail_merge_recipients")
      .select("bucket, status")
      .eq("mail_merge_id", merge.id)
      .eq("status", "sent");
    const byBucket: Record<string, number> = {};
    for (const r of rows ?? []) {
      byBucket[r.bucket] = (byBucket[r.bucket] ?? 0) + 1;
    }
    const sentTotal = rows?.length ?? 0;

    const { error } = await admin
      .from("mail_merges")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", merge.id)
      .eq("status", "sending");
    if (error) {
      await logSystemEvent({
        event_type: "error.caught",
        summary: `Failed to finalize mail merge ${merge.id}`,
        metadata: {
          source: "mail_merge_drain",
          cause: "finalize_failed",
          mail_merge_id: merge.id,
          message: error.message,
        },
      });
      continue;
    }

    await logSystemEvent({
      event_type: "email.bulk_sent",
      actor_id: merge.sent_by,
      summary: `Mail merge sent via Gmail to ${sentTotal} recipients`,
      metadata: {
        kind: "mail_merge",
        mail_merge_id: merge.id,
        recipient_count: sentTotal,
        by_bucket: byBucket,
      },
    });
  }
}
