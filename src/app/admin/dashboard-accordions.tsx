"use client";

import { useState } from "react";
import Link from "next/link";

type PendingApp = {
  id: string;
  name: string;
  company_name: string;
  submitted_on: string;
};

type UnfulfilledTicket = {
  id: string;
  displayName: string;
  displayEmail: string;
  purchasedAt: string;
  dinnerDate: string | null;
  fulfillmentStatus: string;
  reason: string;
};

type OptOut = {
  id: string;
  name: string;
  marketingOptedOutAt: string;
};

function Accordion({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-lg bg-white shadow">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">
          {title}{" "}
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {count}
          </span>
        </span>
        <span className="text-gray-400">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && <div className="border-t border-gray-200">{children}</div>}
    </div>
  );
}

export default function DashboardAccordions({
  pendingApps,
  unfulfilledTickets,
  optOuts,
}: {
  pendingApps: PendingApp[];
  unfulfilledTickets: UnfulfilledTicket[];
  optOuts: OptOut[];
}) {
  return (
    <div className="space-y-4">
      {/* Pending applications */}
      <Accordion title="Pending Applications" count={pendingApps.length}>
        {pendingApps.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">
            No pending applications.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Company
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pendingApps.map((app) => (
                <tr key={app.id} className="group relative hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    <Link
                      href={`/admin/applications?selected=${app.id}`}
                      className="after:absolute after:inset-0"
                    >
                      {app.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {app.company_name}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {new Date(app.submitted_on).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Accordion>

      {/* Unfulfilled tickets */}
      <Accordion
        title="Unfulfilled Tickets"
        count={unfulfilledTickets.length}
      >
        {unfulfilledTickets.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">
            All tickets fulfilled.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Name / Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Dinner
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Purchased
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {unfulfilledTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">
                    <div className="text-gray-900">{ticket.displayName}</div>
                    {ticket.displayEmail !== ticket.displayName && (
                      <div className="text-xs text-gray-400">
                        {ticket.displayEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {ticket.dinnerDate
                      ? new Date(
                          ticket.dinnerDate + "T00:00:00"
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {new Date(ticket.purchasedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      {ticket.fulfillmentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {ticket.reason || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Accordion>

      {/* Marketing opt-outs */}
      <Accordion title="Marketing Opt-Outs" count={optOuts.length}>
        {optOuts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">
            No marketing opt-outs.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Opted Out
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {optOuts.map((m) => (
                <tr key={m.id} className="group relative hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    <Link
                      href={`/admin/members?selected=${m.id}`}
                      className="after:absolute after:inset-0"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {new Date(m.marketingOptedOutAt).toLocaleDateString()}
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
