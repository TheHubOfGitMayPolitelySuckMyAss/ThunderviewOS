"use client";

import { useState } from "react";
import Link from "next/link";

type DinnerStat = {
  id: string;
  date: string;
  venue: string;
  applied: number;
  approved: number;
  paid: number;
  introAsk: number;
};

type SortKey = "date" | "applied" | "approved" | "paid" | "introAsk";
type SortDir = "asc" | "desc";

function getSortValue(d: DinnerStat, key: SortKey): string | number {
  switch (key) {
    case "date": return d.date;
    case "applied": return d.applied;
    case "approved": return d.approved;
    case "paid": return d.paid;
    case "introAsk": return d.introAsk;
  }
}

export default function DinnersTable({ dinners }: { dinners: DinnerStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...dinners].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const thClass =
    "px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 cursor-pointer select-none hover:text-gray-700";
  const thNumClass =
    "w-20 px-2 py-3 text-center text-xs font-medium uppercase text-gray-500 cursor-pointer select-none hover:text-gray-700";

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  }

  return (
    <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr>
            <th className={thClass} onClick={() => toggleSort("date")}>
              Date<SortIndicator col="date" />
            </th>
            <th className={thNumClass} onClick={() => toggleSort("applied")}>
              Applied<SortIndicator col="applied" />
            </th>
            <th className={thNumClass} onClick={() => toggleSort("approved")}>
              Approved<SortIndicator col="approved" />
            </th>
            <th className={thNumClass} onClick={() => toggleSort("paid")}>
              Paid<SortIndicator col="paid" />
            </th>
            <th className={thNumClass} onClick={() => toggleSort("introAsk")}>
              Intro/Ask<SortIndicator col="introAsk" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sorted.map((dinner) => (
            <tr key={dinner.id} className="group relative hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                <Link
                  href={`/admin/dinners/${dinner.id}`}
                  className="after:absolute after:inset-0"
                >
                  {new Date(dinner.date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }
                  )}
                </Link>
              </td>
              <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                {dinner.applied}
              </td>
              <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                {dinner.approved}
              </td>
              <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                {dinner.paid}
              </td>
              <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                {dinner.introAsk}
              </td>
            </tr>
          ))}
          {dinners.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-6 py-8 text-center text-sm text-gray-400"
              >
                No dinners found. Run the seed script to generate dinner
                dates.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
