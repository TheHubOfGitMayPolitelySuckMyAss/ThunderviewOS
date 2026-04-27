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
  initialPreheader: string;
  initialHeadline: string;
  initialCustomText: string;
  initialPartnershipBoilerplate: string;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
}

export default function MacroEditor({
  initialSubject,
  initialPreheader,
  initialHeadline,
  initialCustomText,
  initialPartnershipBoilerplate,
  lastUpdatedAt,
  lastUpdatedByName: initialUpdatedByName,
}: MacroEditorProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [preheader, setPreheader] = useState(initialPreheader);
  const [headline, setHeadline] = useState(initialHeadline);
  const [customText, setCustomText] = useState(initialCustomText);
  const [partnershipBoilerplate, setPartnershipBoilerplate] = useState(initialPartnershipBoilerplate);
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
      const result = await saveMacro({
        subject,
        preheader,
        headline,
        custom_text: customText,
        partnership_boilerplate: partnershipBoilerplate,
      });
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

      <Field label="Preheader" help="Preview text shown in inbox before opening" className="mb-4">
        <Input
          type="text"
          value={preheader}
          onChange={(e) => { setPreheader(e.target.value); markEdited(); }}
        />
      </Field>

      <Field label="Headline" className="mb-4">
        <Input
          type="text"
          value={headline}
          onChange={(e) => { setHeadline(e.target.value); markEdited(); }}
        />
      </Field>

      <Field label="Custom Text" className="mb-4">
        <RichTextEditor
          value={customText}
          onChange={(html) => { setCustomText(html); markEdited(); }}
          rows={6}
        />
      </Field>

      <Field label="Partnership Boilerplate" className="mb-6">
        <RichTextEditor
          value={partnershipBoilerplate}
          onChange={(html) => { setPartnershipBoilerplate(html); markEdited(); }}
          rows={4}
        />
      </Field>

      <Button onClick={handleSave} disabled={!hasEdited || isSaving}>
        {isSaving ? "Saving\u2026" : "Save Template"}
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
