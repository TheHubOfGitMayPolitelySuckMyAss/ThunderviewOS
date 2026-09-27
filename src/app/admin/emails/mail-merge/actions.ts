"use server";

/**
 * Mail merge server actions.
 *
 * Mirrors the one-off-blast action shape (create/save/test/send + test gate),
 * with two structural differences:
 *   1. Sends go through Eric's Gmail (src/lib/gmail/), not Resend.
 *   2. Send-to-all is asynchronous: recipients are frozen into
 *      mail_merge_recipients as a queue, the first minute's allotment drains
 *      via after(), and the per-minute cron finishes the rest at the
 *      throttle rate (src/lib/mail-merge/pacing.ts). The action returns as soon
 *      as the queue is frozen.
 */

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrTeam } from "@/lib/require-admin";
import { isTestingMode } from "@/lib/email-mode";
import { logSystemEvent } from "@/lib/system-events";
import { getAccessToken } from "@/lib/gmail/auth";
import {
  buildRawMessage,
  getPrimarySendAs,
  sendMessage,
} from "@/lib/gmail/send";
import {
  computeAudience,
  SELECTABLE_GROUPS,
  type SelectableGroup,
} from "@/lib/mail-merge/audience";
import { composeMergeHtml, runMailMergeDrain } from "@/lib/mail-merge/drain";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { resolveSenderFromName } from "@/lib/gmail/sender-name";

export async function createMailMerge(): Promise<{
  success: boolean;
  error?: string;
  mergeId?: string;
}> {
  const actor = await requireAdminOrTeam();
  if (!actor) return { success: false, error: "Not authorized" };

  const admin = createAdminClient("system-internal");
  const { data, error } = await admin
    .from("mail_merges")
    .insert({})
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, mergeId: data.id };
}

export async function saveDraft(
  mergeId: string,
  fields: { subject: string; body: string; groups: string[] }
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAdminOrTeam();
  if (!actor) return { success: false, error: "Not authorized" };

  const groups = fields.groups.filter((g) =>
    (SELECTABLE_GROUPS as readonly string[]).includes(g)
  );

  const admin = createAdminClient("system-internal");
  const { error } = await admin
    .from("mail_merges")
    .update({
      subject: fields.subject,
      body: fields.body,
      groups,
      test_sent_after_last_edit: false,
    })
    .eq("id", mergeId)
    .eq("status", "draft");

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function sendTestEmail(
  mergeId: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAdminOrTeam();
  if (!actor) return { success: false, error: "Not authorized" };

  const admin = createAdminClient("system-internal");
  const { data: merge } = await admin
    .from("mail_merges")
    .select("status, subject, body")
    .eq("id", mergeId)
    .single();

  if (!merge) return { success: false, error: "Mail merge not found" };
  if (merge.status !== "draft")
    return { success: false, error: "Can only test a draft" };
  if (!merge.subject.trim())
    return { success: false, error: "Subject is empty" };

  try {
    const accessToken = await getAccessToken();
    const sendAs = await getPrimarySendAs(accessToken);
    if (!sendAs) throw new Error("Could not load Gmail send-as identity");

    const raw = buildRawMessage({
      to: actor.email,
      fromEmail: sendAs.email,
      fromName: await resolveSenderFromName(sendAs, {
        warn: true,
        context: "mail_merge_test_send",
      }),
      subject: merge.subject,
      bodyHtml: composeMergeHtml(actor.firstName, merge.body),
      signatureHtml: sendAs.signature,
      // Same headers the real send carries, so the test is faithful.
      listUnsubscribeUrl: buildUnsubscribeUrl(actor.memberId),
    });
    await sendMessage(accessToken, raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }

  await admin
    .from("mail_merges")
    .update({
      test_sent_at: new Date().toISOString(),
      test_sent_after_last_edit: true,
    })
    .eq("id", mergeId)
    .eq("status", "draft");

  return { success: true };
}

export async function sendMailMerge(mergeId: string): Promise<{
  success: boolean;
  error?: string;
  queued?: number;
  skipped?: number;
}> {
  const actor = await requireAdminOrTeam();
  if (!actor) return { success: false, error: "Not authorized" };

  const admin = createAdminClient("system-internal");
  const { data: merge } = await admin
    .from("mail_merges")
    .select("status, subject, body, groups, test_sent_after_last_edit")
    .eq("id", mergeId)
    .single();

  if (!merge) return { success: false, error: "Mail merge not found" };
  if (merge.status === "sending")
    return { success: false, error: "Already sending" };
  if (merge.status === "sent") return { success: false, error: "Already sent" };
  if (!merge.test_sent_after_last_edit)
    return { success: false, error: "Send a test email first" };
  if (!merge.subject.trim() || !merge.body.trim() || merge.body === "<p></p>")
    return { success: false, error: "Subject and body are required" };

  const selected = (merge.groups as string[]).filter((g) =>
    (SELECTABLE_GROUPS as readonly string[]).includes(g)
  ) as SelectableGroup[];
  if (selected.length === 0)
    return { success: false, error: "Select at least one group" };

  // Verify Gmail is usable BEFORE freezing the audience — a dead grant should
  // fail the click, not strand a 'sending' merge.
  try {
    const accessToken = await getAccessToken();
    const sendAs = await getPrimarySendAs(accessToken);
    if (!sendAs) throw new Error("Could not load Gmail send-as identity");
    if (!sendAs.signature)
      throw new Error(
        "Gmail signature is empty — configure your signature in Gmail settings first"
      );
    // Once per merge: warn now if this account would send nameless (the
    // drain resolves the same name silently on every run).
    await resolveSenderFromName(sendAs, {
      warn: true,
      context: "mail_merge_send_start",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Gmail not ready: ${message}` };
  }

  // Freeze the audience: team always in; testing mode restricts to team only.
  const audience = await computeAudience();
  let chosen = audience.sendable.filter(
    (r) => r.bucket === "team" || selected.includes(r.bucket as SelectableGroup)
  );
  if (isTestingMode()) {
    chosen = chosen.filter((r) => r.bucket === "team");
  }
  if (chosen.length === 0)
    return { success: false, error: "No eligible recipients" };

  const rows = chosen.map((r) => ({
    mail_merge_id: mergeId,
    member_id: r.member_id,
    first_name: r.first_name,
    email: r.email,
    bucket: r.bucket,
    status: r.email ? "pending" : "skipped",
    error: r.email ? null : "no active email at audience freeze",
  }));

  // Upsert-ignore so a double-click or crashed prior attempt can't duplicate
  // rows (unique on mail_merge_id + member_id).
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin
      .from("mail_merge_recipients")
      .upsert(rows.slice(i, i + CHUNK), {
        onConflict: "mail_merge_id,member_id",
        ignoreDuplicates: true,
      });
    if (error) {
      return { success: false, error: `Failed to queue recipients: ${error.message}` };
    }
  }

  // Flip to 'sending' only after the queue exists (the cron ignores drafts,
  // so a half-frozen queue can never be finalized prematurely).
  const { data: flipped, error: flipError } = await admin
    .from("mail_merges")
    .update({
      status: "sending",
      send_started_at: new Date().toISOString(),
      sent_by: actor.memberId,
    })
    .eq("id", mergeId)
    .eq("status", "draft")
    .select("id");

  if (flipError || !flipped?.length) {
    return {
      success: false,
      error: flipError?.message ?? "Merge was already started elsewhere",
    };
  }

  const queued = rows.filter((r) => r.status === "pending").length;
  const skipped = rows.length - queued;

  await logSystemEvent({
    event_type: "email.bulk_send_started",
    actor_id: actor.memberId,
    summary: `Mail merge send started: ${queued} queued (${selected.join(", ")} + team)`,
    metadata: {
      kind: "mail_merge",
      mail_merge_id: mergeId,
      queued,
      skipped,
      groups: selected,
    },
  });

  // The first minute's allotment goes out right after the response is sent;
  // the per-minute cron sends the rest at the throttle rate.
  after(async () => {
    await runMailMergeDrain();
  });

  return { success: true, queued, skipped };
}
