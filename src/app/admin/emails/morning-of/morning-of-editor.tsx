"use client";

import { useState } from "react";
import TemplateEditor from "../template-editor";
import { sendTestEmail, sendToAllAttendees, saveTemplate } from "./actions";
import { formatName, formatTimestamp } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Attendee = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_website: string | null;
  linkedin_profile: string | null;
  contact_preference: string | null;
  primary_email: string | null;
  current_intro: string | null;
  current_ask: string | null;
  showAsk: boolean;
};

function getNameLink(a: Attendee): { href: string; label: string } | null {
  const name = formatName(a.first_name, a.last_name);
  if (a.contact_preference === "linkedin" && a.linkedin_profile) {
    return { href: a.linkedin_profile, label: name };
  }
  if (a.primary_email) {
    return { href: `mailto:${a.primary_email}`, label: name };
  }
  return null;
}

interface MorningOfEditorProps {
  slug: string;
  initialSubject: string;
  initialBody: string;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
  attendees: Attendee[];
  dinnerDisplay: string | null;
  dinnerId: string | null;
  morningOfSentAt: string | null;
  morningOfSentByName: string | null;
}

export default function MorningOfEditor({
  slug,
  initialSubject,
  initialBody,
  lastUpdatedAt,
  lastUpdatedByName,
  attendees,
  dinnerDisplay,
  dinnerId,
  morningOfSentAt,
  morningOfSentByName,
}: MorningOfEditorProps) {
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sentAt, setSentAt] = useState(morningOfSentAt);
  const [sentByName, setSentByName] = useState(morningOfSentByName);
  const [sendResult, setSendResult] = useState<{ message: string; type: "success" | "error" } | null>(null);

  async function handleSendToAll() {
    if (!dinnerId) return;
    setSending(true);
    setSendResult(null);
    const result = await sendToAllAttendees(dinnerId);
    setSending(false);

    if (result.success) {
      setSentAt(result.sentAt ?? null);
      setSentByName(result.sentByName ?? null);
      setSendResult({ message: `Sent to ${result.sent} attendee${result.sent !== 1 ? "s" : ""}.`, type: "success" });
      setTimeout(() => setShowModal(false), 2000);
    } else {
      setSendResult({ message: result.error || "Send failed", type: "error" });
    }
  }

  async function handleSendTest() {
    setSendingTest(true);
    setSendResult(null);
    const result = await sendTestEmail(slug, initialSubject, initialBody);
    setSendingTest(false);

    if (result.success) {
      setSendResult({ message: "Test email sent to your inbox.", type: "success" });
    } else {
      setSendResult({ message: result.error || "Test send failed", type: "error" });
    }
  }

  return (
    <div>
      {/* Template editor */}
      <TemplateEditor
        slug={slug}
        initialSubject={initialSubject}
        initialBody={initialBody}
        lastUpdatedAt={lastUpdatedAt}
        lastUpdatedByName={lastUpdatedByName}
        availableVariables={[
          "[member.firstname]",
          "[dinner.date]",
          "[dinner.venue]",
          "[dinner.address]",
        ]}
        sendTestEmail={sendTestEmail}
        saveTemplate={saveTemplate}
      />

      {/* Attendee preview section */}
      <div className="mt-7 max-w-2xl">
        <h3 className="mb-1 text-lg font-semibold text-fg1">
          Attendee Intros &amp; Asks{" "}
          <span className="text-sm font-normal text-fg3">(auto-generated)</span>
        </h3>
        {dinnerDisplay && (
          <p className="mb-4 text-sm text-fg3">
            Next dinner: {dinnerDisplay} &middot; {attendees.length} fulfilled attendee{attendees.length !== 1 ? "s" : ""}
          </p>
        )}

        {attendees.length === 0 ? (
          <p className="text-sm text-fg3 italic">
            No fulfilled attendees for the next upcoming dinner yet.
          </p>
        ) : (
          <div className="space-y-4">
            {attendees.map((a) => {
              const link = getNameLink(a);
              return (
                <div key={a.id} className="rounded-lg border border-border bg-bg p-4">
                  <div className="flex items-baseline gap-2">
                    {link ? (
                      <a
                        href={link.href}
                        target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="font-semibold text-accent-hover no-underline hover:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="font-semibold text-fg1">
                        {formatName(a.first_name, a.last_name)}
                      </span>
                    )}
                    {a.company_name && (
                      a.company_website ? (
                        <a
                          href={a.company_website.startsWith("http") ? a.company_website : `https://${a.company_website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent-hover hover:underline"
                        >
                          at {a.company_name}
                        </a>
                      ) : (
                        <span className="text-sm text-fg3">at {a.company_name}</span>
                      )
                    )}
                  </div>
                  {(a.current_intro || a.showAsk) && (
                    <div className="mt-2 text-sm text-fg2 whitespace-pre-wrap">
                      {a.current_intro}
                      {a.current_intro && a.showAsk && a.current_ask && <><br /><br /></>}
                      {a.showAsk && a.current_ask}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Send to attendees */}
        {dinnerId && attendees.length > 0 && (
          <div className="mt-7 border-t border-border-subtle pt-5">
            <Button onClick={() => { setSendResult(null); setShowModal(true); }}>
              Send To Attendees
            </Button>
            {sentAt && (
              <p className="text-xs text-fg3 mt-2">
                Last sent{sentByName ? ` by ${sentByName}` : ""} on {formatTimestamp(sentAt)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-bg border border-border rounded-xl shadow-lg w-[420px] p-6">
            <h3 className="tv-h4 mb-2">Send morning-of email</h3>
            <p className="text-sm text-fg2 mb-5">
              You&rsquo;re about to send this email to <strong className="text-fg1">{attendees.length}</strong> guest{attendees.length !== 1 ? "s" : ""}.
            </p>

            {sendResult && (
              <div
                className={`rounded-md px-[var(--tv-space-4)] py-[var(--tv-space-2)] text-sm mb-4 ${
                  sendResult.type === "success"
                    ? "bg-[rgba(91,106,59,0.08)] text-success"
                    : "bg-[rgba(192,68,42,0.08)] text-danger"
                }`}
              >
                {sendResult.message}
              </div>
            )}

            <div className="flex gap-tight justify-end">
              <Button variant="ghost" onClick={() => setShowModal(false)} disabled={sending}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={handleSendTest} disabled={sending || sendingTest}>
                {sendingTest ? "Sending\u2026" : "Send Test Email"}
              </Button>
              <Button onClick={handleSendToAll} disabled={sending || sendingTest}>
                {sending ? "Sending\u2026" : "Send To All"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
