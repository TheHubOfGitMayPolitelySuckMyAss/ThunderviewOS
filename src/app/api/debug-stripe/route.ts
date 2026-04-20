import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const successUrl = `${origin}/portal/tickets/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/portal/tickets`;

  const debug: Record<string, unknown> = {
    NEXT_PUBLIC_SITE_URL_raw: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SITE_URL_type: typeof process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SITE_URL_length: process.env.NEXT_PUBLIC_SITE_URL?.length,
    origin,
    origin_length: origin.length,
    success_url: successUrl,
    cancel_url: cancelUrl,
    STRIPE_SECRET_KEY_set: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_SECRET_KEY_prefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10),
  };

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Debug Test" },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      metadata: {},
      customer_email: "debug@test.com",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Expire immediately
    await stripe.checkout.sessions.expire(session.id);

    debug.stripe_result = "success";
    debug.session_url_prefix = session.url?.substring(0, 50);
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    debug.stripe_result = "error";
    debug.error_message = e.message;
    debug.error_type = e.type;
    debug.error_code = e.code;
    debug.error_param = e.param;
    debug.error_statusCode = e.statusCode;
    debug.error_constructor = e.constructor?.name;
    debug.error_raw = e.raw;
    debug.error_stack = typeof e.stack === "string"
      ? e.stack.split("\n").slice(0, 8)
      : undefined;
  }

  return NextResponse.json(debug);
}
