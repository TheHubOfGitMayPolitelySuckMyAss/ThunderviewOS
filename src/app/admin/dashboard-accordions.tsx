"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate, formatDateTimeShort } from "@/lib/format";
import { Pill } from "@/components/ui/pill";

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
  children,
}: {
  title: string;
  count: number;
  pillVariant?: "warn" | "neutral";
  pillLabel?: string;
  defaultOpen?: boolean;
  meta?: string;
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
