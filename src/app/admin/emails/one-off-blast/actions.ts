"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { EMAIL_FROM } from "@/lib/email";
import { formatName } from "@/lib/format";
import { renderOneOffBlastEmail } from "@/lib/email-templates/one-off-blast";
import { generateUnsubscribeToken } from "@/lib/unsubscribe";
import { getMarketingRecipients, getMarketingRecipientCount, isTestingMode } from "@/lib/email-mode";
import { logSystemEvent } from "@/lib/system-events";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://thunderview-os.vercel.app").trim();

// ============================================================
// Auth helper
// ============================================================

async function getAuthMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient("system-internal");
  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");

  if (!lookup) return null;
  return { email: lookup.matchedEmail, ...lookup.member };
}

// ============================================================
// Macro template actions
// ============================================================

export async function loadMacro() {
  const admin = createAdminClient("system-internal");
  const { data } = await admin
    .from("one_off_blast_macro")
    .select("*")
    .limit(1)
    .single();
  return data;
}

export async function saveMacro(
  fields: { subject: string; body: string }
): Promise<{ success: boolean; error?: string; updatedAt?: string; updatedByName?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient("system-internal");
  const { error } = await admin
    .from("one_off_blast_macro")
    .update({ ...fields, updated_by: member.id })
    .eq("singleton", true);

  if (error) return { success: false, error: error.message };
  return {
    success: true,
    updatedAt: new Date().toISOString(),
    updatedByName: formatName(member.first_name, member.last_name),
  };
}

// ============================================================
// Draft CRUD
// ============================================================

export async function createDraft(): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient("system-internal");

  const macro = await loadMacro();
  if (!macro) return { success: false, error: "Macro template not found" };

  const { data, error } = await admin
    .from("one_off_blast_emails")
    .insert({
      subject: macro.subject,
      body: macro.body,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  return { success: true, emailId: data.id };
}

export async function saveDraft(
  emailId: string,
  fields: { subject: string; body: string }
): Promise<{ success: boolean; error?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient("system-internal");
  const { error } = await admin
    .from("one_off_blast_emails")
    .update({ ...fields, test_sent_after_last_edit: false })
    .eq("id", emailId)
    .eq("status", "draft");

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================
// Test send
// ============================================================

export async function sendTestEmail(
  emailId: string
): Promise<{ success: boolean; error?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient("system-internal");

  const { data: email } = await admin
    .from("one_off_blast_emails")
    .select("*")
    .eq("id", emailId)
    .single();

  if (!email) return { success: false, error: "Email not found" };
  if (email.status === "sent") return { success: false, error: "Cannot test a sent email" };

  const html = renderOneOffBlastEmail({
    bodyHtml: email.body,
    recipientFirstName: member.first_name,
    unsubscribeUrl: `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(generateUnsubscribeToken(member.id))}`,
  });

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: member.email,
    subject: email.subject,
    html,
  });

  if (error) return { success: false, error: error.message };

  await admin
    .from("one_off_blast_emails")
    .update({ test_sent_at: new Date().toISOString(), test_sent_after_last_edit: true })
    .eq("id", emailId)
    .eq("status", "draft");

  return { success: true };
}

// ============================================================
// Bulk send
// ============================================================

const BATCH_SIZE = 100;

export async function sendToAll(
  emailId: string
): Promise<{ success: boolean; error?: string; sent?: number }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient("system-internal");

  const { data: email } = await admin
    .from("one_off_blast_emails")
    .select("*")
    .eq("id", emailId)
    .single();

  if (!email) return { success: false, error: "Email not found" };
  if (email.status === "sent") return { success: false, error: "Already sent" };
  if (!email.test_sent_after_last_edit) return { success: false, error: "Must send a test email first" };

  const allRecipients = await getMarketingRecipients();

  if (allRecipients.length === 0) {
    return { success: false, error: "No eligible recipients" };
  }

  const audienceSnapshot = allRecipients.map((r) => ({
    member_id: r.id,
    first_name: r.first_name,
    email: r.member_emails[0].email,
  }));

  const emailPayloads = allRecipients.map((r) => {
    const unsubToken = generateUnsubscribeToken(r.id);
    const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

    const html = renderOneOffBlastEmail({
      bodyHtml: email.body,
      recipientFirstName: r.first_name,
      unsubscribeUrl: unsubUrl,
    });

    return {
      from: EMAIL_FROM,
      to: r.member_emails[0].email,
      subject: email.subject,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  let sent = 0;
  for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
    const chunk = emailPayloads.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(chunk);
      sent += chunk.length;
    } catch (err) {
      console.error(`Batch send error (chunk ${i / BATCH_SIZE + 1}):`, err);
    }
  }

  await admin
    .from("one_off_blast_emails")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: member.id,
      audience_snapshot: audienceSnapshot,
    })
    .eq("id", emailId)
    .eq("status", "draft");

  await logSystemEvent({
    event_type: "email.bulk_sent",
    actor_id: member.id,
    summary: `Sent One Off Blast email to ${sent} recipients`,
    metadata: {
      kind: "one_off_blast",
      email_id: emailId,
      recipient_count: sent,
    },
  });

  return { success: true, sent };
}

// ============================================================
// Helpers for instance page
// ============================================================

export { getMarketingRecipientCount as getRecipientCount };
export { isTestingMode };
