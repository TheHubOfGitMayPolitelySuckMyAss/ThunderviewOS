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
 *  - TV Opt Out → flip members.marketing_opted_in to false (same write as
 *    the unsubscribe link; the DB trigger stamps marketing_opted_out_at and
 *    the feed refiner renders it as member.marketing_opted_out).
 *
 * Processing contract:
 *  - Gmail applies a conversation label to EVERY message in the thread, so
 *    one label click on a 3-message thread arrives here as 3 labeled
 *    messages. Messages are grouped by (thread, kind) and each group acts
 *    ONCE: candidates are tried in order (non-Eric senders first — Eric's
 *    own replies extract to NONE) until one succeeds. Success → one
 *    confirmation reply, ALL group messages get trigger labels removed +
 *    "TV Done". All candidates fail → one reply explaining why, all group
 *    messages get "TV Error". Eric retries by re-applying the trigger label.
 *  - Dedupe on gmail_message_id via system_events (gmail_label.processed),
 *    so a crash between acting and re-labeling can't double-apply. A
 *    re-applied label on an already-handled thread goes silently to Done —
 *    unless the thread has gained a NEW processable message (e.g. next
 *    month's "can't make it"), which acts normally.
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
export const LABEL_OPTOUT = "TV Opt Out";
export const LABEL_DONE = "TV Done";
export const LABEL_ERROR = "TV Error";

const ADMIN_EMAIL = "eric@marcoullier.com";

export type LabelActionsResult =
  | { outcome: "not_configured" }
  | { outcome: "idle" }
  | { outcome: "ran"; processed: number; failed: number; aborted: boolean };

/** Failure that should be reported back to Eric on the thread, not thrown up. */
class ActionError extends Error {}

type Kind = "bounce" | "skip" | "optout";

const KIND_LABEL: Record<Kind, string> = {
  bounce: LABEL_BOUNCE,
  skip: LABEL_SKIP,
  optout: LABEL_OPTOUT,
};

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
    LABEL_OPTOUT,
    LABEL_DONE,
    LABEL_ERROR,
  ]);
  const doneLabelId = labelIds.get(LABEL_DONE)!;
  const errorLabelId = labelIds.get(LABEL_ERROR)!;
  const triggerLabelIds = [
    labelIds.get(LABEL_BOUNCE)!,
    labelIds.get(LABEL_SKIP)!,
    labelIds.get(LABEL_OPTOUT)!,
  ];

  const kinds: Kind[] = ["bounce", "skip", "optout"];
  const idsByKind = await Promise.all(
    kinds.map((kind) =>
      listMessageIdsWithLabel(accessToken, labelIds.get(KIND_LABEL[kind])!)
    )
  );
  if (idsByKind.every((ids) => ids.length === 0)) {
    return { outcome: "idle" };
  }

  // Attribute all audited writes to Eric — he acted by labeling the message.
  const lookupAdmin = createAdminClient("system-internal");
  const eric = await findMemberByAnyEmail(lookupAdmin, ADMIN_EMAIL);
  const admin = createAdminClientForActor(eric?.memberId ?? null);

  // One queue entry per message; a message carrying several trigger labels
  // enters once and fails the multi-label check below.
  const seen = new Set<string>();
  const queue: { id: string; kind: Kind }[] = [];
  kinds.forEach((kind, i) => {
    for (const id of idsByKind[i]) {
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push({ id, kind });
    }
  });

  let processed = 0;
  let failed = 0;

  // Fetch everything up front so thread siblings can be grouped — Gmail
  // applies a conversation label to every message in the thread, so acting
  // per-message means N actions + N replies for one label click.
  type Fetched = { id: string; kind: Kind; message: GmailMessage };
  const fetched: Fetched[] = [];
  for (const { id, kind } of queue) {
    try {
      fetched.push({ id, kind, message: await getMessage(accessToken, id) });
    } catch (err) {
      if (err instanceof GmailFatalError) {
        return await abortRun(err, processed, failed);
      }
      failed++;
      const reason = err instanceof Error ? err.message : String(err);
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "cron:gmail-label-actions",
        summary: `Gmail label action (${kind}) failed: ${reason.slice(0, 200)}`,
        metadata: {
          context: "gmail_label_actions",
          cause: "unexpected",
          gmail_message_id: id,
          kind,
          message: reason,
        },
      });
      try {
        await modifyMessageLabels(accessToken, id, [errorLabelId], triggerLabelIds);
      } catch (cleanupErr) {
        console.error("[gmail-label-actions] error-path cleanup failed:", cleanupErr);
      }
    }
  }

  const groups = new Map<string, Fetched[]>();
  for (const item of fetched) {
    const key = `${item.message.threadId}:${item.kind}`;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  for (const group of groups.values()) {
    const kind = group[0].kind;
    try {
      // Non-Eric senders first: for skip/optout the member's own message is
      // the one that names them; Eric's replies in the thread extract to NONE.
      const ordered = [...group].sort(
        (a, b) => Number(isFromEric(a.message)) - Number(isFromEric(b.message))
      );

      // Dedupe: siblings acted on in a prior run (crash between acting and
      // re-labeling, or a re-applied label) never act twice.
      const candidates: Fetched[] = [];
      let priorHandled = false;
      for (const item of ordered) {
        const { data: prior } = await lookupAdmin
          .from("system_events")
          .select("id")
          .eq("event_type", "gmail_label.processed")
          .eq("metadata->>gmail_message_id", item.id)
          .limit(1)
          .maybeSingle();
        if (prior) priorHandled = true;
        else candidates.push(item);
      }

      let confirmation: string | null = null;
      let actedOn: Fetched | null = null;
      let firstFailure: string | null = null;

      for (const item of candidates) {
        try {
          const labelsOnMessage = item.message.labelIds ?? [];
          const triggersOnMessage = triggerLabelIds.filter((lid) =>
            labelsOnMessage.includes(lid)
          );
          if (triggersOnMessage.length > 1) {
            throw new ActionError(
              "More than one TV trigger label is on this message — remove them all, then re-apply just one."
            );
          }

          const from = getHeader(item.message, "From");
          const subject = getHeader(item.message, "Subject");
          const body = extractPlainText(item.message);

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

          if (kind === "bounce") {
            confirmation = await handleBounce(admin, target.email, memberName);
          } else if (kind === "skip") {
            confirmation = await handleSkip(admin, found.memberId, memberName);
          } else {
            confirmation = await handleOptOut(admin, found.memberId, memberName);
          }

          await logSystemEvent({
            event_type: "gmail_label.processed",
            actor_id: eric?.memberId ?? null,
            actor_label: "gmail:label-action",
            subject_member_id: found.memberId,
            summary: confirmation,
            metadata: {
              gmail_message_id: item.id,
              gmail_thread_id: item.message.threadId,
              kind,
              target_email: target.email,
            },
          });

          actedOn = item;
          break;
        } catch (err) {
          // Only an ActionError moves on to the next candidate — anything
          // unexpected mid-action must not risk acting twice on the thread.
          if (!(err instanceof ActionError)) throw err;
          firstFailure ??= err.message;
        }
      }

      if (confirmation && actedOn) {
        await replyOnThread(
          accessToken,
          actedOn.message,
          getHeader(actedOn.message, "Subject"),
          confirmation
        );
        for (const item of group) {
          await modifyMessageLabels(accessToken, item.id, [doneLabelId], triggerLabelIds);
        }
        processed++;
        continue;
      }

      if (candidates.length === 0 || priorHandled) {
        // The thread was already handled (the confirmation went out then) and
        // any leftover candidates are noise like Eric's own replies — Done
        // silently rather than spamming an error for a re-applied label.
        for (const item of group) {
          await modifyMessageLabels(accessToken, item.id, [doneLabelId], triggerLabelIds);
        }
        continue;
      }

      throw new ActionError(firstFailure ?? "no actionable message in this thread");
    } catch (err) {
      if (err instanceof GmailFatalError) {
        return await abortRun(err, processed, failed);
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
          gmail_message_id: group[0].id,
          gmail_thread_id: group[0].message.threadId,
          kind,
          message: reason,
        },
      });
      // Best effort: tell Eric once on the thread and park every sibling
      // under TV Error so nothing retries until he re-applies the label.
      try {
        await replyOnThread(
          accessToken,
          group[0].message,
          getHeader(group[0].message, "Subject"),
          `Couldn't process this as "${KIND_LABEL[kind]}": ${reason}\n\nFix whatever's off and re-apply the label to retry.`
        );
        for (const item of group) {
          await modifyMessageLabels(accessToken, item.id, [errorLabelId], triggerLabelIds);
        }
      } catch (cleanupErr) {
        console.error("[gmail-label-actions] error-path cleanup failed:", cleanupErr);
      }
    }
  }

  return { outcome: "ran", processed, failed, aborted: false };
}

function isFromEric(message: GmailMessage): boolean {
  const from = getHeader(message, "From");
  return !!from && from.toLowerCase().includes(ADMIN_EMAIL);
}

/** Dead grant or quota — the rest of the queue would fail the same way. */
async function abortRun(
  err: GmailFatalError,
  processed: number,
  failed: number
): Promise<LabelActionsResult> {
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

async function handleOptOut(
  admin: AdminClient,
  memberId: string,
  memberName: string
): Promise<string> {
  const { data: member, error } = await admin
    .from("members")
    .select("marketing_opted_in")
    .eq("id", memberId)
    .single();
  if (error || !member) {
    throw new ActionError(
      `Couldn't load the member record: ${error?.message ?? "not found"}`
    );
  }
  if (!member.marketing_opted_in) {
    return `${memberName} was already opted out of marketing emails — no change.`;
  }

  // Same write as the unsubscribe link; the DB trigger stamps
  // marketing_opted_out_at.
  const { error: updateError } = await admin
    .from("members")
    .update({ marketing_opted_in: false })
    .eq("id", memberId);
  if (updateError) {
    throw new ActionError(`Couldn't set the opt-out: ${updateError.message}`);
  }

  return `Opted ${memberName} out of marketing emails. They're out of every marketing and mail-merge audience (transactional emails like ticket confirmations still send).`;
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
