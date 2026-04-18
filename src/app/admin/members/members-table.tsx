"use client";

import { useState } from "react";
import { formatStageType } from "@/lib/format";

type MemberEmail = {
  id: string;
  email: string;
  is_primary: boolean;
  source: string;
  email_status: string;
};

type Application = {
  id: string;
  submitted_on: string;
  status: string;
};

type Ticket = {
  id: string;
  fulfillment_status: string;
  purchased_at: string;
  dinner_id: string;
  dinners: { date: string };
};

type Member = {
  id: string;
  name: string;
  member_emails: MemberEmail[];
  applications: Application[];
  tickets: Ticket[];
  contact_preference: string;
  linkedin_profile: string | null;
  company_name: string | null;
  company_website: string | null;
  attendee_stagetype: string | null;
  marketing_opted_in: boolean;
  kicked_out: boolean;
  first_dinner_attended: string | null;
  last_dinner_attended: string | null;
  current_intro: string | null;
  intro_updated_at: string | null;
  current_ask: string | null;
  ask_updated_at: string | null;
  has_community_access: boolean;
  is_team: boolean;
  created_at: string;
  updated_at: string;
};

function getPrimaryEmail(member: Member): string {
  return (
    member.member_emails.find((e) => e.is_primary)?.email ??
    member.member_emails[0]?.email ??
    "-"
  );
}

type SortKey = "name" | "email" | "company" | "stage" | "lastDinner" | "marketing";
type SortDir = "asc" | "desc";

function getSortValue(member: Member, key: SortKey): string {
  switch (key) {
    case "name": return member.name.toLowerCase();
    case "email": return getPrimaryEmail(member).toLowerCase();
    case "company": return (member.company_name || "").toLowerCase();
    case "stage": return (member.attendee_stagetype || "").toLowerCase();
    case "lastDinner": return member.last_dinner_attended || "";
    case "marketing": return member.marketing_opted_in ? "yes" : "no";
  }
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

export default function MembersTable({
  members,
  initialSelectedId,
}: {
  members: Member[];
  initialSelectedId?: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(
    initialSelectedId
      ? members.find((m) => m.id === initialSelectedId) ?? null
      : null
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = search
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.member_emails.some((e) =>
            e.email.toLowerCase().includes(search.toLowerCase())
          )
      )
    : members;

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (selected) {
    // Earliest approved application date
    const approvedApps = selected.applications
      .filter((a) => a.status === "approved")
      .sort(
        (a, b) =>
          new Date(a.submitted_on).getTime() -
          new Date(b.submitted_on).getTime()
      );
    const applicationDate = approvedApps[0]?.submitted_on;

    // Dinner dates from tickets, most recent first
    const dinnerDates = selected.tickets
      .map((t) => t.dinners?.date)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      // deduplicate (member could have multiple tickets for same dinner)
      .filter((d, i, arr) => arr.indexOf(d) === i);

    // Ask is stale if member has a ticket for a future dinner and hasn't
    // updated their ask since buying that ticket
    const today = new Date().toISOString().slice(0, 10);
    const futureTickets = selected.tickets.filter(
      (t) => t.dinners?.date && t.dinners.date >= today
    );
    const askIsStale =
      futureTickets.length > 0 &&
      futureTickets.some(
        (t) =>
          !selected.ask_updated_at ||
          selected.ask_updated_at < t.purchased_at
      );

    const heading = selected.company_name
      ? `${selected.name} at ${selected.company_name}`
      : selected.name;

    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <button
          onClick={() => setSelected(null)}
          className="mb-4 text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to list
        </button>

        {/* Heading + pills */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3
              className={`text-lg font-semibold ${selected.kicked_out ? "line-through text-gray-400" : "text-gray-900"}`}
            >
              {heading}
            </h3>
            {selected.is_team && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Team
              </span>
            )}
            {!selected.marketing_opted_in && (
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
              {formatStageType(selected.attendee_stagetype)}
            </DetailField>

            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">
                Email Addresses
              </dt>
              <dd className="mt-1">
                <div>
                  {selected.member_emails.map((me) => (
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
              {selected.linkedin_profile ? (
                <a
                  href={selected.linkedin_profile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {selected.linkedin_profile}
                </a>
              ) : (
                "None"
              )}
            </DetailField>

            <DetailField label="Website">
              {selected.company_website ? (
                <a
                  href={
                    selected.company_website.startsWith("http")
                      ? selected.company_website
                      : `https://${selected.company_website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {selected.company_website}
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
                {selected.current_intro || "None"}
              </dd>
              {selected.intro_updated_at && (
                <dd className="mt-0.5 text-xs text-gray-400">
                  Last updated{" "}
                  {new Date(selected.intro_updated_at).toLocaleDateString()}
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
                {selected.current_ask || "None"}
              </dd>
              {selected.ask_updated_at && (
                <dd className="mt-0.5 text-xs text-gray-400">
                  Last updated{" "}
                  {new Date(selected.ask_updated_at).toLocaleDateString()}
                </dd>
              )}
            </div>

            <DetailField label="Contact Preference">
              {selected.contact_preference}
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
    );
  }

  const thClass =
    "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 cursor-pointer select-none hover:text-gray-700";

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className={thClass} onClick={() => toggleSort("name")}>
                Name<SortIndicator col="name" />
              </th>
              <th className={thClass} onClick={() => toggleSort("email")}>
                Email<SortIndicator col="email" />
              </th>
              <th className={thClass} onClick={() => toggleSort("company")}>
                Company<SortIndicator col="company" />
              </th>
              <th className={thClass} onClick={() => toggleSort("stage")}>
                Stage/Type<SortIndicator col="stage" />
              </th>
              <th className={thClass} onClick={() => toggleSort("lastDinner")}>
                Last Dinner<SortIndicator col="lastDinner" />
              </th>
              <th className={thClass} onClick={() => toggleSort("marketing")}>
                Marketing<SortIndicator col="marketing" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((member) => (
              <tr
                key={member.id}
                onClick={() => setSelected(member)}
                className={`cursor-pointer hover:bg-gray-50 ${member.kicked_out ? "line-through text-gray-400" : ""}`}
              >
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400" : "text-gray-900"}`}>
                  {member.name}
                </td>
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400" : "text-gray-500"}`}>
                  {getPrimaryEmail(member)}
                </td>
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400" : "text-gray-500"}`}>
                  {member.company_name || "-"}
                </td>
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400" : "text-gray-500"}`}>
                  {formatStageType(member.attendee_stagetype)}
                </td>
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400" : "text-gray-500"}`}>
                  {member.last_dinner_attended
                    ? new Date(
                        member.last_dinner_attended + "T00:00:00"
                      ).toLocaleDateString()
                    : "-"}
                </td>
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400" : "text-gray-500"}`}>
                  {member.marketing_opted_in ? "Yes" : "No"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
