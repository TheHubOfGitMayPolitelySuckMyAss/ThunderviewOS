import { createClient } from "@/lib/supabase/server";
import { getTodayMT } from "@/lib/format";
import MembersTable from "./members-table";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*, member_emails(id, email, is_primary, source, email_status)")
    .order("first_name", { ascending: true });

  const today = getTodayMT();
  const { data: upcomingDinners } = await supabase
    .from("dinners")
    .select("id, date")
    .gte("date", today)
    .order("date", { ascending: true });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Members</h2>
      <MembersTable
        members={members || []}
        upcomingDinners={upcomingDinners || []}
      />
    </div>
  );
}
