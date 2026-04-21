import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName, formatDinnerDisplay, getTodayMT } from "@/lib/format";
import MorningOfEditor from "./morning-of-editor";

export default async function MorningOfTemplatePage() {
  const admin = createAdminClient();

  const { data: template } = await admin
    .from("email_templates")
    .select("*")
    .eq("slug", "morning-of")
    .single();

  if (!template) {
    return <p className="text-red-600">Template not found in database.</p>;
  }

  let updatedByName: string | null = null;
  if (template.updated_by) {
    const { data: updater } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", template.updated_by)
      .single();
    if (updater) {
      updatedByName = formatName(updater.first_name, updater.last_name);
    }
  }

  // Get next upcoming dinner + fulfilled attendees
  const todayMT = getTodayMT();
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  let dinnerDisplay: string | null = null;
  let attendees: {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
    company_website: string | null;
    linkedin_profile: string | null;
    contact_preference: string | null;
    primary_email: string | null;
    current_intro: string | null;
    current_ask: string | null;
    showAsk: boolean;
  }[] = [];

  if (dinner) {
    dinnerDisplay = formatDinnerDisplay(dinner.date);

    const { data: tickets } = await admin
      .from("tickets")
      .select(
        "member_id, members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, contact_preference, current_intro, current_ask, ask_updated_at, last_dinner_attended, has_community_access, kicked_out, member_emails(email, is_primary))"
      )
      .eq("dinner_id", dinner.id)
      .eq("fulfillment_status", "fulfilled");

    type TicketRow = {
      member_id: string;
      members: {
        id: string;
        first_name: string;
        last_name: string;
        company_name: string | null;
        company_website: string | null;
        linkedin_profile: string | null;
        contact_preference: string | null;
        current_intro: string | null;
        current_ask: string | null;
        ask_updated_at: string | null;
        last_dinner_attended: string | null;
        has_community_access: boolean;
        kicked_out: boolean;
        member_emails: { email: string; is_primary: boolean }[];
      };
    };

    const rows = (tickets ?? []) as unknown as TicketRow[];
    const seen = new Set<string>();

    attendees = rows
      .filter((r) => {
        const m = r.members;
        if (!m || m.kicked_out || !m.has_community_access) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map((r) => {
        const m = r.members;
        const primaryEmail = m.member_emails?.find((e) => e.is_primary)?.email ?? m.member_emails?.[0]?.email ?? null;
        const showAsk = !!(
          m.current_ask &&
          (!m.last_dinner_attended ||
            (m.ask_updated_at && m.ask_updated_at > m.last_dinner_attended))
        );
        return {
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          company_name: m.company_name,
          company_website: m.company_website,
          linkedin_profile: m.linkedin_profile,
          contact_preference: m.contact_preference,
          primary_email: primaryEmail,
          current_intro: m.current_intro,
          current_ask: m.current_ask,
          showAsk,
        };
      })
      .sort((a, b) => {
        const aHas = a.current_intro || a.showAsk ? 0 : 1;
        const bHas = b.current_intro || b.showAsk ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        return formatName(a.first_name, a.last_name)
          .toLowerCase()
          .localeCompare(formatName(b.first_name, b.last_name).toLowerCase());
      });
  }

  return (
    <div>
      <Link
        href="/admin/emails"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Back to emails
      </Link>

      <h2 className="mb-6 text-xl font-bold text-gray-900">
        Morning Of Email Template
      </h2>

      <MorningOfEditor
        slug="morning-of"
        initialSubject={template.subject}
        initialBody={template.body}
        lastUpdatedAt={template.updated_by ? template.updated_at : null}
        lastUpdatedByName={updatedByName}
        attendees={attendees}
        dinnerDisplay={dinnerDisplay}
      />
    </div>
  );
}
