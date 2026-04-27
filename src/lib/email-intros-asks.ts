import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";

export type Attendee = {
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_website: string | null;
  linkedin_profile: string | null;
  contact_preference: string | null;
  primary_email: string | null;
  current_intro: string | null;
  current_ask: string | null;
  ask_updated_at: string | null;
  last_dinner_attended: string | null;
  has_community_access: boolean;
  kicked_out: boolean;
};

/**
 * Fetches fulfilled attendees for a dinner, filtered and sorted
 * the same way as Morning Of: fulfilled tickets, not kicked out,
 * has community access, deduplicated by member, sorted by content-first.
 */
export async function getDinnerAttendees(
  dinnerId: string,
  admin?: ReturnType<typeof createAdminClient>
): Promise<Attendee[]> {
  const client = admin ?? createAdminClient();

  const { data: tickets } = await client
    .from("tickets")
    .select(
      "member_id, members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, contact_preference, current_intro, current_ask, ask_updated_at, last_dinner_attended, has_community_access, kicked_out, member_emails(email, is_primary))"
    )
    .eq("dinner_id", dinnerId)
    .eq("fulfillment_status", "fulfilled");

  type TicketRow = {
    member_id: string;
    members: Attendee & { id: string; member_emails: { email: string; is_primary: boolean }[] };
  };

  const rows = (tickets ?? []) as unknown as TicketRow[];
  const seen = new Set<string>();

  return rows
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
      return { ...m, primary_email: primaryEmail } as Attendee;
    })
    .sort((a, b) => {
      const aHasContent = a.current_intro || a.current_ask ? 0 : 1;
      const bHasContent = b.current_intro || b.current_ask ? 0 : 1;
      if (aHasContent !== bHasContent) return aHasContent - bHasContent;
      return formatName(a.first_name, a.last_name)
        .toLowerCase()
        .localeCompare(formatName(b.first_name, b.last_name).toLowerCase());
    });
}

/**
 * Renders the Intros & Asks HTML block for email.
 * Same rendering as Morning Of — inline-styled, Resend-safe.
 */
export function buildAttendeeHtml(attendees: Attendee[]): string {
  if (attendees.length === 0) {
    return '<p style="font-size:14px;color:#75695B;font-style:italic;">No attendees confirmed yet.</p>';
  }

  return attendees
    .map((a, i) => {
      const name = formatName(a.first_name, a.last_name);
      let nameHtml: string;
      if (a.contact_preference === "linkedin" && a.linkedin_profile) {
        nameHtml = `<a href="${a.linkedin_profile}" style="color:#9A7A5E;text-decoration:none;font-weight:600;font-size:15px;">${name}</a>`;
      } else if (a.primary_email) {
        nameHtml = `<a href="mailto:${a.primary_email}" style="color:#9A7A5E;text-decoration:none;font-weight:600;font-size:15px;">${name}</a>`;
      } else {
        nameHtml = `<span style="font-weight:600;font-size:15px;color:#2B241C;">${name}</span>`;
      }

      let companyHtml = "";
      if (a.company_name) {
        if (a.company_website) {
          const url = a.company_website.startsWith("http") ? a.company_website : `https://${a.company_website}`;
          companyHtml = `<p style="font-size:13px;color:#75695B;margin:0 0 10px;">${a.company_name} &middot; <a href="${url}" style="color:#9A7A5E;">${url.replace(/^https?:\/\//, "")}</a></p>`;
        } else {
          companyHtml = `<p style="font-size:13px;color:#75695B;margin:0 0 10px;">${a.company_name}</p>`;
        }
      }

      const showAsk = a.current_ask && (
        !a.last_dinner_attended ||
        (a.ask_updated_at && a.ask_updated_at > a.last_dinner_attended)
      );

      const sections: string[] = [];
      if (a.current_intro) {
        sections.push(
          `<p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9A7A5E;margin:10px 0 3px;">Intro</p>` +
          `<p style="font-size:14px;color:#2B241C;margin:0;line-height:1.55;">${a.current_intro}</p>`
        );
      }
      if (showAsk) {
        sections.push(
          `<p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9A7A5E;margin:10px 0 3px;">Ask</p>` +
          `<p style="font-size:14px;color:#2B241C;margin:0;line-height:1.55;">${a.current_ask}</p>`
        );
      }

      const borderTop = i > 0 ? "border-top:1px solid #EDE3D1;" : "";
      const paddingTop = i > 0 ? "padding-top:16px;" : "";

      return `<div style="${borderTop}${paddingTop}padding-bottom:16px;">${nameHtml}${companyHtml ? `<br>${companyHtml}` : ""}${sections.join("")}</div>`;
    })
    .join("");
}
