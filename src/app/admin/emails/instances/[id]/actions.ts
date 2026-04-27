"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, bodyToHtml, renderTemplateVars } from "@/lib/email";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const BATCH_SIZE = 100;

/** Helper: get the authenticated admin's member record */
async function getAuthMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("email, members!inner(id, first_name, last_name)")
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!memberEmail) return null;

  const member = memberEmail.members as unknown as {
    id: string;
    first_name: string;
    last_name: string;
  };

  return { email: memberEmail.email, ...member };
}

/** Create a new email instance from a macro template for a specific dinner */
export async function createInstance(
  templateSlug: string,
  dinnerId: string
): Promise<{ success: boolean; error?: string; instanceId?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  // Load macro template
  const { data: template } = await admin
    .from("email_templates")
    .select("subject, body")
    .eq("slug", templateSlug)
    .single();

  if (!template) return { success: false, error: "Template not found" };

  // Insert instance (unique constraint prevents duplicates)
  const { data: instance, error } = await admin
    .from("email_instances")
    .insert({
      template_slug: templateSlug,
      dinner_id: dinnerId,
      subject: template.subject,
      body: template.body,
      status: "draft",
      updated_by: member.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "An email instance already exists for this dinner" };
    }
    return { success: false, error: error.message };
  }

  return { success: true, instanceId: instance.id };
}

/** Save instance subject/body edits */
export async function saveInstance(
  instanceId: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string; updatedAt?: string; updatedByName?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { error } = await admin
    .from("email_instances")
    .update({ subject, body, updated_by: member.id })
    .eq("id", instanceId);

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    updatedAt: new Date().toISOString(),
    updatedByName: formatName(member.first_name, member.last_name),
  };
}

/** Send a test email of this instance to the logged-in admin */
export async function sendInstanceTest(
  instanceId: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  // Get instance + dinner
  const { data: instance } = await admin
    .from("email_instances")
    .select("id, dinner_id, dinners!inner(date, venue, address)")
    .eq("id", instanceId)
    .single();

  if (!instance) return { success: false, error: "Instance not found" };

  const dinner = instance.dinners as unknown as {
    date: string;
    venue: string;
    address: string;
  };

  const vars = {
    firstName: member.first_name,
    dinnerDate: formatDateFriendly(dinner.date),
    venue: dinner.venue,
    address: dinner.address,
  };

  const renderedSubject = renderTemplateVars(subject, vars);
  const renderedBody = renderTemplateVars(body, vars);
  const html = bodyToHtml(renderedBody);

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: member.email,
    subject: renderedSubject,
    html,
  });

  if (error) return { success: false, error: error.message };

  // Mark instance as test_sent (only upgrade from draft, never downgrade from sent)
  await admin
    .from("email_instances")
    .update({ status: "test_sent", test_sent_at: new Date().toISOString() })
    .eq("id", instanceId)
    .in("status", ["draft", "test_sent"]);

  return { success: true };
}

/** Send this instance to all marketing-opted-in members */
export async function sendInstanceToAll(
  instanceId: string
): Promise<{ success: boolean; error?: string; sent?: number; sentAt?: string; sentByName?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  // Load instance + dinner
  const { data: instance } = await admin
    .from("email_instances")
    .select("id, subject, body, status, dinner_id, dinners!inner(date, venue, address)")
    .eq("id", instanceId)
    .single();

  if (!instance) return { success: false, error: "Instance not found" };

  // Guard: must be test_sent, not already sent
  if (instance.status === "sent") {
    return { success: false, error: "This email has already been sent" };
  }
  if (instance.status === "draft") {
    return { success: false, error: "You must send a test email first" };
  }

  const dinner = instance.dinners as unknown as {
    date: string;
    venue: string;
    address: string;
  };

  // Query all marketing-opted-in, non-kicked-out members with active primary emails
  // Paginate past 1k PostgREST cap
  const PAGE_SIZE = 1000;
  type RecipientRow = {
    id: string;
    first_name: string;
    member_emails: { email: string }[];
  };

  const allRecipients: RecipientRow[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await admin
      .from("members")
      .select("id, first_name, member_emails!inner(email)")
      .eq("marketing_opted_in", true)
      .eq("kicked_out", false)
      .eq("member_emails.is_primary", true)
      .eq("member_emails.email_status", "active")
      .range(from, from + PAGE_SIZE - 1);

    const rows = (data ?? []) as unknown as RecipientRow[];
    allRecipients.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (allRecipients.length === 0) {
    return { success: false, error: "No eligible recipients found" };
  }

  // Build email payloads
  const emails = allRecipients.map((r) => {
    const vars = {
      firstName: r.first_name,
      dinnerDate: formatDateFriendly(dinner.date),
      venue: dinner.venue,
      address: dinner.address,
    };
    return {
      from: EMAIL_FROM,
      to: r.member_emails[0].email,
      subject: renderTemplateVars(instance.subject, vars),
      html: bodyToHtml(renderTemplateVars(instance.body, vars)),
    };
  });

  // Send in batches of 100 via Resend batch API
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(chunk);
      sent += chunk.length;
    } catch (err) {
      console.error(`Batch send error (chunk ${i / BATCH_SIZE + 1}):`, err);
      // Continue with remaining batches even if one fails
    }
  }

  const sentAt = new Date().toISOString();

  // Update instance status
  await admin
    .from("email_instances")
    .update({
      status: "sent",
      sent_at: sentAt,
      sent_by: member.id,
      recipient_count: sent,
    })
    .eq("id", instanceId)
    .eq("status", "test_sent"); // Optimistic lock: only update if still test_sent

  const sentByName = formatName(member.first_name, member.last_name);

  return { success: true, sent, sentAt, sentByName };
}

/** Get the count of marketing-opted-in, non-kicked-out members for the confirmation modal */
export async function getRecipientCount(): Promise<number> {
  const admin = createAdminClient();

  const { count } = await admin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("marketing_opted_in", true)
    .eq("kicked_out", false);

  return count ?? 0;
}

/** Get the target dinner for a template slug */
export async function getTargetDinner(
  templateSlug: string
): Promise<{ id: string; date: string } | null> {
  const admin = createAdminClient();
  const todayMT = getTodayMT();

  if (templateSlug === "monday-before") {
    const { data } = await admin
      .from("dinners")
      .select("id, date")
      .gte("date", todayMT)
      .order("date", { ascending: true })
      .limit(1)
      .single();
    return data;
  }

  if (templateSlug === "monday-after") {
    const { data } = await admin
      .from("dinners")
      .select("id, date")
      .lt("date", todayMT)
      .order("date", { ascending: false })
      .limit(1)
      .single();
    return data;
  }

  return null;
}
