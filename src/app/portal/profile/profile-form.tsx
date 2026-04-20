"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { saveProfile } from "./actions";

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
    contactPreference: string | null;
    primaryEmail: string;
    profilePicUrl: string | null;
  };
};

export default function ProfileForm({ member }: ProfileFormProps) {
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
  const [contact, setContact] = useState(
    member.contactPreference ?? "linkedin"
  );
  const [primaryEmail, setPrimaryEmail] = useState(member.primaryEmail);
  const [profilePicUrl, setProfilePicUrl] = useState(member.profilePicUrl);
  const [picPreview, setPicPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removePic, setRemovePic] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
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
    setSelectedFile(file);
    setRemovePic(false);
    setPicPreview(URL.createObjectURL(file));
  }

  function handleRemovePic() {
    setRemovePic(true);
    setSelectedFile(null);
    setPicPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      // Update pic state after successful save
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

  const inputClass =
    "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Profile details section */}
      <section>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Profile Details
        </h3>
        <div className="space-y-4">
          {/* Profile picture */}
          <div className="flex items-center gap-4">
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
              <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gray-900 text-3xl font-medium text-white">
                {firstName?.[0]?.toUpperCase() ?? "?"}{lastName?.[0]?.toUpperCase() ?? ""}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                {profilePicUrl && !removePic ? "Change Photo" : "Upload Photo"}
              </button>
              {profilePicUrl && !removePic && !picPreview && (
                <button
                  type="button"
                  onClick={handleRemovePic}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
              {picPreview && (
                <span className="text-xs text-gray-500">
                  New photo selected — save to apply
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className={labelClass}>
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="last_name" className={labelClass}>
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="primary_email" className={labelClass}>
              Primary Email
            </label>
            <input
              type="email"
              id="primary_email"
              name="primary_email"
              value={primaryEmail}
              onChange={(e) => setPrimaryEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="company_name" className={labelClass}>
              Company
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="company_website" className={labelClass}>
              Website
            </label>
            <input
              type="text"
              id="company_website"
              name="company_website"
              placeholder="https://"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="linkedin_profile" className={labelClass}>
              LinkedIn
            </label>
            <input
              type="text"
              id="linkedin_profile"
              name="linkedin_profile"
              placeholder="https://linkedin.com/in/..."
              value={linkedinProfile}
              onChange={(e) => setLinkedinProfile(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Role</label>
            <p className="mb-2 text-xs text-gray-500">
              Select all that apply.
            </p>
            {/* Hidden field to transmit selected stagetypes */}
            <input
              type="hidden"
              name="attendee_stagetypes"
              value={stagetypes.join(",")}
            />
            <div className="space-y-2">
              {STAGE_OPTIONS.map((option) => {
                const checked = stagetypes.includes(option);
                return (
                  <label
                    key={option}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStagetype(option)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Intro / Ask / Contact section */}
      <section>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Intro &amp; Ask
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="current_intro" className={labelClass}>
              Intro
            </label>
            <textarea
              id="current_intro"
              name="current_intro"
              rows={4}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="How would you introduce yourself to the group?"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="current_ask" className={labelClass}>
              Ask
            </label>
            <textarea
              id="current_ask"
              name="current_ask"
              rows={4}
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="What can the group help you with?"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="contact_preference" className={labelClass}>
              Preferred Contact
            </label>
            <select
              id="contact_preference"
              name="contact_preference"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className={inputClass}
            >
              {CONTACT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        {toast && (
          <div
            className={`mt-3 rounded-md px-4 py-2 text-sm ${
              toast.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </form>
  );
}
