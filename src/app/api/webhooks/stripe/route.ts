import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTargetDinner } from "@/lib/ticket-assignment";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
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
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (!metadata?.member_id || !metadata?.dinner_id) {
      console.error("Webhook missing required metadata:", metadata);
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
        fulfillment_status: "pending",
        payment_source: "portal",
        purchased_at: new Date().toISOString(),
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert ticket from webhook:", insertError.message, insertError.details, insertError.code);
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
        return NextResponse.json(
          { error: "Database update failed" },
          { status: 500 }
        );
      }
    }
  }

  // For all other events (checkout.session.expired, etc.), acknowledge receipt
  return NextResponse.json({ received: true }, { status: 200 });
}
