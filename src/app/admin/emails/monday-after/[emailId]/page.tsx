import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";
import { getDinnerAttendees } from "@/lib/email-intros-asks";
import DraftEditor from "./draft-editor";
import { getRecipientCount, isTestingMode } from "../actions";

export default async function MondayAfterDraftPage({
  params,
}: {
  params: Promise<{ emailId: string }>;
}) {
  const { emailId } = await params;
  const admin = createAdminClient("read-only");

  const { data: email } = await admin
    .from("monday_after_emails")
    .select("*, dinners!inner(id, date, venue, address)")
    .eq("id", emailId)
    .single();

  if (!email) notFound();

  const dinner = email.dinners as unknown as { id: string; date: string; venue: string; address: string };

  const { data: images } = await admin
    .from("monday_after_email_images")
    .select("*")
    .eq("email_id", emailId)
    .order("group_number", { ascending: true })
    .order("display_order", { ascending: true });

  const recipientCount = await getRecipientCount();

  // Fetch attendees for intros/asks preview
  const attendees = await getDinnerAttendees(dinner.id, admin);

  // The CTA in the rendered email points to the NEXT upcoming dinner, not
  // the anchor (which is in the past by the time Monday After sends).
  const today = getTodayMT();
  const { data: upcomingDinnerRow } = await admin
    .from("dinners")
    .select("date, venue, address")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  const upcomingDinner = upcomingDinnerRow ?? null;

  let sentByName: string | null = null;
  if (email.sent_by) {
    const { data: sender } = await admin.from("members").select("first_name, last_name").eq("id", email.sent_by).single();
    if (sender) sentByName = formatName(sender.first_name, sender.last_name);
  }

  return (
    <div>
      <Link
        href="/admin/emails"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        &larr; Emails
      </Link>

      <h2 className="tv-h2 !text-[36px] mb-6">
        Monday After &mdash; {formatDateFriendly(dinner.date)}
      </h2>

      <DraftEditor
        emailId={emailId}
        status={email.status as "draft" | "sent"}
        initialSubject={email.subject}
        initialPreheader={email.preheader}
        initialHeadline={email.headline}
        initialOpeningText={email.opening_text}
        initialRecapText={email.recap_text}
        initialTeamShoutouts={email.team_shoutouts}
        initialOurMission={email.our_mission}
        initialIntrosAsksHeader={email.intros_asks_header}
        initialPartnershipBoilerplate={email.partnership_boilerplate}
        testSentAfterLastEdit={email.test_sent_after_last_edit}
        upcomingDinner={upcomingDinner}
        initialImages={(images ?? []).map((img: { id: string; group_number: number; display_order: number; public_url: string }) => ({
          id: img.id, groupNumber: img.group_number, displayOrder: img.display_order, publicUrl: img.public_url,
        }))}
        recipientCount={recipientCount}
        testingMode={isTestingMode()}
        attendeeCount={attendees.length}
        sentAt={email.sent_at}
        sentByName={sentByName}
        audienceCount={email.audience_snapshot ? (email.audience_snapshot as unknown[]).length : null}
      />
    </div>
  );
}
