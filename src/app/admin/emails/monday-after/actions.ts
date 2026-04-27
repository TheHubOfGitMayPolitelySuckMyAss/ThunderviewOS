"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM } from "@/lib/email";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";
import { renderMondayAfterEmail } from "@/lib/email-templates/monday-after";
import { generateUnsubscribeToken } from "@/lib/unsubscribe";
import { validateImageType, compressEmailImage } from "@/lib/email-image-pipeline";
import { getDinnerAttendees, buildAttendeeHtml } from "@/lib/email-intros-asks";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY!);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://thunderview-os.vercel.app").trim();
const BATCH_SIZE = 100;

// ============================================================
// Auth helper
// ============================================================

async function getAuthMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const member = memberEmail.members as unknown as { id: string; first_name: string; last_name: string };
  return { email: memberEmail.email, ...member };
}

// ============================================================
// Macro template actions
// ============================================================

export async function loadMacro() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("monday_after_macro")
    .select("*")
    .limit(1)
    .single();
  return data;
}

export async function saveMacro(
  fields: {
    subject: string; preheader: string; headline: string; opening_text: string;
    recap_text: string; team_shoutouts: string; our_mission: string;
    intros_asks_header: string; partnership_boilerplate: string;
  }
): Promise<{ success: boolean; error?: string; updatedAt?: string; updatedByName?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("monday_after_macro")
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

export async function createDraft(dinnerId: string): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();
  const macro = await loadMacro();
  if (!macro) return { success: false, error: "Macro template not found" };

  const { data, error } = await admin
    .from("monday_after_emails")
    .insert({
      dinner_id: dinnerId,
      subject: macro.subject,
      preheader: macro.preheader,
      headline: macro.headline,
      opening_text: macro.opening_text,
      recap_text: macro.recap_text,
      team_shoutouts: macro.team_shoutouts,
      our_mission: macro.our_mission,
      intros_asks_header: macro.intros_asks_header,
      partnership_boilerplate: macro.partnership_boilerplate,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "A draft already exists for this dinner" };
    return { success: false, error: error.message };
  }
  return { success: true, emailId: data.id };
}

export async function saveDraft(
  emailId: string,
  fields: {
    subject: string; preheader: string; headline: string; opening_text: string;
    recap_text: string; team_shoutouts: string; our_mission: string;
    intros_asks_header: string; partnership_boilerplate: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("monday_after_emails")
    .update({ ...fields, test_sent_after_last_edit: false })
    .eq("id", emailId)
    .eq("status", "draft");

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================
// Image pipeline (shared helpers)
// ============================================================

export async function uploadEmailImage(
  emailId: string,
  groupNumber: number,
  formData: FormData
): Promise<{ success: boolean; error?: string; image?: { id: string; public_url: string } }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  const typeError = validateImageType(file);
  if (typeError) return { success: false, error: typeError };

  const originalBytes = await file.arrayBuffer();
  const result = await compressEmailImage(originalBytes);
  if ("error" in result) return { success: false, error: result.error };

  const uuid = crypto.randomUUID();
  const storagePath = `monday-after/${emailId}/${groupNumber}/${uuid}.jpg`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("email-images")
    .upload(storagePath, result.buffer, { contentType: "image/jpeg", upsert: false });

  if (uploadError) return { success: false, error: uploadError.message };

  const { data: urlData } = admin.storage.from("email-images").getPublicUrl(storagePath);

  const { data: maxRow } = await admin
    .from("monday_after_email_images")
    .select("display_order")
    .eq("email_id", emailId)
    .eq("group_number", groupNumber)
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = maxRow ? maxRow.display_order + 1 : 0;

  const { data: imageRow, error: insertError } = await admin
    .from("monday_after_email_images")
    .insert({
      email_id: emailId,
      group_number: groupNumber,
      display_order: nextOrder,
      storage_path: storagePath,
      public_url: urlData.publicUrl,
    })
    .select("id, public_url")
    .single();

  if (insertError) return { success: false, error: insertError.message };

  await admin
    .from("monday_after_emails")
    .update({ test_sent_after_last_edit: false })
    .eq("id", emailId)
    .eq("status", "draft");

  return { success: true, image: { id: imageRow.id, public_url: imageRow.public_url } };
}

export async function deleteEmailImage(
  imageId: string,
  emailId: string
): Promise<{ success: boolean; error?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: image } = await admin
    .from("monday_after_email_images")
    .select("*")
    .eq("id", imageId)
    .single();

  if (!image) return { success: false, error: "Image not found" };

  await admin.storage.from("email-images").remove([image.storage_path]);

  const { error } = await admin
    .from("monday_after_email_images")
    .delete()
    .eq("id", imageId);

  if (error) return { success: false, error: error.message };

  const { data: remaining } = await admin
    .from("monday_after_email_images")
    .select("id")
    .eq("email_id", image.email_id)
    .eq("group_number", image.group_number)
    .order("display_order", { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await admin.from("monday_after_email_images").update({ display_order: i }).eq("id", remaining[i].id);
    }
  }

  await admin
    .from("monday_after_emails")
    .update({ test_sent_after_last_edit: false })
    .eq("id", emailId)
    .eq("status", "draft");

  return { success: true };
}

export async function reorderEmailImages(
  emailId: string,
  groupNumber: number,
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();
  for (let i = 0; i < orderedIds.length; i++) {
    await admin.from("monday_after_email_images").update({ display_order: i }).eq("id", orderedIds[i]);
  }

  await admin
    .from("monday_after_emails")
    .update({ test_sent_after_last_edit: false })
    .eq("id", emailId)
    .eq("status", "draft");

  return { success: true };
}

// ============================================================
// Test send
// ============================================================

export async function sendTestEmail(emailId: string): Promise<{ success: boolean; error?: string }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: email } = await admin
    .from("monday_after_emails")
    .select("*, dinners!inner(id, date, venue, address)")
    .eq("id", emailId)
    .single();

  if (!email) return { success: false, error: "Email not found" };
  if (email.status === "sent") return { success: false, error: "Cannot test a sent email" };

  const dinner = email.dinners as unknown as { id: string; date: string; venue: string; address: string };

  const { data: images } = await admin
    .from("monday_after_email_images")
    .select("*")
    .eq("email_id", emailId)
    .order("group_number", { ascending: true })
    .order("display_order", { ascending: true });

  const attendees = await getDinnerAttendees(dinner.id, admin);
  const introsAsksHtml = buildAttendeeHtml(attendees);

  const html = renderMondayAfterEmail({
    subject: email.subject,
    preheader: email.preheader,
    headline: email.headline,
    openingText: email.opening_text,
    recapText: email.recap_text,
    teamShoutouts: email.team_shoutouts,
    ourMission: email.our_mission,
    introsAsksHeader: email.intros_asks_header,
    partnershipBoilerplate: email.partnership_boilerplate,
    dinner: { date: dinner.date, venue: dinner.venue, address: dinner.address },
    images: (images ?? []).map((img: { group_number: number; public_url: string; display_order: number }) => ({
      groupNumber: img.group_number, publicUrl: img.public_url, displayOrder: img.display_order,
    })),
    introsAsksHtml,
    recipientFirstName: member.first_name,
    unsubscribeUrl: `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(generateUnsubscribeToken(member.id))}`,
  });

  const { error } = await resend.emails.send({ from: EMAIL_FROM, to: member.email, subject: email.subject, html });
  if (error) return { success: false, error: error.message };

  await admin
    .from("monday_after_emails")
    .update({ test_sent_at: new Date().toISOString(), test_sent_after_last_edit: true })
    .eq("id", emailId)
    .eq("status", "draft");

  return { success: true };
}

// ============================================================
// Bulk send
// ============================================================

export async function sendToAll(emailId: string): Promise<{ success: boolean; error?: string; sent?: number }> {
  const member = await getAuthMember();
  if (!member) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: email } = await admin
    .from("monday_after_emails")
    .select("*, dinners!inner(id, date, venue, address)")
    .eq("id", emailId)
    .single();

  if (!email) return { success: false, error: "Email not found" };
  if (email.status === "sent") return { success: false, error: "Already sent" };
  if (!email.test_sent_after_last_edit) return { success: false, error: "Must send a test email first" };

  const dinner = email.dinners as unknown as { id: string; date: string; venue: string; address: string };

  const { data: images } = await admin
    .from("monday_after_email_images")
    .select("*")
    .eq("email_id", emailId)
    .order("group_number", { ascending: true })
    .order("display_order", { ascending: true });

  const attendees = await getDinnerAttendees(dinner.id, admin);
  const introsAsksHtml = buildAttendeeHtml(attendees);

  const imageData = (images ?? []).map((img: { group_number: number; public_url: string; display_order: number }) => ({
    groupNumber: img.group_number, publicUrl: img.public_url, displayOrder: img.display_order,
  }));

  // Query recipients (paginated)
  type RecipientRow = { id: string; first_name: string; member_emails: { email: string }[] };
  const allRecipients: RecipientRow[] = [];
  let from = 0;
  const PAGE_SIZE = 1000;
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

  if (allRecipients.length === 0) return { success: false, error: "No eligible recipients" };

  const audienceSnapshot = allRecipients.map((r) => ({
    member_id: r.id, first_name: r.first_name, email: r.member_emails[0].email,
  }));

  const emailPayloads = allRecipients.map((r) => {
    const unsubToken = generateUnsubscribeToken(r.id);
    const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

    const html = renderMondayAfterEmail({
      subject: email.subject,
      preheader: email.preheader,
      headline: email.headline,
      openingText: email.opening_text,
      recapText: email.recap_text,
      teamShoutouts: email.team_shoutouts,
      ourMission: email.our_mission,
      introsAsksHeader: email.intros_asks_header,
      partnershipBoilerplate: email.partnership_boilerplate,
      dinner: { date: dinner.date, venue: dinner.venue, address: dinner.address },
      images: imageData,
      introsAsksHtml,
      recipientFirstName: r.first_name,
      unsubscribeUrl: unsubUrl,
    });

    return {
      from: EMAIL_FROM, to: r.member_emails[0].email, subject: email.subject, html,
      headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    };
  });

  let sent = 0;
  for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
    const chunk = emailPayloads.slice(i, i + BATCH_SIZE);
    try { await resend.batch.send(chunk); sent += chunk.length; }
    catch (err) { console.error(`Batch send error (chunk ${i / BATCH_SIZE + 1}):`, err); }
  }

  await admin
    .from("monday_after_emails")
    .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: member.id, audience_snapshot: audienceSnapshot })
    .eq("id", emailId)
    .eq("status", "draft");

  return { success: true, sent };
}

// ============================================================
// Helpers
// ============================================================

export async function getRecipientCount(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("marketing_opted_in", true)
    .eq("kicked_out", false);
  return count ?? 0;
}

export async function getTeamMembers(): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient();

  const { data: adminEmail } = await admin
    .from("member_emails")
    .select("members!inner(id, first_name, last_name)")
    .eq("email", "eric@marcoullier.com")
    .eq("is_primary", true)
    .limit(1)
    .single();

  const { data: teamMembers } = await admin
    .from("members")
    .select("id, first_name, last_name")
    .eq("is_team", true)
    .eq("kicked_out", false);

  const result: { id: string; name: string }[] = [];
  const seen = new Set<string>();

  if (adminEmail) {
    const m = adminEmail.members as unknown as { id: string; first_name: string; last_name: string };
    result.push({ id: m.id, name: formatName(m.first_name, m.last_name) });
    seen.add(m.id);
  }

  for (const m of teamMembers ?? []) {
    if (!seen.has(m.id)) {
      result.push({ id: m.id, name: formatName(m.first_name, m.last_name) });
      seen.add(m.id);
    }
  }

  return result;
}
