import { createAdminClient } from "@/lib/supabase/admin";
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
        "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, contact_preference"
      )
      .eq("has_community_access", true)
      .eq("kicked_out", false)
      .order("first_name", { ascending: true })
      .range(from, to),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Community</h2>
      <CommunityTable members={members} />
    </div>
  );
}
