"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatDate, formatDateTimeShort } from "@/lib/format";
import { Pill } from "@/components/ui/pill";

/**
 * Tab focus → refresh server data. Lets the dashboard auto-update when Eric
 * tabs back in instead of needing a manual reload.
 */
function useAutoRefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
}

/**
 * Per-accordion "seen since last viewed" tracker. Stores the set of row IDs
 * the user last saw, in localStorage. On every render computes the delta —
 * anything in `currentIds` that isn't in `seenIds` is "new since last view"
 * and surfaces as a +N pill. When the tab loses focus, the current IDs
 * become the new seen baseline (so the next time Eric tabs back, only
 * things added since THIS view are flagged).
 *
 * First visit (no localStorage): treat everything as already-seen so the
 * user doesn't get a sea of +N pills on first load.
 */
function useNewSinceLastView(key: string, currentIds: string[]): number {
  const storageKey = `tv:dashboard:seen:${key}`;
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem(storageKey)
      : null;
    if (stored) {
      try {
        setSeenIds(new Set(JSON.parse(stored) as string[]));
        return;
      } catch {
        // fall through to seeding
      }
    }
    // First visit OR corrupted storage: seed with current state.
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(currentIds));
    }
    setSeenIds(new Set(currentIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first-mount only
  }, []);

  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === "hidden") {
        window.localStorage.setItem(storageKey, JSON.stringify(currentIds));
        setSeenIds(new Set(currentIds));
      }
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [storageKey, currentIds]);

  if (seenIds === null) return 0;
  let n = 0;
  for (const id of currentIds) if (!seenIds.has(id)) n++;
  return n;
}

type PendingApp = {
  id: string;
  name: string;
  company_name: string;
  submitted_on: string;
  kickedOutReapplication: boolean;
};

type OptOut = {
  id: string;
  name: string;
  marketingOptedOutAt: string;
};

type EmailIssue = {
  id: string;
  eventType: "bounced" | "complained";
  recipientEmail: string;
  memberId: string | null;
  memberName: string | null;
  occurredAt: string;
};

type MemberVisit = {
  id: string;
  memberId: string;
  name: string;
  occurredAt: string;
};

type TicketSold = {
  id: string;
  name: string;
  dinnerDate: string | null;
  purchasedAt: string;
};

function Accordion({
  title,
  count,
  pillVariant = "neutral",
  pillLabel,
  defaultOpen,
  meta,
  newCount = 0,
  children,
}: {
  title: string;
  count: number;
  pillVariant?: "warn" | "neutral";
  pillLabel?: string;
  defaultOpen?: boolean;
  meta?: string;
  /** Items added since the user's last view of this accordion. Renders a
   * small "+N new" badge next to the count pill when > 0. */
  newCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border border-border rounded-xl bg-bg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            size={14}
            className={`text-fg3 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          <span className="text-[15px] font-medium text-fg1">{title}</span>
          <Pill variant={pillVariant}>
            {pillLabel || `${count}`}
          </Pill>
          {newCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-accent text-cream-50 text-[11px] font-semibold px-2 py-0.5">
              +{newCount} new
            </span>
          )}
        </div>
        {meta && <span className="text-[13px] text-fg3">{meta}</span>}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

export default function DashboardAccordions({
  pendingApps,
  optOuts,
  emailIssues,
  memberVisits,
  ticketsSoldRecent,
}: {
  pendingApps: PendingApp[];
  optOuts: OptOut[];
  emailIssues: EmailIssue[];
  memberVisits: MemberVisit[];
  ticketsSoldRecent: TicketSold[];
}) {
  // Find oldest pending app age
  const oldestDays = pendingApps.length > 0
    ? Math.max(
        ...pendingApps.map((a) => {
          const ms = Date.now() - new Date(a.submitted_on).getTime();
          return Math.round(ms / (1000 * 60 * 60 * 24));
        })
      )
    : 0;

  // Auto-refresh server data when the tab regains focus.
  useAutoRefreshOnFocus();

  // Per-accordion "new since last view" counts. Each accordion's row IDs
  // are stable across refreshes, so the seen-set diff is meaningful.
  const newPendingApps = useNewSinceLastView(
    "pendingApps",
    pendingApps.map((a) => a.id)
  );
  const newTickets = useNewSinceLastView(
    "ticketsSold",
    ticketsSoldRecent.map((t) => t.id)
  );
  const newVisits = useNewSinceLastView(
    "memberVisits",
    memberVisits.map((v) => v.id)
  );
  const newOptOuts = useNewSinceLastView(
    "optOuts",
    optOuts.map((m) => m.id)
  );
  const newEmailIssues = useNewSinceLastView(
    "emailIssues",
    emailIssues.map((e) => e.id)
  );

  return (
    <div>
      {/* Pending applications */}
      <Accordion
        title="Pending applications"
        count={pendingApps.length}
        pillVariant="warn"
        pillLabel={`${pendingApps.length} awaiting review`}
        defaultOpen={pendingApps.length > 0}
        meta={oldestDays > 0 ? `oldest: ${oldestDays} day${oldestDays !== 1 ? "s" : ""}` : undefined}
        newCount={newPendingApps}
      >
        {pendingApps.length === 0 ? (
          <p className="py-4 text-sm text-fg4">No pending applications.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Received</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Name</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Company</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border"></th>
              </tr>
            </thead>
            <tbody>
              {pendingApps.map((app) => (
                <tr key={app.id} className="group relative cursor-pointer border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated">
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {formatDate(app.submitted_on, { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg1 font-medium">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className="no-underline text-fg1 after:absolute after:inset-0"
                    >
                      {app.name}
                    </Link>
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg2">{app.company_name}</td>
                  <td className="px-3.5 py-3">
                    {app.kickedOutReapplication ? (
                      <Pill variant="danger" dot>Removed-member re-application</Pill>
                    ) : (
                      <Pill variant="warn" dot>Pending</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Accordion>

      {/* Tickets sold */}
      <Accordion
        title="Tickets sold"
        count={ticketsSoldRecent.length}
        pillLabel={`${ticketsSoldRecent.length}`}
        meta="last 30 days"
        newCount={newTickets}
      >
        {ticketsSoldRecent.length === 0 ? (
          <p className="py-4 text-sm text-fg4">No tickets sold in the last 30 days.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Name</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Dinner</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Purchased</th>
              </tr>
            </thead>
            <tbody>
              {ticketsSoldRecent.map((t) => (
                <tr key={t.id} className="group relative border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated">
                  <td className="px-3.5 py-3 text-[14px] text-fg1 font-medium">{t.name}</td>
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {t.dinnerDate ? formatDate(t.dinnerDate, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {formatDate(t.purchasedAt, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Accordion>

      {/* Member visits */}
      <Accordion
        title="Member visits"
        count={memberVisits.length}
        pillLabel={`${memberVisits.length}`}
        meta="last 7 days"
        newCount={newVisits}
      >
        {memberVisits.length === 0 ? (
          <p className="py-4 text-sm text-fg4">No member visits in the last 7 days.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Name</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Visited</th>
              </tr>
            </thead>
            <tbody>
              {memberVisits.map((v) => (
                <tr key={v.id} className="group relative cursor-pointer border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated">
                  <td className="px-3.5 py-3 text-[14px] text-fg1 font-medium">
                    <Link
                      href={`/admin/members/${v.memberId}`}
                      className="no-underline text-fg1 after:absolute after:inset-0"
                    >
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {formatDateTimeShort(v.occurredAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Accordion>

      {/* Marketing opt-outs */}
      <Accordion
        title="Marketing opt-outs"
        count={optOuts.length}
        pillLabel={`${optOuts.length}`}
        meta="last 30 days"
        newCount={newOptOuts}
      >
        {optOuts.length === 0 ? (
          <p className="py-4 text-sm text-fg4">No marketing opt-outs in the last 30 days.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Name</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Opted Out</th>
              </tr>
            </thead>
            <tbody>
              {optOuts.map((m) => (
                <tr key={m.id} className="group relative cursor-pointer border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated">
                  <td className="px-3.5 py-3 text-[14px] text-fg1 font-medium">
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="no-underline text-fg1 after:absolute after:inset-0"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {formatDate(m.marketingOptedOutAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Accordion>

      {/* Email issues */}
      <Accordion
        title="Email issues"
        count={emailIssues.length}
        pillVariant={emailIssues.length > 0 ? "warn" : "neutral"}
        pillLabel={`${emailIssues.length}`}
        meta="last 30 days"
        newCount={newEmailIssues}
      >
        {emailIssues.length === 0 ? (
          <p className="py-4 text-sm text-fg4">No email issues in the last 30 days.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Date</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Member / Email</th>
                <th className="text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border">Type</th>
              </tr>
            </thead>
            <tbody>
              {emailIssues.map((e) => (
                <tr key={e.id} className="group relative border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated">
                  <td className="px-3.5 py-3 text-[14px] text-fg2">
                    {formatDate(e.occurredAt, { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-3.5 py-3 text-[14px] text-fg1">
                    {e.memberId && e.memberName ? (
                      <Link
                        href={`/admin/members/${e.memberId}`}
                        className="no-underline text-fg1 font-medium hover:underline"
                      >
                        {e.memberName}
                      </Link>
                    ) : null}
                    <span className={e.memberName ? " text-fg3 text-[13px] ml-1.5" : " font-medium"}>
                      {e.recipientEmail}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <Pill variant={e.eventType === "complained" ? "danger" : "warn"} dot>
                      {e.eventType === "complained" ? "Complained" : "Bounced"}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Accordion>
    </div>
  );
}
