"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Field from "@/components/field";
import { saveDraft, sendTestEmail, sendMailMerge } from "../actions";

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor"), { ssr: false });

const SELECTABLE = [
  { key: "investors", label: "Investors" },
  { key: "attended", label: "Attended" },
  { key: "approved", label: "Approved" },
] as const;

const SUPPRESSED = [
  { key: "opted_out", label: "Opted Out" },
  { key: "bounced", label: "Bounced" },
  { key: "has_ticket", label: "Has Ticket" },
  { key: "not_this_one", label: "Not This One" },
] as const;

interface DraftEditorProps {
  mergeId: string;
  initialSubject: string;
  initialBody: string;
  initialGroups: string[];
  testSentAfterLastEdit: boolean;
  /** Full precedence-ladder counts (see lib/mail-merge/audience.ts). */
  audienceCounts: Record<string, number>;
  gmailReady: boolean;
  testingMode: boolean;
}

export default function DraftEditor({
  mergeId,
  initialSubject,
  initialBody,
  initialGroups,
  testSentAfterLastEdit: initialTestSent,
  audienceCounts,
  gmailReady,
  testingMode,
}: DraftEditorProps) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [groups, setGroups] = useState<string[]>(initialGroups);
  const [testSentAfterLastEdit, setTestSentAfterLastEdit] = useState(initialTestSent);
  const [hasEdited, setHasEdited] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isSending, startSending] = useTransition();

  function markEdited() {
    setHasEdited(true);
    setTestSentAfterLastEdit(false);
    setEditVersion((v) => v + 1);
  }

  function toggleGroup(key: string) {
    setGroups((g) => (g.includes(key) ? g.filter((k) => k !== key) : [...g, key]));
    markEdited();
  }

  function handleSave() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveDraft(mergeId, { subject, body, groups });
      if (result.success) {
        setHasEdited(false);
        setMessage({ type: "success", text: "Draft saved." });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save" });
      }
    });
  }

  async function autoSave() {
    const result = await saveDraft(mergeId, { subject, body, groups });
    if (result.success) setHasEdited(false);
  }

  useUnsavedChangesGuard({
    enabled: hasEdited,
    version: editVersion,
    onAutosave: autoSave,
  });

  function handleSendTest() {
    startTesting(async () => {
      setMessage(null);
      await saveDraft(mergeId, { subject, body, groups });
      const result = await sendTestEmail(mergeId);
      if (result.success) {
        setHasEdited(false);
        setTestSentAfterLastEdit(true);
        setMessage({ type: "success", text: "Test email sent from your Gmail — check your inbox (and Sent folder)." });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to send test" });
      }
    });
  }

  function handleSend() {
    startSending(async () => {
      setMessage(null);
      const result = await sendMailMerge(mergeId);
      if (result.success) {
        setMessage({
          type: "success",
          text: `Queued ${result.queued} email${result.queued !== 1 ? "s" : ""} — sending has started.`,
        });
        setTimeout(() => {
          setShowSendModal(false);
          router.refresh();
        }, 1500);
      } else {
        setMessage({ type: "error", text: result.error || "Send failed" });
      }
    });
  }

  const teamCount = audienceCounts.team ?? 0;
  const estimated =
    teamCount +
    SELECTABLE.filter((g) => groups.includes(g.key)).reduce(
      (sum, g) => sum + (audienceCounts[g.key] ?? 0),
      0
    );

  const canSend =
    gmailReady &&
    testSentAfterLastEdit &&
    groups.length > 0 &&
    subject.trim() !== "" &&
    body.trim() !== "" &&
    body !== "<p></p>";

  return (
    <div className="max-w-2xl">
      {/* Gmail not connected */}
      {!gmailReady && (
        <div className="rounded-md bg-[rgba(192,68,42,0.08)] border border-[rgba(192,68,42,0.2)] px-4 py-3 text-sm text-fg2 mb-6">
          <strong className="text-fg1">Gmail not connected.</strong> Mail
          merges send through eric@marcoullier.com via the Gmail API.{" "}
          <a href="/api/auth/google" className="underline text-accent-hover">
            Connect Gmail
          </a>{" "}
          to enable sending.
        </div>
      )}

      {/* Testing mode banner */}
      {testingMode && (
        <div className="rounded-md bg-[rgba(192,150,42,0.1)] border border-[rgba(192,150,42,0.3)] px-4 py-3 text-sm text-fg2 mb-6">
          <strong className="text-fg1">Testing mode</strong> &mdash; the merge
          will only send to Team ({teamCount}). Set{" "}
          <code className="text-xs bg-bg-elevated px-1 py-0.5 rounded">NEXT_PUBLIC_EMAIL_MODE=live</code>{" "}
          in Vercel to send to the selected groups.
        </div>
      )}

      {/* Groups */}
      <Field label="Send to" className="mb-4">
        <div className="space-y-2 pt-1">
          {SELECTABLE.map((g) => (
            <label key={g.key} className="flex items-center gap-2.5 text-sm text-fg1 cursor-pointer">
              <input
                type="checkbox"
                checked={groups.includes(g.key)}
                onChange={() => toggleGroup(g.key)}
                className="accent-[var(--tv-accent,#9A7A5E)]"
              />
              {g.label}
              <span className="text-fg3">({audienceCounts[g.key] ?? 0})</span>
            </label>
          ))}
          <label className="flex items-center gap-2.5 text-sm text-fg2">
            <input type="checkbox" checked disabled />
            Team <span className="text-fg3">({teamCount}) &mdash; always included</span>
          </label>
          <p className="text-xs text-fg3 pt-1">
            Automatically excluded:{" "}
            {SUPPRESSED.map(
              (s) => `${s.label} (${audienceCounts[s.key] ?? 0})`
            ).join(" · ")}
          </p>
        </div>
      </Field>

      {/* Subject */}
      <Field label="Subject" className="mb-4">
        <Input
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            markEdited();
          }}
        />
      </Field>

      {/* Body */}
      <Field label="Body" className="mb-4">
        <RichTextEditor
          value={body}
          onChange={(html) => {
            setBody(html);
            markEdited();
          }}
          rows={10}
        />
      </Field>

      {/* What each recipient gets */}
      <div className="rounded-lg border border-border bg-bg-elevated p-4 mb-6">
        <p className="text-xs text-fg3 leading-relaxed">
          Each recipient gets a personal email from eric@marcoullier.com:
          <br />
          <span className="text-fg2">Hi &lt;first name&gt;,</span> &mdash; then
          your message above &mdash; then your live Gmail signature. No
          Thunderview template, no unsubscribe footer. Sends pace at ~1/sec so
          it reads as one-to-one email.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-6">
        <Button variant="secondary" onClick={handleSave} disabled={!hasEdited || isSaving}>
          {isSaving ? "Saving…" : "Save Draft"}
        </Button>
        <Button variant="secondary" onClick={handleSendTest} disabled={isTesting || !gmailReady}>
          {isTesting ? "Sending…" : "Send Test Email"}
        </Button>
        <Button onClick={() => { setMessage(null); setShowSendModal(true); }} disabled={!canSend}>
          Send Mail Merge
        </Button>
      </div>

      {/* Validation hints */}
      {!canSend && (
        <div className="mt-3 text-xs text-fg3 space-y-0.5">
          {!gmailReady && <p>Required: connect Gmail</p>}
          {groups.length === 0 && <p>Missing: pick at least one group</p>}
          {!subject.trim() && <p>Missing: subject</p>}
          {(!body.trim() || body === "<p></p>") && <p>Missing: body</p>}
          {!testSentAfterLastEdit && <p>Required: send a test email after your latest edits</p>}
        </div>
      )}

      {/* Status message */}
      {message && !showSendModal && (
        <p className={`mt-3 text-sm ${message.type === "success" ? "text-moss-600" : "text-ember-600"}`}>
          {message.text}
        </p>
      )}

      {/* Send confirmation modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-bg border border-border rounded-xl shadow-lg w-[440px] p-6">
            <h3 className="tv-h4 mb-2">Send Mail Merge</h3>
            <p className="text-sm text-fg2 mb-5">
              You&rsquo;re about to send a personal email from your Gmail to{" "}
              <strong className="text-fg1">~{estimated}</strong> people (
              {SELECTABLE.filter((g) => groups.includes(g.key))
                .map((g) => g.label)
                .join(", ")}{" "}
              + Team). At ~1/sec this takes about{" "}
              {Math.max(1, Math.round(estimated / 60))} minute
              {Math.round(estimated / 60) !== 1 ? "s" : ""}.
            </p>

            {message && (
              <div className={`rounded-md px-[var(--tv-space-4)] py-[var(--tv-space-2)] text-sm mb-4 ${
                message.type === "success" ? "bg-[rgba(91,106,59,0.08)] text-success" : "bg-[rgba(192,68,42,0.08)] text-danger"
              }`}>
                {message.text}
              </div>
            )}

            <div className="flex gap-tight justify-end">
              <Button variant="ghost" onClick={() => setShowSendModal(false)} disabled={isSending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? "Starting…" : "Send Mail Merge"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
