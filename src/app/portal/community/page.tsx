import { createAdminClient } from "@/lib/supabase/admin";
import { H1, Lede } from "@/components/ui/typography";
import CommunityTable from "./community-table";

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

  return (
    <div className="tv-container-portal tv-page-gutter py-7">
      <H1 className="mb-1.5">Community</H1>
      <Lede className="mb-6">{members.length} members of the Thunderview community.</Lede>
      <CommunityTable members={members} />
    </div>
  );
}
