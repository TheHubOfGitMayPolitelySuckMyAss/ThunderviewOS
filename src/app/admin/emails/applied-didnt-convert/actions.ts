"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { EMAIL_FROM, bodyToHtml } from "@/lib/email";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

function renderTemplate(text: string, member: { first_name: string }): string {
  return text.replace(/\[member\.firstname\]/g, member.first_name);
}

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

  const admin = createAdminClient("read-only");

  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");

  if (!lookup) return { success: false, error: "Member not found" };

  const member = lookup.member;

  const renderedSubject = renderTemplate(subject, member);
  const renderedBody = renderTemplate(body, member);
  const html = bodyToHtml(renderedBody);

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: lookup.matchedEmail,
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

  const admin = await createAdminClientForCurrentActor();

  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");

  if (!lookup) return { success: false, error: "Member not found" };

  const member = lookup.member;

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
