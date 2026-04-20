"use client";

import { useState, useRef } from "react";
import { savePortalProfile } from "./actions";

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
      // If intro or ask was just saved, banner switches to welcoming message
      if (bannerDinnerDate) setIntroAskFresh(true);
    }
  }

  return (
    <div className="space-y-4">
      {bannerDinnerDate && (
        <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <p className="font-medium">
            You&rsquo;ve got a ticket for {bannerDinnerDate}!
          </p>
          <p className="mt-1">
            {introAskFresh
              ? "We can\u2019t wait to see you."
              : "Please update your Intro & Ask when you have a moment."}
          </p>
        </div>
      )}
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="current_intro" className="block text-sm font-medium text-gray-700">
          Intro
        </label>
        <textarea
          id="current_intro"
          name="current_intro"
          rows={4}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none"
          placeholder="How would you introduce yourself to the group?"
        />
      </div>

      <div>
        <label htmlFor="current_ask" className="block text-sm font-medium text-gray-700">
          Ask
        </label>
        <textarea
          id="current_ask"
          name="current_ask"
          rows={4}
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none"
          placeholder="What can the group help you with?"
        />
      </div>

      <div>
        <label htmlFor="contact_preference" className="block text-sm font-medium text-gray-700">
          Preferred Contact
        </label>
        <select
          id="contact_preference"
          name="contact_preference"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none"
        >
          {CONTACT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {toast && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            toast.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}
    </form>
    </div>
  );
}
