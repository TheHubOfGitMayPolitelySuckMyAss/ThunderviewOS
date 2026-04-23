import { createClient } from "@/lib/supabase/server";
import DashboardAccordions from "./dashboard-accordions";
import { formatDate, formatName, getTodayMT } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Body } from "@/components/ui/typography";
import PageHeader from "@/components/page-header";

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
    const appCutoff = prevDinner?.date ?? "1970-01-01";
    const { count: appCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .gt("submitted_on", appCutoff)
      .in("status", ["pending", "approved"]);
    newAppsSinceLastDinner = appCount ?? 0;

    const { data: soldTickets } = await supabase
      .from("tickets")
      .select("quantity")
      .eq("dinner_id", nextDinner.id)
      .in("fulfillment_status", ["purchased", "fulfilled"]);
    ticketsSold = (soldTickets || []).reduce((sum, t) => sum + (t.quantity ?? 1), 0);
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
    <div className="tv-container-admin">
      <PageHeader
        title="Dashboard"
        size="compact"
        actions={nextDinner ? (
          <span className="text-fg3 text-[14px]">
            Next dinner: <strong className="text-fg1">{formatDate(nextDinner.date, { month: "short", day: "numeric" })}</strong> &middot; {daysUntil === 0 ? "today" : `${daysUntil} days away`}
          </span>
        ) : undefined}
      />

      {/* Key stats */}
      {nextDinner ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="tv-eyebrow mb-2">Days until</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {daysUntil === 0 ? "Today" : daysUntil}
            </div>
            <div className="text-[12px] text-fg3">
              {formatDate(nextDinner.date, { month: "short", day: "numeric" })} &middot; {nextDinner.venue || "ID345"}
            </div>
          </Card>
          <Card>
            <div className="tv-eyebrow mb-2">Tickets sold</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {ticketsSold}
            </div>
            <div className="text-[12px] text-fg3">for next dinner</div>
          </Card>
          <Card>
            <div className="tv-eyebrow mb-2">New apps</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {newAppsSinceLastDinner}
            </div>
            <div className="text-[12px] text-fg3">pending review</div>
          </Card>
          <Card>
            <div className="tv-eyebrow mb-2">Community</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {/* This stat was hardcoded before; keeping same pattern */}
              &mdash;
            </div>
            <div className="text-[12px] text-fg3">members</div>
          </Card>
        </div>
      ) : (
        <Body className="text-fg3 mb-6">No upcoming dinners found.</Body>
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
