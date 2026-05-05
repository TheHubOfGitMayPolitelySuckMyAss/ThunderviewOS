import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName, formatTimestamp } from "@/lib/format";
import DraftEditor from "./draft-editor";
import { getRecipientCount, isTestingMode } from "../actions";

export default async function OneOffBlastDraftPage({
  params,
}: {
  params: Promise<{ emailId: string }>;
}) {
  const { emailId } = await params;
  const admin = createAdminClient("read-only");

  const { data: email } = await admin
    .from("one_off_blast_emails")
    .select("*")
    .eq("id", emailId)
    .single();

  if (!email) notFound();

  const recipientCount = await getRecipientCount();

  let sentByName: string | null = null;
  if (email.sent_by) {
    const { data: sender } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", email.sent_by)
      .single();
    if (sender) sentByName = formatName(sender.first_name, sender.last_name);
  }

  const headerLabel =
    email.status === "sent" && email.sent_at
      ? `Sent ${formatTimestamp(email.sent_at)}`
      : `Draft created ${formatTimestamp(email.created_at)}`;

  return (
    <div>
      <Link
        href="/admin/emails"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        &larr; Emails
      </Link>

      <h2 className="tv-h2 !text-[36px] mb-2">
        One Off Blast
      </h2>
      <p className="text-sm text-fg3 mb-6">{headerLabel}</p>

      <DraftEditor
        emailId={emailId}
        status={email.status as "draft" | "sent"}
        initialSubject={email.subject}
        initialBody={email.body}
        testSentAfterLastEdit={email.test_sent_after_last_edit}
        recipientCount={recipientCount}
        testingMode={isTestingMode()}
        sentAt={email.sent_at}
        sentByName={sentByName}
        audienceCount={email.audience_snapshot ? (email.audience_snapshot as unknown[]).length : null}
      />
    </div>
  );
}
