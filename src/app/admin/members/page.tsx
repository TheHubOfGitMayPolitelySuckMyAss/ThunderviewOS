import { createClient } from "@/lib/supabase/server";
import { getTodayMT } from "@/lib/format";
import MembersTable from "./members-table";

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

export default async function MembersPage() {
  const supabase = await createClient();

  const members = await fetchAll((from, to) =>
    supabase
      .from("members")
      .select("*, member_emails(id, email, is_primary, source, email_status)")
      .order("first_name", { ascending: true })
      .range(from, to),
  );

  const today = getTodayMT();
  const { data: upcomingDinners } = await supabase
    .from("dinners")
    .select("id, date")
    .gte("date", today)
    .order("date", { ascending: true });

  return (
    <div className="max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="tv-h2 !text-[36px]">Members</h1>
      </div>
      <MembersTable
        members={members}
        upcomingDinners={upcomingDinners || []}
      />
    </div>
  );
}
