"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const EMAIL_FROM = "team@thunderviewceodinners.com";

const resend = new Resend(process.env.RESEND_API_KEY!);

function renderTemplate(body: string, member: { first_name: string }): string {
  return body.replace(/\[member\.firstname\]/g, member.first_name);
}

function bodyToHtml(body: string): string {
  // Convert newlines to <br>, preserve existing HTML tags
  return body.replace(/\n/g, "<br>");
}

export async function sendTestEmail(
  slug: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  // Get the current user's member record
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

  const renderedSubject = renderTemplate(subject, member);
  const renderedBody = renderTemplate(body, member);
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

  // Get member id for updated_by
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
