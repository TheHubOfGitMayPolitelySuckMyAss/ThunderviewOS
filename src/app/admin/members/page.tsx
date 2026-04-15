import { createClient } from "@/lib/supabase/server";
import MembersTable from "./members-table";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Members</h2>
      <MembersTable members={members || []} />
    </div>
  );
}
