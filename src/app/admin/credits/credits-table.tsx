"use client";

import { useState } from "react";

type Credit = {
  id: string;
  member_id: string;
  source_ticket_id: string;
  status: string;
  redeemed_ticket_id: string | null;
  created_at: string;
  redeemed_at: string | null;
  members: { name: string; member_emails: { email: string; is_primary: boolean }[] } | null;
  source_ticket: { dinner_id: string; dinners: { date: string } | null } | null;
  redeemed_ticket: {
    dinner_id: string;
    dinners: { date: string } | null;
  } | null;
};

const filters = ["All", "Outstanding", "Redeemed"] as const;

export default function CreditsTable({ credits }: { credits: Credit[] }) {
  const [filter, setFilter] = useState<string>("All");

  const filtered =
    filter === "All"
      ? credits
      : credits.filter(
          (c) => c.status === filter.toLowerCase()
        );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Source Dinner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Redeemed Dinner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((credit) => (
              <tr key={credit.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {credit.members?.name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {credit.members?.member_emails?.find((e) => e.is_primary)?.email ?? credit.members?.member_emails?.[0]?.email ?? "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {credit.source_ticket?.dinners?.date
                    ? new Date(
                        credit.source_ticket.dinners.date + "T00:00:00"
                      ).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      credit.status === "outstanding"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {credit.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {credit.redeemed_ticket?.dinners?.date
                    ? new Date(
                        credit.redeemed_ticket.dinners.date + "T00:00:00"
                      ).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(credit.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  No credits found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
