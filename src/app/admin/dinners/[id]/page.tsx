import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function DinnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: dinner } = await supabase
    .from("dinners")
    .select("*")
    .eq("id", id)
    .single();

  if (!dinner) {
    notFound();
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*, members(name, email)")
    .eq("dinner_id", id)
    .order("purchased_at", { ascending: false });

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("preferred_dinner_date", dinner.date)
    .order("submitted_on", { ascending: false });

  // Count tickets by fulfillment status
  const statusCounts = (tickets || []).reduce(
    (acc, t) => {
      acc[t.fulfillment_status] = (acc[t.fulfillment_status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Dinner header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {new Date(dinner.date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </h2>
        <p className="text-sm text-gray-500">Venue: {dinner.venue}</p>
      </div>

      {/* Ticket counts */}
      <div className="flex gap-4">
        {["pending", "fulfilled", "refunded", "credited"].map((status) => (
          <div
            key={status}
            className="rounded-lg bg-white px-4 py-3 shadow"
          >
            <p className="text-xs uppercase text-gray-500">{status}</p>
            <p className="text-2xl font-bold text-gray-900">
              {statusCounts[status] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Tickets table */}
      <div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Tickets</h3>
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
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Purchased
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tickets?.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {(ticket.members as { name: string })?.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {(ticket.members as { email: string })?.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {ticket.ticket_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    ${Number(ticket.amount_paid).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={ticket.fulfillment_status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(ticket.purchased_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!tickets || tickets.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-gray-400"
                  >
                    No tickets for this dinner.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Applications table */}
      <div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          Applications for this date
        </h3>
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
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {applications?.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {app.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {app.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {app.company_name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(app.submitted_on).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!applications || applications.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-400"
                  >
                    No applications for this dinner date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    fulfilled: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
    credited: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}
