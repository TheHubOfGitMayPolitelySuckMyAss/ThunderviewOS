import { createClient } from "@/lib/supabase/server";
import MembersTable from "./members-table";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const { selected } = await searchParams;
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select(
      "*, member_emails(id, email, is_primary, source, email_status), applications(id, submitted_on, status), tickets(id, fulfillment_status, dinner_id, dinners(date))"
    )
    .order("name", { ascending: true });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Members</h2>
      <MembersTable members={members || []} initialSelectedId={selected} />
    </div>
  );
}
