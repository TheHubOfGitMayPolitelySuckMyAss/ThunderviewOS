"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitApplication } from "./actions";
import Field from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";

const STAGE_OPTIONS = [
  "Active CEO (Bootstrapping or VC-Backed)",
  "Exited CEO (Acquisition or IPO)",
  "Investor",
  "Guest (Speaker/Press/Etc)",
];

const GENDER_OPTIONS = [
  "Female",
  "Male",
  "Other",
  "Prefer not to say",
];

const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Prefer not to say",
];

const ORIENTATION_OPTIONS = [
  "LGBTQ+",
  "Straight",
  "Prefer not to say",
];

export default function ApplicationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinProfile, setLinkedinProfile] = useState("");
  const [gender, setGender] = useState("");
  const [race, setRace] = useState("");
  const [orientation, setOrientation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [attendeeStagetype, setAttendeeStagetype] = useState("");
  const [iAmCeo, setIAmCeo] = useState("");
  const [isNotServices, setIsNotServices] = useState("");

  const isActiveCEO =
    attendeeStagetype === "Active CEO (Bootstrapping or VC-Backed)";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await submitApplication({
        firstName,
        lastName,
        email,
        linkedinProfile,
        gender,
        race,
        orientation,
        companyName,
        companyWebsite,
        attendeeStagetype,
        iAmCeo: isActiveCEO ? iAmCeo : null,
        isNotServices: isActiveCEO ? isNotServices : null,
      });

      if (result.success) {
        router.push(result.alreadyMember ? "/apply/already-member" : "/apply/thanks");
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* PERSONAL INFORMATION */}
      <section>
        <Eyebrow className="border-b border-border-subtle pb-2.5 mb-5">
          Personal Information
        </Eyebrow>
        <div className="space-y-form-row">
          <Field label="Name" required>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="text"
                required
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                type="text"
                required
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </Field>

          <Field
            label="Email"
            required
            help="Please click the button below to get our pre-dinner email with attendee introductions!"
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="LinkedIn Profile" required>
            <Input
              type="text"
              required
              placeholder="https://"
              value={linkedinProfile}
              onChange={(e) => setLinkedinProfile(e.target.value)}
            />
          </Field>

          <Field label="Gender" required>
            <Select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="" disabled>
                Select an option
              </option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Race" required>
            <Select
              required
              value={race}
              onChange={(e) => setRace(e.target.value)}
            >
              <option value="" disabled>
                Select an option
              </option>
              {RACE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Orientation" required>
            <Select
              required
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
            >
              <option value="" disabled>
                Select an option
              </option>
              {ORIENTATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* COMPANY INFORMATION */}
      <section>
        <Eyebrow className="border-b border-border-subtle pb-2.5 mb-5">
          Company Information
        </Eyebrow>
        <div className="space-y-form-row">
          <Field label="Company Name" required>
            <Input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>

          <Field label="Company Website" required>
            <Input
              type="text"
              required
              placeholder="https://"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
            />
          </Field>

          <Field label="Attendee Stage/Type" required>
            <Select
              required
              value={attendeeStagetype}
              onChange={(e) => setAttendeeStagetype(e.target.value)}
            >
              <option value="" disabled>
                Select an option
              </option>
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </Field>

          {isActiveCEO && (
            <>
              <Field
                label="I Am My Startup's CEO"
                required
                help="Thunderview CEO Dinners are specifically organized for company CEOs. Sadly, this means no CTOs, CPOs, Presidents, co-founders or spouses (work or otherwise)."
              >
                <Select
                  required
                  value={iAmCeo}
                  onChange={(e) => setIAmCeo(e.target.value)}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </Select>
              </Field>

              <Field
                label="My Startup Is NOT A Services Business"
                required
                help="Our dinners are focused on product and software companies. We do not allow the following types of companies to attend: accountancies, dev shops, recruiters, consultants, fractional executives and coaches."
              >
                <Select
                  required
                  value={isNotServices}
                  onChange={(e) => setIsNotServices(e.target.value)}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </Select>
              </Field>
            </>
          )}
        </div>
      </section>

      {error && (
        <p className="rounded-md bg-[rgba(192,68,42,0.1)] px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full" size="lg">
        {isPending ? "Submitting\u2026" : "Submit"}
      </Button>
    </form>
  );
}
