import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { H1, Lede, Eyebrow } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import { formatName, formatStageType } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import CommunityTable from "./community-table";
import Link from "next/link";

// PostgREST on Supabase caps responses at 1000 rows server-side.
// Paginate with .range() until drained.
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export default async function CommunityPage() {
  const admin = createAdminClient();

  // Get current user's member_id so we don't feature them to themselves
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let viewerMemberId: string | null = null;
  if (user?.email) {
    const { data: viewerEmail } = await admin
      .from("member_emails")
      .select("member_id")
      .eq("email", user.email)
      .limit(1)
      .single();
    viewerMemberId = viewerEmail?.member_id ?? null;
  }

  // Featured member: all three fields filled, attended in last 6 months,
  // not team, not kicked out, has community access, not the viewer
  const todayMT = getTodayMT();
  const sixMonthsAgo = new Date(todayMT + "T00:00:00Z");
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
  const cutoffDate = sixMonthsAgo.toISOString().slice(0, 10);

  let featuredQuery = admin
    .from("members")
    .select(
      "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, current_give, contact_preference, profile_pic_url"
    )
    .eq("has_community_access", true)
    .eq("kicked_out", false)
    .eq("is_team", false)
    .not("current_intro", "is", null)
    .neq("current_intro", "")
    .not("current_ask", "is", null)
    .neq("current_ask", "")
    .not("current_give", "is", null)
    .neq("current_give", "")
    .gte("last_dinner_attended", cutoffDate)
    .order("id") // need a deterministic base before random sampling
    .limit(100); // pull eligible pool, pick random client-side

  if (viewerMemberId) {
    featuredQuery = featuredQuery.neq("id", viewerMemberId);
  }

  const { data: eligibleMembers } = await featuredQuery;

  // Pick one at random from the eligible pool
  // (Supabase/PostgREST doesn't support ORDER BY RANDOM(), so we fetch
  // the pool and pick server-side)
  const featured =
    eligibleMembers && eligibleMembers.length > 0
      ? eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)]
      : null;

  // Fetch featured member's primary email for contact section
  let featuredEmail: string | null = null;
  if (featured) {
    const { data: fEmail } = await admin
      .from("member_emails")
      .select("email")
      .eq("member_id", featured.id)
      .eq("is_primary", true)
      .limit(1)
      .single();
    featuredEmail = fEmail?.email ?? null;
  }

  // Full member list for the table
  const members = await fetchAll((from, to) =>
    admin
      .from("members")
      .select(
        "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, contact_preference, profile_pic_url"
      )
      .eq("has_community_access", true)
      .eq("kicked_out", false)
      .order("first_name", { ascending: true })
      .range(from, to),
  );

  const featuredRoles = featured
    ? ((featured.attendee_stagetypes ?? []) as string[])
    : [];

  return (
    <div className="tv-container-portal tv-page-gutter py-7">
      <H1 className="mb-1.5">Community</H1>
      <Lede className="mb-6">{members.length} members of the Thunderview community.</Lede>

      {featured && (
        <div className="mb-section">
          <Eyebrow className="mb-3">Featured Member</Eyebrow>
          <Card>
            <div className="flex items-center gap-5 mb-5">
              <MemberAvatar member={featured} size="lg" />
              <div className="flex-1">
                <Link
                  href={`/portal/members/${featured.id}`}
                  className="no-underline"
                >
                  <h2 className="tv-h3 !m-0 text-fg1 hover:text-accent-hover transition-colors duration-[120ms]">
                    {formatName(featured.first_name, featured.last_name)}
                  </h2>
                </Link>
                {featured.company_name && (
                  <p className="text-base text-fg2 mt-1">
                    CEO at{" "}
                    {featured.company_website ? (
                      <a
                        href={
                          featured.company_website.startsWith("http")
                            ? featured.company_website
                            : `https://${featured.company_website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-hover underline decoration-border"
                      >
                        {featured.company_name}
                      </a>
                    ) : (
                      featured.company_name
                    )}
                  </p>
                )}
                <p className="text-[13px] text-fg3 mt-1">
                  {featuredRoles.length > 0
                    ? featuredRoles.map(formatStageType).join(" \u00B7 ")
                    : "Member"}
                </p>
              </div>
            </div>

            <Eyebrow>Intro</Eyebrow>
            <p className="text-[15px] text-fg2 leading-[1.6] mt-1 mb-5 whitespace-pre-wrap">
              {featured.current_intro}
            </p>

            <Eyebrow>Ask</Eyebrow>
            <p className="text-[15px] text-fg2 leading-[1.6] mt-1 mb-5 whitespace-pre-wrap">
              {featured.current_ask}
            </p>

            <Eyebrow>Give</Eyebrow>
            <p className="text-[15px] text-fg2 leading-[1.6] mt-1 mb-5 whitespace-pre-wrap">
              {featured.current_give}
            </p>

            <Eyebrow>Contact</Eyebrow>
            <p className="text-[14.5px] mt-1">
              {featured.linkedin_profile && (
                <a
                  href={
                    featured.linkedin_profile.startsWith("http")
                      ? featured.linkedin_profile
                      : `https://${featured.linkedin_profile}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-hover underline decoration-border"
                >
                  LinkedIn
                </a>
              )}
              {featured.contact_preference === "email" && featuredEmail && (
                <>
                  {featured.linkedin_profile && <span className="text-fg4 mx-1.5">&middot;</span>}
                  <a
                    href={`mailto:${featuredEmail}`}
                    className="text-accent-hover underline decoration-border"
                  >
                    {featuredEmail}
                  </a>
                </>
              )}
            </p>
          </Card>
        </div>
      )}

      <CommunityTable members={members} />
    </div>
  );
}
