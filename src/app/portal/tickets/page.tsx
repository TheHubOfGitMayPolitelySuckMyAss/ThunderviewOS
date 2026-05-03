import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { redirect } from "next/navigation";
import { formatDinnerDisplay, getTodayMT } from "@/lib/format";
import { getTicketInfo } from "@/lib/ticket-assignment";
import { H1, Body } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import TicketPurchase from "./ticket-purchase";

export default async function TicketSelectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient("read-only");

  // Auth lookup must match against ANY of the member's registered emails.
  const result = await findMemberByAnyEmail<{
    id: string;
    attendee_stagetypes: string[];
    has_community_access: boolean;
    kicked_out: boolean;
  }>(
    admin,
    user.email!,
    "id, attendee_stagetypes, has_community_access, kicked_out"
  );
  const member = result?.member ?? null;

  // Kicked out or not a member → back to portal
  if (!member || member.kicked_out) {
    redirect("/portal");
  }

  // No stagetype set
  if (!member.attendee_stagetypes || member.attendee_stagetypes.length === 0) {
    return (
      <div className="tv-container-narrow tv-page-gutter py-7">
        <H1 className="mb-1.5">Buy a dinner ticket.</H1>
        <Body>
          Your profile isn&rsquo;t fully set up yet. Please contact{" "}
          <a href="mailto:eric@marcoullier.com" className="text-accent-hover underline decoration-border">
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
      <div className="tv-container-narrow tv-page-gutter py-7">
        <H1 className="mb-1.5">Buy a dinner ticket.</H1>
        <Body>
          No upcoming dinners available. Please contact{" "}
          <a href="mailto:eric@marcoullier.com" className="text-accent-hover underline decoration-border">
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
    <div className="tv-container-narrow tv-page-gutter py-7">
      <H1 className="mb-6">Buy a dinner ticket.</H1>

      <Card>
        <TicketPurchase
          dinnerOptions={dinnerOptions}
          defaultDinnerId={defaultDinnerId}
          ticketLabel={label}
          ticketPrice={price}
          memberEmail={result!.matchedEmail}
        />
      </Card>
    </div>
  );
}
