import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatStageType, formatTimestamp } from "@/lib/format";

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

  const fields: [string, string][] = [
    ["Email", application.email],
    ["Company", application.company_name],
    ["Website", application.company_website],
    ["Stage/Type", formatStageType(application.attendee_stagetype)],
    ["Preferred Dinner", formatDate(application.preferred_dinner_date)],
    ["LinkedIn", application.linkedin_profile],
    ["Gender", application.gender],
    ["Race", application.race],
    ["Orientation", application.orientation],
    [
      "I am my startup's CEO",
      application.i_am_my_startups_ceo || "N/A",
    ],
    [
      "Not a services business",
      application.my_startup_is_not_a_services_business || "N/A",
    ],
    ["Status", application.status],
    ["Rejection Reason", application.rejection_reason || "N/A"],
    ["Submitted", formatTimestamp(application.submitted_on)],
    [
      "Reviewed",
      application.reviewed_at
        ? formatTimestamp(application.reviewed_at)
        : "Not yet",
    ],
  ];

  return (
    <div>
      <Link
        href="/admin/applications"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Back to applications
      </Link>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {application.name}
        </h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase text-gray-500">
                {label}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
