import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ApplicationDetail from "./application-detail";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .single();

  if (!application) notFound();

  return (
    <div>
      <Link
        href="/admin/applications"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Back to applications
      </Link>

      <ApplicationDetail application={application} />
    </div>
  );
}
