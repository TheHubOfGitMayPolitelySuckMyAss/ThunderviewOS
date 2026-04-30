/**
 * Resend webhook handler for email bounce, complaint, and failure events.
 *
 * Verifies signature via svix headers, inserts into email_events (idempotent),
 * updates member_emails status on bounce/complaint, and notifies admin on
 * complaint/failure.
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

const resend = new Resend(process.env.RESEND_API_KEY!);

const EVENT_TYPE_MAP: Record<string, "bounced" | "complained" | "failed"> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "failed",
  "email.failed": "failed",
};

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
    console.error("[resend-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
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
  // Resend sends `to` as an array; per Jan 2026 changelog each event is single-recipient
  const toArr = data.to as string[] | undefined;
  const recipientEmail = (toArr?.[0] ?? "").toLowerCase();
  const subject = (data.subject as string) ?? null;
  const occurredAt = event.created_at ?? new Date().toISOString();

  if (!resendEmailId || !recipientEmail) {
    console.error("[resend-webhook] Missing email_id or recipient:", { resendEmailId, recipientEmail });
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Insert event (idempotent via UNIQUE on resend_email_id + event_type)
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
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Match recipient to a member_emails row (case-insensitive)
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("id, member_id")
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
    if (eventType === "bounced") {
      await admin
        .from("member_emails")
        .update({ email_status: "bounced" })
        .eq("id", memberEmail.id);
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
    }
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
    console.error("[resend-webhook] Notification send failed (non-fatal):", err);
  }

  return NextResponse.json({ ok: true, eventType, recipientEmail });
}
