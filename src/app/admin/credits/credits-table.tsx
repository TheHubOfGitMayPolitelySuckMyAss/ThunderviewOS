"use client";

import { useState } from "react";
import { formatDate, formatName } from "@/lib/format";

type Credit = {
  id: string;
  member_id: string;
  source_ticket_id: string;
  status: string;
  redeemed_ticket_id: string | null;
  created_at: string;
  redeemed_at: string | null;
  members: { first_name: string; last_name: string; member_emails: { email: string; is_primary: boolean }[] } | null;
  source_ticket: { dinner_id: string; dinners: { date: string } | null } | null;
  redeemed_ticket: {
    dinner_id: string;
    dinners: { date: string } | null;
  } | null;
};

const filters = ["All", "Outstanding", "Redeemed"] as const;

type SortKey = "member" | "email" | "sourceDinner" | "status" | "redeemedDinner" | "created";
type SortDir = "asc" | "desc";

function getPrimaryEmail(credit: Credit): string {
  return credit.members?.member_emails?.find((e) => e.is_primary)?.email
    ?? credit.members?.member_emails?.[0]?.email ?? "-";
}

function getSortValue(credit: Credit, key: SortKey): string {
  switch (key) {
    case "member": return (credit.members ? formatName(credit.members.first_name, credit.members.last_name) : "").toLowerCase();
    case "email": return getPrimaryEmail(credit).toLowerCase();
    case "sourceDinner": return credit.source_ticket?.dinners?.date || "";
    case "status": return credit.status;
    case "redeemedDinner": return credit.redeemed_ticket?.dinners?.date || "";
    case "created": return credit.created_at;
  }
}

export default function CreditsTable({ credits }: { credits: Credit[] }) {
  const [filter, setFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered =
    filter === "All"
      ? credits
      : credits.filter(
          (c) => c.status === filter.toLowerCase()
        );

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
      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className={thClass} onClick={() => toggleSort("member")}>
                Member<SortIndicator col="member" />
              </th>
              <th className={thClass} onClick={() => toggleSort("email")}>
                Email<SortIndicator col="email" />
              </th>
              <th className={thClass} onClick={() => toggleSort("sourceDinner")}>
                Source Dinner<SortIndicator col="sourceDinner" />
              </th>
              <th className={thClass} onClick={() => toggleSort("status")}>
                Status<SortIndicator col="status" />
              </th>
              <th className={thClass} onClick={() => toggleSort("redeemedDinner")}>
                Redeemed Dinner<SortIndicator col="redeemedDinner" />
              </th>
              <th className={thClass} onClick={() => toggleSort("created")}>
                Created<SortIndicator col="created" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((credit) => (
              <tr key={credit.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {credit.members ? formatName(credit.members.first_name, credit.members.last_name) : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {getPrimaryEmail(credit)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {credit.source_ticket?.dinners?.date
                    ? formatDate(credit.source_ticket.dinners.date)
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      credit.status === "outstanding"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {credit.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {credit.redeemed_ticket?.dinners?.date
                    ? formatDate(credit.redeemed_ticket.dinners.date)
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDate(credit.created_at)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  No credits found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
