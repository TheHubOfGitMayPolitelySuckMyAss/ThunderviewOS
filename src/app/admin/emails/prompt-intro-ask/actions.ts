"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { EMAIL_FROM, bodyToHtml, renderTemplateVars } from "@/lib/email";
import { formatDateFriendly, getTodayMT } from "@/lib/format";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const ALLOWED_SLUGS = ["prompt-intro-ask-missing", "prompt-intro-ask-stale"] as const;

function assertSlug(slug: string): slug is (typeof ALLOWED_SLUGS)[number] {
  return (ALLOWED_SLUGS as readonly string[]).includes(slug);
}

export async function sendTestEmail(
  slug: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  if (!assertSlug(slug)) return { success: false, error: "Unknown slug" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient("read-only");
  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");
  if (!lookup) return { success: false, error: "Member not found" };

  const todayMT = getTodayMT();
  const { data: nextDinner } = await admin
    .from("dinners")
    .select("date, venue, address")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(1)
    .single();
  if (!nextDinner) return { success: false, error: "No upcoming dinner found for test data" };

  const vars = {
    firstName: lookup.member.first_name,
    dinnerDate: formatDateFriendly(nextDinner.date),
    venue: nextDinner.venue,
    address: nextDinner.address,
  };

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: lookup.matchedEmail,
    subject: renderTemplateVars(subject, vars),
    html: bodyToHtml(renderTemplateVars(body, vars)),
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function saveTemplate(
  slug: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string; updatedAt?: string; updatedByName?: string }> {
  if (!assertSlug(slug)) return { success: false, error: "Unknown slug" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();
  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");
  if (!lookup) return { success: false, error: "Member not found" };

  const { error } = await admin
    .from("email_templates")
    .update({ subject, body, updated_by: lookup.member.id })
    .eq("slug", slug);
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    updatedAt: new Date().toISOString(),
    updatedByName: `${lookup.member.first_name} ${lookup.member.last_name}`,
  };
}
