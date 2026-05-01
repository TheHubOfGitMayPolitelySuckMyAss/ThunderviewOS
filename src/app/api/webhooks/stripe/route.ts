import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTargetDinner } from "@/lib/ticket-assignment";
import { sendFulfillmentEmail } from "@/lib/email-send";
import { logSystemEvent } from "@/lib/system-events";
import { safePushMember } from "@/lib/streak/safe-push";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    return await handleStripeWebhook(request);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:stripe",
      summary: `Stripe webhook threw: ${error.message}`,
      metadata: {
        context: "webhook.stripe",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleStripeWebhook(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:stripe",
      summary: "Stripe webhook rejected: missing stripe-signature header",
      metadata: {
        context: "webhook.stripe",
        cause: "missing_signature_header",
      },
    });
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "webhook:stripe",
      summary: `Stripe webhook signature verification failed: ${message}`,
      metadata: {
        context: "webhook.stripe",
        cause: "signature_verification_failed",
        message,
      },
    });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  await logSystemEvent({
    event_type: "webhook.stripe",
    actor_label: "webhook:stripe",
    summary: `Stripe webhook received: ${event.type}`,
    metadata: {
      event_type: event.type,
      stripe_event_id: event.id,
    },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (!metadata?.member_id || !metadata?.dinner_id) {
      console.error("Webhook missing required metadata:", metadata);
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "webhook:stripe",
        summary: "Stripe checkout.session.completed missing required metadata",
        metadata: {
          context: "webhook.stripe",
          cause: "malformed_payload",
          stripe_event_id: event.id,
          stripe_session_id: session.id,
          received_metadata: metadata ?? null,
        },
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const admin = createAdminClient();

    // Idempotency: check if ticket already exists for this session
    const { data: existing } = await admin
      .from("tickets")
      .select("id")
      .eq("stripe_session_id", session.id)
      .limit(1)
      .single();

    if (existing) {
      // Already processed
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    // Insert as pending first (fires trg_ticket_insert: sets has_community_access, first_dinner_attended)
    const { data: inserted, error: insertError } = await admin
      .from("tickets")
      .insert({
        member_id: metadata.member_id,
        dinner_id: metadata.dinner_id,
        ticket_type: metadata.ticket_type,
        quantity: parseInt(metadata.quantity, 10),
        amount_paid: parseInt(metadata.amount_paid, 10),
        fulfillment_status: "purchased",
        payment_source: "portal",
        purchased_at: new Date().toISOString(),
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert ticket from webhook:", insertError.message, insertError.details, insertError.code);
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "webhook:stripe",
        summary: `Stripe webhook ticket insert failed: ${insertError.message}`,
        metadata: {
          context: "webhook.stripe",
          cause: "ticket_insert_failed",
          message: insertError.message,
          code: insertError.code ?? null,
          stripe_event_id: event.id,
          stripe_session_id: session.id,
          member_id: metadata.member_id,
          dinner_id: metadata.dinner_id,
        },
      });
      return NextResponse.json(
        { error: "Database insert failed" },
        { status: 500 }
      );
    }

    // Only auto-fulfill if this ticket is for the next upcoming dinner
    const nextDinner = await getTargetDinner(metadata.member_id, admin);
    if (nextDinner && metadata.dinner_id === nextDinner.id) {
      const { error: updateError } = await admin
        .from("tickets")
        .update({
          fulfillment_status: "fulfilled",
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);

      if (updateError) {
        console.error("Failed to fulfill ticket from webhook:", updateError.message, updateError.details, updateError.code);
        await logSystemEvent({
          event_type: "error.caught",
          actor_label: "webhook:stripe",
          summary: `Stripe webhook ticket fulfill update failed: ${updateError.message}`,
          metadata: {
            context: "webhook.stripe",
            cause: "ticket_fulfill_update_failed",
            message: updateError.message,
            code: updateError.code ?? null,
            ticket_id: inserted.id,
            member_id: metadata.member_id,
            dinner_id: metadata.dinner_id,
          },
        });
        return NextResponse.json(
          { error: "Database update failed" },
          { status: 500 }
        );
      }

      // Send fulfillment email (dinner details)
      await sendFulfillmentEmail(metadata.member_id, metadata.dinner_id);
    }

    await safePushMember(metadata.member_id, "stripe_webhook");
  }

  // For all other events (checkout.session.expired, etc.), acknowledge receipt
  return NextResponse.json({ received: true }, { status: 200 });
}
