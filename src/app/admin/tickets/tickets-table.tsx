"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";

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

type SortKey = "purchased" | "member" | "dinner" | "qty" | "amount" | "type" | "source" | "status";
type SortDir = "asc" | "desc";

function getSortValue(t: TicketRow, key: SortKey): string | number {
  switch (key) {
    case "purchased": return t.purchasedAt;
    case "member": return t.memberName.toLowerCase();
    case "dinner": return t.dinnerDate;
    case "qty": return t.quantity;
    case "amount": return t.amountPaid;
    case "type": return t.ticketType;
    case "source": return t.paymentSource;
    case "status": return t.fulfillmentStatus;
  }
}

function StatusPill({ status }: { status: string }) {
  const variant = {
    purchased: "neutral" as const,
    fulfilled: "success" as const,
    refunded: "danger" as const,
    credited: "warn" as const,
  }[status] ?? "neutral" as const;
  return <Pill variant={variant} dot>{status.charAt(0).toUpperCase() + status.slice(1)}</Pill>;
}

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

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />;
  }

  const thClass = "text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border cursor-pointer select-none hover:text-fg2 sticky top-0 z-10";

  return (
    <div>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search member…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!max-w-[360px]"
        />
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-border bg-bg">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass} onClick={() => toggleSort("purchased")}>Purchased<SortIcon col="purchased" /></th>
              <th className={thClass} onClick={() => toggleSort("member")}>Member<SortIcon col="member" /></th>
              <th className={thClass} onClick={() => toggleSort("dinner")}>Dinner<SortIcon col="dinner" /></th>
              <th className={thClass} onClick={() => toggleSort("qty")}>Qty<SortIcon col="qty" /></th>
              <th className={thClass} onClick={() => toggleSort("amount")}>Amount<SortIcon col="amount" /></th>
              <th className={thClass} onClick={() => toggleSort("source")}>Source<SortIcon col="source" /></th>
              <th className={thClass} onClick={() => toggleSort("status")}>Status<SortIcon col="status" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const kicked = t.kickedOut;
              return (
                <tr
                  key={t.id}
                  className={`group relative cursor-pointer border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated ${kicked ? "line-through" : ""}`}
                >
                  <td className={`px-3.5 py-3 text-[14px] ${kicked ? "text-fg4" : "text-fg2"}`}>
                    <Link href={`/admin/dinners/${t.dinnerId}`} className={`no-underline after:absolute after:inset-0 ${kicked ? "text-fg4" : "text-fg2"}`}>
                      {formatDate(t.purchasedAt)}
                    </Link>
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] font-medium ${kicked ? "text-fg4" : "text-fg1"}`}>
                    {t.memberName}
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] ${kicked ? "text-fg4" : "text-fg2"}`}>
                    {t.dinnerDisplay}
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] tabular-nums ${kicked ? "text-fg4" : "text-fg2"}`}>
                    {t.quantity}
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] tabular-nums ${kicked ? "text-fg4" : "text-fg2"}`}>
                    ${t.amountPaid.toFixed(2)}
                  </td>
                  <td className={`px-3.5 py-3 text-[14px] ${kicked ? "text-fg4" : "text-fg2"}`}>
                    {t.paymentSource}
                  </td>
                  <td className="px-3.5 py-3 text-sm">
                    <StatusPill status={t.fulfillmentStatus} />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3.5 py-6 text-center text-sm text-fg4">
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
