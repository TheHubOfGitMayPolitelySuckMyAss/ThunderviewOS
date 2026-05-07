"use client";

import { useState, useRef } from "react";
import { savePortalProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { H4 } from "@/components/ui/typography";
import Field from "@/components/field";

const CONTACT_OPTIONS = ["linkedin", "email"];
const INTRO_MAX = 1000;
const ASK_MAX = 250;

function counterClass(len: number, max: number): string {
  if (len >= max) return "text-danger";
  if (len >= max * 0.9) return "text-warning";
  return "text-fg3";
}

export default function PortalForm({
  initialIntro,
  initialAsk,
  initialContact,
  bannerDinnerDate,
  bannerIntroAskFresh,
}: {
  initialIntro: string | null;
  initialAsk: string | null;
  initialContact: string | null;
  bannerDinnerDate: string | null;
  bannerIntroAskFresh: boolean;
}) {
  const [intro, setIntro] = useState(initialIntro ?? "");
  const [ask, setAsk] = useState(initialAsk ?? "");
  const [contact, setContact] = useState(initialContact ?? "linkedin");
  const [saving, setSaving] = useState(false);
  const [introAskFresh, setIntroAskFresh] = useState(bannerIntroAskFresh);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  function showToast(message: string, type: "success" | "error") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const result = await savePortalProfile(formData);

    setSaving(false);

    if (!result.success) {
      showToast(result.error || "Save failed", "error");
      return;
    }

    if (result.noChanges) {
      showToast("No changes to save", "success");
    } else {
      showToast("Saved!", "success");
      if (bannerDinnerDate) setIntroAskFresh(true);
    }
  }

  return (
    <div className="flex flex-col gap-tight">
      <H4>Your intro &amp; ask for this dinner</H4>
      <p className="text-sm text-fg2 leading-[1.55] mb-form-row">
        Every attendee gets the full list the morning of dinner. People use it to find
        you&nbsp;&mdash; they&rsquo;ll walk up and say &ldquo;you&rsquo;re the one looking for
        a new CRM&rdquo; or &ldquo;I saw you&rsquo;re building in climate tech.&rdquo;
        The more specific you are, the more useful the room becomes.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-form-row">
        <div className="flex flex-col gap-label-input">
          <Field label="Intro">
            <p className="text-sm text-fg3 italic leading-[1.5]">
              &ldquo;My name is [name] and I&rsquo;m the CEO of [company]. We help [market]
              with [problem] which has [specific impact] by giving them [solution].&rdquo;
            </p>
            <Textarea
              id="current_intro"
              name="current_intro"
              rows={4}
              maxLength={INTRO_MAX}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="My name is..."
            />
            <div className={`text-xs text-right ${counterClass(intro.length, INTRO_MAX)}`}>
              {intro.length}/{INTRO_MAX}
            </div>
          </Field>
        </div>

        <div className="flex flex-col gap-label-input">
          <Field label="Ask">
            <p className="text-sm text-fg3 italic leading-[1.5]">
              Anything you need, other than requests for sales and fundraising
              (help with sales and fundraising strategy is ok though).
            </p>
            <Textarea
              id="current_ask"
              name="current_ask"
              rows={3}
              maxLength={ASK_MAX}
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="I could use help with..."
            />
            <div className={`text-xs text-right ${counterClass(ask.length, ASK_MAX)}`}>
              {ask.length}/{ASK_MAX}
            </div>
          </Field>
        </div>

        <Field label="Preferred contact">
          <Select
            id="contact_preference"
            name="contact_preference"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          >
            {CONTACT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving\u2026" : "Save"}
          </Button>
        </div>

        {toast && (
          <div
            className={`rounded-md px-[var(--tv-space-4)] py-[var(--tv-space-2)] text-sm ${
              toast.type === "success"
                ? "bg-[rgba(91,106,59,0.08)] text-success"
                : "bg-[rgba(192,68,42,0.08)] text-danger"
            }`}
          >
            {toast.message}
          </div>
        )}
      </form>
    </div>
  );
}
