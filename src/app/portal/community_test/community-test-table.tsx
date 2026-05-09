"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { formatName } from "@/lib/format";
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
  current_intro_short: string | null;
  current_ask_short: string | null;
  current_give_short: string | null;
  contact_preference: string | null;
  profile_pic_url: string | null;
};

type SortKey = "first_name" | "last_name" | "company";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "company", label: "Company" },
];

function getSortValue(member: Member, key: SortKey): string {
  switch (key) {
    case "first_name":
      return (member.first_name || "").toLowerCase();
    case "last_name":
      return (member.last_name || "").toLowerCase();
    case "company":
      return (member.company_name || "").toLowerCase();
  }
}

export default function CommunityTestTable({ members }: { members: Member[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("first_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const headerRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function pickSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setMenuOpen(false);
  }

  const completeFiltered = showIncomplete
    ? members
    : members.filter(
        (m) =>
          m.current_intro_short ||
          m.current_ask_short ||
          m.current_give_short,
      );

  const filtered = search
    ? completeFiltered.filter((m) => {
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
    : completeFiltered;

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const headerLabels = ["Name/Company", "Intro", "Ask", "Give"];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Input
          type="text"
          placeholder="Search name, company, intro, ask, give…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!max-w-sm"
        />
        <label className="flex items-center gap-2 text-[13px] text-fg2 select-none cursor-pointer">
          Show members without intros/asks
          <button
            type="button"
            role="switch"
            aria-checked={showIncomplete}
            onClick={() => setShowIncomplete((v) => !v)}
            className={
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-[120ms] " +
              (showIncomplete ? "bg-accent" : "bg-border")
            }
          >
            <span
              className={
                "inline-block h-4 w-4 transform rounded-full bg-bg shadow transition-transform duration-[120ms] " +
                (showIncomplete ? "translate-x-[18px]" : "translate-x-0.5")
              }
            />
          </button>
        </label>
      </div>

      <div className="rounded-xl border border-border bg-bg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                ref={headerRef}
                onClick={() => setMenuOpen((v) => !v)}
                className="relative text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-4 py-3 bg-bg-elevated border-b border-border select-none sticky top-0 z-10 cursor-pointer hover:text-fg2 w-[280px]"
              >
                <span className="inline-flex items-center gap-1">
                  Name/Company
                  <ChevronDown size={12} />
                  {sortDir === "asc" ? (
                    <ArrowUp size={12} className="ml-1" />
                  ) : (
                    <ArrowDown size={12} className="ml-1" />
                  )}
                </span>
                {menuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-3 top-full mt-1 w-44 rounded-lg border border-border bg-bg shadow-lg overflow-hidden normal-case tracking-normal font-normal text-[13px] text-fg2"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const active = sortKey === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => pickSort(opt.key)}
                          className={
                            "w-full text-left px-3 py-2 hover:bg-bg-elevated flex items-center justify-between " +
                            (active ? "text-fg1 font-medium" : "")
                          }
                        >
                          <span>{opt.label}</span>
                          {active && (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </th>
              {headerLabels.slice(1).map((label) => (
                <th
                  key={label}
                  className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-4 py-3 bg-bg-elevated border-b border-border select-none sticky top-0 z-10"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => (
              <tr
                key={member.id}
                className="group relative cursor-pointer border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated align-top"
              >
                <td className="px-4 py-3.5">
                  <Link
                    href={`/portal/members/${member.id}`}
                    className="flex items-start gap-3 no-underline after:absolute after:inset-0"
                  >
                    <MemberAvatar member={member} size="sm" />
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold text-fg1">
                        {formatName(member.first_name, member.last_name)}
                      </span>
                      <span className="text-[12px] text-fg3 mt-0.5">
                        {member.company_name || ""}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-[13px] text-fg2">
                  {member.current_intro_short || ""}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-fg2">
                  {member.current_ask_short || ""}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-fg2">
                  {member.current_give_short || ""}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-fg4">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-fg4">
        {sorted.length} member{sorted.length !== 1 ? "s" : ""}
        {search ? ` matching “${search}”` : ""}
      </p>
    </div>
  );
}
