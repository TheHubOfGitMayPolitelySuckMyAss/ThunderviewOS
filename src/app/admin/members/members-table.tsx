"use client";

import { useState } from "react";

type MemberEmail = {
  id: string;
  email: string;
  is_primary: boolean;
  source: string;
};

type Member = {
  id: string;
  name: string;
  member_emails: MemberEmail[];
  contact_preference: string;
  linkedin_profile: string | null;
  company_name: string | null;
  company_website: string | null;
  attendee_stagetype: string | null;
  marketing_opted_in: boolean;
  kicked_out: boolean;
  last_dinner_attended: string | null;
  current_intro: string | null;
  current_ask: string | null;
  ask_updated_at: string | null;
  has_attended: boolean;
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

  const filtered = search
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.member_emails.some((e) =>
            e.email.toLowerCase().includes(search.toLowerCase())
          )
      )
    : members;

  if (selected) {
    const primaryEmail = getPrimaryEmail(selected);
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <button
          onClick={() => setSelected(null)}
          className="mb-4 text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to list
        </button>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {selected.name}
        </h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            ["Primary Email", primaryEmail],
            ["Contact Preference", selected.contact_preference],
            ["LinkedIn", selected.linkedin_profile || "N/A"],
            ["Company", selected.company_name || "N/A"],
            ["Website", selected.company_website || "N/A"],
            ["Stage/Type", selected.attendee_stagetype || "N/A"],
            ["Marketing Opted In", selected.marketing_opted_in ? "Yes" : "No"],
            ["Kicked Out", selected.kicked_out ? "Yes" : "No"],
            ["Has Attended", selected.has_attended ? "Yes" : "No"],
            ["Is Team", selected.is_team ? "Yes" : "No"],
            [
              "Last Dinner Attended",
              selected.last_dinner_attended
                ? new Date(
                    selected.last_dinner_attended + "T00:00:00"
                  ).toLocaleDateString()
                : "Never",
            ],
            ["Current Intro", selected.current_intro || "N/A"],
            ["Current Ask", selected.current_ask || "N/A"],
            [
              "Ask Updated",
              selected.ask_updated_at
                ? new Date(selected.ask_updated_at).toLocaleString()
                : "N/A",
            ],
            ["Created", new Date(selected.created_at).toLocaleString()],
            ["Updated", new Date(selected.updated_at).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase text-gray-500">
                {label}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Multi-email list */}
        <div className="mt-6">
          <h4 className="mb-2 text-sm font-medium uppercase text-gray-500">
            Email Addresses
          </h4>
          <div className="rounded-md border border-gray-200">
            {selected.member_emails.map((me) => (
              <div
                key={me.id}
                className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0"
              >
                <span className="text-sm text-gray-900">{me.email}</span>
                <span className="text-xs text-gray-400">{me.source}</span>
                {me.is_primary && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    primary
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Stage/Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Last Dinner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Marketing
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Kicked Out
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Team
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((member) => (
              <tr
                key={member.id}
                onClick={() => setSelected(member)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm text-gray-900">
                  {member.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {getPrimaryEmail(member)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {member.company_name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {member.attendee_stagetype || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {member.last_dinner_attended
                    ? new Date(
                        member.last_dinner_attended + "T00:00:00"
                      ).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {member.marketing_opted_in ? "Yes" : "No"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {member.kicked_out ? (
                    <span className="text-red-600">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {member.is_team ? (
                    <span className="text-blue-600">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
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
