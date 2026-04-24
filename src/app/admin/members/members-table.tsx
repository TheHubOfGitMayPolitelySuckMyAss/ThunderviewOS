"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown } from "lucide-react";
import { formatDate, formatName, formatStageType } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddMemberModal from "./add-member-modal";

type MemberEmail = {
  id: string;
  email: string;
  is_primary: boolean;
  source: string;
  email_status: string;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  member_emails: MemberEmail[];
  contact_preference: string;
  linkedin_profile: string | null;
  company_name: string | null;
  company_website: string | null;
  attendee_stagetypes: string[];
  marketing_opted_in: boolean;
  kicked_out: boolean;
  last_dinner_attended: string | null;
  profile_pic_url: string | null;
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
    case "name": return formatName(member.first_name, member.last_name).toLowerCase();
    case "email": return getPrimaryEmail(member).toLowerCase();
    case "company": return (member.company_name || "").toLowerCase();
    case "stage": return member.attendee_stagetypes.join(", ").toLowerCase();
    case "lastDinner": return member.last_dinner_attended || "";
    case "marketing": return member.marketing_opted_in ? "yes" : "no";
  }
}

export default function MembersTable({
  members,
  upcomingDinners,
}: {
  members: Member[];
  upcomingDinners: { id: string; date: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addedName, setAddedName] = useState<string | null>(null);
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
          m.member_emails.some((e) => e.email.toLowerCase().includes(s))
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
    return sortDir === "asc" ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />;
  }

  const thClass = "text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border cursor-pointer select-none hover:text-fg2 sticky top-0 z-10";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Input
          type="text"
          placeholder="Search name, company, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!max-w-[360px]"
        />
        <Button onClick={() => setShowAddModal(true)}>+ Add Member</Button>
      </div>

      {showAddModal && (
        <AddMemberModal
          dinners={upcomingDinners}
          onClose={() => setShowAddModal(false)}
          onSuccess={(name) => {
            setShowAddModal(false);
            setAddedName(name);
            router.refresh();
          }}
        />
      )}

      {addedName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 rounded-lg bg-bg border border-border px-8 py-6 text-center shadow-lg">
            <p className="tv-h4">{addedName} added!</p>
            <Button variant="secondary" className="mt-4" onClick={() => setAddedName(null)}>
              Onwards!
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-border bg-bg">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass} onClick={() => toggleSort("name")}>Name<SortIcon col="name" /></th>
              <th className={thClass} onClick={() => toggleSort("company")}>Company<SortIcon col="company" /></th>
              <th className={thClass} onClick={() => toggleSort("stage")}>Stage<SortIcon col="stage" /></th>
              <th className={thClass} onClick={() => toggleSort("lastDinner")}>Last Dinner<SortIcon col="lastDinner" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => {
              const kicked = member.kicked_out;
              return (
                <tr
                  key={member.id}
                  className={`group relative cursor-pointer border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated ${kicked ? "line-through" : ""}`}
                >
                  <td className={`px-3.5 py-3 text-[14px] ${kicked ? "text-fg4" : "text-fg1"} font-medium`}>
                    <Link
                      href={`/admin/members/${member.id}`}
                      className={`flex items-center gap-2 no-underline after:absolute after:inset-0 ${kicked ? "text-fg4" : "text-fg1"}`}
                    >
                      <MemberAvatar member={member} size="sm" />
                      {formatName(member.first_name, member.last_name)}
                    </Link>
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] ${kicked ? "text-fg4" : "text-fg2"}`}>
                    {member.company_name || "\u2014"}
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] ${kicked ? "text-fg4" : "text-fg2"}`}>
                    {member.attendee_stagetypes.length > 0
                      ? member.attendee_stagetypes.map(formatStageType).join(", ")
                      : "\u2014"}
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] ${kicked ? "text-fg4" : "text-fg2"}`}>
                    {member.last_dinner_attended
                      ? formatDate(member.last_dinner_attended)
                      : "\u2014"}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3.5 py-6 text-center text-sm text-fg4">
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
