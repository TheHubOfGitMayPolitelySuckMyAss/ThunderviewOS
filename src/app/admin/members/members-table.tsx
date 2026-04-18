"use client";

import { useState } from "react";
import { formatStageType } from "@/lib/format";

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
  first_dinner_attended: string | null;
  last_dinner_attended: string | null;
  current_intro: string | null;
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
            ["Stage/Type", formatStageType(selected.attendee_stagetype)],
            ["Marketing Opted In", selected.marketing_opted_in ? "Yes" : "No"],
            ["Kicked Out", selected.kicked_out ? "Yes" : "No"],
            ["Community Access", selected.has_community_access ? "Yes" : "No"],
            ["Is Team", selected.is_team ? "Yes" : "No"],
            [
              "First Dinner",
              selected.first_dinner_attended
                ? new Date(
                    selected.first_dinner_attended + "T00:00:00"
                  ).toLocaleDateString()
                : "Never",
            ],
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
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400 line-through" : "text-gray-900"}`}>
                  {member.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {getPrimaryEmail(member)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {member.company_name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatStageType(member.attendee_stagetype)}
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
