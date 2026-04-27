"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { formatTimestamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Field from "@/components/field";
import { Eyebrow } from "@/components/ui/typography";
import {
  saveDraft,
  sendTestEmail,
  sendToAll,
  uploadEmailImage,
  deleteEmailImage,
  reorderEmailImages,
} from "../actions";
import ImageGroup from "./image-group";

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor"), { ssr: false });

type ImageData = {
  id: string;
  groupNumber: number;
  displayOrder: number;
  publicUrl: string;
};

interface DraftEditorProps {
  emailId: string;
  status: "draft" | "sent";
  initialSubject: string;
  initialPreheader: string;
  initialHeadline: string;
  initialCustomText: string;
  initialPartnershipBoilerplate: string;
  testSentAfterLastEdit: boolean;
  dinner: { date: string; venue: string; address: string };
  initialImages: ImageData[];
  recipientCount: number;
  sentAt: string | null;
  sentByName: string | null;
  audienceCount: number | null;
}

function formatDinnerLine(dinner: { date: string; venue: string; address: string }): string {
  const d = new Date(dinner.date + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${month} ${day}${suffix}, ${year} from 6p to 9p @ ${dinner.venue} // ${dinner.address}`;
}

export default function DraftEditor({
  emailId,
  status: initialStatus,
  initialSubject,
  initialPreheader,
  initialHeadline,
  initialCustomText,
  initialPartnershipBoilerplate,
  testSentAfterLastEdit: initialTestSent,
  dinner,
  initialImages,
  recipientCount,
  sentAt,
  sentByName,
  audienceCount,
}: DraftEditorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [subject, setSubject] = useState(initialSubject);
  const [preheader, setPreheader] = useState(initialPreheader);
  const [headline, setHeadline] = useState(initialHeadline);
  const [customText, setCustomText] = useState(initialCustomText);
  const [partnershipBoilerplate, setPartnershipBoilerplate] = useState(initialPartnershipBoilerplate);
  const [testSentAfterLastEdit, setTestSentAfterLastEdit] = useState(initialTestSent);
  const [hasEdited, setHasEdited] = useState(false);
  const [images, setImages] = useState<ImageData[]>(initialImages);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isSending, startSending] = useTransition();

  const isSent = status === "sent";

  function markEdited() {
    setHasEdited(true);
    setTestSentAfterLastEdit(false);
  }

  // Image group helpers
  const group1Images = images.filter((i) => i.groupNumber === 1).sort((a, b) => a.displayOrder - b.displayOrder);
  const group5Images = images.filter((i) => i.groupNumber === 5).sort((a, b) => a.displayOrder - b.displayOrder);

  const handleImageUpload = useCallback(async (groupNumber: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadEmailImage(emailId, groupNumber, formData);
    if (result.success && result.image) {
      setImages((prev) => [
        ...prev,
        {
          id: result.image!.id,
          groupNumber,
          displayOrder: prev.filter((i) => i.groupNumber === groupNumber).length,
          publicUrl: result.image!.public_url,
        },
      ]);
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
        // Re-pack display orders per group
        const groups = new Map<number, ImageData[]>();
        for (const img of updated) {
          if (!groups.has(img.groupNumber)) groups.set(img.groupNumber, []);
          groups.get(img.groupNumber)!.push(img);
        }
        const repacked: ImageData[] = [];
        for (const [, groupImgs] of groups) {
          groupImgs.sort((a, b) => a.displayOrder - b.displayOrder);
          groupImgs.forEach((img, i) => repacked.push({ ...img, displayOrder: i }));
        }
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
        const reordered = orderedIds.map((id, i) => {
          const img = prev.find((im) => im.id === id)!;
          return { ...img, displayOrder: i };
        });
        return [...others, ...reordered];
      });
      setTestSentAfterLastEdit(false);
    }
    return result;
  }, [emailId]);

  // Save
  function handleSave() {
    startSaving(async () => {
      setMessage(null);
      const result = await saveDraft(emailId, {
        subject,
        preheader,
        headline,
        custom_text: customText,
        partnership_boilerplate: partnershipBoilerplate,
      });
      if (result.success) {
        setHasEdited(false);
        setMessage({ type: "success", text: "Draft saved." });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save" });
      }
    });
  }

  // Test send
  function handleSendTest() {
    startTesting(async () => {
      setMessage(null);
      // Save current content first
      await saveDraft(emailId, {
        subject,
        preheader,
        headline,
        custom_text: customText,
        partnership_boilerplate: partnershipBoilerplate,
      });
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

  // Send to all
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

  // Can send? All required fields + both image groups have images + test sent after last edit
  const canSend =
    testSentAfterLastEdit &&
    subject.trim() !== "" &&
    preheader.trim() !== "" &&
    headline.trim() !== "" &&
    customText.trim() !== "" && customText !== "<p></p>" &&
    partnershipBoilerplate.trim() !== "" && partnershipBoilerplate !== "<p></p>" &&
    group1Images.length > 0 &&
    group5Images.length > 0;

  return (
    <div className="max-w-2xl">
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

      {/* Preheader */}
      <Field label="Preheader" help="Preview text shown in inbox before opening" className="mb-4">
        <Input type="text" value={preheader} onChange={(e) => { setPreheader(e.target.value); markEdited(); }} disabled={isSent} />
      </Field>

      {/* Divider */}
      <div className="border-t border-border-subtle my-6" />

      {/* Image group 1 */}
      <Eyebrow className="mb-3">Image Group 1</Eyebrow>
      <ImageGroup
        images={group1Images}
        groupNumber={1}
        disabled={isSent}
        onUpload={(file) => handleImageUpload(1, file)}
        onDelete={handleImageDelete}
        onReorder={(ids) => handleImageReorder(1, ids)}
      />

      {/* Headline */}
      <Field label="Headline" className="mb-4 mt-6">
        <Input type="text" value={headline} onChange={(e) => { setHeadline(e.target.value); markEdited(); }} disabled={isSent} />
      </Field>

      {/* Custom text */}
      <Field label="Custom Text" className="mb-4">
        <RichTextEditor
          value={customText}
          onChange={(html) => { setCustomText(html); markEdited(); }}
          disabled={isSent}
          rows={8}
        />
      </Field>

      {/* Static preview: CTA + dinner details */}
      <div className="rounded-lg border border-border bg-bg-elevated p-4 mb-6">
        <div className="text-center">
          <span className="inline-block bg-accent text-cream-50 font-semibold text-sm px-5 py-2.5 rounded-lg">
            Buy A Ticket
          </span>
          <p className="mt-3 text-sm text-fg3">{formatDinnerLine(dinner)}</p>
        </div>
      </div>

      {/* Image group 2 (group_number = 5) */}
      <Eyebrow className="mb-3">Image Group 2</Eyebrow>
      <ImageGroup
        images={group5Images}
        groupNumber={5}
        disabled={isSent}
        onUpload={(file) => handleImageUpload(5, file)}
        onDelete={handleImageDelete}
        onReorder={(ids) => handleImageReorder(5, ids)}
      />

      {/* Partnership boilerplate */}
      <Field label="Partnership Boilerplate" className="mb-4 mt-6">
        <RichTextEditor
          value={partnershipBoilerplate}
          onChange={(html) => { setPartnershipBoilerplate(html); markEdited(); }}
          disabled={isSent}
          rows={4}
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
            {isSaving ? "Saving\u2026" : "Save Draft"}
          </Button>
          <Button variant="secondary" onClick={handleSendTest} disabled={isTesting}>
            {isTesting ? "Sending\u2026" : "Send Test Email"}
          </Button>
          <Button onClick={() => { setMessage(null); setShowSendModal(true); }} disabled={!canSend}>
            Send To All
          </Button>
        </div>
      )}

      {/* Validation hints when send is disabled */}
      {!isSent && !canSend && (
        <div className="mt-3 text-xs text-fg3 space-y-0.5">
          {group1Images.length === 0 && <p>Missing: at least 1 image in Group 1</p>}
          {group5Images.length === 0 && <p>Missing: at least 1 image in Group 2</p>}
          {(!subject.trim()) && <p>Missing: subject</p>}
          {(!preheader.trim()) && <p>Missing: preheader</p>}
          {(!headline.trim()) && <p>Missing: headline</p>}
          {(!customText.trim() || customText === "<p></p>") && <p>Missing: custom text</p>}
          {(!partnershipBoilerplate.trim() || partnershipBoilerplate === "<p></p>") && <p>Missing: partnership boilerplate</p>}
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
            <h3 className="tv-h4 mb-2">Send Monday Before email</h3>
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
                {isSending ? "Sending\u2026" : "Send To All"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
