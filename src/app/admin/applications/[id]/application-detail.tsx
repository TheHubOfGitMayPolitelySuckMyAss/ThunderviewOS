"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatName, formatStageType } from "@/lib/format";
import {
  approveApplication,
  rejectApplication,
  linkApplicationToMember,
  searchMembers,
} from "./actions";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const REJECTION_REASONS = ["Service Provider", "services business", "Other"];

type ApplicationData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  company_website: string;
  linkedin_profile: string;
  attendee_stagetype: string;
  preferred_dinner_date: string;
  gender: string;
  race: string;
  orientation: string;
  i_am_my_startups_ceo: string | null;
  my_startup_is_not_a_services_business: string | null;
  status: string;
  member_id: string | null;
  rejection_reason: string | null;
  submitted_on: string;
  reviewed_at: string | null;
};

export default function ApplicationDetail({
  application,
}: {
  application: ApplicationData;
}) {
  const router = useRouter();
  const [app, setApp] = useState(application);
  const [toast, setToast] = useState<string | null>(null);
  const [kickedOutWarning, setKickedOutWarning] = useState<{
    name: string;
    memberId: string;
  } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-sync when server refreshes
  useEffect(() => {
    setApp(application);
  }, [application]);

  const fullName = formatName(app.first_name, app.last_name);
  const heading = `${fullName} at ${app.company_name}`;
  const isActiveCEO =
    app.attendee_stagetype === "Active CEO (Bootstrapping or VC-Backed)";

  function handleApprove() {
    setKickedOutWarning(null);
    startTransition(async () => {
      const result = await approveApplication(app.id);
      if (result.isKickedOut) {
        setKickedOutWarning({
          name: result.kickedOutName || "This member",
          memberId: result.memberId!,
        });
        return;
      }
      if (result.success) {
        if (result.isExisting) {
          setToast(`${fullName} is already a member — application linked.`);
          setTimeout(() => setToast(null), 4000);
        }
        router.refresh();
      }
    });
  }

  function handleLinked(memberName: string) {
    setShowLinkModal(false);
    setToast(`${memberName} linked — application approved.`);
    setTimeout(() => setToast(null), 4000);
    router.refresh();
  }

  const showApprove = app.status === "pending" || app.status === "rejected";
  const showReject = app.status === "pending";
  const showLink =
    app.status === "pending" && !app.member_id;

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      {/* Toast */}
      {toast && (
        <div className="mb-4 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {toast}
        </div>
      )}

      {/* Kicked-out warning */}
      {kickedOutWarning && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          <Link
            href={`/admin/members/${kickedOutWarning.memberId}`}
            className="font-medium underline"
          >
            {kickedOutWarning.name}
          </Link>{" "}
          was removed from Thunderview. Reinstate them from their member page
          before approving this application.
        </div>
      )}

      {/* Heading + status pill + member link + action buttons */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{heading}</h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[app.status] || "bg-gray-100 text-gray-800"}`}
          >
            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
          </span>
          {app.member_id && (
            <Link
              href={`/admin/members/${app.member_id}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View member &rarr;
            </Link>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex gap-3">
          {showApprove && (
            <button
              onClick={handleApprove}
              disabled={isPending || !!kickedOutWarning}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? "Approving..." : "Approve"}
            </button>
          )}
          {showLink && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Link to existing member
            </button>
          )}
          {showReject && (
            <button
              onClick={() => setShowRejectModal(true)}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Reject
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Column One */}
        <div className="space-y-4">
          <DetailField label="Type">
            {formatStageType(app.attendee_stagetype)}
          </DetailField>

          <DetailField label="Email">{app.email}</DetailField>

          <DetailField label="LinkedIn">
            <a
              href={app.linkedin_profile}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              {app.linkedin_profile}
            </a>
          </DetailField>

          <DetailField label="Website">
            <a
              href={
                app.company_website.startsWith("http")
                  ? app.company_website
                  : `https://${app.company_website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              {app.company_website}
            </a>
          </DetailField>

          <DetailField label="Gender">{app.gender}</DetailField>

          <DetailField label="Race/Ethnicity">{app.race}</DetailField>

          <DetailField label="Orientation">{app.orientation}</DetailField>

          {isActiveCEO && (
            <>
              <DetailField label="I Am My Startup's CEO">
                {app.i_am_my_startups_ceo || "N/A"}
              </DetailField>
              <DetailField label="My Startup Is NOT A Services Business">
                {app.my_startup_is_not_a_services_business || "N/A"}
              </DetailField>
            </>
          )}
        </div>

        {/* Column Two */}
        <div className="space-y-4">
          <DetailField label="Applied">
            {formatDate(app.submitted_on)}
          </DetailField>

          <DetailField label="Status">{app.status}</DetailField>

          {app.status === "rejected" && (
            <DetailField label="Rejection Reason">
              {app.rejection_reason || "No reason given"}
            </DetailField>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <RejectModal
          applicationId={app.id}
          name={fullName}
          onClose={() => setShowRejectModal(false)}
          onRejected={() => {
            setShowRejectModal(false);
            router.refresh();
          }}
        />
      )}

      {/* Link to existing member modal */}
      {showLinkModal && (
        <LinkMemberModal
          applicationId={app.id}
          onClose={() => setShowLinkModal(false)}
          onLinked={handleLinked}
          onKickedOut={(name, memberId) => {
            setShowLinkModal(false);
            setKickedOutWarning({ name, memberId });
          }}
        />
      )}
    </div>
  );
}

// ── Reject Modal ──

function RejectModal({
  applicationId,
  name,
  onClose,
  onRejected,
}: {
  applicationId: string;
  name: string;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleReject() {
    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) return;

    startTransition(async () => {
      const result = await rejectApplication(applicationId, finalReason);
      if (result.success) {
        onRejected();
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Reject {name}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Rejection Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === "Other" && (
            <input
              type="text"
              placeholder="Enter reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className={inputClass}
            />
          )}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={isPending || (reason === "Other" && !customReason.trim())}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Link Member Modal ──

function LinkMemberModal({
  applicationId,
  onClose,
  onLinked,
  onKickedOut,
}: {
  applicationId: string;
  onClose: () => void;
  onLinked: (memberName: string) => void;
  onKickedOut: (name: string, memberId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; company_name: string | null; primary_email: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchMembers(q).then((r) => {
      setResults(r);
      setSearching(false);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, doSearch]);

  function handleConfirm() {
    if (!selected) return;
    setError("");
    startTransition(async () => {
      const result = await linkApplicationToMember(applicationId, selected);
      if (result.isKickedOut) {
        onKickedOut(result.memberName || "This member", result.memberId!);
        return;
      }
      if (result.success) {
        onLinked(result.memberName || "Member");
      } else {
        setError(result.error || "Failed to link");
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Link to Existing Member
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <input
          type="text"
          placeholder="Search members by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
          className={inputClass}
        />

        {searching && (
          <p className="mt-2 text-xs text-gray-400">Searching...</p>
        )}

        {results.length > 0 && (
          <div className="mt-2 max-h-60 overflow-auto rounded-md border border-gray-200">
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                  selected === m.id ? "bg-blue-50" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {m.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {m.company_name || "-"} &middot; {m.primary_email}
                  </div>
                </div>
                {selected === m.id && (
                  <span className="ml-auto text-xs text-blue-600">
                    Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && !searching && results.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">No members found.</p>
        )}

        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || isPending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? "Linking..." : "Link & Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DetailField ──

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children}</dd>
    </div>
  );
}
