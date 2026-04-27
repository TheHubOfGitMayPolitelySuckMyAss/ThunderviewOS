"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, bodyToHtml, renderTemplateVars } from "@/lib/email";
import { formatDateFriendly, getTodayMT } from "@/lib/format";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendTestEmail(
  slug: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  void slug;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("email, members!inner(id, first_name, last_name)")
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!memberEmail) return { success: false, error: "Member not found" };

  const member = memberEmail.members as unknown as {
    id: string;
    first_name: string;
    last_name: string;
  };

  // Monday Before targets the next upcoming dinner
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
    firstName: member.first_name,
    dinnerDate: formatDateFriendly(nextDinner.date),
    venue: nextDinner.venue,
    address: nextDinner.address,
  };

  const renderedSubject = renderTemplateVars(subject, vars);
  const renderedBody = renderTemplateVars(body, vars);
  const html = bodyToHtml(renderedBody);

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: memberEmail.email,
    subject: renderedSubject,
    html,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function saveTemplate(
  slug: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string; updatedAt?: string; updatedByName?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("members!inner(id, first_name, last_name)")
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!memberEmail) return { success: false, error: "Member not found" };

  const member = memberEmail.members as unknown as {
    id: string;
    first_name: string;
    last_name: string;
  };

  const { error } = await admin
    .from("email_templates")
    .update({ subject, body, updated_by: member.id })
    .eq("slug", slug);

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    updatedAt: new Date().toISOString(),
    updatedByName: `${member.first_name} ${member.last_name}`,
  };
}
