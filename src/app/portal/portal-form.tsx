"use client";

import { useState, useRef } from "react";
import { savePortalProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/ui/typography";

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
      {bannerDinnerDate && (
        <div className="rounded-lg border border-tan-300 bg-bg-elevated px-[22px] py-[18px] flex items-center gap-4 shadow-glow">
          <span className="text-[28px]">🎟️</span>
          <div className="flex-1 text-[14.5px] text-fg2 leading-[1.5]">
            You&rsquo;re confirmed for <strong className="text-fg1">{bannerDinnerDate}</strong>.{" "}
            {introAskFresh
              ? "We can\u2019t wait to see you."
              : "Please update your Intro & Ask when you have a moment."}
          </div>
        </div>
      )}

      <Eyebrow className="!mt-6">Your Intro & Ask</Eyebrow>
      <p className="text-[13px] text-fg3 -mt-1 mb-4">
        We send these around a week before each dinner so people know who to find you for.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="current_intro">
            Intro &mdash; how you&rsquo;d introduce yourself at the table
          </Label>
          <Textarea
            id="current_intro"
            name="current_intro"
            rows={4}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="How would you introduce yourself to the group?"
          />
        </div>

        <div>
          <Label htmlFor="current_ask">
            Ask &mdash; one specific thing the room could help with
          </Label>
          <Textarea
            id="current_ask"
            name="current_ask"
            rows={4}
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="What can the group help you with?"
          />
        </div>

        <div>
          <Label htmlFor="contact_preference">Preferred contact</Label>
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
        </div>

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
