/**
 * Gmail label actions: Eric applies "TV Bounce" or "TV Skip" to a message in
 * his Gmail; the per-minute cron picks it up and acts on it, then replies in
 * the same thread with a confirmation (or the reason it couldn't act).
 *
 *  - TV Bounce → run the hard-bounce cascade (applyHardBounce: flip
 *    email_status, promote a secondary). Covers Gmail mail-merge bounces,
 *    which arrive as mailer-daemon emails and have no Resend webhook.
 *  - TV Skip → set members.excluded_from_dinner_id to the next upcoming
 *    dinner (the not_this_one stage; post-dinner cron clears it afterwards).
 *
 * Processing contract:
 *  - One attempt per message. Success → trigger labels removed, "TV Done"
 *    added. Failure → trigger labels removed, "TV Error" added, reply
 *    explains why. Eric retries by re-applying the trigger label.
 *  - Dedupe on gmail_message_id via system_events (gmail_label.processed),
 *    so a crash between acting and re-labeling can't double-apply.
 *  - Audit rows attribute to Eric (he performed the action by labeling) via
 *    createAdminClientForActor, same pattern as the signed-link review flow.
 *  - GmailFatalError (dead grant / quota) aborts the whole run — every
 *    remaining message would fail identically.
 *
 * Only Eric can label messages in his own mailbox, so there is no
 * sender-spoofing surface here.
 */

import { getAccessToken, getGmailConnection } from "./auth";
import {
  ensureLabels,
  extractPlainText,
  getHeader,
  getMessage,
  listMessageIdsWithLabel,
  modifyMessageLabels,
  type GmailMessage,
} from "./labels";
import { buildRawMessage, escapeHtml, sendMessage, GmailFatalError } from "./send";
import { extractTargetEmail } from "./extract-target";
import { applyHardBounce } from "@/lib/email-bounce";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClientForActor } from "@/lib/supabase/admin-with-actor";
import { logSystemEvent } from "@/lib/system-events";
import { formatDateFriendly, getTodayMT } from "@/lib/format";

export const LABEL_BOUNCE = "TV Bounce";
export const LABEL_SKIP = "TV Skip";
export const LABEL_DONE = "TV Done";
export const LABEL_ERROR = "TV Error";

const ADMIN_EMAIL = "eric@marcoullier.com";

export type LabelActionsResult =
  | { outcome: "not_configured" }
  | { outcome: "idle" }
  | { outcome: "ran"; processed: number; failed: number; aborted: boolean };

/** Failure that should be reported back to Eric on the thread, not thrown up. */
class ActionError extends Error {}

type Kind = "bounce" | "skip";

export async function runGmailLabelActions(): Promise<LabelActionsResult> {
  const conn = await getGmailConnection();
  if (!conn.connected || !conn.labelScopeOk) {
    // Pre-reconnect state, not an error: the grant predates gmail.modify.
    return { outcome: "not_configured" };
  }

  const accessToken = await getAccessToken();
  const labelIds = await ensureLabels(accessToken, [
    LABEL_BOUNCE,
    LABEL_SKIP,
    LABEL_DONE,
    LABEL_ERROR,
  ]);
  const bounceLabelId = labelIds.get(LABEL_BOUNCE)!;
  const skipLabelId = labelIds.get(LABEL_SKIP)!;
  const doneLabelId = labelIds.get(LABEL_DONE)!;
  const errorLabelId = labelIds.get(LABEL_ERROR)!;

  const [bounceIds, skipIds] = await Promise.all([
    listMessageIdsWithLabel(accessToken, bounceLabelId),
    listMessageIdsWithLabel(accessToken, skipLabelId),
  ]);
  if (bounceIds.length === 0 && skipIds.length === 0) {
    return { outcome: "idle" };
  }

  // Attribute all audited writes to Eric — he acted by labeling the message.
  const lookupAdmin = createAdminClient("system-internal");
  const eric = await findMemberByAnyEmail(lookupAdmin, ADMIN_EMAIL);
  const admin = createAdminClientForActor(eric?.memberId ?? null);

  const queue: { id: string; kind: Kind }[] = [
    ...bounceIds.map((id) => ({ id, kind: "bounce" as const })),
    ...skipIds.filter((id) => !bounceIds.includes(id)).map((id) => ({
      id,
      kind: "skip" as const,
    })),
  ];

  let processed = 0;
  let failed = 0;

  for (const { id, kind } of queue) {
    let message: GmailMessage | null = null;
    try {
      message = await getMessage(accessToken, id);

      const hasBoth =
        (message.labelIds ?? []).includes(bounceLabelId) &&
        (message.labelIds ?? []).includes(skipLabelId);
      if (hasBoth) {
        throw new ActionError(
          `Both "${LABEL_BOUNCE}" and "${LABEL_SKIP}" are on this message — remove both, then re-apply just one.`
        );
      }

      // Dedupe: acted already but crashed before re-labeling? Don't act twice.
      const { data: prior } = await lookupAdmin
        .from("system_events")
        .select("id")
        .eq("event_type", "gmail_label.processed")
        .eq("metadata->>gmail_message_id", id)
        .limit(1)
        .maybeSingle();
      if (prior) {
        await modifyMessageLabels(accessToken, id, [doneLabelId], [
          bounceLabelId,
          skipLabelId,
        ]);
        continue;
      }

      const from = getHeader(message, "From");
      const subject = getHeader(message, "Subject");
      const body = extractPlainText(message);

      const target = await extractTargetEmail(kind, { from, subject, body });
      if (target.email === null) throw new ActionError(target.reason);

      const found = await findMemberByAnyEmail<{
        id: string;
        first_name: string | null;
        last_name: string | null;
      }>(admin, target.email, "id, first_name, last_name");
      if (!found) {
        throw new ActionError(
          `No member has the email ${target.email} — nothing was changed.`
        );
      }
      const memberName =
        [found.member.first_name, found.member.last_name]
          .filter(Boolean)
          .join(" ") || target.email;

      let confirmation: string;
      if (kind === "bounce") {
        confirmation = await handleBounce(admin, target.email, memberName);
      } else {
        confirmation = await handleSkip(admin, found.memberId, memberName);
      }

      await logSystemEvent({
        event_type: "gmail_label.processed",
        actor_id: eric?.memberId ?? null,
        actor_label: "gmail:label-action",
        subject_member_id: found.memberId,
        summary: confirmation,
        metadata: {
          gmail_message_id: id,
          kind,
          target_email: target.email,
        },
      });

      await replyOnThread(accessToken, message, subject, confirmation);
      await modifyMessageLabels(accessToken, id, [doneLabelId], [
        bounceLabelId,
        skipLabelId,
      ]);
      processed++;
    } catch (err) {
      if (err instanceof GmailFatalError) {
        // Dead grant or quota — the rest of the queue would fail the same way.
        await logSystemEvent({
          event_type: "error.caught",
          actor_label: "cron:gmail-label-actions",
          summary: `Gmail label actions aborted: ${err.message.slice(0, 200)}`,
          metadata: {
            context: "gmail_label_actions",
            cause: "gmail_fatal",
            message: err.message,
          },
        });
        return { outcome: "ran", processed, failed: failed + 1, aborted: true };
      }

      failed++;
      const reason =
        err instanceof ActionError
          ? err.message
          : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "cron:gmail-label-actions",
        summary: `Gmail label action (${kind}) failed: ${reason.slice(0, 200)}`,
        metadata: {
          context: "gmail_label_actions",
          cause: err instanceof ActionError ? "action_error" : "unexpected",
          gmail_message_id: id,
          kind,
          message: reason,
        },
      });
      // Best effort: tell Eric on the thread and park the message under
      // TV Error so it isn't retried until he re-applies the trigger label.
      try {
        if (message) {
          await replyOnThread(
            accessToken,
            message,
            getHeader(message, "Subject"),
            `Couldn't process this as "${kind === "bounce" ? LABEL_BOUNCE : LABEL_SKIP}": ${reason}\n\nFix whatever's off and re-apply the label to retry.`
          );
        }
        await modifyMessageLabels(accessToken, id, [errorLabelId], [
          bounceLabelId,
          skipLabelId,
        ]);
      } catch (cleanupErr) {
        console.error("[gmail-label-actions] error-path cleanup failed:", cleanupErr);
      }
    }
  }

  return { outcome: "ran", processed, failed, aborted: false };
}

type AdminClient = ReturnType<typeof createAdminClientForActor>;

async function handleBounce(
  admin: AdminClient,
  targetEmail: string,
  memberName: string
): Promise<string> {
  const { data: emailRow, error } = await admin
    .from("member_emails")
    .select("id, email, member_id, is_primary, email_status")
    .eq("email", targetEmail)
    .limit(1)
    .maybeSingle();
  if (error || !emailRow) {
    throw new ActionError(
      `Couldn't load the member_emails row for ${targetEmail}: ${error?.message ?? "not found"}`
    );
  }
  if (emailRow.email_status === "bounced") {
    return `${targetEmail} (${memberName}) was already marked bounced — no change.`;
  }

  await applyHardBounce({
    admin,
    memberEmail: {
      id: emailRow.id,
      email: emailRow.email,
      member_id: emailRow.member_id,
      is_primary: emailRow.is_primary,
    },
    memberName,
    actorLabel: "gmail:label-action",
  });

  if (!emailRow.is_primary) {
    return `Marked ${targetEmail} (a secondary email on ${memberName}) as bounced.`;
  }

  // The cascade may have promoted a secondary — report what actually happened.
  const { data: newPrimary } = await admin
    .from("member_emails")
    .select("email")
    .eq("member_id", emailRow.member_id)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (newPrimary && newPrimary.email !== targetEmail) {
    return `Marked ${targetEmail} as bounced and promoted ${newPrimary.email} to primary on ${memberName}.`;
  }
  return `Marked ${targetEmail} as bounced. ${memberName} has no other deliverable email on file.`;
}

async function handleSkip(
  admin: AdminClient,
  memberId: string,
  memberName: string
): Promise<string> {
  const { data: dinner, error } = await admin
    .from("dinners")
    .select("id, date")
    .gte("date", getTodayMT())
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new ActionError(`Couldn't look up the next dinner: ${error.message}`);
  }
  if (!dinner) {
    throw new ActionError(
      "There's no upcoming dinner on the calendar to exclude them from."
    );
  }

  const { error: updateError } = await admin
    .from("members")
    .update({ excluded_from_dinner_id: dinner.id })
    .eq("id", memberId);
  if (updateError) {
    throw new ActionError(`Couldn't set the exclusion: ${updateError.message}`);
  }

  await logSystemEvent({
    event_type: "member.excluded_from_dinner",
    actor_label: "gmail:label-action",
    subject_member_id: memberId,
    summary: `Marked ${memberName} "not this time" for the ${formatDateFriendly(dinner.date)} dinner`,
    metadata: { dinner_id: dinner.id, dinner_date: dinner.date },
  });

  return `Marked ${memberName} "not this time" for the ${formatDateFriendly(dinner.date)} dinner. They're out of mail-merge audiences until that dinner passes.`;
}

async function replyOnThread(
  accessToken: string,
  message: GmailMessage,
  subject: string | null,
  text: string
): Promise<void> {
  const messageIdHeader = getHeader(message, "Message-ID");
  const replySubject =
    subject && /^re:/i.test(subject) ? subject : `Re: ${subject ?? "(no subject)"}`;

  const bodyHtml = text
    .split("\n\n")
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const raw = buildRawMessage({
    to: ADMIN_EMAIL,
    fromEmail: ADMIN_EMAIL,
    fromName: "Thunderview OS",
    subject: replySubject,
    bodyHtml,
    inReplyTo: messageIdHeader ?? undefined,
    references: messageIdHeader ?? undefined,
  });
  await sendMessage(accessToken, raw, message.threadId);
}
