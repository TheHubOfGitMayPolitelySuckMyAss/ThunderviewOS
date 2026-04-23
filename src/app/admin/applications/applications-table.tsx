"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import { formatDate, formatName, formatStageType } from "@/lib/format";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";

type Application = {
  id: string;
  submitted_on: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  attendee_stagetype: string;
  preferred_dinner_date: string;
  status: string;
};

const filters = ["Pending", "Approved", "Rejected", "All"] as const;

type SortKey = "name" | "email" | "company" | "stage" | "dinner" | "status" | "submitted";
type SortDir = "asc" | "desc";

function getSortValue(app: Application, key: SortKey): string {
  switch (key) {
    case "name": return formatName(app.first_name, app.last_name).toLowerCase();
    case "email": return app.email.toLowerCase();
    case "company": return app.company_name.toLowerCase();
    case "stage": return app.attendee_stagetype.toLowerCase();
    case "dinner": return app.preferred_dinner_date;
    case "status": return app.status;
    case "submitted": return app.submitted_on;
  }
}

function StatusPill({ status }: { status: string }) {
  const variant = {
    pending: "warn" as const,
    approved: "success" as const,
    rejected: "danger" as const,
  }[status] ?? "neutral" as const;
  return <Pill variant={variant} dot>{status.charAt(0).toUpperCase() + status.slice(1)}</Pill>;
}

export default function ApplicationsTable({
  applications,
}: {
  applications: Application[];
}) {
  const [filter, setFilter] = useState<string>("Pending");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const byFilter =
    filter === "All"
      ? applications
      : applications.filter((a) => a.status === filter.toLowerCase());

  const filtered = search
    ? byFilter.filter((a) => {
        const s = search.toLowerCase();
        return (
          formatName(a.first_name, a.last_name).toLowerCase().includes(s) ||
          a.email.toLowerCase().includes(s) ||
          a.company_name.toLowerCase().includes(s)
        );
      })
    : byFilter;

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

  const thClass = "text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-cream-100 border-b border-line-200 cursor-pointer select-none hover:text-fg2 sticky top-0 z-10";

  return (
    <div>
      {/* Search + filter tabs */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          type="text"
          placeholder="Search name, company, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!max-w-[360px]"
        />
        <div className="flex gap-1 bg-cream-100 p-1 rounded-md border border-line-200">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium cursor-pointer ${
                filter === f
                  ? "bg-ink-900 text-cream-50"
                  : "bg-transparent text-fg2 hover:bg-cream-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-line-200 bg-cream-50">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass} onClick={() => toggleSort("submitted")}>
                Received<SortIcon col="submitted" />
              </th>
              <th className={thClass} onClick={() => toggleSort("name")}>
                Name<SortIcon col="name" />
              </th>
              <th className={thClass} onClick={() => toggleSort("company")}>
                Company<SortIcon col="company" />
              </th>
              <th className={thClass} onClick={() => toggleSort("stage")}>
                Stage<SortIcon col="stage" />
              </th>
              <th className={thClass} onClick={() => toggleSort("status")}>
                Status<SortIcon col="status" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((app) => {
              const isRejected = app.status === "rejected";
              return (
                <tr
                  key={app.id}
                  className="group relative cursor-pointer border-b border-line-100 last:border-b-0 hover:bg-cream-100"
                >
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {formatDate(app.submitted_on, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] font-medium ${isRejected ? "text-fg4 line-through" : "text-fg1"}`}>
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className={`no-underline after:absolute after:inset-0 ${isRejected ? "text-fg4" : "text-fg1"}`}
                    >
                      {formatName(app.first_name, app.last_name)}
                    </Link>
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {app.company_name}
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {formatStageType(app.attendee_stagetype)}
                  </td>
                  <td className="px-3.5 py-3 text-sm">
                    <StatusPill status={app.status} />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3.5 py-6 text-center text-sm text-fg4">
                  No applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
