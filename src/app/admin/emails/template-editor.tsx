"use client";

import { useState, useTransition } from "react";
import { formatTimestamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface TemplateEditorProps {
  slug: string;
  initialSubject: string;
  initialBody: string;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
  availableVariables: string[];
  sendTestEmail: (slug: string, subject: string, body: string) => Promise<{ success: boolean; error?: string }>;
  saveTemplate: (slug: string, subject: string, body: string) => Promise<{ success: boolean; error?: string; updatedAt?: string; updatedByName?: string }>;
}

export default function TemplateEditor({
  slug,
  initialSubject,
  initialBody,
  lastUpdatedAt,
  lastUpdatedByName: initialUpdatedByName,
  availableVariables,
  sendTestEmail,
  saveTemplate,
}: TemplateEditorProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [hasEdited, setHasEdited] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(lastUpdatedAt);
  const [updatedByName, setUpdatedByName] = useState(initialUpdatedByName);
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
        <Label>Subject</Label>
        <Input
          type="text"
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
        />
      </div>

      {/* Body */}
      <div className="mb-2">
        <Label>Body</Label>
        <Textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          rows={16}
          className="!font-mono !text-sm"
        />
      </div>

      {/* Available variables */}
      <p className="mb-6 text-xs text-fg3">
        Available variables:{" "}
        {availableVariables.map((v, i) => (
          <span key={v}>
            {i > 0 && ", "}
            <code className="rounded bg-cream-100 px-1 py-0.5 text-fg2">{v}</code>
          </span>
        ))}
      </p>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleSendTest}
          disabled={!hasEdited || testSent || isSending}
        >
          {isSending ? "Sending\u2026" : "Send Test Email"}
        </Button>
        <Button
          onClick={handleSave}
          disabled={!testSent || isSaving}
        >
          {isSaving ? "Saving\u2026" : "Save Changes"}
        </Button>
      </div>

      {/* Status message */}
      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === "success" ? "text-moss-600" : "text-ember-600"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Last updated */}
      {updatedAt && updatedByName && (
        <p className="mt-4 text-xs text-fg3">
          Last updated by {updatedByName} on {formatTimestamp(updatedAt)}
        </p>
      )}
    </div>
  );
}
