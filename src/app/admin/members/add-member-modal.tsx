"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { formatDate, formatName, formatStageType } from "@/lib/format";
import { checkEmail, addMember } from "./actions";
import type { EmailCheckResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldHelp } from "@/components/ui/field-help";

const STAGE_OPTIONS = [
  "Active CEO (Bootstrapping or VC-Backed)",
  "Exited CEO (Acquisition or IPO)",
  "Investor",
  "Guest (Speaker/Press/Etc)",
];

const GENDER_OPTIONS = ["Prefer not to say", "Male", "Female", "Other"];
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
const ORIENTATION_OPTIONS = ["Prefer not to say", "Straight", "LGBTQ+"];

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [linkedinProfile, setLinkedinProfile] = useState("");
  const [attendeeStagetype, setAttendeeStagetype] = useState(STAGE_OPTIONS[0]);
  const [gender, setGender] = useState("Prefer not to say");
  const [race, setRace] = useState("Prefer not to say");
  const [orientation, setOrientation] = useState("Prefer not to say");
  const [preferredDinnerDate, setPreferredDinnerDate] = useState(dinners[0]?.date ?? "");

  const [emailCheck, setEmailCheck] = useState<EmailCheckResult | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

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

  const emailBlocked = !!emailCheck?.existingMember || !!emailCheck?.pendingApp;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailBlocked) return;
    setError("");

    startTransition(async () => {
      const result = await addMember({
        firstName, lastName, email, companyName, companyWebsite,
        linkedinProfile, attendeeStagetype, preferredDinnerDate,
        gender, race, orientation,
      });

      if (result.success) {
        onSuccess(formatName(firstName, lastName));
      } else {
        setError(result.error || "Failed to add member");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-bg border border-border p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="tv-h4">Add Member</h3>
          <button onClick={onClose} className="text-fg4 cursor-pointer hover:text-fg2">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>First Name</Label>
              <Input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label required>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={!!emailCheck?.existingMember} />
            {emailChecking && <FieldHelp>Checking...</FieldHelp>}
            {emailCheck?.existingMember && (
              <FieldHelp error>
                This email belongs to an existing member:{" "}
                <Link href={`/admin/members/${emailCheck.existingMember.id}`} className="underline text-ember-600">
                  {emailCheck.existingMember.name}
                </Link>
              </FieldHelp>
            )}
            {emailCheck?.pendingApp && (
              <FieldHelp className="!text-mustard-500">
                This person has a pending application.{" "}
                <Link href={`/admin/applications/${emailCheck.pendingApp.id}`} className="underline">
                  View application
                </Link>
              </FieldHelp>
            )}
            {emailCheck?.rejectedApp && !emailCheck.pendingApp && (
              <FieldHelp className="!text-mustard-500">
                This person was previously rejected.{" "}
                <Link href={`/admin/applications/${emailCheck.rejectedApp.id}`} className="underline">
                  View application
                </Link>
              </FieldHelp>
            )}
          </div>

          <div>
            <Label required>Company</Label>
            <Input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>

          <div>
            <Label>Website</Label>
            <Input type="text" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
          </div>

          <div>
            <Label>LinkedIn</Label>
            <Input type="text" value={linkedinProfile} onChange={(e) => setLinkedinProfile(e.target.value)} />
          </div>

          <div>
            <Label required>Type</Label>
            <Select required value={attendeeStagetype} onChange={(e) => setAttendeeStagetype(e.target.value)}>
              {STAGE_OPTIONS.map((opt) => <option key={opt} value={opt}>{formatStageType(opt)}</option>)}
            </Select>
          </div>

          <div>
            <Label>Gender</Label>
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              {GENDER_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </div>

          <div>
            <Label>Race/Ethnicity</Label>
            <Select value={race} onChange={(e) => setRace(e.target.value)}>
              {RACE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </div>

          <div>
            <Label>Orientation</Label>
            <Select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
              {ORIENTATION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </div>

          <div>
            <Label required>Preferred Dinner Date</Label>
            <Select required value={preferredDinnerDate} onChange={(e) => setPreferredDinnerDate(e.target.value)}>
              {dinners.map((d) => <option key={d.id} value={d.date}>{formatDate(d.date)}</option>)}
            </Select>
          </div>

          {error && (
            <p className="rounded-md bg-[#F2D4CB] px-3 py-2 text-sm text-ember-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isPending || emailBlocked || emailChecking}>
              {isPending ? "Adding\u2026" : "Add Member"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
