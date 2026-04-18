"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitApplication } from "./actions";

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

type DinnerOption = { value: string; label: string };

export default function ApplicationForm({
  dinnerOptions,
}: {
  dinnerOptions: DinnerOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [preferredDinnerDate, setPreferredDinnerDate] = useState("");
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
        preferredDinnerDate,
        iAmCeo: isActiveCEO ? iAmCeo : null,
        isNotServices: isActiveCEO ? isNotServices : null,
      });

      if (result.success) {
        router.push("/apply/thanks");
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700";
  const requiredStar = <span className="text-red-500"> *</span>;

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* SIGN UP HERE! */}
      <section>
        <h2 className="mb-4 border-b border-gray-300 pb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
          Sign Up Here!
        </h2>
        <div>
          <label className={labelClass}>
            Preferred Dinner Date{requiredStar}
          </label>
          <select
            required
            value={preferredDinnerDate}
            onChange={(e) => setPreferredDinnerDate(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select an option
            </option>
            {dinnerOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* PERSONAL INFORMATION */}
      <section>
        <h2 className="mb-4 border-b border-gray-300 pb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
          Personal Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Name{requiredStar}</label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                required
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email{requiredStar}</label>
            <p className="mb-1 text-xs text-gray-500">
              Please click the button below to get our pre-dinner email with
              attendee introductions!
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              LinkedIn Profile{requiredStar}
            </label>
            <input
              type="text"
              required
              placeholder="http://"
              value={linkedinProfile}
              onChange={(e) => setLinkedinProfile(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Gender{requiredStar}</label>
            <select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select an option
              </option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Race{requiredStar}</label>
            <select
              required
              value={race}
              onChange={(e) => setRace(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select an option
              </option>
              {RACE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Orientation{requiredStar}</label>
            <select
              required
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select an option
              </option>
              {ORIENTATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* COMPANY INFORMATION */}
      <section>
        <h2 className="mb-4 border-b border-gray-300 pb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
          Company Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Company Name{requiredStar}</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Company Website{requiredStar}
            </label>
            <input
              type="text"
              required
              placeholder="http://"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Attendee Stage/Type{requiredStar}
            </label>
            <select
              required
              value={attendeeStagetype}
              onChange={(e) => setAttendeeStagetype(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select an option
              </option>
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {isActiveCEO && (
            <>
              <div>
                <label className={labelClass}>
                  I Am My Startup&rsquo;s CEO{requiredStar}
                </label>
                <p className="mb-1 text-xs text-gray-500">
                  Thunderview CEO Dinners are specifically organized for company
                  CEOs. Sadly, this means no CTOs, CPOs, Presidents, co-founders
                  or spouses (work or otherwise).
                </p>
                <select
                  required
                  value={iAmCeo}
                  onChange={(e) => setIAmCeo(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  My Startup Is NOT A Services Business{requiredStar}
                </label>
                <p className="mb-1 text-xs text-gray-500">
                  Our dinners are focused on product and software companies. We
                  do not allow the following types of companies to attend:
                  accountancies, dev shops, recruiters, consultants, fractional
                  executives and coaches.
                </p>
                <select
                  required
                  value={isNotServices}
                  onChange={(e) => setIsNotServices(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
