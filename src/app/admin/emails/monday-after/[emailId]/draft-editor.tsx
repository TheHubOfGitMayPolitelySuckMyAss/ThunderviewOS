"use client";

import { useState, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import { formatTimestamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import Field from "@/components/field";
import { Eyebrow } from "@/components/ui/typography";
import ImageGroup from "@/components/email-image-group";
import {
  saveDraft, sendTestEmail, sendToAll,
  uploadEmailImage, deleteEmailImage, reorderEmailImages,
} from "../actions";

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor"), { ssr: false });

type ImageData = { id: string; groupNumber: number; displayOrder: number; publicUrl: string };

interface DraftEditorProps {
  emailId: string;
  status: "draft" | "sent";
  initialSubject: string;
  initialPreheader: string;
  initialHeadline: string;
  initialOpeningText: string;
  initialRecapText: string;
  initialTeamShoutouts: string;
  initialOurMission: string;
  initialIntrosAsksHeader: string;
  initialPartnershipBoilerplate: string;
  initialSignoffMemberId: string | null;
  testSentAfterLastEdit: boolean;
  dinner: { date: string; venue: string; address: string };
  initialImages: ImageData[];
  teamMembers: { id: string; name: string }[];
  recipientCount: number;
  attendeeCount: number;
  sentAt: string | null;
  sentByName: string | null;
  audienceCount: number | null;
}

function formatDinnerLine(dinner: { date: string; venue: string; address: string }): string {
  const d = new Date(dinner.date + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${month} ${day}${suffix}, ${year} from 6p to 9p @ ${dinner.venue} // ${dinner.address}`;
}

function isBlank(html: string): boolean {
  return !html || html.trim() === "" || html === "<p></p>";
}

export default function DraftEditor({
  emailId, status: initialStatus,
  initialSubject, initialPreheader, initialHeadline, initialOpeningText,
  initialRecapText, initialTeamShoutouts, initialOurMission,
  initialIntrosAsksHeader, initialPartnershipBoilerplate,
  initialSignoffMemberId, testSentAfterLastEdit: initialTestSent,
  dinner, initialImages, teamMembers, recipientCount, attendeeCount,
  sentAt, sentByName, audienceCount,
}: DraftEditorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [subject, setSubject] = useState(initialSubject);
  const [preheader, setPreheader] = useState(initialPreheader);
  const [headline, setHeadline] = useState(initialHeadline);
  const [openingText, setOpeningText] = useState(initialOpeningText);
  const [recapText, setRecapText] = useState(initialRecapText);
  const [teamShoutouts, setTeamShoutouts] = useState(initialTeamShoutouts);
  const [ourMission, setOurMission] = useState(initialOurMission);
  const [introsAsksHeader, setIntrosAsksHeader] = useState(initialIntrosAsksHeader);
  const [partnershipBoilerplate, setPartnershipBoilerplate] = useState(initialPartnershipBoilerplate);
  const [signoffMemberId, setSignoffMemberId] = useState(initialSignoffMemberId || teamMembers[0]?.id || "");
  const [testSentAfterLastEdit, setTestSentAfterLastEdit] = useState(initialTestSent);
  const [hasEdited, setHasEdited] = useState(false);
  const [images, setImages] = useState<ImageData[]>(initialImages);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isSending, startSending] = useTransition();

  const isSent = status === "sent";

  function markEdited() { setHasEdited(true); setTestSentAfterLastEdit(false); }

  const groupImages = (n: number) => images.filter((i) => i.groupNumber === n).sort((a, b) => a.displayOrder - b.displayOrder);
  const g1 = groupImages(1), g2 = groupImages(2), g3 = groupImages(3), g4 = groupImages(4), g5 = groupImages(5);

  const handleImageUpload = useCallback(async (groupNumber: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadEmailImage(emailId, groupNumber, formData);
    if (result.success && result.image) {
      setImages((prev) => [...prev, {
        id: result.image!.id, groupNumber,
        displayOrder: prev.filter((i) => i.groupNumber === groupNumber).length,
        publicUrl: result.image!.public_url,
      }]);
      setTestSentAfterLastEdit(false);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, [emailId]);

  const handleImageDelete = useCallback(async (imageId: string) => {
    const result = await deleteEmailImage(imageId, emailId);
    if (result.success) {
      setImages((prev) => {
        const updated = prev.filter((i) => i.id !== imageId);
        const groups = new Map<number, ImageData[]>();
        for (const img of updated) { if (!groups.has(img.groupNumber)) groups.set(img.groupNumber, []); groups.get(img.groupNumber)!.push(img); }
        const repacked: ImageData[] = [];
        for (const [, gi] of groups) { gi.sort((a, b) => a.displayOrder - b.displayOrder); gi.forEach((img, i) => repacked.push({ ...img, displayOrder: i })); }
        return repacked;
      });
      setTestSentAfterLastEdit(false);
    }
    return result;
  }, [emailId]);

  const handleImageReorder = useCallback(async (groupNumber: number, orderedIds: string[]) => {
    const result = await reorderEmailImages(emailId, groupNumber, orderedIds);
    if (result.success) {
      setImages((prev) => {
        const others = prev.filter((i) => i.groupNumber !== groupNumber);
        const reordered = orderedIds.map((id, i) => { const img = prev.find((im) => im.id === id)!; return { ...img, displayOrder: i }; });
        return [...others, ...reordered];
      });
      setTestSentAfterLastEdit(false);
    }
    return result;
  }, [emailId]);

  function buildSaveFields() {
    return {
      subject, preheader, headline,
      opening_text: openingText, recap_text: recapText,
      team_shoutouts: teamShoutouts, our_mission: ourMission,
      intros_asks_header: introsAsksHeader, partnership_boilerplate: partnershipBoilerplate,
      signoff_member_id: signoffMemberId,
    };
  }

  function handleSave() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveDraft(emailId, buildSaveFields());
      if (result.success) { setHasEdited(false); setMessage({ type: "success", text: "Draft saved." }); }
      else setMessage({ type: "error", text: result.error || "Failed to save" });
    });
  }

  function handleSendTest() {
    startTesting(async () => {
      setMessage(null);
      await saveDraft(emailId, buildSaveFields());
      const result = await sendTestEmail(emailId);
      if (result.success) { setHasEdited(false); setTestSentAfterLastEdit(true); setMessage({ type: "success", text: "Test email sent!" }); }
      else setMessage({ type: "error", text: result.error || "Failed to send test" });
    });
  }

  function handleSendToAll() {
    startSending(async () => {
      setMessage(null);
      const result = await sendToAll(emailId);
      if (result.success) { setStatus("sent"); setMessage({ type: "success", text: `Sent to ${result.sent} member${result.sent !== 1 ? "s" : ""}.` }); setTimeout(() => setShowSendModal(false), 2000); }
      else setMessage({ type: "error", text: result.error || "Send failed" });
    });
  }

  const canSend =
    testSentAfterLastEdit &&
    !isBlank(subject) && !isBlank(preheader) && !isBlank(headline) &&
    !isBlank(openingText) && !isBlank(recapText) && !isBlank(teamShoutouts) &&
    !isBlank(ourMission) && !isBlank(introsAsksHeader) && !isBlank(partnershipBoilerplate) &&
    g1.length > 0 && g2.length > 0 && g3.length > 0 && g4.length > 0 && g5.length > 0;

  return (
    <div className="max-w-2xl">
      {isSent && sentAt && (
        <div className="rounded-md bg-[rgba(91,106,59,0.08)] px-4 py-3 text-sm text-success mb-6">
          Sent to {audienceCount} member{audienceCount !== 1 ? "s" : ""}{sentByName ? ` by ${sentByName}` : ""} on {formatTimestamp(sentAt)}
        </div>
      )}

      <Field label="Subject" className="mb-4">
        <Input type="text" value={subject} onChange={(e) => { setSubject(e.target.value); markEdited(); }} disabled={isSent} />
      </Field>
      <Field label="Preheader" help="Preview text shown in inbox before opening" className="mb-4">
        <Input type="text" value={preheader} onChange={(e) => { setPreheader(e.target.value); markEdited(); }} disabled={isSent} />
      </Field>
      <Field label="Sign-off" className="mb-6">
        <Select value={signoffMemberId} onChange={(e) => { setSignoffMemberId(e.target.value); markEdited(); }} disabled={isSent}>
          {teamMembers.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
        </Select>
      </Field>

      <div className="border-t border-border-subtle my-6" />

      <Eyebrow className="mb-3">Image Group 1</Eyebrow>
      <ImageGroup images={g1} groupNumber={1} disabled={isSent} onUpload={(f) => handleImageUpload(1, f)} onDelete={handleImageDelete} onReorder={(ids) => handleImageReorder(1, ids)} />

      <Field label="Headline" className="mb-4 mt-6">
        <Input type="text" value={headline} onChange={(e) => { setHeadline(e.target.value); markEdited(); }} disabled={isSent} />
      </Field>

      <Field label="Opening Text" className="mb-4">
        <RichTextEditor value={openingText} onChange={(html) => { setOpeningText(html); markEdited(); }} disabled={isSent} rows={6} />
      </Field>

      <div className="rounded-lg border border-border bg-bg-elevated p-4 mb-6">
        <div className="text-center">
          <span className="inline-block bg-accent text-cream-50 font-semibold text-sm px-5 py-2.5 rounded-lg">Buy A Ticket</span>
          <p className="mt-3 text-sm text-fg3">{formatDinnerLine(dinner)}</p>
        </div>
      </div>

      <Eyebrow className="mb-3">Image Group 2</Eyebrow>
      <ImageGroup images={g2} groupNumber={2} disabled={isSent} onUpload={(f) => handleImageUpload(2, f)} onDelete={handleImageDelete} onReorder={(ids) => handleImageReorder(2, ids)} />

      <Field label="Recap Text" className="mb-4 mt-6">
        <RichTextEditor value={recapText} onChange={(html) => { setRecapText(html); markEdited(); }} disabled={isSent} rows={6} />
      </Field>

      <Eyebrow className="mb-3">Image Group 3</Eyebrow>
      <ImageGroup images={g3} groupNumber={3} disabled={isSent} onUpload={(f) => handleImageUpload(3, f)} onDelete={handleImageDelete} onReorder={(ids) => handleImageReorder(3, ids)} />

      <Field label="Team Shoutouts" className="mb-4 mt-6">
        <RichTextEditor value={teamShoutouts} onChange={(html) => { setTeamShoutouts(html); markEdited(); }} disabled={isSent} rows={4} />
      </Field>

      <Field label="Our Mission" className="mb-4">
        <RichTextEditor value={ourMission} onChange={(html) => { setOurMission(html); markEdited(); }} disabled={isSent} rows={4} />
      </Field>

      <Eyebrow className="mb-3">Image Group 4</Eyebrow>
      <ImageGroup images={g4} groupNumber={4} disabled={isSent} onUpload={(f) => handleImageUpload(4, f)} onDelete={handleImageDelete} onReorder={(ids) => handleImageReorder(4, ids)} />

      <Field label="Intros & Asks Header" className="mb-4 mt-6">
        <RichTextEditor value={introsAsksHeader} onChange={(html) => { setIntrosAsksHeader(html); markEdited(); }} disabled={isSent} rows={3} />
      </Field>

      <div className="rounded-lg border border-border bg-bg-elevated p-4 mb-6">
        <Eyebrow className="mb-2 text-fg3">Intros &amp; Asks ({attendeeCount} attendee{attendeeCount !== 1 ? "s" : ""})</Eyebrow>
        <p className="text-xs text-fg3 italic">Auto-generated from this dinner&rsquo;s fulfilled attendees. This section is not editable — it renders live data at send time.</p>
      </div>

      <Eyebrow className="mb-3">Image Group 5</Eyebrow>
      <ImageGroup images={g5} groupNumber={5} disabled={isSent} onUpload={(f) => handleImageUpload(5, f)} onDelete={handleImageDelete} onReorder={(ids) => handleImageReorder(5, ids)} />

      <Field label="Partnership Boilerplate" className="mb-4 mt-6">
        <RichTextEditor value={partnershipBoilerplate} onChange={(html) => { setPartnershipBoilerplate(html); markEdited(); }} disabled={isSent} rows={4} />
      </Field>

      <div className="rounded-lg border border-border bg-bg-elevated p-4 mb-6">
        <p className="text-xs text-fg3 text-center leading-relaxed">
          Thunderview CEO Dinners / 2462 S Acoma St / Denver, CO 80223 / USA<br />
          <span className="underline">Unsubscribe from marketing emails</span>
        </p>
      </div>

      {!isSent && (
        <div className="flex items-center gap-3 mt-6">
          <Button variant="secondary" onClick={handleSave} disabled={!hasEdited || isSaving}>{isSaving ? "Saving\u2026" : "Save Draft"}</Button>
          <Button variant="secondary" onClick={handleSendTest} disabled={isTesting}>{isTesting ? "Sending\u2026" : "Send Test Email"}</Button>
          <Button onClick={() => { setMessage(null); setShowSendModal(true); }} disabled={!canSend}>Send To All</Button>
        </div>
      )}

      {!isSent && !canSend && (
        <div className="mt-3 text-xs text-fg3 space-y-0.5">
          {[1,2,3,4,5].map((n) => groupImages(n).length === 0 && <p key={n}>Missing: at least 1 image in Group {n}</p>)}
          {isBlank(subject) && <p>Missing: subject</p>}
          {isBlank(preheader) && <p>Missing: preheader</p>}
          {isBlank(headline) && <p>Missing: headline</p>}
          {isBlank(openingText) && <p>Missing: opening text</p>}
          {isBlank(recapText) && <p>Missing: recap text</p>}
          {isBlank(teamShoutouts) && <p>Missing: team shoutouts</p>}
          {isBlank(ourMission) && <p>Missing: our mission</p>}
          {isBlank(introsAsksHeader) && <p>Missing: intros &amp; asks header</p>}
          {isBlank(partnershipBoilerplate) && <p>Missing: partnership boilerplate</p>}
          {!testSentAfterLastEdit && <p>Required: send a test email after your latest edits</p>}
        </div>
      )}

      {message && !showSendModal && (
        <p className={`mt-3 text-sm ${message.type === "success" ? "text-moss-600" : "text-ember-600"}`}>{message.text}</p>
      )}

      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-bg border border-border rounded-xl shadow-lg w-[420px] p-6">
            <h3 className="tv-h4 mb-2">Send Monday After email</h3>
            <p className="text-sm text-fg2 mb-5">
              You&rsquo;re about to send this email to <strong className="text-fg1">{recipientCount}</strong> member{recipientCount !== 1 ? "s" : ""} with marketing enabled.
            </p>
            {message && (
              <div className={`rounded-md px-[var(--tv-space-4)] py-[var(--tv-space-2)] text-sm mb-4 ${message.type === "success" ? "bg-[rgba(91,106,59,0.08)] text-success" : "bg-[rgba(192,68,42,0.08)] text-danger"}`}>{message.text}</div>
            )}
            <div className="flex gap-tight justify-end">
              <Button variant="ghost" onClick={() => setShowSendModal(false)} disabled={isSending}>Cancel</Button>
              <Button onClick={handleSendToAll} disabled={isSending}>{isSending ? "Sending\u2026" : "Send To All"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
