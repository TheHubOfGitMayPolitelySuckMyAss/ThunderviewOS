"use client";

import { useState, useTransition, useEffect, useRef, forwardRef } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toggleGuestsAllowed } from "./actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";

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

type SortKey = "date" | "paid" | "introAsk";
type SortDir = "asc" | "desc";

function getSortValue(d: DinnerStat, key: SortKey): string | number {
  switch (key) {
    case "date": return d.date;
    case "paid": return d.paid;
    case "introAsk": return d.introAsk;
  }
}

export default function DinnersTable({ dinners, nextDinnerId }: { dinners: DinnerStat[]; nextDinnerId: string | null }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const nextDinnerRowRef = useRef<HTMLTableRowElement>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (hasScrolled.current) return;
    const container = scrollContainerRef.current;
    const row = nextDinnerRowRef.current;
    if (!container || !row) return;
    requestAnimationFrame(() => {
      const thead = container.querySelector("thead");
      const headerHeight = thead?.getBoundingClientRect().height ?? 0;
      const rowTop = row.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollTop += (rowTop - containerTop - headerHeight);
      hasScrolled.current = true;
    });
  }, []);

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

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />;
  }

  const thBase = "text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-cream-100 border-b border-line-200 cursor-pointer select-none hover:text-fg2 sticky top-0 z-10";
  const thNum = "w-20 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-2 py-2.5 bg-cream-100 border-b border-line-200 cursor-pointer select-none hover:text-fg2 sticky top-0 z-10";

  return (
    <div ref={scrollContainerRef} className="max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-line-200 bg-cream-50">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={thBase} onClick={() => toggleSort("date")}>
              Date<SortIcon col="date" />
            </th>
            <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-cream-100 border-b border-line-200 sticky top-0 z-10">
              Venue
            </th>
            <th className={thNum} onClick={() => toggleSort("paid")}>
              Paid<SortIcon col="paid" />
            </th>
            <th className={thNum} onClick={() => toggleSort("introAsk")}>
              Intro/Ask<SortIcon col="introAsk" />
            </th>
            <th className="w-20 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-2 py-2.5 bg-cream-100 border-b border-line-200 sticky top-0 z-10">
              Guests
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((dinner) => (
            <DinnerRow
              key={dinner.id}
              dinner={dinner}
              isNext={dinner.id === nextDinnerId}
              ref={dinner.id === nextDinnerId ? nextDinnerRowRef : undefined}
            />
          ))}
          {dinners.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3.5 py-8 text-center text-sm text-fg4">
                No dinners found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const DinnerRow = forwardRef<HTMLTableRowElement, { dinner: DinnerStat; isNext: boolean }>(function DinnerRow({ dinner, isNext }, ref) {
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
      <tr
        ref={ref}
        className={`group relative cursor-pointer border-b border-line-100 last:border-b-0 hover:bg-cream-100 ${isNext ? "bg-[rgba(181,131,90,0.06)]" : ""}`}
      >
        <td className="whitespace-nowrap px-3.5 py-3 text-[14px] text-fg1 font-medium">
          <Link href={`/admin/dinners/${dinner.id}`} className="no-underline text-fg1 after:absolute after:inset-0">
            {formatDate(dinner.date, { month: "short", day: "numeric", year: "numeric" })}
          </Link>
          {isNext && <Pill variant="accent" className="ml-1.5 !py-0 !px-2 !text-[11px]">Next</Pill>}
        </td>
        <td className="px-3.5 py-3 text-[14px] text-fg2">
          {dinner.venue || "ID345"} &middot; Denver
        </td>
        <td className="w-20 px-2 py-3 text-center text-[14px] tabular-nums text-fg2">
          {dinner.paid}
        </td>
        <td className="w-20 px-2 py-3 text-center text-[14px] tabular-nums text-fg2">
          {isNext ? dinner.introAsk : "\u2014"}
        </td>
        <td className="relative z-10 w-20 px-2 py-3 text-center text-[14px]">
          {isPending ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-200 border-t-clay-500" />
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className={`cursor-pointer font-medium ${dinner.guestsAllowed ? "text-moss-600 hover:underline" : "text-fg4 hover:text-fg3"}`}
            >
              {dinner.guestsAllowed ? "Yes" : "No"}
            </button>
          )}
        </td>
      </tr>

      {showModal && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="mx-4 w-full max-w-sm rounded-lg bg-cream-50 border border-line-200 p-6 shadow-lg">
                <p className="text-sm text-fg1">
                  Switch guest tickets for{" "}
                  {formatDate(dinner.date, { month: "long", day: "numeric", year: "numeric" })}{" "}
                  to <strong>{newValue ? "allowed" : "not allowed"}</strong>?
                </p>
                <div className="mt-4 flex justify-end gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirm} disabled={isPending}>
                    {isPending ? "…" : "Confirm"}
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});
