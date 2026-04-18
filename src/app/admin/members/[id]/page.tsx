import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatStageType } from "@/lib/format";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select(
      "*, member_emails(id, email, is_primary, source, email_status), applications(id, submitted_on, status), tickets(id, fulfillment_status, purchased_at, dinner_id, dinners(date))"
    )
    .eq("id", id)
    .single();

  if (!member) notFound();

  // Earliest approved application date
  const approvedApps = (member.applications as { id: string; submitted_on: string; status: string }[])
    .filter((a) => a.status === "approved")
    .sort(
      (a, b) =>
        new Date(a.submitted_on).getTime() - new Date(b.submitted_on).getTime()
    );
  const applicationDate = approvedApps[0]?.submitted_on;

  // Dinner dates from tickets, most recent first
  const tickets = member.tickets as {
    id: string;
    fulfillment_status: string;
    purchased_at: string;
    dinner_id: string;
    dinners: { date: string };
  }[];
  const dinnerDates = tickets
    .map((t) => t.dinners?.date)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))
    .filter((d, i, arr) => arr.indexOf(d) === i);

  // Ask staleness
  const today = new Date().toISOString().slice(0, 10);
  const futureTickets = tickets.filter(
    (t) => t.dinners?.date && t.dinners.date >= today
  );
  const askIsStale =
    futureTickets.length > 0 &&
    futureTickets.some(
      (t) =>
        !member.ask_updated_at ||
        member.ask_updated_at < t.purchased_at
    );

  const heading = member.company_name
    ? `${member.name} at ${member.company_name}`
    : member.name;

  const emails = member.member_emails as {
    id: string;
    email: string;
    is_primary: boolean;
    source: string;
    email_status: string;
  }[];

  return (
    <div>
      <Link
        href="/admin/members"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Back to members
      </Link>

      <div className="rounded-lg bg-white p-6 shadow">
        {/* Heading + pills */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3
              className={`text-lg font-semibold ${member.kicked_out ? "line-through text-gray-400" : "text-gray-900"}`}
            >
              {heading}
            </h3>
            {member.is_team && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Team
              </span>
            )}
            {!member.marketing_opted_in && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                Marketing Opt-Out
              </span>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Column One */}
          <div className="space-y-4">
            <DetailField label="Type">
              {formatStageType(member.attendee_stagetype)}
            </DetailField>

            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">
                Email Addresses
              </dt>
              <dd className="mt-1">
                <div>
                  {emails.map((me) => (
                    <div
                      key={me.id}
                      className="flex flex-wrap items-center gap-2 py-1"
                    >
                      <span className="text-sm text-gray-900">{me.email}</span>
                      <span className="text-xs text-gray-400">{me.source}</span>
                      {me.is_primary && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          primary
                        </span>
                      )}
                      {me.email_status === "bounced" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          bounced
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </dd>
            </div>

            <DetailField label="LinkedIn">
              {member.linkedin_profile ? (
                <a
                  href={member.linkedin_profile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {member.linkedin_profile}
                </a>
              ) : (
                "None"
              )}
            </DetailField>

            <DetailField label="Website">
              {member.company_website ? (
                <a
                  href={
                    member.company_website.startsWith("http")
                      ? member.company_website
                      : `https://${member.company_website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {member.company_website}
                </a>
              ) : (
                "None"
              )}
            </DetailField>

            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">
                Intro
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {member.current_intro || "None"}
              </dd>
              {member.intro_updated_at && (
                <dd className="mt-0.5 text-xs text-gray-400">
                  Last updated{" "}
                  {new Date(member.intro_updated_at).toLocaleDateString()}
                </dd>
              )}
            </div>

            <div>
              <dt className="flex items-center gap-2 text-xs font-medium uppercase text-gray-500">
                Ask
                {askIsStale && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium normal-case text-yellow-800">
                    Stale
                  </span>
                )}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {member.current_ask || "None"}
              </dd>
              {member.ask_updated_at && (
                <dd className="mt-0.5 text-xs text-gray-400">
                  Last updated{" "}
                  {new Date(member.ask_updated_at).toLocaleDateString()}
                </dd>
              )}
            </div>

            <DetailField label="Contact Preference">
              {member.contact_preference}
            </DetailField>
          </div>

          {/* Column Two */}
          <div className="space-y-4">
            <DetailField label="Application Date">
              {applicationDate
                ? `Approved ${new Date(applicationDate).toLocaleDateString()}`
                : "None"}
            </DetailField>

            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">
                Dinners
              </dt>
              <dd className="mt-1">
                {dinnerDates.length > 0 ? (
                  <ul className="space-y-1">
                    {dinnerDates.map((d) => (
                      <li key={d} className="text-sm text-gray-900">
                        {new Date(d + "T00:00:00").toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-gray-900">None</span>
                )}
              </dd>
            </div>
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
