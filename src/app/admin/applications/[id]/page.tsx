import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    <div className="max-w-[1280px]">
      <Link
        href="/admin/applications"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={14} /> Applications
      </Link>

      <ApplicationDetail application={application} />
    </div>
  );
}
