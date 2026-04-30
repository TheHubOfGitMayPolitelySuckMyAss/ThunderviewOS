"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { fetchMemberHistory } from "./member-history-actions";
import type { FeedRow } from "@/lib/activity-feed";
import { formatTimestamp } from "@/lib/format";

type Props = {
  memberId: string;
  initialRows: FeedRow[];
  initialTotal: number;
  pageSize: number;
  allEventTypes: string[];
};

export default function MemberHistoryClient(props: Props) {
  const [rows, setRows] = useState<FeedRow[]>(props.initialRows);
  const [total, setTotal] = useState(props.initialTotal);
  const [page, setPage] = useState(1);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [pending, start] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / props.pageSize));

  function refetch(nextPage: number, nextEvents: string[]) {
    start(async () => {
      const r = await fetchMemberHistory({
        memberId: props.memberId,
        page: nextPage,
        pageSize: props.pageSize,
        eventTypes: nextEvents,
      });
      setRows(r.rows);
      setTotal(r.total);
      setPage(nextPage);
    });
  }

  function toggleEventType(t: string) {
    const set = new Set(eventTypes);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    const next = Array.from(set);
    setEventTypes(next);
    refetch(1, next);
  }

  function clearFilter() {
    setEventTypes([]);
    refetch(1, []);
  }

  return (
    <div className="space-y-stack">
      {/* Filter */}
      <div className="flex items-end gap-3 mb-tight relative">
        <div className="relative">
          <label className="block text-[12px] font-medium text-fg2 mb-1">Event type</label>
          <button
            type="button"
            onClick={() => setEventTypeOpen(!eventTypeOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-bg text-sm hover:bg-bg-tinted min-w-[180px] justify-between"
          >
            <span>{eventTypes.length === 0 ? "All events" : `${eventTypes.length} selected`}</span>
            <span className="text-fg3">▾</span>
          </button>
          {eventTypeOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEventTypeOpen(false)} />
              <div className="absolute mt-1 w-[280px] max-h-[360px] overflow-y-auto rounded-md border border-border bg-bg-elevated shadow-glow z-20 p-2">
                {props.allEventTypes.length === 0 ? (
                  <div className="text-fg3 text-sm p-2">No events yet</div>
                ) : (
                  props.allEventTypes.map((t) => (
                    <label
                      key={t}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-bg-tinted rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={eventTypes.includes(t)}
                        onChange={() => toggleEventType(t)}
                      />
                      <span className="font-mono text-[12.5px]">{t}</span>
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        {eventTypes.length > 0 && (
          <Button variant="ghost" onClick={clearFilter}>
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-tinted text-fg2 text-[12.5px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">When</th>
              <th className="text-left px-4 py-2 font-medium">Event</th>
              <th className="text-left px-4 py-2 font-medium">Summary</th>
              <th className="text-left px-4 py-2 font-medium">Actor</th>
              <th className="text-left px-4 py-2 font-medium">Subject</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg3">
                  {pending ? "Loading…" : "No history yet."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.source}:${r.source_id}`} className="border-t border-border align-top">
                  <td className="px-4 py-2.5 text-fg2 whitespace-nowrap">
                    {formatTimestamp(r.occurred_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill variant="neutral" className="font-mono text-[11.5px]">
                      {r.event_type}
                    </Pill>
                  </td>
                  <td className="px-4 py-2.5">{r.summary}</td>
                  <td className="px-4 py-2.5">
                    {r.actor_id ? (
                      <Link className="text-accent hover:underline" href={`/admin/members/${r.actor_id}`}>
                        {r.actor_name ?? "Unknown"}
                      </Link>
                    ) : (
                      <span className="text-fg3">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.subject_member_id ? (
                      <Link
                        className="text-accent hover:underline"
                        href={`/admin/members/${r.subject_member_id}`}
                      >
                        {r.subject_name ?? "Unknown"}
                      </Link>
                    ) : (
                      <span className="text-fg3">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-tight">
        <span className="text-fg3 text-[13px]">
          {total === 0 ? "0 events" : `Page ${page} of ${totalPages} · ${total} events`}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={page <= 1 || pending} onClick={() => refetch(page - 1, eventTypes)}>
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={page >= totalPages || pending}
            onClick={() => refetch(page + 1, eventTypes)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
