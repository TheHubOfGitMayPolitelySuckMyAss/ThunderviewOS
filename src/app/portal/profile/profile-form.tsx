"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { saveProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Eyebrow, H1 } from "@/components/ui/typography";
import Field from "@/components/field";
import { Card } from "@/components/ui/card";

const CropModal = dynamic(() => import("./crop-modal"), { ssr: false });

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
  };
};

export default function ProfileForm({ member }: ProfileFormProps) {
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
  const [profilePicUrl, setProfilePicUrl] = useState(member.profilePicUrl);
  const [picPreview, setPicPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removePic, setRemovePic] = useState(false);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isHeic = file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic");
    if (isHeic) {
      setSelectedFile(file);
      setRemovePic(false);
      setPicPreview(null);
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
    formData.set("first_name", firstName);
    formData.set("last_name", lastName);
    formData.set("company_name", companyName);
    formData.set("company_website", companyWebsite);
    formData.set("linkedin_profile", linkedinProfile);
    formData.set("attendee_stagetypes", stagetypes.join(","));
    formData.set("current_intro", intro);
    formData.set("current_ask", ask);
    formData.set("contact_preference", contact);
    formData.set("primary_email", primaryEmail);

    const result = await saveProfile(formData);
    setSavingPhoto(false);

    if (!result.success) {
      showToast(result.error || "Upload failed", "error");
      setSelectedFile(file);
      return;
    }

    showToast("Photo saved!", "success");
    if (result.profilePicUrl) {
      setProfilePicUrl(result.profilePicUrl);
    }
    setSelectedFile(null);
    setPicPreview(null);
    setRemovePic(false);
    router.refresh();
  }

  function handleCropCancel() {
    setCropImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemovePic() {
    setSelectedFile(null);
    setPicPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setSavingPhoto(true);
    const formData = new FormData();
    formData.set("remove_pic", "true");
    formData.set("first_name", firstName);
    formData.set("last_name", lastName);
    formData.set("company_name", companyName);
    formData.set("company_website", companyWebsite);
    formData.set("linkedin_profile", linkedinProfile);
    formData.set("attendee_stagetypes", stagetypes.join(","));
    formData.set("current_intro", intro);
    formData.set("current_ask", ask);
    formData.set("contact_preference", contact);
    formData.set("primary_email", primaryEmail);

    const result = await saveProfile(formData);
    setSavingPhoto(false);

    if (!result.success) {
      showToast(result.error || "Remove failed", "error");
      return;
    }

    showToast("Photo removed!", "success");
    setProfilePicUrl(null);
    setRemovePic(false);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    if (selectedFile) {
      formData.set("profile_pic", selectedFile);
    }
    if (removePic) {
      formData.set("remove_pic", "true");
    }
    const result = await saveProfile(formData);

    setSaving(false);

    if (!result.success) {
      showToast(result.error || "Save failed", "error");
      return;
    }

    if (result.noChanges) {
      showToast("No changes to save", "success");
    } else {
      showToast("Saved!", "success");
      if (result.profilePicUrl !== undefined) {
        setProfilePicUrl(result.profilePicUrl ?? null);
      }
      if (removePic) {
        setProfilePicUrl(null);
      }
      setSelectedFile(null);
      setPicPreview(null);
      setRemovePic(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      {/* Profile head */}
      <div className="flex items-center gap-5 mb-6">
        <div className="relative">
          {picPreview || (!removePic && profilePicUrl) ? (
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
              {profilePicUrl && !removePic ? "Change photo" : "Upload photo"}
            </Button>
            {profilePicUrl && !removePic && !picPreview && (
              <button
                type="button"
                onClick={handleRemovePic}
                className="text-sm text-ember-600 cursor-pointer hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <Eyebrow className="mb-4">Profile details</Eyebrow>
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

          <Eyebrow className="mt-7 pt-5 border-t border-border-subtle mb-4">Intro, Ask &amp; Give</Eyebrow>

          <Field label="Intro">
            <Textarea
              id="current_intro"
              name="current_intro"
              rows={4}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="How would you introduce yourself to the group?"
            />
          </Field>

          <Field label="Ask" className="mt-form-row">
            <Textarea
              id="current_ask"
              name="current_ask"
              rows={4}
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="What can the group help you with?"
            />
          </Field>

          <Field label="Give" className="mt-form-row">
            <Textarea
              id="current_give"
              name="current_give"
              rows={4}
              value={give}
              onChange={(e) => setGive(e.target.value)}
              placeholder="What can you offer the community?"
            />
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
