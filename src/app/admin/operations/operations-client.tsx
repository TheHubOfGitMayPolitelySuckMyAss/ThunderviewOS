"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchMembersForActor } from "./actions";
import type { FeedRow, FeedKind } from "@/lib/activity-feed";
import { formatTimestamp } from "@/lib/format";
import { ChevronDown } from "lucide-react";

type Props = {
  kind: FeedKind;
  page: number;
  pageSize: number;
  total: number;
  rows: FeedRow[];
  feedError: string | null;
  allEventTypes: string[];
  eventTypes: string[];
  actorMemberId: string | null;
  fromDate: string | null;
  toDate: string | null;
};

export default function OperationsClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [actorQuery, setActorQuery] = useState("");
  const [actorResults, setActorResults] = useState<{ id: string; name: string }[]>([]);
  const [actorName, setActorName] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Reset page when filters change (but not when setting page itself)
    if (key !== "page") params.delete("page");
    router.push(`/admin/operations?${params.toString()}`);
  }

  function toggleTab(tab: FeedKind) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("page");
    params.delete("events"); // event types are tab-specific
    router.push(`/admin/operations?${params.toString()}`);
  }

  function toggleEventType(t: string) {
    const set = new Set(props.eventTypes);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    setParam("events", Array.from(set).join(","));
  }

  async function onActorChange(q: string) {
    setActorQuery(q);
    if (q.trim().length < 2) {
      setActorResults([]);
      return;
    }
    const r = await searchMembersForActor(q);
    setActorResults(r);
  }

  function selectActor(m: { id: string; name: string }) {
    setActorName(m.name);
    setActorQuery("");
    setActorResults([]);
    setParam("actor", m.id);
  }

  function clearActor() {
    setActorName(null);
    setParam("actor", null);
  }

  const tabClasses = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md transition ${
      active ? "bg-ink-900 text-cream-50" : "text-fg2 hover:bg-bg-tinted"
    }`;

  return (
    <div className="space-y-stack">
      {/* Tabs */}
      <div className="flex gap-2 mb-tight">
        <button onClick={() => toggleTab("people")} className={tabClasses(props.kind === "people")}>
          People
        </button>
        <button onClick={() => toggleTab("system")} className={tabClasses(props.kind === "system")}>
          System
        </button>
        <button onClick={() => toggleTab("marketing")} className={tabClasses(props.kind === "marketing")}>
          Marketing
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end mb-tight relative z-10">
        {/* Event type multi-select */}
        <div className="relative">
          <label className="block text-[12px] font-medium text-fg2 mb-1">Event type</label>
          <button
            type="button"
            onClick={() => setEventTypeOpen(!eventTypeOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-bg text-sm hover:bg-bg-tinted min-w-[180px] justify-between"
          >
            <span>
              {props.eventTypes.length === 0
                ? "All events"
                : `${props.eventTypes.length} selected`}
            </span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-fg2" />
          </button>
          {eventTypeOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setEventTypeOpen(false)}
              />
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
                        checked={props.eventTypes.includes(t)}
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

        {/* Actor search */}
        <div className="relative">
          <label className="block text-[12px] font-medium text-fg2 mb-1">Actor</label>
          {props.actorMemberId ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 rounded-md border border-border bg-bg-elevated text-sm">
                {actorName ?? "Selected"}
              </span>
              <button
                type="button"
                onClick={clearActor}
                className="text-fg3 hover:text-fg1 text-sm"
              >
                clear
              </button>
            </div>
          ) : (
            <>
              <Input
                value={actorQuery}
                onChange={(e) => onActorChange(e.target.value)}
                placeholder="Search members..."
                className="min-w-[200px]"
              />
              {actorResults.length > 0 && (
                <div className="absolute mt-1 w-[280px] max-h-[280px] overflow-y-auto rounded-md border border-border bg-bg-elevated shadow-glow z-20">
                  {actorResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectActor(m)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-bg-tinted"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Date range */}
        <div>
          <label className="block text-[12px] font-medium text-fg2 mb-1">From</label>
          <Input
            type="date"
            defaultValue={props.fromDate ?? ""}
            onChange={(e) => setParam("from", e.target.value || null)}
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-fg2 mb-1">To</label>
          <Input
            type="date"
            defaultValue={props.toDate ?? ""}
            onChange={(e) => setParam("to", e.target.value || null)}
          />
        </div>

        {(props.eventTypes.length > 0 || props.actorMemberId || props.fromDate || props.toDate) && (
          <Button variant="ghost" onClick={() => router.push("/admin/operations?tab=" + props.kind)}>
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      {props.feedError ? (
        <FeedError message={props.feedError} />
      ) : (
        <FeedTable rows={props.rows} />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-tight">
        <span className="text-fg3 text-[13px]">
          {props.total === 0
            ? "0 events"
            : `Page ${props.page} of ${totalPages} · ${props.total} events`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={props.page <= 1}
            onClick={() => setParam("page", String(props.page - 1))}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={props.page >= totalPages}
            onClick={() => setParam("page", String(props.page + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FeedError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-border bg-bg p-6 text-center space-y-2">
      <p className="text-sm font-medium text-fg1">Could not load this feed</p>
      <p className="text-xs text-fg3 font-mono">{message}</p>
    </div>
  );
}

export function FeedTable({ rows }: { rows: FeedRow[] }) {
  const formatted = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        ts: formatTimestamp(r.occurred_at),
      })),
    [rows]
  );

  return (
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
          {formatted.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-fg3">
                No events match these filters.
              </td>
            </tr>
          ) : (
            formatted.map((r) => (
              <tr key={`${r.source}:${r.source_id}`} className="border-t border-border align-top">
                <td className="px-4 py-2.5 text-fg2 whitespace-nowrap">{r.ts}</td>
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
                  ) : r.actor_label ? (
                    <span className="text-fg3 font-mono text-[12px]">{r.actor_label}</span>
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
                      {r.subject_label ?? r.subject_name ?? "Unknown"}
                    </Link>
                  ) : r.subject_label ? (
                    <span className="text-fg2">{r.subject_label}</span>
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
  );
}
