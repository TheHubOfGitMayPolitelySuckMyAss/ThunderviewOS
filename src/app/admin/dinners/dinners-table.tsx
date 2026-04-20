"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { toggleGuestsAllowed } from "./actions";
import { useRouter } from "next/navigation";

type DinnerStat = {
  id: string;
  date: string;
  venue: string;
  guestsAllowed: boolean;
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
            <th className="w-20 px-2 py-3 text-center text-xs font-medium uppercase text-gray-500">
              Guests
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sorted.map((dinner) => (
            <DinnerRow key={dinner.id} dinner={dinner} />
          ))}
          {dinners.length === 0 && (
            <tr>
              <td
                colSpan={6}
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

function DinnerRow({ dinner }: { dinner: DinnerStat }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const newValue = !dinner.guestsAllowed;

  function handleConfirm() {
    startTransition(async () => {
      const result = await toggleGuestsAllowed(dinner.id, newValue);
      if (result.success) {
        setShowModal(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <tr className="group relative hover:bg-gray-50">
        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
          <Link
            href={`/admin/dinners/${dinner.id}`}
            className="after:absolute after:inset-0"
          >
            {formatDate(dinner.date, {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
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
        <td className="relative z-10 w-20 px-2 py-4 text-center text-sm">
          <button
            onClick={() => setShowModal(true)}
            className={`cursor-pointer font-medium ${dinner.guestsAllowed ? "text-green-600 hover:text-green-800" : "text-gray-400 hover:text-gray-600"}`}
          >
            {dinner.guestsAllowed ? "Yes" : "No"}
          </button>
        </td>
      </tr>

      {showModal && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                <p className="text-sm text-gray-900">
                  Switch guest tickets for{" "}
                  {formatDate(dinner.date, { month: "long", day: "numeric", year: "numeric" })}{" "}
                  to <strong>{newValue ? "allowed" : "not allowed"}</strong>?
                </p>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isPending ? "..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
