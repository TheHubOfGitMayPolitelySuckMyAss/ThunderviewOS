import { createAdminClient } from "@/lib/supabase/admin";
import { formatDinnerDisplay, formatName } from "@/lib/format";
import { getTodayMT } from "@/lib/format";
import Link from "next/link";

export default async function RecapPage() {
  const admin = createAdminClient();
  const today = getTodayMT();

  // Most recent completed dinner = latest date < today
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .lt("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (!dinner) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Last Month&rsquo;s Intros &amp; Asks
        </h2>
        <p className="mt-4 text-gray-500">No dinners yet.</p>
      </div>
    );
  }

  // Fulfilled tickets for that dinner, with member data
  const { data: tickets } = await admin
    .from("tickets")
    .select(
      "member_id, members!inner(id, first_name, last_name, company_name, current_intro, current_ask, has_community_access, kicked_out)"
    )
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled");

  type AttendeeRow = {
    member_id: string;
    members: {
      id: string;
      first_name: string;
      last_name: string;
      company_name: string | null;
      current_intro: string | null;
      current_ask: string | null;
      has_community_access: boolean;
      kicked_out: boolean;
    };
  };

  const rows = (tickets ?? []) as unknown as AttendeeRow[];

  // Deduplicate by member_id (qty=2 tickets are one row, but just in case),
  // exclude kicked-out and no-community-access
  const seen = new Set<string>();
  const attendees = rows
    .filter((r) => {
      const m = r.members;
      if (!m || m.kicked_out || !m.has_community_access) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .map((r) => r.members)
    .sort((a, b) =>
      formatName(a.first_name, a.last_name)
        .toLowerCase()
        .localeCompare(formatName(b.first_name, b.last_name).toLowerCase())
    );

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="text-2xl font-bold text-gray-900">
        Thunderview Dinner &mdash; {formatDinnerDisplay(dinner.date)}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {attendees.length} attendee{attendees.length !== 1 ? "s" : ""}
      </p>

      <div className="mt-6 space-y-6">
        {attendees.map((m) => (
          <div key={m.id} className="rounded-lg border bg-white p-5">
            <div className="flex items-baseline gap-2">
              <Link
                href={`/portal/members/${m.id}`}
                className="text-lg font-semibold text-blue-600 hover:text-blue-800"
              >
                {formatName(m.first_name, m.last_name)}
              </Link>
              {m.company_name && (
                <span className="text-sm text-gray-500">
                  at {m.company_name}
                </span>
              )}
            </div>

            {(m.current_intro || m.current_ask) && (
              <div className="mt-3 space-y-2">
                {m.current_intro && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Intro
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">
                      {m.current_intro}
                    </dd>
                  </div>
                )}
                {m.current_ask && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Ask
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">
                      {m.current_ask}
                    </dd>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {attendees.length === 0 && (
          <p className="text-gray-500">No attendees for this dinner.</p>
        )}
      </div>
    </div>
  );
}
