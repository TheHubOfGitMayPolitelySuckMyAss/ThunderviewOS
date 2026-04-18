import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatStageType } from "@/lib/format";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

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

  const heading = `${application.name} at ${application.company_name}`;
  const isActiveCEO =
    application.attendee_stagetype === "Active CEO (Bootstrapping or VC-Backed)";

  return (
    <div>
      <Link
        href="/admin/applications"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Back to applications
      </Link>

      <div className="rounded-lg bg-white p-6 shadow">
        {/* Heading + status pill + member link */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{heading}</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[application.status] || "bg-gray-100 text-gray-800"}`}
            >
              {application.status.charAt(0).toUpperCase() +
                application.status.slice(1)}
            </span>
            {application.member_id && (
              <Link
                href={`/admin/members/${application.member_id}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View member &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Column One */}
          <div className="space-y-4">
            <DetailField label="Type">
              {formatStageType(application.attendee_stagetype)}
            </DetailField>

            <DetailField label="Email">{application.email}</DetailField>

            <DetailField label="LinkedIn">
              <a
                href={application.linkedin_profile}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {application.linkedin_profile}
              </a>
            </DetailField>

            <DetailField label="Website">
              <a
                href={
                  application.company_website.startsWith("http")
                    ? application.company_website
                    : `https://${application.company_website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {application.company_website}
              </a>
            </DetailField>

            <DetailField label="Gender">{application.gender}</DetailField>

            <DetailField label="Race/Ethnicity">
              {application.race}
            </DetailField>

            <DetailField label="Orientation">
              {application.orientation}
            </DetailField>

            {isActiveCEO && (
              <>
                <DetailField label="I Am My Startup's CEO">
                  {application.i_am_my_startups_ceo || "N/A"}
                </DetailField>
                <DetailField label="My Startup Is NOT A Services Business">
                  {application.my_startup_is_not_a_services_business || "N/A"}
                </DetailField>
              </>
            )}
          </div>

          {/* Column Two */}
          <div className="space-y-4">
            <DetailField label="Applied">
              {formatDate(application.submitted_on)}
            </DetailField>

            <DetailField label="Preferred Dinner">
              {application.preferred_dinner_date
                ? formatDate(application.preferred_dinner_date)
                : "None"}
            </DetailField>

            <DetailField label="Status">{application.status}</DetailField>

            {application.status === "rejected" && (
              <DetailField label="Rejection Reason">
                {application.rejection_reason || "No reason given"}
              </DetailField>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children}</dd>
    </div>
  );
}
