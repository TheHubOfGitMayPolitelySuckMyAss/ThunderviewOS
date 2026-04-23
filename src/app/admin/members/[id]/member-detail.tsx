"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate, formatName, formatStageType } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { FieldHelp } from "@/components/ui/field-help";
import {
  updateMemberField,
  toggleMemberFlag,
  removeMember,
  reinstateMember,
  addMemberEmail,
  deleteMemberEmail,
  setPrimaryEmail,
  checkEmailForMember,
  applyCredit,
  compTicket,
} from "./actions";
import type { EmailCheckResult } from "./actions";

const STAGE_OPTIONS = [
  "Active CEO (Bootstrapping or VC-Backed)",
  "Exited CEO (Acquisition or IPO)",
  "Investor",
  "Guest (Speaker/Press/Etc)",
];

const CONTACT_OPTIONS = ["linkedin", "email"];

function PencilIcon() {
  return <Pencil size={14} />;
}

type MemberEmail = {
  id: string;
  email: string;
  is_primary: boolean;
  source: string;
  email_status: string;
};

type MemberData = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_website: string | null;
  linkedin_profile: string | null;
  attendee_stagetypes: string[];
  current_intro: string | null;
  intro_updated_at: string | null;
  current_ask: string | null;
  ask_updated_at: string | null;
  contact_preference: string;
  marketing_opted_in: boolean;
  is_team: boolean;
  kicked_out: boolean;
  last_dinner_attended: string | null;
  profile_pic_url: string | null;
  member_emails: MemberEmail[];
};

export default function MemberDetail({
  member,
  applicationDate,
  dinnerDates,
  askIsStale,
  isAdmin,
  unredeemedCredits,
  nextDinnerDate,
}: {
  member: MemberData;
  applicationDate: string | null;
  dinnerDates: string[];
  askIsStale: boolean;
  isAdmin: boolean;
  unredeemedCredits: number;
  nextDinnerDate: string | null;
}) {
  const router = useRouter();
  const [m, setM] = useState(member);

  // Re-sync when server data changes (e.g. after router.refresh())
  useEffect(() => { setM(member); }, [member]);

  return (
    <div className="rounded-xl border border-border bg-bg p-6 shadow-xs">
      {/* Heading */}
      <div className="mb-6">
        <Heading member={m} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7">
        {/* Column One */}
        <div className="space-y-4">
          <EditableField
            label="First Name"
            value={m.first_name}
            memberId={m.id}
            field="first_name"
            type="text"
            onSaved={(v) => setM({ ...m, first_name: v as string })}
          />
          <EditableField
            label="Last Name"
            value={m.last_name}
            memberId={m.id}
            field="last_name"
            type="text"
            onSaved={(v) => setM({ ...m, last_name: v as string })}
          />
          <EditableField
            label="Company"
            value={m.company_name}
            memberId={m.id}
            field="company_name"
            type="text"
            onSaved={(v) => setM({ ...m, company_name: v as string })}
          />
          <EditableField
            label="Type"
            value={m.attendee_stagetypes[0] ?? null}
            memberId={m.id}
            field="attendee_stagetypes"
            type="select"
            options={STAGE_OPTIONS}
            displayFn={formatStageType}
            onSaved={(v) =>
              setM({ ...m, attendee_stagetypes: v ? [v as string] : [] })
            }
          />

          <EmailsSection member={m} onUpdated={() => router.refresh()} />

          <EditableField
            label="LinkedIn"
            value={m.linkedin_profile}
            memberId={m.id}
            field="linkedin_profile"
            type="text"
            valueNotClickable
            renderDisplay={(v) =>
              v ? (
                <a href={v} target="_blank" rel="noopener noreferrer" className="text-accent-hover underline decoration-border">
                  {v}
                </a>
              ) : (
                "None"
              )
            }
            onSaved={(v) => setM({ ...m, linkedin_profile: v as string | null })}
          />
          <EditableField
            label="Website"
            value={m.company_website}
            memberId={m.id}
            field="company_website"
            type="text"
            valueNotClickable
            renderDisplay={(v) =>
              v ? (
                <a
                  href={v.startsWith("http") ? v : `https://${v}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-hover underline decoration-border"
                >
                  {v}
                </a>
              ) : (
                "None"
              )
            }
            onSaved={(v) => setM({ ...m, company_website: v as string | null })}
          />

          <EditableField
            label="Intro"
            value={m.current_intro}
            memberId={m.id}
            field="current_intro"
            type="textarea"
            subtitle={
              m.intro_updated_at
                ? `Last updated ${formatDate(m.intro_updated_at)}`
                : undefined
            }
            onSaved={(v) => setM({ ...m, current_intro: v as string | null })}
          />

          <EditableField
            label="Ask"
            value={m.current_ask}
            memberId={m.id}
            field="current_ask"
            type="textarea"
            labelExtra={
              askIsStale ? (
                <Pill variant="warn">Stale</Pill>
              ) : undefined
            }
            subtitle={
              m.ask_updated_at
                ? `Last updated ${formatDate(m.ask_updated_at)}`
                : undefined
            }
            onSaved={(v) => setM({ ...m, current_ask: v as string | null })}
          />

          <EditableField
            label="Contact Preference"
            value={m.contact_preference}
            memberId={m.id}
            field="contact_preference"
            type="select"
            options={CONTACT_OPTIONS}
            onSaved={(v) => setM({ ...m, contact_preference: v as string })}
          />
        </div>

        {/* Column Two */}
        <div className="space-y-4">
          {unredeemedCredits > 0 && (
            <ApplyCreditSection member={m} />
          )}

          {nextDinnerDate && !m.kicked_out && (
            <CompTicketSection member={m} nextDinnerDate={nextDinnerDate} />
          )}

          <DetailField label="Application Date">
            {applicationDate
              ? `Approved ${formatDate(applicationDate)}`
              : "None"}
          </DetailField>

          <div>
            <dt className="text-xs font-medium uppercase text-fg3">
              Dinners
            </dt>
            <dd className="mt-1">
              {dinnerDates.length > 0 ? (
                <ul className="space-y-1">
                  {dinnerDates.map((d) => (
                    <li key={d} className="text-sm text-fg1">
                      {formatDate(d)}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-fg1">None</span>
              )}
            </dd>
          </div>

          <ToggleField
            label="Marketing Opted In"
            value={m.marketing_opted_in}
            memberId={m.id}
            field="marketing_opted_in"
            onToggled={(v) => setM({ ...m, marketing_opted_in: v })}
          />

          {isAdmin ? (
            <ToggleField
              label="Team"
              value={m.is_team}
              memberId={m.id}
              field="is_team"
              onToggled={(v) => setM({ ...m, is_team: v })}
            />
          ) : (
            <DetailField label="Team">
              {m.is_team ? "Yes" : "No"}
            </DetailField>
          )}

          <RemoveReinstateSection member={m} />
        </div>
      </div>
    </div>
  );
}

// ── Heading ──

function Heading({ member }: { member: MemberData }) {
  const fullName = formatName(member.first_name, member.last_name);
  const heading = member.company_name
    ? `${fullName} at ${member.company_name}`
    : fullName;

  return (
    <div className="flex items-center gap-4">
      <MemberAvatar member={member} size="lg" />
      <h1
        className={`tv-h2 !text-[36px] ${member.kicked_out ? "line-through text-fg4" : ""}`}
      >
        {fullName}{" "}
        {member.company_name && (
          <span className="font-sans font-normal text-[22px] text-fg3">at {member.company_name}</span>
        )}
      </h1>
    </div>
  );
}

// ── DetailField (read-only) ──

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-fg3">{label}</dt>
      <dd className="mt-1 text-sm text-fg1">{children}</dd>
    </div>
  );
}

// ── EditableField ──

function EditableField({
  label,
  value,
  memberId,
  field,
  type,
  options,
  displayFn,
  renderDisplay,
  labelExtra,
  subtitle,
  valueNotClickable,
  onSaved,
}: {
  label: string;
  value: string | null;
  memberId: string;
  field: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  displayFn?: (v: string | null) => string;
  renderDisplay?: (v: string | null) => React.ReactNode;
  labelExtra?: React.ReactNode;
  subtitle?: string;
  /** If true, clicking the value does NOT enter edit mode (for URL fields) */
  valueNotClickable?: boolean;
  onSaved: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setDraft(value || "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function commit() {
    const newValue = draft.trim() || null;
    startTransition(async () => {
      const result = await updateMemberField(memberId, field, newValue);
      if (result.success) {
        onSaved(newValue);
        setEditing(false);
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-border px-3 py-1.5 text-sm text-fg1 shadow-sm focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]";

  if (editing) {
    return (
      <div>
        <dt className="flex items-center gap-2 text-xs font-medium uppercase text-fg3">
          {label}
          {labelExtra}
        </dt>
        <dd className="mt-1">
          {type === "textarea" ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className={inputClass}
            />
          ) : type === "select" ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
            >
              {options?.map((opt) => (
                <option key={opt} value={opt}>
                  {displayFn ? displayFn(opt) : opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
            />
          )}
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={commit}
              disabled={isPending}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Commit"}
            </button>
            <button
              onClick={cancel}
              className="rounded bg-bg-elevated px-3 py-1 text-xs font-medium text-fg2 hover:bg-bg-tinted"
            >
              Cancel
            </button>
          </div>
        </dd>
      </div>
    );
  }

  const displayValue = renderDisplay
    ? renderDisplay(value)
    : displayFn
      ? displayFn(value)
      : value || "None";

  const clickableValue = !valueNotClickable;

  return (
    <div className="group/field">
      <dt className="flex items-center gap-2 text-xs font-medium uppercase text-fg3">
        {label}
        {labelExtra}
        <button
          onClick={startEdit}
          className="text-fg4 opacity-0 transition-opacity hover:text-fg2 group-hover/field:opacity-100"
          title={`Edit ${label.toLowerCase()}`}
        >
          <PencilIcon />
        </button>
      </dt>
      <dd
        className={`mt-1 text-sm text-fg1${clickableValue ? " cursor-pointer" : ""}`}
        onClick={clickableValue ? startEdit : undefined}
      >
        {displayValue}
      </dd>
      {subtitle && (
        <dd className="mt-0.5 text-xs text-fg4">{subtitle}</dd>
      )}
    </div>
  );
}

// ── ToggleField ──

function ToggleField({
  label,
  value,
  memberId,
  field,
  onToggled,
}: {
  label: string;
  value: boolean;
  memberId: string;
  field: "marketing_opted_in" | "is_team";
  onToggled: (v: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const newValue = !value;
    onToggled(newValue);
    startTransition(async () => {
      const result = await toggleMemberFlag(memberId, field, newValue);
      if (!result.success) {
        onToggled(value); // revert
      }
    });
  }

  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs font-medium uppercase text-fg3">{label}</dt>
      <button
        onClick={toggle}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          value ? "bg-moss-600" : "bg-bg-tinted"
        } ${isPending ? "opacity-50" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-bg shadow ring-0 transition duration-200 ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── Remove / Reinstate ──

function RemoveReinstateSection({ member }: { member: MemberData }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isRemove = !member.kicked_out;

  function handleConfirm() {
    startTransition(async () => {
      const result = isRemove
        ? await removeMember(member.id)
        : await reinstateMember(member.id);
      if (result.success) {
        setShowConfirm(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="pt-4">
      {isRemove ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-md border border-ember-600/30 px-4 py-2 text-sm font-medium text-ember-600 hover:bg-ember-600/[0.08]"
        >
          Remove Member
        </button>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-fg2 hover:bg-bg-elevated"
        >
          Reinstate Member
        </button>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-bg p-6 shadow-lg">
            <p className="text-sm text-fg1">
              {isRemove
                ? `Remove ${formatName(member.first_name, member.last_name)} from Thunderview? This will block all emails and flag future ticket purchases for refund.`
                : `Reinstate ${formatName(member.first_name, member.last_name)}? This will restore their membership and marketing emails.`}
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-md bg-bg-elevated px-4 py-2 text-sm font-medium text-fg2 hover:bg-bg-tinted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  isRemove
                    ? "bg-ember-600 hover:bg-ember-600/90"
                    : "bg-accent hover:bg-accent-hover"
                }`}
              >
                {isPending
                  ? "..."
                  : isRemove
                    ? "Remove"
                    : "Reinstate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Apply Credit ──

function ApplyCreditSection({ member }: { member: MemberData }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const result = await applyCredit(member.id);
      if (result.success) {
        setShowConfirm(false);
        router.refresh();
      } else {
        setError(result.error || "Failed to apply credit");
      }
    });
  }

  const fullName = formatName(member.first_name, member.last_name);

  return (
    <div>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Apply Credit
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-bg p-6 shadow-lg">
            <p className="text-sm text-fg1">
              Apply credit for <strong>{fullName}</strong>? This will create a
              ticket for the next upcoming dinner.
            </p>
            {error && (
              <p className="mt-2 rounded-md bg-[#F2D4CB] px-3 py-2 text-sm text-ember-600">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowConfirm(false); setError(""); }}
                className="rounded-md bg-bg-elevated px-4 py-2 text-sm font-medium text-fg2 hover:bg-bg-tinted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending ? "..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comp Ticket ──

function CompTicketSection({ member, nextDinnerDate }: { member: MemberData; nextDinnerDate: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const result = await compTicket(member.id);
      if (result.success) {
        setShowConfirm(false);
        router.refresh();
      } else {
        setError(result.error || "Failed to comp ticket");
      }
    });
  }

  const fullName = formatName(member.first_name, member.last_name);

  return (
    <div>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Comp Ticket
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-bg p-6 shadow-lg">
            <p className="text-sm text-fg1">
              Comp a free ticket to <strong>{fullName}</strong> for{" "}
              <strong>{formatDate(nextDinnerDate)}</strong>?
            </p>
            {error && (
              <p className="mt-2 rounded-md bg-[#F2D4CB] px-3 py-2 text-sm text-ember-600">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowConfirm(false); setError(""); }}
                className="rounded-md bg-bg-elevated px-4 py-2 text-sm font-medium text-fg2 hover:bg-bg-tinted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending ? "..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Emails Section ──

function EmailsSection({
  member,
  onUpdated,
}: {
  member: MemberData;
  onUpdated: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="group/field">
      <dt className="flex items-center gap-2 text-xs font-medium uppercase text-fg3">
        Email Addresses
        <button
          onClick={() => setShowModal(true)}
          className="text-fg4 opacity-0 transition-opacity hover:text-fg2 group-hover/field:opacity-100"
          title="Manage emails"
        >
          <PencilIcon />
        </button>
      </dt>
      <dd className="mt-1">
        <div>
          {member.member_emails.map((me) => (
            <div
              key={me.id}
              onClick={() => setShowModal(true)}
              className="flex cursor-pointer flex-wrap items-center gap-2 py-1"
            >
              <span className="text-sm text-fg1">{me.email}</span>
              <span className="text-xs text-fg4">{me.source}</span>
              {me.is_primary && (
                <span className="rounded-full bg-bg-tinted px-2 py-0.5 text-xs font-medium text-accent-hover">
                  primary
                </span>
              )}
              {me.email_status === "bounced" && (
                <span className="rounded-full bg-[#F2D4CB] px-2 py-0.5 text-xs font-medium text-ember-600">
                  bounced
                </span>
              )}
            </div>
          ))}
        </div>
      </dd>

      {showModal && (
        <EmailModal
          member={member}
          onClose={() => setShowModal(false)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}

// ── Email Modal ──

function EmailModal({
  member,
  onClose,
  onUpdated,
}: {
  member: MemberData;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCheck, setEmailCheck] = useState<EmailCheckResult | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const validateEmail = useCallback(
    (val: string) => {
      if (!val || !val.includes("@")) {
        setEmailCheck(null);
        return;
      }
      setEmailChecking(true);
      checkEmailForMember(val, member.id).then((result) => {
        setEmailCheck(result);
        setEmailChecking(false);
      });
    },
    [member.id]
  );

  useEffect(() => {
    const timer = setTimeout(() => validateEmail(newEmail), 400);
    return () => clearTimeout(timer);
  }, [newEmail, validateEmail]);

  const addBlocked =
    !!emailCheck?.existingMember || !!emailCheck?.pendingApp;

  function handleAdd() {
    if (!newEmail || addBlocked) return;
    setError("");
    startTransition(async () => {
      const result = await addMemberEmail(member.id, newEmail);
      if (result.success) {
        setNewEmail("");
        setEmailCheck(null);
        onUpdated();
      } else {
        setError(result.error || "Failed to add email");
      }
    });
  }

  function handleDelete(emailId: string) {
    if (member.member_emails.length <= 1) {
      setError("Cannot delete the last remaining email");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await deleteMemberEmail(emailId);
      if (result.success) {
        setConfirmDeleteId(null);
        onUpdated();
      } else {
        setError(result.error || "Failed to delete email");
      }
    });
  }

  function handleSetPrimary(emailId: string) {
    setError("");
    startTransition(async () => {
      const result = await setPrimaryEmail(member.id, emailId);
      if (result.success) {
        onUpdated();
      } else {
        setError(result.error || "Failed to set primary email");
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-border px-3 py-1.5 text-sm text-fg1 shadow-sm focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-bg p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fg1">
            Manage Emails
          </h3>
          <button
            onClick={onClose}
            className="text-fg4 hover:text-fg2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {member.member_emails.map((me) => (
            <div
              key={me.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-fg1">{me.email}</span>
                <span className="text-xs text-fg4">{me.source}</span>
                {me.is_primary && (
                  <span className="rounded-full bg-bg-tinted px-2 py-0.5 text-xs font-medium text-accent-hover">
                    primary
                  </span>
                )}
                {me.email_status === "bounced" && (
                  <span className="rounded-full bg-[#F2D4CB] px-2 py-0.5 text-xs font-medium text-ember-600">
                    bounced
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!me.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(me.id)}
                    disabled={isPending}
                    className="text-xs text-accent-hover underline decoration-border disabled:opacity-50"
                  >
                    Make primary
                  </button>
                )}
                {confirmDeleteId === me.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(me.id)}
                      disabled={isPending}
                      className="text-xs font-medium text-ember-600 hover:text-ember-600 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-fg4 hover:text-fg2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(me.id)}
                    className="text-xs text-ember-600 hover:text-ember-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new email */}
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Add email address..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
            />
            <button
              onClick={handleAdd}
              disabled={isPending || addBlocked || emailChecking || !newEmail}
              className="whitespace-nowrap rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {emailChecking && (
            <p className="mt-1 text-xs text-fg4">Checking...</p>
          )}
          {emailCheck?.existingMember && (
            <p className="mt-1 text-xs text-ember-600">
              This email belongs to{" "}
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

        {error && (
          <p className="mt-3 rounded-md bg-[#F2D4CB] px-3 py-2 text-sm text-ember-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
