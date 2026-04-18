import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import DashboardAccordions from "./dashboard-accordions";
import { formatDate, formatName, getTodayMT } from "@/lib/format";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = getTodayMT();

  // Next upcoming dinner
  const { data: nextDinner } = await supabase
    .from("dinners")
    .select("*")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  // Previous dinner (most recent past dinner, used as cutoff for "new" applications)
  const { data: prevDinner } = await supabase
    .from("dinners")
    .select("date")
    .lt("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  // Stats for next dinner
  let newAppsSinceLastDinner = 0;
  let ticketsSold = 0;

  if (nextDinner) {
    // Applications submitted after the last dinner date
    const appCutoff = prevDinner?.date ?? "1970-01-01";
    const { count: appCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .gt("submitted_on", appCutoff);
    newAppsSinceLastDinner = appCount ?? 0;

    // Tickets sold for next dinner
    const { count: ticketCount } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("dinner_id", nextDinner.id);
    ticketsSold = ticketCount ?? 0;
  }

  // Days until next dinner
  let daysUntil: number | null = null;
  if (nextDinner) {
    const dinnerMs = new Date(nextDinner.date + "T00:00:00").getTime();
    const todayMs = new Date(today + "T00:00:00").getTime();
    daysUntil = Math.round((dinnerMs - todayMs) / (1000 * 60 * 60 * 24));
  }

  // Pending applications
  const { data: pendingApps } = await supabase
    .from("applications")
    .select("id, first_name, last_name, company_name, submitted_on")
    .eq("status", "pending")
    .order("submitted_on", { ascending: false });

  // Marketing opt-outs
  const { data: optOuts } = await supabase
    .from("members")
    .select("id, first_name, last_name, marketing_opted_out_at")
    .not("marketing_opted_out_at", "is", null)
    .order("marketing_opted_out_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>

      {/* Key stats */}
      {nextDinner ? (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">Next Dinner</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatDate(nextDinner.date, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">Days Until</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {daysUntil === 0 ? "Today" : daysUntil}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">
              New Apps Since Last Dinner
            </p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {newAppsSinceLastDinner}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">Tickets Sold</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {ticketsSold}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No upcoming dinners found.</p>
      )}

      {/* Accordion sections */}
      <DashboardAccordions
        pendingApps={(pendingApps || []).map((a) => ({
          id: a.id,
          name: formatName(a.first_name, a.last_name),
          company_name: a.company_name,
          submitted_on: a.submitted_on,
        }))}
        optOuts={
          (optOuts || []).map((m) => ({
            id: m.id,
            name: formatName(m.first_name, m.last_name),
            marketingOptedOutAt: m.marketing_opted_out_at,
          }))
        }
      />
    </div>
  );
}
