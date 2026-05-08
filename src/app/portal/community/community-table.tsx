"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatName, formatStageType } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { Input } from "@/components/ui/input";

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
  current_give: string | null;
  contact_preference: string | null;
  profile_pic_url: string | null;
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
          (m.current_give || "").toLowerCase().includes(s) ||
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

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="inline ml-1" />
    ) : (
      <ArrowDown size={12} className="inline ml-1" />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search name, company, role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!max-w-sm"
        />
      </div>

      <div className="rounded-xl border border-border bg-bg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {(["name", "company", "role"] as SortKey[]).map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-4 py-3 bg-bg-elevated border-b border-border cursor-pointer select-none hover:text-fg2 sticky top-0 z-10"
                >
                  {col === "name" ? "Name" : col === "company" ? "Company" : "Role"}
                  <SortIcon col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => (
              <tr
                key={member.id}
                className="group relative cursor-pointer border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated"
              >
                <td className="px-4 py-3.5 text-sm">
                  <Link
                    href={`/portal/members/${member.id}`}
                    className="flex items-center gap-3 text-fg1 font-medium no-underline after:absolute after:inset-0"
                  >
                    <MemberAvatar member={member} size="sm" />
                    {formatName(member.first_name, member.last_name)}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-[13px] text-fg2">
                  {member.company_name || "\u2014"}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-fg3">
                  {member.attendee_stagetypes.length > 0
                    ? member.attendee_stagetypes.map(formatStageType).join(", ")
                    : "\u2014"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-fg4"
                >
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-fg4">
        {sorted.length} member{sorted.length !== 1 ? "s" : ""}
        {search ? ` matching \u201C${search}\u201D` : ""}
      </p>
    </div>
  );
}
