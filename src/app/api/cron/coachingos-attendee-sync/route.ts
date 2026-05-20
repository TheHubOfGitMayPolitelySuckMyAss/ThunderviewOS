/**
 * Vercel Cron: "CoachingOS Attendee Sync" — fires daily, no-ops unless today
 * (in America/Denver) is a dinner date. On firing day:
 *   - Pull every member with a fulfilled ticket for tonight's dinner whose
 *     last_dinner_attended IS NULL (first-time attendees, attending tonight).
 *   - POST them to CoachingOS as triage candidates.
 *
 * CoachingOS surfaces these in Top Priorities so Eric can decide before the
 * dinner whether to add each as a Lead or ignore. CoachingOS dedups against
 * its own contacts.emails on receive — first-timers who happen to already be
 * in Eric's Rolodex don't surface.
 *
 * Push is best-effort. A 401/500 from CoachingOS doesn't roll back the cron;
 * it logs error.caught and exits 200 so Vercel doesn't retry-storm.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import { logSystemEvent } from "@/lib/system-events";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runAttendeeSync();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:coachingos-attendee-sync",
      summary: `coachingos-attendee-sync threw: ${error.message}`,
      metadata: {
        context: "cron.coachingos_attendee_sync",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

async function runAttendeeSync() {
  const admin = createAdminClient("cron");
  const targetDate = getTodayMT();

  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date")
    .eq("date", targetDate)
    .maybeSingle();

  if (!dinner) {
    await logSystemEvent({
      event_type: "cron.coachingos_attendee_sync",
      actor_label: "cron:coachingos-attendee-sync",
      summary: `coachingos-attendee-sync ran: no dinner on ${targetDate}`,
      metadata: {
        outcome: "no_op",
        target_date: targetDate,
        reason: "no dinner scheduled today",
      },
    });
    return NextResponse.json({
      ran: true,
      target_date: targetDate,
      reason: "no dinner today",
    });
  }

  const { data: tickets } = await admin
    .from("tickets")
    .select("member_id")
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled")
    .range(0, 999);

  const ticketedMemberIds = Array.from(
    new Set((tickets ?? []).map((t) => t.member_id as string)),
  );

  if (ticketedMemberIds.length === 0) {
    await logSystemEvent({
      event_type: "cron.coachingos_attendee_sync",
      actor_label: "cron:coachingos-attendee-sync",
      summary: `coachingos-attendee-sync ran: no fulfilled tickets for ${targetDate}`,
      metadata: {
        outcome: "no_op",
        dinner_id: dinner.id,
        dinner_date: targetDate,
        reason: "no fulfilled tickets",
      },
    });
    return NextResponse.json({
      ran: true,
      dinner_date: targetDate,
      reason: "no fulfilled tickets",
    });
  }

  const { data: members } = await admin
    .from("members")
    .select(
      `id, first_name, last_name, company_name, company_website, linkedin_profile,
       current_intro, current_ask, last_dinner_attended,
       member_emails!inner(email, is_primary, email_status)`,
    )
    .in("id", ticketedMemberIds)
    .is("last_dinner_attended", null)
    .eq("member_emails.is_primary", true)
    .eq("member_emails.email_status", "active");

  type MemberRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    company_website: string | null;
    linkedin_profile: string | null;
    current_intro: string | null;
    current_ask: string | null;
    last_dinner_attended: string | null;
    member_emails: { email: string }[];
  };

  const attendees = ((members ?? []) as MemberRow[])
    .map((m) => {
      const email = m.member_emails?.[0]?.email ?? null;
      if (!email) return null;
      const name = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
      if (!name) return null;
      return {
        thunderview_member_id: m.id,
        name,
        email,
        company_name: m.company_name || null,
        company_website: m.company_website || null,
        linkedin_profile: m.linkedin_profile || null,
        intro: m.current_intro || null,
        ask: m.current_ask || null,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  if (attendees.length === 0) {
    await logSystemEvent({
      event_type: "cron.coachingos_attendee_sync",
      actor_label: "cron:coachingos-attendee-sync",
      summary: `coachingos-attendee-sync ran: no first-time attendees for ${targetDate}`,
      metadata: {
        outcome: "no_op",
        dinner_id: dinner.id,
        dinner_date: targetDate,
        ticketed_count: ticketedMemberIds.length,
        reason: "no first-time attendees",
      },
    });
    return NextResponse.json({
      ran: true,
      dinner_date: targetDate,
      first_timers: 0,
    });
  }

  const webhookUrl = process.env.COACHINGOS_WEBHOOK_URL;
  const webhookSecret = process.env.COACHINGOS_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:coachingos-attendee-sync",
      summary: "coachingos-attendee-sync: COACHINGOS_WEBHOOK_URL or COACHINGOS_WEBHOOK_SECRET missing",
      metadata: {
        context: "cron.coachingos_attendee_sync",
        cause: "missing_env",
        first_timer_count: attendees.length,
      },
    });
    return NextResponse.json({ ran: true, error: "missing env" }, { status: 500 });
  }

  let webhookStatus: number | null = null;
  let webhookResponse: unknown = null;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({ dinner_date: targetDate, attendees }),
    });
    webhookStatus = res.status;
    webhookResponse = await res.json().catch(() => null);
    if (!res.ok) {
      await logSystemEvent({
        event_type: "error.caught",
        actor_label: "cron:coachingos-attendee-sync",
        summary: `coachingos-attendee-sync webhook returned ${res.status}`,
        metadata: {
          context: "cron.coachingos_attendee_sync",
          cause: "webhook_non_2xx",
          status: res.status,
          response: webhookResponse,
          first_timer_count: attendees.length,
        },
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:coachingos-attendee-sync",
      summary: `coachingos-attendee-sync webhook threw: ${error.message}`,
      metadata: {
        context: "cron.coachingos_attendee_sync",
        cause: "webhook_throw",
        message: error.message,
        first_timer_count: attendees.length,
      },
    });
    return NextResponse.json({ ran: true, dinner_date: targetDate, first_timers: attendees.length, webhook_error: error.message });
  }

  await logSystemEvent({
    event_type: "cron.coachingos_attendee_sync",
    actor_label: "cron:coachingos-attendee-sync",
    summary: `coachingos-attendee-sync pushed ${attendees.length} first-timer(s) for ${targetDate}`,
    metadata: {
      outcome: webhookStatus && webhookStatus < 300 ? "success" : "webhook_error",
      dinner_id: dinner.id,
      dinner_date: targetDate,
      first_timer_count: attendees.length,
      webhook_status: webhookStatus,
      webhook_response: webhookResponse,
    },
  });

  return NextResponse.json({
    ran: true,
    dinner_date: targetDate,
    first_timers: attendees.length,
    webhook_status: webhookStatus,
  });
}
