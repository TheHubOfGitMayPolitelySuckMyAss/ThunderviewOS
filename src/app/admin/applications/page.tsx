import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import ApplicationsTable from "./applications-table";
import PageHeader from "@/components/page-header";

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
