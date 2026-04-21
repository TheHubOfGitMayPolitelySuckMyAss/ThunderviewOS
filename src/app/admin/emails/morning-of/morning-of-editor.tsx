"use client";

import { useState, useTransition } from "react";
import TemplateEditor from "../template-editor";
import { sendTestEmail, saveTemplate, sendPreviewEmail } from "./actions";
import { formatName } from "@/lib/format";

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
}

export default function MorningOfEditor({
  slug,
  initialSubject,
  initialBody,
  lastUpdatedAt,
  lastUpdatedByName,
  attendees,
  dinnerDisplay,
}: MorningOfEditorProps) {
  const [previewMessage, setPreviewMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSendingPreview, startPreview] = useTransition();

  function handleSendPreview() {
    startPreview(async () => {
      setPreviewMessage(null);
      const result = await sendPreviewEmail();
      if (result.success) {
        setPreviewMessage({ type: "success", text: "Preview email sent!" });
      } else {
        setPreviewMessage({ type: "error", text: result.error || "Failed to send preview" });
      }
    });
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

      {/* Preview Full Email button */}
      <div className="mt-6 max-w-2xl border-t pt-4">
        <button
          onClick={handleSendPreview}
          disabled={isSendingPreview}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSendingPreview ? "Sending..." : "Preview Full Email"}
        </button>
        <span className="ml-3 text-xs text-gray-500">
          Sends saved template + live attendee data to you
        </span>
        {previewMessage && (
          <p
            className={`mt-2 text-sm ${
              previewMessage.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {previewMessage.text}
          </p>
        )}
      </div>

      {/* Attendee preview section */}
      <div className="mt-10 max-w-2xl">
        <h3 className="mb-1 text-lg font-semibold text-gray-800">
          Attendee Intros &amp; Asks{" "}
          <span className="text-sm font-normal text-gray-500">(auto-generated)</span>
        </h3>
        {dinnerDisplay && (
          <p className="mb-4 text-sm text-gray-500">
            Next dinner: {dinnerDisplay} &middot; {attendees.length} fulfilled attendee{attendees.length !== 1 ? "s" : ""}
          </p>
        )}

        {attendees.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No fulfilled attendees for the next upcoming dinner yet.
          </p>
        ) : (
          <div className="space-y-4">
            {attendees.map((a) => {
              const link = getNameLink(a);
              return (
                <div key={a.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-baseline gap-2">
                    {link ? (
                      <a
                        href={link.href}
                        target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="font-semibold text-gray-900">
                        {formatName(a.first_name, a.last_name)}
                      </span>
                    )}
                    {a.company_name && (
                      a.company_website ? (
                        <a
                          href={a.company_website.startsWith("http") ? a.company_website : `https://${a.company_website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          at {a.company_name}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500">at {a.company_name}</span>
                      )
                    )}
                  </div>
                  {(a.current_intro || a.current_ask) && (
                    <div className="mt-2 space-y-1.5">
                      {a.current_intro && (
                        <div>
                          <span className="text-xs font-medium uppercase text-gray-500">Intro</span>
                          <p className="whitespace-pre-wrap text-sm text-gray-700">{a.current_intro}</p>
                        </div>
                      )}
                      {a.current_ask && (
                        <div>
                          <span className="text-xs font-medium uppercase text-gray-500">Ask</span>
                          <p className="whitespace-pre-wrap text-sm text-gray-700">{a.current_ask}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
