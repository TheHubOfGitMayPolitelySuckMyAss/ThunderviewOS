"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, formatStageType } from "@/lib/format";

type MemberEmail = {
  id: string;
  email: string;
  is_primary: boolean;
  source: string;
  email_status: string;
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
}: {
  members: Member[];
}) {
  const [search, setSearch] = useState("");
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
                className={`group relative cursor-pointer hover:bg-gray-50 ${member.kicked_out ? "line-through text-gray-400" : ""}`}
              >
                <td className={`px-4 py-3 text-sm ${member.kicked_out ? "text-gray-400" : "text-gray-900"}`}>
                  <Link
                    href={`/admin/members/${member.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {member.name}
                  </Link>
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
                    ? formatDate(member.last_dinner_attended)
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
