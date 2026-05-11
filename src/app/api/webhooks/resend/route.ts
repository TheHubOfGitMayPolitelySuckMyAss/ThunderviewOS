/**
 * Resend webhook handler for email bounce, complaint, and failure events.
 *
 * Verifies signature via svix headers, filters to Thunderview-originated sends,
 * normalizes recipient strings, inserts into email_events (idempotent), updates
 * member_emails status, auto-promotes a non-bounced secondary when a primary
 * hard-bounces, and notifies admin on complaint/failure.
 *
 * Hard-bounce vs soft-bounce: only `bounce.type = "Permanent"` flips state.
 * Transient/Undetermined bounces persist for dashboard visibility but do not
 * change member_emails.email_status, do not promote, and do not push to Streak.
 *
 * The Resend webhook is account-scoped — every app on Eric's Resend account
 * POSTs here. We filter on `data.from` domain and silently drop anything not
 * sent from `thunderviewceodinners.com`.
 *
 * Deploy order:
 * 1. Deploy this code
 * 2. Register webhook in Resend dashboard → https://thunderview-os.vercel.app/api/webhooks/resend
 *    (select events: email.bounced, email.complained, email.failed)
 * 3. Copy signing secret → add as RESEND_WEBHOOK_SECRET in Vercel Production scope
 * 4. Redeploy so the env var is available
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import {
  sendComplaintNotification,
  sendSendFailureNotification,
} from "@/lib/email-send";
import { logSystemEvent } from "@/lib/system-events";
import { safePushMember } from "@/lib/streak/safe-push";

const resend = new Resend(process.env.RESEND_API_KEY!);

const EVENT_TYPE_MAP: Record<string, "bounced" | "complained" | "failed"> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "failed",
  "email.failed": "failed",
};

const THUNDERVIEW_DOMAIN = "thunderviewceodinners.com";

/**
 * Extract a bare lowercase email from any of:
 *   "Name <email>", "<email>", "email"
 * Returns "" if no plausible address is found.
 */
function parseRecipientEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const bracketed = raw.match(/<([^>]+)>/);
  const candidate = (bracketed?.[1] ?? raw).trim().toLowerCase();
  return candidate.includes("@") ? candidate : "";
}

function parseSenderDomain(raw: string | null | undefined): string {
  const email = parseRecipientEmail(raw);
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

export async function POST(req: Request) {
  try {
    return await handleResendWebhook(req);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:resend",
      summary: `Resend webhook threw: ${error.message}`,
      metadata: {
        context: "webhook.resend",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleResendWebhook(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:resend",
      summary: "Resend webhook rejected: RESEND_WEBHOOK_SECRET not configured",
      metadata: {
        context: "webhook.resend",
        cause: "missing_webhook_secret_env",
      },
    });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();

  // Verify signature via svix headers
  const svixHeaders = {
    id: req.headers.get("svix-id") ?? "",
    timestamp: req.headers.get("svix-timestamp") ?? "",
    signature: req.headers.get("svix-signature") ?? "",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: { type: string; data: Record<string, any>; created_at: string };
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: svixHeaders,
      webhookSecret,
    }) as unknown as typeof event;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resend-webhook] Signature verification failed:", err);
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:resend",
      summary: `Resend webhook signature verification failed: ${message}`,
      metadata: {
        context: "webhook.resend",
        cause: "signature_verification_failed",
        message,
      },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Thunderview-only filter: silently drop events from other apps on the
  // shared Resend account. No email_events insert, no system_events log.
  // Resend treats 200 as accepted and won't retry.
  const senderDomain = parseSenderDomain(event.data?.from as string | undefined);
  if (senderDomain !== THUNDERVIEW_DOMAIN) {
    return NextResponse.json({ ok: true, skipped: "non_thunderview_sender" });
  }

  await logSystemEvent({
    event_type: "webhook.resend",
    actor_label: "webhook:resend",
    summary: `Resend webhook received: ${event.type}`,
    metadata: {
      event_type: event.type,
      to: (event.data?.to as string[] | undefined)?.[0] ?? null,
    },
  });

  const eventType = EVENT_TYPE_MAP[event.type];
  if (!eventType) {
    // Not an event we care about — acknowledge and move on
    return NextResponse.json({ ok: true, skipped: event.type });
  }

  const data = event.data;
  const resendEmailId = (data.email_id as string) ?? "";
  // Resend sends `to` as an array; per Jan 2026 changelog each event is single-recipient.
  // The array entries can be bare ("foo@bar.com") or bracketed ("Name <foo@bar.com>").
  const toArr = data.to as string[] | undefined;
  const recipientEmail = parseRecipientEmail(toArr?.[0]);
  const subject = (data.subject as string) ?? null;
  const occurredAt = event.created_at ?? new Date().toISOString();

  if (!resendEmailId || !recipientEmail) {
    console.error("[resend-webhook] Missing email_id or recipient:", { resendEmailId, recipientEmail });
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:resend",
      summary: "Resend webhook payload missing email_id or recipient",
      metadata: {
        context: "webhook.resend",
        cause: "malformed_payload",
        resend_event_type: event.type,
        resend_email_id: resendEmailId || null,
        recipient_email: recipientEmail || null,
      },
    });
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Hard vs soft bounce. Only Permanent bounces flip state.
  const bounceType = (data.bounce as { type?: string } | undefined)?.type ?? null;
  const isHardBounce = eventType === "bounced" && bounceType === "Permanent";

  const admin = createAdminClient("webhook");

  // Insert event (idempotent via UNIQUE on resend_email_id + event_type).
  // We persist every Thunderview event — even soft bounces — for dashboard visibility.
  const { data: inserted, error: insertError } = await admin
    .from("email_events")
    .insert({
      event_type: eventType,
      resend_email_id: resendEmailId,
      recipient_email: recipientEmail,
      subject,
      occurred_at: occurredAt,
      raw_payload: event,
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique constraint violation = already processed
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[resend-webhook] Insert failed:", insertError.message);
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:resend",
      summary: `Resend webhook email_events insert failed: ${insertError.message}`,
      metadata: {
        context: "webhook.resend",
        cause: "email_events_insert_failed",
        message: insertError.message,
        code: insertError.code ?? null,
        resend_event_type: event.type,
        resend_email_id: resendEmailId,
        recipient_email: recipientEmail,
      },
    });
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Match recipient to a member_emails row (case-insensitive).
  // recipientEmail is already bare + lowercased.
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("id, member_id, is_primary")
    .ilike("email", recipientEmail)
    .limit(1)
    .single();

  let memberName: string | null = null;

  if (memberEmail) {
    // Backfill member_email_id and member_id on the event row
    await admin
      .from("email_events")
      .update({
        member_email_id: memberEmail.id,
        member_id: memberEmail.member_id,
      })
      .eq("id", inserted.id);

    // Look up member name for notifications
    const { data: member } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", memberEmail.member_id)
      .single();
    if (member) {
      memberName = formatName(member.first_name, member.last_name);
    }

    // Update member state based on event type
    if (eventType === "bounced" && isHardBounce) {
      await admin
        .from("member_emails")
        .update({ email_status: "bounced" })
        .eq("id", memberEmail.id);

      await logSystemEvent({
        event_type: "email.status_set_bounced",
        actor_label: "webhook:resend",
        subject_member_id: memberEmail.member_id,
        summary: `Marked ${recipientEmail} as bounced on ${memberName ?? "member"}`,
        metadata: {
          recipient_email: recipientEmail,
          member_email_id: memberEmail.id,
          was_primary: memberEmail.is_primary,
        },
      });

      // Auto-promote a non-bounced secondary to primary when the bounced
      // email was the primary. Must run BEFORE safePushMember so the next
      // Streak push picks up the new primary (Streak's contacts array uses
      // replace-semantics, so the old contact gets dropped).
      let promotedEmail: string | null = null;
      let streakOutcome: "primary_rotated" | "no_secondary_unreachable" | "secondary_retired" =
        memberEmail.is_primary ? "no_secondary_unreachable" : "secondary_retired";
      if (memberEmail.is_primary) {
        const { data: candidates } = await admin
          .from("member_emails")
          .select("id, email")
          .eq("member_id", memberEmail.member_id)
          .eq("email_status", "active")
          .neq("id", memberEmail.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const promotion = candidates?.[0];
        if (promotion) {
          const { error: rpcError } = await admin.rpc("swap_primary_email", {
            p_member_id: memberEmail.member_id,
            p_new_primary_email_id: promotion.id,
          });
          if (rpcError) {
            console.error("[resend-webhook] swap_primary_email failed:", rpcError.message);
            await logSystemEvent({
              event_type: "error.caught",
              actor_label: "webhook:resend",
              summary: `swap_primary_email failed during bounce promotion: ${rpcError.message}`,
              metadata: {
                context: "webhook.resend",
                cause: "promote_secondary_failed",
                member_id: memberEmail.member_id,
                bounced_member_email_id: memberEmail.id,
                promoted_member_email_id: promotion.id,
                message: rpcError.message,
              },
            });
          } else {
            promotedEmail = promotion.email;
            streakOutcome = "primary_rotated";
            await logSystemEvent({
              event_type: "email.primary_promoted",
              actor_label: "webhook:resend",
              subject_member_id: memberEmail.member_id,
              summary: `Promoted ${promotion.email} to primary on ${memberName ?? "member"} (replacing bounced ${recipientEmail})`,
              metadata: {
                member_id: memberEmail.member_id,
                bounced_email: recipientEmail,
                promoted_member_email_id: promotion.id,
                promoted_email: promotion.email,
              },
            });
          }
        } else {
          await logSystemEvent({
            event_type: "email.no_secondary_available",
            actor_label: "webhook:resend",
            subject_member_id: memberEmail.member_id,
            summary: `${memberName ?? "Member"} has no deliverable email — ${recipientEmail} was their only active address`,
            metadata: {
              member_id: memberEmail.member_id,
              bounced_email: recipientEmail,
            },
          });
        }
      }

      await safePushMember(memberEmail.member_id, "resend_bounce");
      const outcomeSummary =
        streakOutcome === "primary_rotated"
          ? `Streak resynced: primary email rotated to ${promotedEmail}`
          : streakOutcome === "no_secondary_unreachable"
            ? `Streak resynced: member moved to Bounced stage (no deliverable email)`
            : `Streak resynced: secondary email retired (member still reachable)`;
      await logSystemEvent({
        event_type: "streak.bounce_synced",
        actor_label: "webhook:resend",
        subject_member_id: memberEmail.member_id,
        summary: outcomeSummary,
        metadata: {
          member_id: memberEmail.member_id,
          outcome: streakOutcome,
          bounced_email: recipientEmail,
          promoted_email: promotedEmail,
        },
      });
    } else if (eventType === "complained") {
      await admin
        .from("member_emails")
        .update({ email_status: "complained" })
        .eq("id", memberEmail.id);

      // Opt out of marketing — existing trigger handles marketing_opted_out_at
      await admin
        .from("members")
        .update({ marketing_opted_in: false })
        .eq("id", memberEmail.member_id);
      await safePushMember(memberEmail.member_id, "resend_complaint");
    }
    // Soft bounces (non-Permanent): no email_status flip, no promotion, no Streak push.
    // Row persists in email_events for dashboard visibility.
  }

  // Notify admin on complaint or failure (non-blocking — don't 5xx on failure)
  try {
    if (eventType === "complained") {
      await sendComplaintNotification({
        recipientEmail,
        memberName,
        resendEmailId,
        occurredAt,
        subject,
      });
    } else if (eventType === "failed") {
      const errorReason =
        (data.error as string) ??
        (data.message as string) ??
        null;
      await sendSendFailureNotification({
        recipientEmail,
        memberName,
        resendEmailId,
        occurredAt,
        subject,
        errorReason,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resend-webhook] Notification send failed (non-fatal):", err);
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:resend",
      summary: `Resend webhook admin notification send failed: ${message}`,
      metadata: {
        context: "webhook.resend",
        cause: "admin_notification_send_failed",
        message,
        resend_event_type: event.type,
        resend_email_id: resendEmailId,
        recipient_email: recipientEmail,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    eventType,
    recipientEmail,
    bounceType,
    isHardBounce,
  });
}
