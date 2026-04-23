"use client";

import { useState, useRef } from "react";
import { savePortalProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Eyebrow } from "@/components/ui/typography";
import Field from "@/components/field";

const CONTACT_OPTIONS = ["linkedin", "email"];

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
    <div className="space-y-4">
      <Eyebrow>Your intro &amp; ask for this dinner</Eyebrow>
      <p className="text-[14px] text-fg2 leading-[1.55] -mt-1 mb-4">
        Every attendee gets the full list of intros and asks the week before dinner.
        People use it to find you&mdash;they&rsquo;ll walk up and say &ldquo;you&rsquo;re the one
        who needs help with fundraising&rdquo; or &ldquo;I saw you&rsquo;re building in climate
        tech.&rdquo; The more specific you are, the more useful the room becomes.
      </p>

      <form onSubmit={handleSubmit} className="space-y-form-row">
        <Field label="Intro \u2014 how you\u2019d introduce yourself at the table">
          <Textarea
            id="current_intro"
            name="current_intro"
            rows={4}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="How would you introduce yourself to the group?"
          />
        </Field>

        <Field label="Ask \u2014 one specific thing the room could help with">
          <Textarea
            id="current_ask"
            name="current_ask"
            rows={4}
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="What can the group help you with?"
          />
        </Field>

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

        <Button type="submit" disabled={saving}>
          {saving ? "Saving\u2026" : "Save"}
        </Button>

        {toast && (
          <div
            className={`rounded-md px-4 py-2 text-sm ${
              toast.type === "success"
                ? "bg-[#E4E9D4] text-moss-600"
                : "bg-[#F2D4CB] text-ember-600"
            }`}
          >
            {toast.message}
          </div>
        )}
      </form>
    </div>
  );
}
