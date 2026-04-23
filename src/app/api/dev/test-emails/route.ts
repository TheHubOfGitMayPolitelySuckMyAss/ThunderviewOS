/**
 * Temporary one-shot route to fire all transactional emails to Eric.
 * DELETE THIS FILE after confirming emails look correct.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendApprovalEmail,
  sendReApplicationEmail,
  sendRejectionEmail,
  sendFulfillmentEmail,
  sendMorningOfEmail,
  sendNewApplicationNotification,
} from "@/lib/email-send";
import { formatName, getTodayMT } from "@/lib/format";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== "thunderview-test-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results: Record<string, string> = {};

  // Find Eric's member ID
  const { data: ericEmail } = await admin
    .from("member_emails")
    .select("member_id")
    .eq("email", "eric@marcoullier.com")
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!ericEmail) {
    return NextResponse.json({ error: "Eric member record not found" }, { status: 500 });
  }

  const memberId = ericEmail.member_id;

  // 1. Approval
  try {
    await sendApprovalEmail(memberId);
    results.approval = "sent";
  } catch (e) {
    results.approval = `error: ${e}`;
  }

  // 2. Re-application
  try {
    await sendReApplicationEmail(memberId);
    results["re-application"] = "sent";
  } catch (e) {
    results["re-application"] = `error: ${e}`;
  }

  // 3. Rejection — needs an application ID. Find Eric's most recent application.
  const { data: ericApp } = await admin
    .from("applications")
    .select("id")
    .eq("email", "eric@marcoullier.com")
    .order("submitted_on", { ascending: false })
    .limit(1)
    .single();

  if (ericApp) {
    try {
      await sendRejectionEmail(ericApp.id);
      results.rejection = "sent";
    } catch (e) {
      results.rejection = `error: ${e}`;
    }
  } else {
    results.rejection = "skipped — no application found for eric@marcoullier.com";
  }

  // 4. Fulfillment — needs a dinner ID. Use next upcoming dinner.
  const today = getTodayMT();
  const { data: nextDinner } = await admin
    .from("dinners")
    .select("id, date, venue, address")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  if (nextDinner) {
    try {
      await sendFulfillmentEmail(memberId, nextDinner.id);
      results.fulfillment = "sent";
    } catch (e) {
      results.fulfillment = `error: ${e}`;
    }

    // 5. Morning-of
    try {
      const sampleAttendeeHtml = `<p><strong>Sample Attendee</strong> at Sample Co<br>This is a test intro for the morning-of email preview.</p>`;
      await sendMorningOfEmail(
        "eric@marcoullier.com",
        "Eric",
        nextDinner.date,
        nextDinner.venue,
        nextDinner.address,
        sampleAttendeeHtml
      );
      results["morning-of"] = "sent";
    } catch (e) {
      results["morning-of"] = `error: ${e}`;
    }
  } else {
    results.fulfillment = "skipped — no upcoming dinner";
    results["morning-of"] = "skipped — no upcoming dinner";
  }

  // 6. Admin notification
  try {
    await sendNewApplicationNotification({
      id: "test-preview-id",
      firstName: "Test",
      lastName: "Applicant",
      email: "test@example.com",
      companyName: "Test Company",
      companyWebsite: "testcompany.com",
      linkedinProfile: "linkedin.com/in/testapplicant",
      attendeeStagetype: "Active CEO (Bootstrapping or VC-Backed)",
    });
    results["admin-notification"] = "sent";
  } catch (e) {
    results["admin-notification"] = `error: ${e}`;
  }

  return NextResponse.json({ results });
}
