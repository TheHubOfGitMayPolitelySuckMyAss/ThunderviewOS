import { createClient } from "@/lib/supabase/server";
import ApplicationsTable from "./applications-table";
import PageHeader from "@/components/page-header";

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

export default async function ApplicationsPage() {
  const supabase = await createClient();

  const applications = await fetchAll((from, to) =>
    supabase
      .from("applications")
      .select("*")
      .order("submitted_on", { ascending: false })
      .range(from, to),
  );

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="tv-container-admin">
      <PageHeader
        title="Applications"
        size="compact"
        actions={<span className="text-fg3 text-[14px]">{applications.length} total &middot; {pendingCount} pending</span>}
      />
      <ApplicationsTable applications={applications} />
    </div>
  );
}
