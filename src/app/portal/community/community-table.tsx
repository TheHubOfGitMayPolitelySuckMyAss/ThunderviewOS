"use client";

import { useState } from "react";
import Link from "next/link";
import { formatName, formatStageType } from "@/lib/format";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_website: string | null;
  linkedin_profile: string | null;
  attendee_stagetypes: string[];
  current_intro: string | null;
  current_ask: string | null;
  contact_preference: string | null;
};

type SortKey = "name" | "company" | "role";
type SortDir = "asc" | "desc";

function getSortValue(member: Member, key: SortKey): string {
  switch (key) {
    case "name":
      return formatName(member.first_name, member.last_name).toLowerCase();
    case "company":
      return (member.company_name || "").toLowerCase();
    case "role":
      return member.attendee_stagetypes.join(", ").toLowerCase();
  }
}

export default function CommunityTable({ members }: { members: Member[] }) {
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
    ? members.filter((m) => {
        const s = search.toLowerCase();
        const fullName = formatName(m.first_name, m.last_name).toLowerCase();
        return (
          m.first_name.toLowerCase().includes(s) ||
          m.last_name.toLowerCase().includes(s) ||
          fullName.includes(s) ||
          (m.company_name || "").toLowerCase().includes(s) ||
          (m.company_website || "").toLowerCase().includes(s) ||
          (m.linkedin_profile || "").toLowerCase().includes(s) ||
          (m.current_intro || "").toLowerCase().includes(s) ||
          (m.current_ask || "").toLowerCase().includes(s) ||
          (m.contact_preference || "").toLowerCase().includes(s) ||
          m.attendee_stagetypes.some((st) => st.toLowerCase().includes(s))
        );
      })
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
    return (
      <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className={thClass} onClick={() => toggleSort("name")}>
                Name
                <SortIndicator col="name" />
              </th>
              <th className={thClass} onClick={() => toggleSort("company")}>
                Company
                <SortIndicator col="company" />
              </th>
              <th className={thClass} onClick={() => toggleSort("role")}>
                Role
                <SortIndicator col="role" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((member) => (
              <tr
                key={member.id}
                className="group relative cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm text-gray-900">
                  <Link
                    href={`/portal/members/${member.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {formatName(member.first_name, member.last_name)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {member.company_name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {member.attendee_stagetypes.length > 0
                    ? member.attendee_stagetypes.map(formatStageType).join(", ")
                    : "-"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        {sorted.length} member{sorted.length !== 1 ? "s" : ""}
        {search ? ` matching "${search}"` : ""}
      </p>
    </div>
  );
}
