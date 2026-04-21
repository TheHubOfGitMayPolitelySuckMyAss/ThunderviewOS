"use client";

import { useState, useTransition } from "react";
import { sendTestEmail, saveTemplate } from "./actions";
import { formatTimestamp } from "@/lib/format";

interface TemplateEditorProps {
  slug: string;
  initialSubject: string;
  initialBody: string;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
}

export default function TemplateEditor({
  slug,
  initialSubject,
  initialBody,
  lastUpdatedAt,
  lastUpdatedByName,
}: TemplateEditorProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [hasEdited, setHasEdited] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(lastUpdatedAt);
  const [updatedByName, setUpdatedByName] = useState(lastUpdatedByName);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSending, startSending] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function handleSubjectChange(value: string) {
    setSubject(value);
    setHasEdited(true);
    setTestSent(false);
  }

  function handleBodyChange(value: string) {
    setBody(value);
    setHasEdited(true);
    setTestSent(false);
  }

  function handleSendTest() {
    startSending(async () => {
      setMessage(null);
      const result = await sendTestEmail(slug, subject, body);
      if (result.success) {
        setTestSent(true);
        setMessage({ type: "success", text: "Test email sent!" });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to send test email" });
      }
    });
  }

  function handleSave() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveTemplate(slug, subject, body);
      if (result.success) {
        setHasEdited(false);
        setTestSent(false);
        setUpdatedAt(result.updatedAt!);
        setUpdatedByName(result.updatedByName!);
        setMessage({ type: "success", text: "Template saved." });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save" });
      }
    });
  }

  return (
    <div className="max-w-2xl">
      {/* Subject */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Body */}
      <div className="mb-2">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Body
        </label>
        <textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          rows={16}
          className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Available variables */}
      <p className="mb-6 text-xs text-gray-500">
        Available variables: <code className="rounded bg-gray-100 px-1 py-0.5">[member.firstname]</code>
      </p>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSendTest}
          disabled={!hasEdited || isSending}
          className="rounded bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? "Sending..." : "Send Test Email"}
        </button>
        <button
          onClick={handleSave}
          disabled={!testSent || isSaving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Last updated */}
      {updatedAt && updatedByName && (
        <p className="mt-4 text-xs text-gray-500">
          Last updated by {updatedByName} on {formatTimestamp(updatedAt)}
        </p>
      )}
    </div>
  );
}
