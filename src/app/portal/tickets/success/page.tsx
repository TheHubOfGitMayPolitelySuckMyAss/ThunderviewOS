import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDinnerDisplay } from "@/lib/format";
import { H1, Body } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
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
        const amountPaid = session.metadata.amount_paid;
        if (amountPaid) {
          amountDisplay = `$${amountPaid}`;
        }
      }
      if (session.amount_total) {
        amountDisplay = `$${session.amount_total / 100}`;
      }
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
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-[540px] mx-auto p-12 text-center bg-cream-100 rounded-xl shadow-glow">
        <H1 className="mb-4">Ticket confirmed.</H1>
        <Body>
          You&rsquo;re on the list for {dinnerDateDisplay}.
          {amountDisplay && (
            <span className="block mt-1 text-fg3">
              Amount paid: {amountDisplay}
            </span>
          )}
        </Body>
        <Body className="mt-3">
          We&rsquo;ll send the full roster about a week before with logistics.
        </Body>
        <Link href="/portal" className="no-underline mt-6 inline-block">
          <Button variant="secondary">Back To Portal</Button>
        </Link>
      </div>
      <ConfettiEffect />
    </div>
  );
}
