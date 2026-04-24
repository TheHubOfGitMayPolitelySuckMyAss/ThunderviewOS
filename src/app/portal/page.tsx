import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { formatDinnerDisplay, formatName, getTodayMT, toDateMT } from "@/lib/format";
import { getTicketInfo } from "@/lib/ticket-assignment";
import { H1 } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import PortalForm from "./portal-form";
import TicketPurchase from "./tickets/ticket-purchase";
import PurchaseConfetti from "./purchase-confetti";
import DinnerDetailsBlock from "./dinner-details-block";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ purchased?: string }>;
}) {
  const { purchased } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email!;
  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "email, members!inner(id, first_name, attendee_stagetypes, has_community_access, kicked_out, current_intro, current_ask, contact_preference, intro_updated_at, ask_updated_at, last_dinner_attended)"
    )
    .eq("email", email)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    first_name: string;
    attendee_stagetypes: string[];
    has_community_access: boolean;
    kicked_out: boolean;
    current_intro: string | null;
    current_ask: string | null;
    contact_preference: string | null;
    intro_updated_at: string | null;
    ask_updated_at: string | null;
    last_dinner_attended: string | null;
  } | null;

  const isMember = member !== null && member.kicked_out === false;

  // Fetch next future ticket for banner
  let bannerDinnerDate: string | null = null;
  let introAskFresh = false;
  if (isMember) {
    const todayMT = getTodayMT();
    const { data: futureTicket } = await admin
      .from("tickets")
      .select("dinners!inner(date)")
      .eq("member_id", member.id)
      .in("fulfillment_status", ["purchased", "fulfilled"])
      .gte("dinners.date", todayMT)
      .order("dinners(date)", { ascending: true })
      .limit(1)
      .single();

    if (futureTicket) {
      const dinner = futureTicket.dinners as unknown as { date: string };
      bannerDinnerDate = dinner.date;

      const lda = member.last_dinner_attended;
      const introDate = member.intro_updated_at ? toDateMT(member.intro_updated_at) : null;
      const askDate = member.ask_updated_at ? toDateMT(member.ask_updated_at) : null;
      const introTouched = introDate && (!lda || introDate > lda);
      const askTouched = askDate && (!lda || askDate > lda);
      introAskFresh = !!(introTouched || askTouched);
    }
  }

  // Build ticket purchase data when member has no upcoming ticket
  let ticketPurchaseData: {
    dinnerOptions: { id: string; date: string; label: string; isPast: boolean; guestsAllowed: boolean }[];
    defaultDinnerId: string;
    ticketLabel: string;
    ticketPrice: number;
    memberEmail: string;
  } | null = null;

  if (isMember && !bannerDinnerDate && member.attendee_stagetypes?.length > 0) {
    const todayMT = getTodayMT();

    const { data: existingTickets } = await admin
      .from("tickets")
      .select("dinner_id")
      .eq("member_id", member.id)
      .in("fulfillment_status", ["purchased", "fulfilled"]);

    const ticketedDinnerIds = new Set(
      (existingTickets || []).map((t) => t.dinner_id)
    );

    const { data: pastDinner } = await admin
      .from("dinners")
      .select("id, date, guests_allowed")
      .lt("date", todayMT)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    const { data: upcomingDinners } = await admin
      .from("dinners")
      .select("id, date, guests_allowed")
      .gte("date", todayMT)
      .order("date", { ascending: true })
      .limit(3);

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

    if (dinnerOptions.length > 0) {
      const defaultDinnerId =
        dinnerOptions.find((d) => !d.isPast)?.id || dinnerOptions[0].id;
      const { label, price } = getTicketInfo(
        member.attendee_stagetypes,
        member.has_community_access
      );

      // Get primary email for Stripe
      const { data: emails } = await admin
        .from("member_emails")
        .select("email, is_primary")
        .eq("member_id", member.id);
      const primaryEmail = emails?.find((e) => e.is_primary)?.email ?? email;

      ticketPurchaseData = {
        dinnerOptions,
        defaultDinnerId,
        ticketLabel: label,
        ticketPrice: price,
        memberEmail: primaryEmail,
      };
    }
  }

  // Fetch dinner details for next upcoming dinner (shown when no ticket)
  let dinnerDetails: {
    title: string | null;
    description: string | null;
    speakers: {
      first_name: string;
      last_name: string;
      company_name: string | null;
      linkedin_profile: string | null;
      company_website: string | null;
      profile_pic_url: string | null;
    }[];
  } | null = null;

  if (isMember && !bannerDinnerDate) {
    const todayMT = getTodayMT();
    const { data: nextDinner } = await admin
      .from("dinners")
      .select("id, title, description")
      .gte("date", todayMT)
      .order("date", { ascending: true })
      .limit(1)
      .single();

    if (nextDinner) {
      const { data: speakerRows } = await admin
        .from("dinner_speakers")
        .select("members(first_name, last_name, company_name, linkedin_profile, company_website, profile_pic_url)")
        .eq("dinner_id", nextDinner.id);

      const speakers = (speakerRows || []).map((row) => {
        const m = row.members as unknown as {
          first_name: string;
          last_name: string;
          company_name: string | null;
          linkedin_profile: string | null;
          company_website: string | null;
          profile_pic_url: string | null;
        };
        return m;
      });

      dinnerDetails = {
        title: nextDinner.title,
        description: nextDinner.description,
        speakers,
      };
    }
  }

  return (
    <div className="tv-container-narrow tv-page-gutter py-7">
      <H1 className="mb-6">
        {member?.first_name ? `Welcome back, ${member.first_name}.` : "Portal"}
      </H1>

      {isMember && bannerDinnerDate && (
        <div className="rounded-lg border border-accent-soft bg-bg-elevated px-5 py-3.5 flex items-center gap-3 mb-6">
          <Check size={18} className="text-accent flex-shrink-0" />
          <span className="text-sm text-fg2 leading-[1.5]">
            You&rsquo;re confirmed for <strong className="text-fg1">{formatDinnerDisplay(bannerDinnerDate)}</strong>.
          </span>
        </div>
      )}

      {isMember && !bannerDinnerDate && dinnerDetails && (
        <DinnerDetailsBlock details={dinnerDetails} />
      )}

      {isMember && bannerDinnerDate ? (
        <Card>
          <PortalForm
            initialIntro={member.current_intro}
            initialAsk={member.current_ask}
            initialContact={member.contact_preference}
            bannerDinnerDate={formatDinnerDisplay(bannerDinnerDate)}
            bannerIntroAskFresh={introAskFresh}
          />
        </Card>
      ) : isMember && ticketPurchaseData ? (
        <Card>
          <TicketPurchase
            dinnerOptions={ticketPurchaseData.dinnerOptions}
            defaultDinnerId={ticketPurchaseData.defaultDinnerId}
            ticketLabel={ticketPurchaseData.ticketLabel}
            ticketPrice={ticketPurchaseData.ticketPrice}
            memberEmail={ticketPurchaseData.memberEmail}
          />
        </Card>
      ) : null}

      <p className="text-xs text-fg3 mt-5 text-center">
        Need to update your name, company, or photo?{" "}
        <Link href="/portal/profile" className="text-accent-hover hover:underline">
          Edit your profile
        </Link>
      </p>

      {purchased === "true" && <PurchaseConfetti />}
    </div>
  );
}
