import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDinnerDisplay } from "@/lib/format";
import ConfettiEffect from "@/app/apply/thanks/confetti";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function TicketSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let dinnerDateDisplay = "an upcoming dinner";
  let amountDisplay: string | null = null;

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.metadata?.dinner_id) {
        // Extract dinner date from line item name or metadata
        const amountPaid = session.metadata.amount_paid;
        if (amountPaid) {
          amountDisplay = `$${amountPaid}`;
        }
      }
      // Get dinner date from the line item name
      if (session.amount_total) {
        amountDisplay = `$${session.amount_total / 100}`;
      }
      // Fetch dinner date from Supabase using metadata
      if (session.metadata?.dinner_id) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const { data: dinner } = await admin
          .from("dinners")
          .select("date")
          .eq("id", session.metadata.dinner_id)
          .single();
        if (dinner?.date) {
          dinnerDateDisplay = formatDinnerDisplay(dinner.date);
        }
      }
    } catch {
      // If fetch fails, show generic message
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Thanks, your ticket is confirmed!
        </h1>
        <p className="text-sm leading-relaxed text-gray-700">
          See you at {dinnerDateDisplay} at the Mercury Cafe.
          {amountDisplay && (
            <span className="block mt-1 text-gray-500">
              Amount paid: {amountDisplay}
            </span>
          )}
        </p>
        <p className="mt-3 text-sm text-gray-500">
          We&rsquo;ll send a reminder a few days before with logistics.
        </p>
        <Link
          href="/portal"
          className="mt-6 inline-block rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Back to portal
        </Link>
      </div>
      <ConfettiEffect />
    </div>
  );
}
