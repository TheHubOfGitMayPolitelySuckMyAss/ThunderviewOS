"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { saveProfile, portalUpdateProfilePic, toggleMarketing } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { H1 } from "@/components/ui/typography";
import Field from "@/components/field";
import FormSection from "@/components/form-section";
import { Card } from "@/components/ui/card";

const CropModal = dynamic(() => import("./crop-modal"), { ssr: false });

function counterClass(len: number, max: number): string {
  if (len >= max) return "text-danger";
  if (len >= max * 0.9) return "text-warning";
  return "text-fg3";
}

const STAGE_OPTIONS = [
  "Active CEO (Bootstrapping or VC-Backed)",
  "Exited CEO (Acquisition or IPO)",
  "Investor",
  "Guest (Speaker/Press/Etc)",
];

const CONTACT_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
];

type ProfileFormProps = {
  returnTo?: string;
  member: {
    firstName: string;
    lastName: string;
    companyName: string | null;
    companyWebsite: string | null;
    linkedinProfile: string | null;
    attendeeStagetypes: string[];
    currentIntro: string | null;
    currentAsk: string | null;
    currentGive: string | null;
    contactPreference: string | null;
    primaryEmail: string;
    profilePicUrl: string | null;
    marketingOptedIn: boolean;
  };
};

export default function ProfileForm({ member, returnTo }: ProfileFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [companyName, setCompanyName] = useState(member.companyName ?? "");
  const [companyWebsite, setCompanyWebsite] = useState(
    member.companyWebsite ?? ""
  );
  const [linkedinProfile, setLinkedinProfile] = useState(
    member.linkedinProfile ?? ""
  );
  const [stagetypes, setStagetypes] = useState<string[]>(
    member.attendeeStagetypes
  );
  const [intro, setIntro] = useState(member.currentIntro ?? "");
  const [ask, setAsk] = useState(member.currentAsk ?? "");
  const [give, setGive] = useState(member.currentGive ?? "");
  const [contact, setContact] = useState(
    member.contactPreference ?? "linkedin"
  );
  const [primaryEmail, setPrimaryEmail] = useState(member.primaryEmail);
  const [marketingOptedIn, setMarketingOptedIn] = useState(member.marketingOptedIn);
  const [togglingMarketing, setTogglingMarketing] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState(member.profilePicUrl);
  const [picPreview, setPicPreview] = useState<string | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  function showToast(message: string, type: "success" | "error") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function toggleStagetype(option: string) {
    setStagetypes((prev) =>
      prev.includes(option)
        ? prev.filter((s) => s !== option)
        : [...prev, option]
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isHeic = file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic");
    if (isHeic) {
      // HEIC can't be cropped client-side — upload directly, server does center-crop
      setSavingPhoto(true);
      const formData = new FormData();
      formData.set("profile_pic", file);
      const result = await portalUpdateProfilePic(formData);
      setSavingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!result.success) {
        showToast(result.error || "Upload failed", "error");
        return;
      }
      showToast("Photo saved!", "success");
      if (result.profilePicUrl) setProfilePicUrl(result.profilePicUrl);
      router.refresh();
      return;
    }

    setCropImageUrl(URL.createObjectURL(file));
  }

  async function handleCropApply(blob: Blob) {
    const file = new File([blob], "cropped.png", { type: "image/png" });
    setCropImageUrl(null);
    setPicPreview(URL.createObjectURL(blob));
    if (fileInputRef.current) fileInputRef.current.value = "";

    setSavingPhoto(true);
    const formData = new FormData();
    formData.set("profile_pic", file);

    const result = await portalUpdateProfilePic(formData);
    setSavingPhoto(false);

    if (!result.success) {
      showToast(result.error || "Upload failed", "error");
      return;
    }

    showToast("Photo saved!", "success");
    if (result.profilePicUrl) {
      setProfilePicUrl(result.profilePicUrl);
    }
    setPicPreview(null);
    router.refresh();
  }

  function handleCropCancel() {
    setCropImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemovePic() {
    setPicPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setSavingPhoto(true);
    const formData = new FormData();
    formData.set("remove_pic", "true");

    const result = await portalUpdateProfilePic(formData);
    setSavingPhoto(false);

    if (!result.success) {
      showToast(result.error || "Remove failed", "error");
      return;
    }

    showToast("Photo removed!", "success");
    setProfilePicUrl(null);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const result = await saveProfile(formData);

    setSaving(false);

    if (!result.success) {
      showToast(result.error || "Save failed", "error");
      return;
    }

    if (result.noChanges) {
      if (returnTo) {
        router.push(returnTo);
      } else {
        showToast("No changes to save", "success");
      }
    } else {
      if (returnTo) {
        router.push(returnTo);
      } else {
        showToast("Saved!", "success");
      }
    }
  }

  return (
    <>
      {/* Profile head */}
      <div className="flex items-center gap-5 mb-6">
        <div className="relative">
          {picPreview || profilePicUrl ? (
            <Image
              src={picPreview || profilePicUrl!}
              alt="Profile"
              width={120}
              height={120}
              className="h-[120px] w-[120px] rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-accent font-display font-medium text-[40px] text-cream-50">
              {firstName?.[0]?.toUpperCase() ?? "?"}{lastName?.[0]?.toUpperCase() ?? ""}
            </div>
          )}
          {savingPhoto && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60">
              <svg className="h-6 w-6 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="mt-1 text-xs font-medium text-white">Saving photo</span>
            </div>
          )}
        </div>
        <div>
          <H1 className="!m-0">{firstName} {lastName}</H1>
          <p className="text-[15px] text-fg2 mt-1">
            {stagetypes.length > 0
              ? stagetypes.map(s => s.replace(/ \(.*\)/, "")).join(", ")
              : "Member"}
          </p>
          <div className="flex gap-2 mt-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {profilePicUrl ? "Change Photo" : "Upload Photo"}
            </Button>
            {profilePicUrl && !picPreview && (
              <button
                type="button"
                onClick={handleRemovePic}
                className="text-sm text-ember-600 cursor-pointer hover:underline"
              >
                Remove Photo
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <FormSection eyebrow="Profile details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="First name" required>
              <Input
                id="first_name"
                name="first_name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <Input
                id="last_name"
                name="last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Primary email" className="mt-form-row">
            <Input
              type="email"
              id="primary_email"
              name="primary_email"
              value={primaryEmail}
              onChange={(e) => setPrimaryEmail(e.target.value)}
            />
          </Field>

          <Field label="Company name" className="mt-form-row">
            <Input
              id="company_name"
              name="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>

          <Field label="Company website" className="mt-form-row">
            <Input
              id="company_website"
              name="company_website"
              placeholder="https://"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
            />
          </Field>

          <Field label="LinkedIn" className="mt-form-row">
            <Input
              id="linkedin_profile"
              name="linkedin_profile"
              placeholder="https://linkedin.com/in/..."
              value={linkedinProfile}
              onChange={(e) => setLinkedinProfile(e.target.value)}
            />
          </Field>

          <Field label="Attendee type" className="mt-form-row">
            <input
              type="hidden"
              name="attendee_stagetypes"
              value={stagetypes.join(",")}
            />
            <div className="flex flex-wrap gap-3.5 text-[14px] text-fg2">
              {STAGE_OPTIONS.map((option) => {
                const checked = stagetypes.includes(option);
                return (
                  <label
                    key={option}
                    className="inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStagetype(option)}
                      className="h-4 w-4 rounded accent-clay-500"
                    />
                    {option.replace(/ \(.*\)/, "")}
                  </label>
                );
              })}
            </div>
          </Field>
          </FormSection>

          <FormSection eyebrow="Intro, Ask & Give" divider>
          <Field label="Intro">
            <p className="text-sm text-fg3 italic leading-[1.5]">
              &ldquo;My name is [name] and I&rsquo;m the CEO of [company]. We help [market]
              with [problem] which has [specific impact] by giving them [solution].&rdquo;
            </p>
            <Textarea
              id="current_intro"
              name="current_intro"
              rows={4}
              maxLength={1000}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="My name is..."
            />
            <div className={`text-xs text-right ${counterClass(intro.length, 1000)}`}>
              {intro.length}/1,000
            </div>
          </Field>

          <Field label="Ask" className="mt-form-row">
            <p className="text-sm text-fg3 italic leading-[1.5]">
              Anything you need, other than requests for sales and fundraising
              (help with sales and fundraising strategy is ok though).
            </p>
            <Textarea
              id="current_ask"
              name="current_ask"
              rows={4}
              maxLength={250}
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="I could use help with..."
            />
            <div className={`text-xs text-right ${counterClass(ask.length, 250)}`}>
              {ask.length}/250
            </div>
          </Field>

          <Field label="Give" className="mt-form-row">
            <p className="text-sm text-fg3 italic leading-[1.5]">
              What can you do to help Thunderview members build their own startups?
            </p>
            <Textarea
              id="current_give"
              name="current_give"
              rows={4}
              maxLength={500}
              value={give}
              onChange={(e) => setGive(e.target.value)}
              placeholder="What can you offer the community?"
            />
            <div className={`text-xs text-right ${counterClass(give.length, 500)}`}>
              {give.length}/500
            </div>
          </Field>

          <Field label="Preferred contact" className="mt-form-row">
            <Select
              id="contact_preference"
              name="contact_preference"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            >
              {CONTACT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          </FormSection>

          <FormSection eyebrow="Email preferences" divider>
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-[14px] text-fg2">
              <input
                type="checkbox"
                checked={marketingOptedIn}
                disabled={togglingMarketing}
                onChange={async (e) => {
                  const newVal = e.target.checked;
                  setTogglingMarketing(true);
                  setMarketingOptedIn(newVal);
                  const result = await toggleMarketing(newVal);
                  setTogglingMarketing(false);
                  if (!result.success) {
                    setMarketingOptedIn(!newVal);
                    showToast(result.error || "Failed to update", "error");
                  } else {
                    showToast(
                      newVal ? "Subscribed to marketing emails" : "Unsubscribed from marketing emails",
                      "success"
                    );
                  }
                }}
                className="h-4 w-4 rounded accent-clay-500"
              />
              Receive marketing emails (Dinner Details, Dinner Wrapup)
            </label>
            <p className="text-xs text-fg3 mt-1.5">
              Transactional emails (ticket confirmations, dinner details) are always sent regardless of this setting.
            </p>
          </FormSection>

          <div className="mt-6">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving\u2026" : "Save Changes"}
            </Button>

            {toast && (
              <div
                className={`mt-3 rounded-md px-4 py-2 text-sm ${
                  toast.type === "success"
                    ? "bg-[#E4E9D4] text-moss-600"
                    : "bg-[#F2D4CB] text-ember-600"
                }`}
              >
                {toast.message}
              </div>
            )}
          </div>
        </Card>
      </form>

      {cropImageUrl && (
        <CropModal
          imageUrl={cropImageUrl}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
