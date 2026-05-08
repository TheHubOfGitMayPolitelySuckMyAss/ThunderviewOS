import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT, formatDinnerDisplay, formatDinnerShort, formatName } from "@/lib/format";
import { Eyebrow, H2, H3, Small } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import MemberAvatar from "@/components/member-avatar";

type Speaker = {
  member_id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  linkedin_profile: string | null;
  company_website: string | null;
  profile_pic_url: string | null;
};

export default async function ThisMonthsDinner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const admin = createAdminClient("public-flow");
  const todayMT = getTodayMT();

  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date, venue, address, title, description")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  if (!dinner) return null;

  const { data: speakerRows } = await admin
    .from("dinner_speakers")
    .select("member_id, members(first_name, last_name, company_name, linkedin_profile, company_website, profile_pic_url)")
    .eq("dinner_id", dinner.id);

  const speakers: Speaker[] = (speakerRows || []).map((row) => {
    const m = row.members as unknown as {
      first_name: string;
      last_name: string;
      company_name: string | null;
      linkedin_profile: string | null;
      company_website: string | null;
      profile_pic_url: string | null;
    };
    return { member_id: row.member_id, ...m };
  });

  const hasTitle = !!dinner.title;
  const hasDescription = !!dinner.description;
  const hasSpeakers = speakers.length > 0;

  // Format date for display: "Thursday, May 7, 2026"
  const dateObj = new Date(dinner.date + "T00:00:00");
  const longDate = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="bg-bg-elevated border-t border-border-subtle py-section">
      <div className="max-w-[1120px] mx-auto tv-page-gutter">
        <Eyebrow className="mb-3">This Month&rsquo;s Dinner</Eyebrow>

        {hasTitle && (
          <H2 className="mb-3">{dinner.title}</H2>
        )}

        <div className="text-[15px] text-fg2 mb-stack">
          <div>
            <strong className="text-fg1">{longDate}</strong> &middot; 6:00 PM
          </div>
          <div className="text-fg3">{dinner.venue} &middot; {dinner.address}</div>
        </div>

        {hasDescription && (
          <p className="text-[15px] text-fg2 leading-[1.6] whitespace-pre-line max-w-[740px] mb-stack">
            {dinner.description}
          </p>
        )}

        {hasSpeakers && (
          <>
            <H2 className="mt-section mb-stack">Speaking</H2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-7 gap-x-6">
              {speakers.map((s) => {
              const name = formatName(s.first_name, s.last_name);
              const hasLinks = s.linkedin_profile || s.company_website;

              return (
                <article key={s.member_id} className="flex items-center gap-5">
                  <MemberAvatar member={s} size="lg" />
                  <div className="min-w-0">
                    <H3 className="!text-[24px]" style={{ fontVariationSettings: '"opsz" 72' }}>
                      {name}
                    </H3>
                    {s.company_name && (
                      <p className="text-[15px] text-fg3 mt-0.5">{s.company_name}</p>
                    )}
                    {hasLinks && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {s.linkedin_profile && (
                          <a
                            href={s.linkedin_profile.startsWith("http") ? s.linkedin_profile : `https://${s.linkedin_profile}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-fg3 no-underline hover:text-accent-hover"
                          >
                            <ExternalLink size={12} /> LinkedIn
                          </a>
                        )}
                        {s.linkedin_profile && s.company_website && (
                          <span className="text-fg4 text-xs">&middot;</span>
                        )}
                        {s.company_website && (
                          <a
                            href={s.company_website.startsWith("http") ? s.company_website : `https://${s.company_website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-fg3 no-underline hover:text-accent-hover"
                          >
                            <Globe size={12} /> Website
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            </div>
          </>
        )}

        <div className="mt-section mb-stack">
          {isAuthenticated ? (
            <Button size="md" asChild>
              <Link href="/portal/tickets">Buy A Dinner Ticket</Link>
            </Button>
          ) : (
            <Button size="md" asChild>
              <Link href="/apply">Apply For {formatDinnerShort(dinner.date)}</Link>
            </Button>
          )}
          <Small className="mt-2 text-fg3">40 seats. Closes when full.</Small>
        </div>
      </div>
    </section>
  );
}
