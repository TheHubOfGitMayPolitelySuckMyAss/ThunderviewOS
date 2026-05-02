import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getTodayMT } from "@/lib/format";
import MembersTable from "./members-table";
import PageHeader from "@/components/page-header";

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
    <div className="tv-container-admin">
      <PageHeader title="Members" size="compact" />
      <MembersTable
        members={members}
        upcomingDinners={upcomingDinners || []}
      />
    </div>
  );
}
