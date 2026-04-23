import { createAdminClient } from "@/lib/supabase/admin";
import { formatDinnerDisplay, formatName } from "@/lib/format";
import { getTodayMT } from "@/lib/format";
import Link from "next/link";
import MemberAvatar from "@/components/member-avatar";
import { H1, Eyebrow, Body } from "@/components/ui/typography";

export default async function RecapPage() {
  const admin = createAdminClient();
  const today = getTodayMT();

  // Most recent completed dinner = latest date < today
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .lt("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (!dinner) {
    return (
      <div className="tv-container-portal tv-page-gutter py-7">
        <H1 className="mb-1.5">Last Month&rsquo;s Intros &amp; Asks</H1>
        <Body>No dinners yet.</Body>
      </div>
    );
  }

  // Fulfilled tickets for that dinner, with member data
  const { data: tickets } = await admin
    .from("tickets")
    .select(
      "member_id, members!inner(id, first_name, last_name, company_name, current_intro, current_ask, has_community_access, kicked_out, profile_pic_url)"
    )
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled");

  type AttendeeRow = {
    member_id: string;
    members: {
      id: string;
      first_name: string;
      last_name: string;
      company_name: string | null;
      current_intro: string | null;
      current_ask: string | null;
      has_community_access: boolean;
      kicked_out: boolean;
      profile_pic_url: string | null;
    };
  };

  const rows = (tickets ?? []) as unknown as AttendeeRow[];

  // Deduplicate by member_id, exclude kicked-out and no-community-access
  const seen = new Set<string>();
  const attendees = rows
    .filter((r) => {
      const m = r.members;
      if (!m || m.kicked_out || !m.has_community_access) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .map((r) => r.members)
    .sort((a, b) => {
      const aHas = a.current_intro || a.current_ask ? 0 : 1;
      const bHas = b.current_intro || b.current_ask ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return formatName(a.first_name, a.last_name)
        .toLowerCase()
        .localeCompare(formatName(b.first_name, b.last_name).toLowerCase());
    });

  return (
    <div className="tv-container-portal tv-page-gutter py-7">
      {/* Centered header */}
      <div className="text-center pb-5 border-b border-border-subtle mb-7">
        <Eyebrow className="mb-1.5">Thunderview Dinner</Eyebrow>
        <p className="font-display font-medium text-[34px] italic text-accent-hover">
          {formatDinnerDisplay(dinner.date)}
        </p>
        <p className="text-fg3 text-[14px] mt-1.5">
          {attendees.length} attendee{attendees.length !== 1 ? "s" : ""} &middot; here&rsquo;s who was there and what they&rsquo;re working on
        </p>
      </div>

      {/* Two-column card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {attendees.map((m) => (
          <div key={m.id} className="bg-bg-elevated border border-border-subtle rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3.5">
              <MemberAvatar member={m} size="md" />
              <div>
                <Link
                  href={`/portal/members/${m.id}`}
                  className="text-[15px] font-semibold text-fg1 no-underline hover:underline"
                >
                  {formatName(m.first_name, m.last_name)}
                </Link>
                {m.company_name && (
                  <p className="text-[12.5px] text-fg3">{m.company_name}</p>
                )}
              </div>
            </div>

            {m.current_intro && (
              <>
                <p className="font-semibold text-[11px] uppercase tracking-[0.12em] text-accent-hover mt-3 mb-1">Intro</p>
                <p className="text-[13.5px] leading-[1.55] text-fg2 whitespace-pre-wrap">{m.current_intro}</p>
              </>
            )}
            {m.current_ask && (
              <>
                <p className="font-semibold text-[11px] uppercase tracking-[0.12em] text-accent-hover mt-3 mb-1">Ask</p>
                <p className="text-[13.5px] leading-[1.55] text-fg2 whitespace-pre-wrap">{m.current_ask}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {attendees.length === 0 && (
        <Body className="text-fg3 mt-4">No attendees for this dinner.</Body>
      )}
    </div>
  );
}
