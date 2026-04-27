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
  initialOpeningText: string;
  initialRecapText: string;
  initialTeamShoutouts: string;
  initialOurMission: string;
  initialIntrosAsksHeader: string;
  initialPartnershipBoilerplate: string;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
}

export default function MacroEditor({
  initialSubject,
  initialPreheader,
  initialHeadline,
  initialOpeningText,
  initialRecapText,
  initialTeamShoutouts,
  initialOurMission,
  initialIntrosAsksHeader,
  initialPartnershipBoilerplate,
  lastUpdatedAt,
  lastUpdatedByName: initialUpdatedByName,
}: MacroEditorProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [preheader, setPreheader] = useState(initialPreheader);
  const [headline, setHeadline] = useState(initialHeadline);
  const [openingText, setOpeningText] = useState(initialOpeningText);
  const [recapText, setRecapText] = useState(initialRecapText);
  const [teamShoutouts, setTeamShoutouts] = useState(initialTeamShoutouts);
  const [ourMission, setOurMission] = useState(initialOurMission);
  const [introsAsksHeader, setIntrosAsksHeader] = useState(initialIntrosAsksHeader);
  const [partnershipBoilerplate, setPartnershipBoilerplate] = useState(initialPartnershipBoilerplate);
  const [hasEdited, setHasEdited] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(lastUpdatedAt);
  const [updatedByName, setUpdatedByName] = useState(initialUpdatedByName);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  function markEdited() { setHasEdited(true); }

  function handleSave() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveMacro({
        subject, preheader, headline,
        opening_text: openingText, recap_text: recapText,
        team_shoutouts: teamShoutouts, our_mission: ourMission,
        intros_asks_header: introsAsksHeader, partnership_boilerplate: partnershipBoilerplate,
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
        <Input type="text" value={subject} onChange={(e) => { setSubject(e.target.value); markEdited(); }} />
      </Field>
      <Field label="Preheader" help="Preview text shown in inbox before opening" className="mb-4">
        <Input type="text" value={preheader} onChange={(e) => { setPreheader(e.target.value); markEdited(); }} />
      </Field>
      <Field label="Headline" className="mb-4">
        <Input type="text" value={headline} onChange={(e) => { setHeadline(e.target.value); markEdited(); }} />
      </Field>
      <Field label="Opening Text" className="mb-4">
        <RichTextEditor value={openingText} onChange={(html) => { setOpeningText(html); markEdited(); }} rows={6} />
      </Field>
      <Field label="Recap Text" className="mb-4">
        <RichTextEditor value={recapText} onChange={(html) => { setRecapText(html); markEdited(); }} rows={4} />
      </Field>
      <Field label="Team Shoutouts" className="mb-4">
        <RichTextEditor value={teamShoutouts} onChange={(html) => { setTeamShoutouts(html); markEdited(); }} rows={4} />
      </Field>
      <Field label="Our Mission" className="mb-4">
        <RichTextEditor value={ourMission} onChange={(html) => { setOurMission(html); markEdited(); }} rows={4} />
      </Field>
      <Field label="Intros & Asks Header" className="mb-4">
        <RichTextEditor value={introsAsksHeader} onChange={(html) => { setIntrosAsksHeader(html); markEdited(); }} rows={3} />
      </Field>
      <Field label="Partnership Boilerplate" className="mb-6">
        <RichTextEditor value={partnershipBoilerplate} onChange={(html) => { setPartnershipBoilerplate(html); markEdited(); }} rows={4} />
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
