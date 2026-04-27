"use client";

import { useState, useTransition } from "react";
import { formatTimestamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/field";
import { saveInstance, sendInstanceTest, sendInstanceToAll } from "./actions";

interface InstanceEditorProps {
  instanceId: string;
  templateSlug: string;
  initialSubject: string;
  initialBody: string;
  initialStatus: "draft" | "test_sent" | "sent";
  recipientCount: number;
  sentAt: string | null;
  sentByName: string | null;
  sentCount: number | null;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
}

const AVAILABLE_VARIABLES = [
  "[member.firstname]",
  "[dinner.date]",
  "[dinner.venue]",
  "[dinner.address]",
];

export default function InstanceEditor({
  instanceId,
  initialSubject,
  initialBody,
  initialStatus,
  recipientCount,
  sentAt: initialSentAt,
  sentByName: initialSentByName,
  sentCount: initialSentCount,
  lastUpdatedAt,
  lastUpdatedByName: initialUpdatedByName,
}: InstanceEditorProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState(initialStatus);
  const [hasEdited, setHasEdited] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(lastUpdatedAt);
  const [updatedByName, setUpdatedByName] = useState(initialUpdatedByName);
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [sentByName, setSentByName] = useState(initialSentByName);
  const [sentCount, setSentCount] = useState(initialSentCount);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isSending, startSending] = useTransition();

  const isSent = status === "sent";

  function handleSubjectChange(value: string) {
    setSubject(value);
    setHasEdited(true);
  }

  function handleBodyChange(value: string) {
    setBody(value);
    setHasEdited(true);
  }

  function handleSaveDraft() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveInstance(instanceId, subject, body);
      if (result.success) {
        setHasEdited(false);
        setUpdatedAt(result.updatedAt!);
        setUpdatedByName(result.updatedByName!);
        setMessage({ type: "success", text: "Draft saved." });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save" });
      }
    });
  }

  function handleSendTest() {
    startTesting(async () => {
      setMessage(null);
      const result = await sendInstanceTest(instanceId, subject, body);
      if (result.success) {
        setStatus((prev) => (prev === "draft" ? "test_sent" : prev));
        setMessage({ type: "success", text: "Test email sent!" });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to send test email" });
      }
    });
  }

  function handleSendToAll() {
    startSending(async () => {
      setMessage(null);
      const result = await sendInstanceToAll(instanceId);
      if (result.success) {
        setStatus("sent");
        setSentAt(result.sentAt!);
        setSentByName(result.sentByName!);
        setSentCount(result.sent!);
        setMessage({ type: "success", text: `Sent to ${result.sent} member${result.sent !== 1 ? "s" : ""}.` });
        setTimeout(() => setShowModal(false), 2000);
      } else {
        setMessage({ type: "error", text: result.error || "Send failed" });
      }
    });
  }

  return (
    <div className="max-w-2xl">
      {/* Sent banner */}
      {isSent && sentAt && (
        <div className="rounded-md bg-[rgba(91,106,59,0.08)] px-4 py-3 text-sm text-success mb-6">
          Sent to {sentCount} member{sentCount !== 1 ? "s" : ""}{sentByName ? ` by ${sentByName}` : ""} on {formatTimestamp(sentAt)}
        </div>
      )}

      {/* Subject */}
      <Field label="Subject" className="mb-4">
        <Input
          type="text"
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          disabled={isSent}
        />
      </Field>

      {/* Body */}
      <Field label="Body" className="mb-2">
        <Textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          rows={16}
          className="!font-mono !text-sm"
          disabled={isSent}
        />
      </Field>

      {/* Available variables */}
      <p className="mb-6 text-xs text-fg3">
        Available variables:{" "}
        {AVAILABLE_VARIABLES.map((v, i) => (
          <span key={v}>
            {i > 0 && ", "}
            <code className="rounded bg-bg-elevated px-1 py-0.5 text-fg2">{v}</code>
          </span>
        ))}
      </p>

      {/* Action buttons */}
      {!isSent && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={!hasEdited || isSaving}
          >
            {isSaving ? "Saving\u2026" : "Save Draft"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleSendTest}
            disabled={isTesting}
          >
            {isTesting ? "Sending\u2026" : "Send Test Email"}
          </Button>
          <Button
            onClick={() => { setMessage(null); setShowModal(true); }}
            disabled={status === "draft"}
          >
            Send To All
          </Button>
        </div>
      )}

      {/* Status message */}
      {message && !showModal && (
        <p
          className={`mt-3 text-sm ${
            message.type === "success" ? "text-moss-600" : "text-ember-600"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Last updated */}
      {updatedAt && updatedByName && !isSent && (
        <p className="mt-4 text-xs text-fg3">
          Last updated by {updatedByName} on {formatTimestamp(updatedAt)}
        </p>
      )}

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-bg border border-border rounded-xl shadow-lg w-[420px] p-6">
            <h3 className="tv-h4 mb-2">Send marketing email</h3>
            <p className="text-sm text-fg2 mb-5">
              You&rsquo;re about to send this email to{" "}
              <strong className="text-fg1">{recipientCount}</strong>{" "}
              member{recipientCount !== 1 ? "s" : ""}.
            </p>

            {message && (
              <div
                className={`rounded-md px-[var(--tv-space-4)] py-[var(--tv-space-2)] text-sm mb-4 ${
                  message.type === "success"
                    ? "bg-[rgba(91,106,59,0.08)] text-success"
                    : "bg-[rgba(192,68,42,0.08)] text-danger"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex gap-tight justify-end">
              <Button variant="ghost" onClick={() => setShowModal(false)} disabled={isSending}>
                Cancel
              </Button>
              <Button onClick={handleSendToAll} disabled={isSending}>
                {isSending ? "Sending\u2026" : "Send To All"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
