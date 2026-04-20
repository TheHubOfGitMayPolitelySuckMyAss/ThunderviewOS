import { createClient } from "@/lib/supabase/server";
import DinnersTable from "./dinners-table";

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
    members: unknown;
  }>((from, to) =>
    supabase
      .from("applications")
      .select("preferred_dinner_date, status, member_id, members(kicked_out)")
      .range(from, to),
  );

  const tickets = await fetchAll<{
    dinner_id: string;
    fulfillment_status: string;
    member_id: string;
    quantity: number;
    members: unknown;
  }>((from, to) =>
    supabase
      .from("tickets")
      .select(
        "dinner_id, fulfillment_status, member_id, quantity, members(current_intro, current_ask, ask_updated_at, last_dinner_attended)",
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

    // Exclude applications whose linked member is kicked out
    const isKickedOut = (a: typeof dinnerApps[0]) => {
      const m = a.members as { kicked_out: boolean } | null;
      return m?.kicked_out === true;
    };

    const applied = dinnerApps.filter((a) => a.status === "pending").length;

    const fulfilledMemberIds = new Set(
      dinnerTickets
        .filter((t) => t.fulfillment_status === "fulfilled")
        .map((t) => t.member_id)
    );
    const approved = dinnerApps.filter(
      (a) => a.status === "approved" && a.member_id && !fulfilledMemberIds.has(a.member_id) && !isKickedOut(a)
    ).length;

    const paid = dinnerTickets
      .filter((t) => t.fulfillment_status === "fulfilled" || t.fulfillment_status === "pending")
      .reduce((sum, t) => sum + (t.quantity ?? 1), 0);

    const introAsk = dinnerTickets
      .filter((t) => {
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
      })
      .reduce((sum, t) => sum + (t.quantity ?? 1), 0);

    return { id: dinner.id, date: dinner.date, venue: dinner.venue, guestsAllowed: dinner.guests_allowed as boolean, applied, approved, paid, introAsk };
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Dinners</h2>
      <DinnersTable dinners={dinnerStats} />
    </div>
  );
}
