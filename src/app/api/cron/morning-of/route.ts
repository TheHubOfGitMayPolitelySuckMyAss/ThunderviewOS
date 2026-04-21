/**
 * Vercel Cron: morning-of dinner email.
 *
 * Schedule: fires daily at 1pm UTC (7am MDT / 6am MST).
 * Checks if today (in America/Denver) is a dinner date.
 * If yes, sends the morning-of email to all members with fulfilled tickets.
 *
 * The email includes the editable template body + auto-generated attendee
 * intros & asks section.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT, formatName } from "@/lib/format";
import { sendMorningOfEmail } from "@/lib/email-send";

function buildAttendeeHtml(attendees: {
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
}[]): string {
  if (attendees.length === 0) {
    return "<p><em>No attendees confirmed yet.</em></p>";
  }

  return attendees
    .map((a) => {
      const name = formatName(a.first_name, a.last_name);
      let nameHtml: string;
      if (a.contact_preference === "linkedin" && a.linkedin_profile) {
        nameHtml = `<a href="${a.linkedin_profile}"><strong>${name}</strong></a>`;
      } else if (a.primary_email) {
        nameHtml = `<a href="mailto:${a.primary_email}"><strong>${name}</strong></a>`;
      } else {
        nameHtml = `<strong>${name}</strong>`;
      }

      let companyHtml = "";
      if (a.company_name) {
        if (a.company_website) {
          const url = a.company_website.startsWith("http") ? a.company_website : `https://${a.company_website}`;
          companyHtml = ` — <a href="${url}"><em>${a.company_name}</em></a>`;
        } else {
          companyHtml = ` — <em>${a.company_name}</em>`;
        }
      }

      const lines: string[] = [];
      lines.push(`${nameHtml}${companyHtml}`);

      const showAsk = a.current_ask && (
        !a.last_dinner_attended ||
        (a.ask_updated_at && a.ask_updated_at > a.last_dinner_attended)
      );

      if (a.current_intro) {
        lines.push(`<br>${a.current_intro}`);
      }
      if (a.current_intro && showAsk) {
        lines.push("<br>");
      }
      if (showAsk) {
        lines.push(`${a.current_ask}`);
      }

      return lines.join("");
    })
    .join("<br><br>---<br><br>");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayMT();
  const admin = createAdminClient();

  // Check if today is a dinner
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date, venue, address")
    .eq("date", today)
    .single();

  if (!dinner) {
    return NextResponse.json({
      ran: true,
      sent: 0,
      reason: "no dinner today",
      today,
    });
  }

  // Get all fulfilled tickets for today's dinner
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
  const attendees = rows
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
      return { ...m, primary_email: primaryEmail };
    })
    .sort((a, b) => {
      const aHas = a.current_intro || a.current_ask ? 0 : 1;
      const bHas = b.current_intro || b.current_ask ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return formatName(a.first_name, a.last_name)
        .toLowerCase()
        .localeCompare(formatName(b.first_name, b.last_name).toLowerCase());
    });

  // Build the attendee HTML once (shared across all emails)
  const attendeeHtml = buildAttendeeHtml(attendees);

  // Send to each attendee
  let sent = 0;
  for (const attendee of attendees) {
    if (!attendee.primary_email) continue;
    await sendMorningOfEmail(
      attendee.primary_email,
      attendee.first_name,
      dinner.date,
      dinner.venue,
      dinner.address,
      attendeeHtml
    );
    sent++;
  }

  console.log(`[morning-of] Sent ${sent} emails for dinner ${dinner.date}`);
  return NextResponse.json({
    ran: true,
    sent,
    dinnerDate: dinner.date,
    attendeeCount: attendees.length,
  });
}
