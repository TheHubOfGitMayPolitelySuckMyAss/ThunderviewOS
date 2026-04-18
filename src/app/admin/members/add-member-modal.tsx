"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate, formatStageType } from "@/lib/format";
import { checkEmail, addMember } from "./actions";
import type { EmailCheckResult } from "./actions";

const STAGE_OPTIONS = [
  "Active CEO (Bootstrapping or VC-Backed)",
  "Exited CEO (Acquisition or IPO)",
  "Investor",
  "Guest (Speaker/Press/Etc)",
];

const GENDER_OPTIONS = [
  "Prefer not to say",
  "Male",
  "Female",
  "Other",
];

const RACE_OPTIONS = [
  "Prefer not to say",
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White",
];

const ORIENTATION_OPTIONS = [
  "Prefer not to say",
  "Straight",
  "LGBTQ+",
];

type Dinner = { id: string; date: string };

export default function AddMemberModal({
  dinners,
  onClose,
  onSuccess,
}: {
  dinners: Dinner[];
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [linkedinProfile, setLinkedinProfile] = useState("");
  const [attendeeStagetype, setAttendeeStagetype] = useState(STAGE_OPTIONS[0]);
  const [gender, setGender] = useState("Prefer not to say");
  const [race, setRace] = useState("Prefer not to say");
  const [orientation, setOrientation] = useState("Prefer not to say");
  const [preferredDinnerDate, setPreferredDinnerDate] = useState(
    dinners[0]?.date ?? ""
  );

  const [emailCheck, setEmailCheck] = useState<EmailCheckResult | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Debounced email validation
  const validateEmail = useCallback((val: string) => {
    if (!val || !val.includes("@")) {
      setEmailCheck(null);
      return;
    }
    setEmailChecking(true);
    checkEmail(val).then((result) => {
      setEmailCheck(result);
      setEmailChecking(false);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => validateEmail(email), 400);
    return () => clearTimeout(timer);
  }, [email, validateEmail]);

  const emailBlocked =
    !!emailCheck?.existingMember || !!emailCheck?.pendingApp;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailBlocked) return;
    setError("");

    startTransition(async () => {
      const result = await addMember({
        name,
        email,
        companyName,
        companyWebsite,
        linkedinProfile,
        attendeeStagetype,
        preferredDinnerDate,
        gender,
        race,
        orientation,
      });

      if (result.success) {
        onSuccess(name);
      } else {
        setError(result.error || "Failed to add member");
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Member</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            {emailChecking && (
              <p className="mt-1 text-xs text-gray-400">Checking...</p>
            )}
            {emailCheck?.existingMember && (
              <p className="mt-1 text-xs text-red-600">
                This email belongs to an existing member:{" "}
                <Link
                  href={`/admin/members/${emailCheck.existingMember.id}`}
                  className="underline"
                >
                  {emailCheck.existingMember.name}
                </Link>
              </p>
            )}
            {emailCheck?.pendingApp && (
              <p className="mt-1 text-xs text-yellow-700">
                This person has a pending application.{" "}
                <Link
                  href={`/admin/applications/${emailCheck.pendingApp.id}`}
                  className="underline"
                >
                  View application
                </Link>
              </p>
            )}
            {emailCheck?.rejectedApp && !emailCheck.pendingApp && (
              <p className="mt-1 text-xs text-yellow-700">
                This person was previously rejected.{" "}
                <Link
                  href={`/admin/applications/${emailCheck.rejectedApp.id}`}
                  className="underline"
                >
                  View application
                </Link>
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Company <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Website</label>
            <input
              type="text"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>LinkedIn</label>
            <input
              type="text"
              value={linkedinProfile}
              onChange={(e) => setLinkedinProfile(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={attendeeStagetype}
              onChange={(e) => setAttendeeStagetype(e.target.value)}
              className={inputClass}
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {formatStageType(opt)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass}
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Race/Ethnicity</label>
            <select
              value={race}
              onChange={(e) => setRace(e.target.value)}
              className={inputClass}
            >
              {RACE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Orientation</label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              className={inputClass}
            >
              {ORIENTATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Preferred Dinner Date <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={preferredDinnerDate}
              onChange={(e) => setPreferredDinnerDate(e.target.value)}
              className={inputClass}
            >
              {dinners.map((d) => (
                <option key={d.id} value={d.date}>
                  {formatDate(d.date)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || emailBlocked || emailChecking}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isPending ? "Adding..." : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
