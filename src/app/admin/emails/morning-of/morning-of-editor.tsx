"use client";

import TemplateEditor from "../template-editor";
import { sendTestEmail, saveTemplate } from "./actions";
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
      <div className="mt-10 max-w-2xl">
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
                <div key={a.id} className="rounded-lg border border-line-200 bg-cream-50 p-4">
                  <div className="flex items-baseline gap-2">
                    {link ? (
                      <a
                        href={link.href}
                        target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="font-semibold text-clay-600 no-underline hover:underline hover:underline"
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
                          className="text-sm text-clay-600 hover:underline"
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
      </div>
    </div>
  );
}
