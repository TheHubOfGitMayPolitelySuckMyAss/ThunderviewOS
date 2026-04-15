"use client";

import { useState } from "react";

type Application = {
  id: string;
  submitted_on: string;
  name: string;
  email: string;
  gender: string;
  race: string;
  orientation: string;
  company_name: string;
  company_website: string;
  attendee_stagetype: string;
  preferred_dinner_date: string;
  i_am_my_startups_ceo: string | null;
  my_startup_is_not_a_services_business: string | null;
  linkedin_profile: string;
  status: string;
  member_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const filters = ["All", "Pending", "Approved", "Rejected"] as const;

export default function ApplicationsTable({
  applications,
}: {
  applications: Application[];
}) {
  const [filter, setFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Application | null>(null);

  const filtered =
    filter === "All"
      ? applications
      : applications.filter(
          (a) => a.status === filter.toLowerCase()
        );

  if (selected) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <button
          onClick={() => setSelected(null)}
          className="mb-4 text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to list
        </button>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {selected.name}
        </h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            ["Email", selected.email],
            ["Company", selected.company_name],
            ["Website", selected.company_website],
            ["Stage/Type", selected.attendee_stagetype],
            [
              "Preferred Dinner",
              new Date(
                selected.preferred_dinner_date + "T00:00:00"
              ).toLocaleDateString(),
            ],
            ["LinkedIn", selected.linkedin_profile],
            ["Gender", selected.gender],
            ["Race", selected.race],
            ["Orientation", selected.orientation],
            ["I am my startup's CEO", selected.i_am_my_startups_ceo || "N/A"],
            [
              "Not a services business",
              selected.my_startup_is_not_a_services_business || "N/A",
            ],
            ["Status", selected.status],
            ["Rejection Reason", selected.rejection_reason || "N/A"],
            [
              "Submitted",
              new Date(selected.submitted_on).toLocaleString(),
            ],
            [
              "Reviewed",
              selected.reviewed_at
                ? new Date(selected.reviewed_at).toLocaleString()
                : "Not yet",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase text-gray-500">
                {label}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
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
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Stage/Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Preferred Dinner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((app) => (
              <tr
                key={app.id}
                onClick={() => setSelected(app)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm text-gray-900">{app.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {app.email}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {app.company_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {app.attendee_stagetype}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(
                    app.preferred_dinner_date + "T00:00:00"
                  ).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(app.submitted_on).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  No applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}
