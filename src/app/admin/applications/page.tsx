import { createClient } from "@/lib/supabase/server";
import ApplicationsTable from "./applications-table";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .order("submitted_on", { ascending: false });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Applications</h2>
      <ApplicationsTable applications={applications || []} />
    </div>
  );
}
