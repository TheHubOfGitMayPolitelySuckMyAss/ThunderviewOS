import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// PostgREST on Supabase caps responses at 1000 rows server-side, so .limit()
// above that is silently clamped. Paginate with .range() until drained.
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export default async function DinnersPage() {
  const supabase = await createClient();

  const { data: dinners } = await supabase
    .from("dinners")
    .select("*")
    .order("date", { ascending: true });

  const applications = await fetchAll<{
    preferred_dinner_date: string;
    status: string;
    member_id: string | null;
  }>((from, to) =>
    supabase
      .from("applications")
      .select("preferred_dinner_date, status, member_id")
      .range(from, to),
  );

  const tickets = await fetchAll<{
    dinner_id: string;
    fulfillment_status: string;
    member_id: string;
    members: unknown;
  }>((from, to) =>
    supabase
      .from("tickets")
      .select(
        "dinner_id, fulfillment_status, member_id, members(current_intro, current_ask, ask_updated_at, last_dinner_attended)",
      )
      .range(from, to),
  );

  const dinnerStats = (dinners || []).map((dinner) => {
    const dinnerApps = (applications || []).filter(
      (a) => a.preferred_dinner_date === dinner.date
    );
    const dinnerTickets = (tickets || []).filter(
      (t) => t.dinner_id === dinner.id
    );

    const applied = dinnerApps.filter((a) => a.status === "pending").length;

    const fulfilledMemberIds = new Set(
      dinnerTickets
        .filter((t) => t.fulfillment_status === "fulfilled")
        .map((t) => t.member_id)
    );
    const approved = dinnerApps.filter(
      (a) => a.status === "approved" && a.member_id && !fulfilledMemberIds.has(a.member_id)
    ).length;

    const paid = dinnerTickets.filter(
      (t) => t.fulfillment_status === "fulfilled"
    ).length;

    const introAsk = dinnerTickets.filter((t) => {
      if (t.fulfillment_status !== "fulfilled") return false;
      const m = t.members as unknown as {
        current_intro: string | null;
        current_ask: string | null;
        ask_updated_at: string | null;
        last_dinner_attended: string | null;
      } | null;
      if (!m) return false;
      if (!m.current_intro || !m.current_ask) return false;
      if (!m.last_dinner_attended) return true;
      if (!m.ask_updated_at) return false;
      return m.ask_updated_at > m.last_dinner_attended;
    }).length;

    return { ...dinner, applied, approved, paid, introAsk };
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Dinners</h2>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Date
              </th>
              <th className="w-20 px-2 py-3 text-center text-xs font-medium uppercase text-gray-500">
                Applied
              </th>
              <th className="w-20 px-2 py-3 text-center text-xs font-medium uppercase text-gray-500">
                Approved
              </th>
              <th className="w-20 px-2 py-3 text-center text-xs font-medium uppercase text-gray-500">
                Paid
              </th>
              <th className="w-20 px-2 py-3 text-center text-xs font-medium uppercase text-gray-500">
                Intro/Ask
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dinnerStats.map((dinner) => (
              <tr key={dinner.id} className="group relative hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  <Link
                    href={`/admin/dinners/${dinner.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {new Date(dinner.date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </Link>
                </td>
                <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                  {dinner.applied}
                </td>
                <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                  {dinner.approved}
                </td>
                <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                  {dinner.paid}
                </td>
                <td className="w-20 px-2 py-4 text-center text-sm tabular-nums text-gray-500">
                  {dinner.introAsk}
                </td>
              </tr>
            ))}
            {(!dinners || dinners.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm text-gray-400"
                >
                  No dinners found. Run the seed script to generate dinner
                  dates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
