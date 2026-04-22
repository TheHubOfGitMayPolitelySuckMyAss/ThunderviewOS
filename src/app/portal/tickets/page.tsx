import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDinnerDisplay, getTodayMT } from "@/lib/format";
import { getTicketInfo } from "@/lib/ticket-assignment";
import { H1, Lede, Body } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import TicketPurchase from "./ticket-purchase";

export default async function TicketSelectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Look up member by auth email
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "email, members!inner(id, attendee_stagetypes, has_community_access, kicked_out)"
    )
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    attendee_stagetypes: string[];
    has_community_access: boolean;
    kicked_out: boolean;
  } | null;

  // Kicked out or not a member → back to portal
  if (!member || member.kicked_out) {
    redirect("/portal");
  }

  // No stagetype set
  if (!member.attendee_stagetypes || member.attendee_stagetypes.length === 0) {
    return (
      <div className="max-w-[980px] mx-auto px-8 py-10">
        <Link href="/portal" className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3">
          <ArrowLeft size={14} /> Portal home
        </Link>
        <H1 className="mt-2">Buy a dinner ticket.</H1>
        <Body className="mt-4">
          Your profile isn&rsquo;t fully set up yet. Please contact{" "}
          <a href="mailto:eric@marcoullier.com" className="text-clay-600 underline decoration-line-200">
            eric@marcoullier.com
          </a>{" "}
          for help.
        </Body>
      </div>
    );
  }

  // Fetch dinner_ids the member already has active tickets for
  const { data: existingTickets } = await admin
    .from("tickets")
    .select("dinner_id")
    .eq("member_id", member.id)
    .in("fulfillment_status", ["purchased", "fulfilled"]);

  const ticketedDinnerIds = new Set(
    (existingTickets || []).map((t) => t.dinner_id)
  );

  // Fetch eligible dinners: most recent past + next 3 upcoming
  const todayMT = getTodayMT();

  // Most recent past dinner
  const { data: pastDinner } = await admin
    .from("dinners")
    .select("id, date, guests_allowed")
    .lt("date", todayMT)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  // Next 3 upcoming dinners
  const { data: upcomingDinners } = await admin
    .from("dinners")
    .select("id, date, guests_allowed")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(3);

  // Combine: past dinner (if any) + upcoming
  const dinnerOptions: { id: string; date: string; label: string; isPast: boolean; guestsAllowed: boolean }[] = [];

  if (pastDinner && !ticketedDinnerIds.has(pastDinner.id)) {
    dinnerOptions.push({
      id: pastDinner.id,
      date: pastDinner.date,
      label: formatDinnerDisplay(pastDinner.date),
      isPast: true,
      guestsAllowed: pastDinner.guests_allowed,
    });
  }

  for (const d of upcomingDinners || []) {
    if (ticketedDinnerIds.has(d.id)) continue;
    dinnerOptions.push({
      id: d.id,
      date: d.date,
      label: formatDinnerDisplay(d.date),
      isPast: false,
      guestsAllowed: d.guests_allowed,
    });
  }

  if (dinnerOptions.length === 0) {
    return (
      <div className="max-w-[980px] mx-auto px-8 py-10">
        <Link href="/portal" className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3">
          <ArrowLeft size={14} /> Portal home
        </Link>
        <H1 className="mt-2">Buy a dinner ticket.</H1>
        <Body className="mt-4">
          No upcoming dinners available. Please contact{" "}
          <a href="mailto:eric@marcoullier.com" className="text-clay-600 underline decoration-line-200">
            eric@marcoullier.com
          </a>.
        </Body>
      </div>
    );
  }

  // Default to first upcoming (non-past) dinner
  const defaultDinnerId =
    dinnerOptions.find((d) => !d.isPast)?.id || dinnerOptions[0].id;

  const { label, price } = getTicketInfo(
    member.attendee_stagetypes,
    member.has_community_access
  );

  return (
    <div className="max-w-[980px] mx-auto px-8 py-10">
      <Link href="/portal" className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Portal home
      </Link>
      <H1 className="mt-2">Buy a dinner ticket.</H1>
      <Lede>Pick a date. We&rsquo;ll send details about a week before.</Lede>

      <Card className="mt-6">
        <TicketPurchase
          dinnerOptions={dinnerOptions}
          defaultDinnerId={defaultDinnerId}
          ticketLabel={label}
          ticketPrice={price}
          memberEmail={memberEmail!.email}
        />
      </Card>
    </div>
  );
}
