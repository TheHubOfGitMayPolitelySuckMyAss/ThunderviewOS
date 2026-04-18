"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";

type TicketRow = {
  id: string;
  purchasedAt: string;
  memberName: string;
  memberFirstName: string;
  memberLastName: string;
  kickedOut: boolean;
  dinnerDate: string;
  dinnerDisplay: string;
  dinnerId: string;
  quantity: number;
  amountPaid: number;
  ticketType: string;
  paymentSource: string;
  fulfillmentStatus: string;
};

type SortKey =
  | "purchased"
  | "member"
  | "dinner"
  | "qty"
  | "amount"
  | "type"
  | "source"
  | "status";
type SortDir = "asc" | "desc";

function getSortValue(t: TicketRow, key: SortKey): string | number {
  switch (key) {
    case "purchased":
      return t.purchasedAt;
    case "member":
      return t.memberName.toLowerCase();
    case "dinner":
      return t.dinnerDate;
    case "qty":
      return t.quantity;
    case "amount":
      return t.amountPaid;
    case "type":
      return t.ticketType;
    case "source":
      return t.paymentSource;
    case "status":
      return t.fulfillmentStatus;
  }
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  fulfilled: "bg-green-100 text-green-800",
  refunded: "bg-red-100 text-red-800",
  credited: "bg-yellow-100 text-yellow-800",
};

export default function TicketsTable({ tickets }: { tickets: TicketRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("purchased");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "purchased" || key === "dinner" ? "desc" : "asc");
    }
  }

  const filtered = search
    ? tickets.filter((t) => {
        const s = search.toLowerCase();
        return (
          t.memberFirstName.toLowerCase().includes(s) ||
          t.memberLastName.toLowerCase().includes(s) ||
          t.memberName.toLowerCase().includes(s)
        );
      })
    : tickets;

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
          placeholder="Search by member name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th className={thClass} onClick={() => toggleSort("purchased")}>
                Purchased
                <SortIndicator col="purchased" />
              </th>
              <th className={thClass} onClick={() => toggleSort("member")}>
                Member
                <SortIndicator col="member" />
              </th>
              <th className={thClass} onClick={() => toggleSort("dinner")}>
                Dinner
                <SortIndicator col="dinner" />
              </th>
              <th className={thClass} onClick={() => toggleSort("qty")}>
                Qty
                <SortIndicator col="qty" />
              </th>
              <th className={thClass} onClick={() => toggleSort("amount")}>
                Amount
                <SortIndicator col="amount" />
              </th>
              <th className={thClass} onClick={() => toggleSort("type")}>
                Type
                <SortIndicator col="type" />
              </th>
              <th className={thClass} onClick={() => toggleSort("source")}>
                Source
                <SortIndicator col="source" />
              </th>
              <th className={thClass} onClick={() => toggleSort("status")}>
                Status
                <SortIndicator col="status" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((t) => (
              <tr
                key={t.id}
                className="group relative cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm text-gray-500">
                  <Link
                    href={`/admin/dinners/${t.dinnerId}`}
                    className="after:absolute after:inset-0"
                  >
                    {formatDate(t.purchasedAt)}
                  </Link>
                </td>
                <td
                  className={`px-4 py-3 text-sm ${t.kickedOut ? "text-gray-400 line-through" : "text-gray-900"}`}
                >
                  {t.memberName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {t.dinnerDisplay}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {t.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  ${t.amountPaid.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {t.ticketType}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {t.paymentSource}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[t.fulfillmentStatus] || "bg-gray-100 text-gray-800"}`}
                  >
                    {t.fulfillmentStatus}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
