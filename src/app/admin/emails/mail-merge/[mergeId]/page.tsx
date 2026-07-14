import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { formatName, formatTimestamp } from "@/lib/format";
import { isTestingMode } from "@/lib/email-mode";
import { computeAudience } from "@/lib/mail-merge/audience";
import { getGmailConnection } from "@/lib/gmail/auth";
import DraftEditor from "./draft-editor";
import SendingProgress from "./sending-progress";

const BUCKET_LABELS: Record<string, string> = {
  team: "Team",
  investors: "Investors",
  attended: "Attended",
  approved: "Approved",
};

type RecipientAgg = {
  sentByBucket: Record<string, number>;
  sent: number;
  pending: number;
  failed: number;
  skipped: number;
  total: number;
};

export default async function MailMergePage({
  params,
}: {
  params: Promise<{ mergeId: string }>;
}) {
  const { mergeId } = await params;
  const admin = createAdminClient("read-only");

  const { data: merge } = await admin
    .from("mail_merges")
    .select("*")
    .eq("id", mergeId)
    .single();

  if (!merge) notFound();

  let sentByName: string | null = null;
  if (merge.sent_by) {
    const { data: sender } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", merge.sent_by)
      .single();
    if (sender) sentByName = formatName(sender.first_name, sender.last_name);
  }

  const headerLabel =
    merge.status === "sent" && merge.sent_at
      ? `Sent ${formatTimestamp(merge.sent_at)}${sentByName ? ` by ${sentByName}` : ""}`
      : merge.status === "sending"
        ? `Sending — started ${formatTimestamp(merge.send_started_at)}`
        : `Draft created ${formatTimestamp(merge.created_at)}`;

  return (
    <div>
      <Link
        href="/admin/emails"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        &larr; Emails
      </Link>

      <h2 className="tv-h2 !text-[36px] mb-2">Mail Merge</h2>
      <p className="text-sm text-fg3 mb-6">{headerLabel}</p>

      {merge.status === "draft" ? (
        <DraftView merge={merge} />
      ) : (
        <ResultView merge={merge} />
      )}
    </div>
  );
}

async function DraftView({
  merge,
}: {
  merge: {
    id: string;
    subject: string;
    body: string;
    groups: string[];
    test_sent_after_last_edit: boolean;
  };
}) {
  const [audience, gmail] = await Promise.all([
    computeAudience(),
    getGmailConnection(),
  ]);

  return (
    <DraftEditor
      mergeId={merge.id}
      initialSubject={merge.subject}
      initialBody={merge.body}
      initialGroups={merge.groups}
      testSentAfterLastEdit={merge.test_sent_after_last_edit}
      audienceCounts={audience.counts}
      gmailReady={gmail.connected && gmail.scopeOk}
      testingMode={isTestingMode()}
    />
  );
}

async function ResultView({
  merge,
}: {
  merge: { id: string; status: string; groups: string[] };
}) {
  const admin = createAdminClient("read-only");
  const rows = await fetchAll<{ bucket: string; status: string }>((from, to) =>
    admin
      .from("mail_merge_recipients")
      .select("bucket, status")
      .eq("mail_merge_id", merge.id)
      .range(from, to)
  );

  const agg: RecipientAgg = {
    sentByBucket: {},
    sent: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
    total: rows.length,
  };
  for (const r of rows) {
    if (r.status === "sent") {
      agg.sent += 1;
      agg.sentByBucket[r.bucket] = (agg.sentByBucket[r.bucket] ?? 0) + 1;
    } else if (r.status === "failed") agg.failed += 1;
    else if (r.status === "skipped") agg.skipped += 1;
    else agg.pending += 1;
  }

  const isSending = merge.status === "sending";
  const bucketOrder = ["investors", "attended", "approved", "team"];

  return (
    <div className="max-w-2xl">
      {isSending && <SendingProgress />}

      {isSending ? (
        <div className="rounded-md bg-[rgba(192,150,42,0.1)] border border-[rgba(192,150,42,0.3)] px-4 py-3 text-sm text-fg2 mb-6">
          <strong className="text-fg1">Sending&hellip;</strong> {agg.sent} of{" "}
          {agg.sent + agg.pending} sent via Gmail (~1/sec). Safe to leave this
          page — sending continues on the server.
        </div>
      ) : (
        <div className="rounded-md bg-[rgba(91,106,59,0.08)] px-4 py-3 text-sm text-success mb-6">
          Sent to {agg.sent} member{agg.sent !== 1 ? "s" : ""} via Gmail
        </div>
      )}

      <div className="rounded-lg border border-border bg-bg-elevated p-4 mb-6">
        <p className="text-xs text-fg3 uppercase tracking-wide mb-2">
          Recipients by group
        </p>
        <ul className="space-y-1">
          {bucketOrder
            .filter((b) => (agg.sentByBucket[b] ?? 0) > 0 || merge.groups.includes(b) || b === "team")
            .map((b) => (
              <li key={b} className="flex justify-between text-sm">
                <span className="text-fg2">{BUCKET_LABELS[b] ?? b}</span>
                <span className="text-fg1 font-medium">
                  {agg.sentByBucket[b] ?? 0} sent
                </span>
              </li>
            ))}
        </ul>
        {(agg.failed > 0 || agg.skipped > 0 || agg.pending > 0) && (
          <p className="mt-3 text-xs text-fg3">
            {agg.pending > 0 && `${agg.pending} pending · `}
            {agg.failed > 0 && `${agg.failed} failed · `}
            {agg.skipped > 0 && `${agg.skipped} skipped (no active email)`}
          </p>
        )}
      </div>
    </div>
  );
}
