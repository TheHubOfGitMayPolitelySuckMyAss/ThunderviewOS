"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { formatTimestamp } from "@/lib/format";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Field from "@/components/field";
import {
  saveDraft,
  sendTestEmail,
  sendToAll,
} from "../actions";

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor"), { ssr: false });

interface DraftEditorProps {
  emailId: string;
  status: "draft" | "sent";
  initialSubject: string;
  initialBody: string;
  testSentAfterLastEdit: boolean;
  recipientCount: number;
  testingMode: boolean;
  sentAt: string | null;
  sentByName: string | null;
  audienceCount: number | null;
}

export default function DraftEditor({
  emailId,
  status: initialStatus,
  initialSubject,
  initialBody,
  testSentAfterLastEdit: initialTestSent,
  recipientCount,
  testingMode,
  sentAt,
  sentByName,
  audienceCount,
}: DraftEditorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [testSentAfterLastEdit, setTestSentAfterLastEdit] = useState(initialTestSent);
  const [hasEdited, setHasEdited] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isSending, startSending] = useTransition();

  const isSent = status === "sent";

  function markEdited() {
    setHasEdited(true);
    setTestSentAfterLastEdit(false);
    setEditVersion((v) => v + 1);
  }

  function handleSave() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveDraft(emailId, { subject, body });
      if (result.success) {
        setHasEdited(false);
        setMessage({ type: "success", text: "Draft saved." });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save" });
      }
    });
  }

  async function autoSave() {
    const result = await saveDraft(emailId, { subject, body });
    if (result.success) setHasEdited(false);
  }

  useUnsavedChangesGuard({
    enabled: hasEdited && !isSent,
    version: editVersion,
    onAutosave: autoSave,
  });

  function handleSendTest() {
    startTesting(async () => {
      setMessage(null);
      await saveDraft(emailId, { subject, body });
      const result = await sendTestEmail(emailId);
      if (result.success) {
        setHasEdited(false);
        setTestSentAfterLastEdit(true);
        setMessage({ type: "success", text: "Test email sent!" });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to send test" });
      }
    });
  }

  function handleSendToAll() {
    startSending(async () => {
      setMessage(null);
      const result = await sendToAll(emailId);
      if (result.success) {
        setStatus("sent");
        setMessage({ type: "success", text: `Sent to ${result.sent} member${result.sent !== 1 ? "s" : ""}.` });
        setTimeout(() => setShowSendModal(false), 2000);
      } else {
        setMessage({ type: "error", text: result.error || "Send failed" });
      }
    });
  }

  const canSend =
    testSentAfterLastEdit &&
    subject.trim() !== "" &&
    body.trim() !== "" && body !== "<p></p>";

  return (
    <div className="max-w-2xl">
      {/* Testing mode banner */}
      {testingMode && !isSent && (
        <div className="rounded-md bg-[rgba(192,150,42,0.1)] border border-[rgba(192,150,42,0.3)] px-4 py-3 text-sm text-fg2 mb-6">
          <strong className="text-fg1">Testing mode</strong> &mdash; &ldquo;Send To All&rdquo; will only send to admin and team members ({recipientCount} recipients). Set <code className="text-xs bg-bg-elevated px-1 py-0.5 rounded">NEXT_PUBLIC_EMAIL_MODE=live</code> in Vercel to send to all members.
        </div>
      )}

      {/* Sent banner */}
      {isSent && sentAt && (
        <div className="rounded-md bg-[rgba(91,106,59,0.08)] px-4 py-3 text-sm text-success mb-6">
          Sent to {audienceCount} member{audienceCount !== 1 ? "s" : ""}{sentByName ? ` by ${sentByName}` : ""} on {formatTimestamp(sentAt)}
        </div>
      )}

      {/* Subject */}
      <Field label="Subject" className="mb-4">
        <Input type="text" value={subject} onChange={(e) => { setSubject(e.target.value); markEdited(); }} disabled={isSent} />
      </Field>

      {/* Body */}
      <Field label="Body" className="mb-4">
        <RichTextEditor
          value={body}
          onChange={(html) => { setBody(html); markEdited(); }}
          disabled={isSent}
          rows={10}
        />
      </Field>

      {/* Static preview: CAN-SPAM */}
      <div className="rounded-lg border border-border bg-bg-elevated p-4 mb-6">
        <p className="text-xs text-fg3 text-center leading-relaxed">
          Thunderview CEO Dinners / 2462 S Acoma St / Denver, CO 80223 / USA<br />
          <span className="underline">Unsubscribe from marketing emails</span>
        </p>
      </div>

      {/* Action buttons */}
      {!isSent && (
        <div className="flex items-center gap-3 mt-6">
          <Button variant="secondary" onClick={handleSave} disabled={!hasEdited || isSaving}>
            {isSaving ? "Saving…" : "Save Draft"}
          </Button>
          <Button variant="secondary" onClick={handleSendTest} disabled={isTesting}>
            {isTesting ? "Sending…" : "Send Test Email"}
          </Button>
          <Button onClick={() => { setMessage(null); setShowSendModal(true); }} disabled={!canSend}>
            Send To All
          </Button>
        </div>
      )}

      {/* Validation hints when send is disabled */}
      {!isSent && !canSend && (
        <div className="mt-3 text-xs text-fg3 space-y-0.5">
          {(!subject.trim()) && <p>Missing: subject</p>}
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
          <div className="bg-bg border border-border rounded-xl shadow-lg w-[420px] p-6">
            <h3 className="tv-h4 mb-2">Send One Off Blast</h3>
            <p className="text-sm text-fg2 mb-5">
              You&rsquo;re about to send this email to{" "}
              <strong className="text-fg1">{recipientCount}</strong>{" "}
              member{recipientCount !== 1 ? "s" : ""} with marketing enabled.
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
              <Button onClick={handleSendToAll} disabled={isSending}>
                {isSending ? "Sending…" : "Send To All"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
