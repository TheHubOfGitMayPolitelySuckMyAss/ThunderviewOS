"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { formatTimestamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Field from "@/components/field";
import { saveMacro } from "./actions";

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor"), { ssr: false });

interface MacroEditorProps {
  initialSubject: string;
  initialBody: string;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
}

export default function MacroEditor({
  initialSubject,
  initialBody,
  lastUpdatedAt,
  lastUpdatedByName: initialUpdatedByName,
}: MacroEditorProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [hasEdited, setHasEdited] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(lastUpdatedAt);
  const [updatedByName, setUpdatedByName] = useState(initialUpdatedByName);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  function markEdited() {
    setHasEdited(true);
  }

  function handleSave() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveMacro({ subject, body });
      if (result.success) {
        setHasEdited(false);
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
      <Field label="Subject" className="mb-4">
        <Input
          type="text"
          value={subject}
          onChange={(e) => { setSubject(e.target.value); markEdited(); }}
        />
      </Field>

      <Field label="Body" className="mb-6">
        <RichTextEditor
          value={body}
          onChange={(html) => { setBody(html); markEdited(); }}
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

      <Button onClick={handleSave} disabled={!hasEdited || isSaving}>
        {isSaving ? "Saving…" : "Save Template"}
      </Button>

      {message && (
        <p className={`mt-3 text-sm ${message.type === "success" ? "text-moss-600" : "text-ember-600"}`}>
          {message.text}
        </p>
      )}

      {updatedAt && updatedByName && (
        <p className="mt-4 text-xs text-fg3">
          Last updated by {updatedByName} on {formatTimestamp(updatedAt)}
        </p>
      )}
    </div>
  );
}
