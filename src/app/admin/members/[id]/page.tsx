import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayMT } from "@/lib/format";
import MemberDetail from "./member-detail";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select(
      "*, member_emails(id, email, is_primary, source, email_status), applications(id, submitted_on, status), tickets(id, fulfillment_status, purchased_at, dinner_id, dinners(date))"
    )
    .eq("id", id)
    .single();

  if (!member) notFound();

  // Determine if current user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = user?.email === "eric@marcoullier.com";

  // Earliest approved application date
  const approvedApps = (
    member.applications as { id: string; submitted_on: string; status: string }[]
  )
    .filter((a) => a.status === "approved")
    .sort(
      (a, b) =>
        new Date(a.submitted_on).getTime() - new Date(b.submitted_on).getTime()
    );
  const applicationDate = approvedApps[0]?.submitted_on ?? null;

  // Dinner dates from tickets, most recent first
  const tickets = member.tickets as {
    id: string;
    fulfillment_status: string;
    purchased_at: string;
    dinner_id: string;
    dinners: { date: string };
  }[];
  const dinnerDates = tickets
    .map((t) => t.dinners?.date)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))
    .filter((d, i, arr) => arr.indexOf(d) === i);

  // Unredeemed credits
  const { count: unredeemedCredits } = await supabase
    .from("credits")
    .select("*", { count: "exact", head: true })
    .eq("member_id", id)
    .eq("status", "outstanding")
    .is("redeemed_ticket_id", null);

  // Next upcoming dinner date (for comp ticket)
  const today = getTodayMT();
  const { data: nextDinner } = await supabase
    .from("dinners")
    .select("date")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single();
  const nextDinnerDate = nextDinner?.date ?? null;

  // Ask staleness
  const futureTickets = tickets.filter(
    (t) => t.dinners?.date && t.dinners.date >= today
  );
  const askIsStale =
    futureTickets.length > 0 &&
    futureTickets.some(
      (t) => !member.ask_updated_at || member.ask_updated_at < t.purchased_at
    );

  // Shape member data for client component (exclude nested applications/tickets)
  const memberData = {
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    company_name: member.company_name,
    company_website: member.company_website,
    linkedin_profile: member.linkedin_profile,
    attendee_stagetypes: (member.attendee_stagetypes ?? []) as string[],
    current_intro: member.current_intro,
    intro_updated_at: member.intro_updated_at,
    current_ask: member.current_ask,
    ask_updated_at: member.ask_updated_at,
    current_give: member.current_give,
    contact_preference: member.contact_preference,
    marketing_opted_in: member.marketing_opted_in,
    is_team: member.is_team,
    kicked_out: member.kicked_out,
    last_dinner_attended: member.last_dinner_attended,
    profile_pic_url: member.profile_pic_url ?? null,
    member_emails: member.member_emails as {
      id: string;
      email: string;
      is_primary: boolean;
      source: string;
      email_status: string;
    }[],
  };

  return (
    <div className="max-w-[1040px] mx-auto">
      <Link
        href="/admin/members"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={14} /> Members
      </Link>

      <MemberDetail
        member={memberData}
        applicationDate={applicationDate}
        dinnerDates={dinnerDates}
        askIsStale={askIsStale}
        isAdmin={isAdmin}
        unredeemedCredits={unredeemedCredits ?? 0}
        nextDinnerDate={nextDinnerDate}
      />
    </div>
  );
}
