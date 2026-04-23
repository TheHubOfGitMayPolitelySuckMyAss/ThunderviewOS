"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate, formatName, formatStageType } from "@/lib/format";
import {
  approveApplication,
  rejectApplication,
  linkApplicationToMember,
  searchMembers,
} from "./actions";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

function StatusPill({ status }: { status: string }) {
  const variant = {
    pending: "warn" as const,
    approved: "success" as const,
    rejected: "danger" as const,
  }[status] ?? "neutral" as const;
  return <Pill variant={variant} dot>{status.charAt(0).toUpperCase() + status.slice(1)}</Pill>;
}

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

  useEffect(() => {
    setApp(application);
  }, [application]);

  const fullName = formatName(app.first_name, app.last_name);
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
          setToast(`${fullName} is already a member \u2014 application linked.`);
          setTimeout(() => setToast(null), 4000);
        }
        router.refresh();
      }
    });
  }

  function handleLinked(memberName: string) {
    setShowLinkModal(false);
    setToast(`${memberName} linked \u2014 application approved.`);
    setTimeout(() => setToast(null), 4000);
    router.refresh();
  }

  const showApprove = app.status === "pending" || app.status === "rejected";
  const showReject = app.status === "pending";
  const showLink = app.status === "pending" && !app.member_id;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="mb-4 rounded-md bg-[#E4E9D4] px-4 py-3 text-sm text-moss-600">
          {toast}
        </div>
      )}

      {/* Kicked-out warning */}
      {kickedOutWarning && (
        <div className="mb-4 rounded-md bg-[#F2D4CB] px-4 py-3 text-sm text-ember-600">
          <Link
            href={`/admin/members/${kickedOutWarning.memberId}`}
            className="font-medium underline text-ember-600"
          >
            {kickedOutWarning.name}
          </Link>{" "}
          was removed from Thunderview. Reinstate them from their member page
          before approving this application.
        </div>
      )}

      {/* Heading */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="tv-h2 !text-[36px]">
            {fullName}{" "}
            <span className="font-sans font-normal text-[22px] text-fg3">at {app.company_name}</span>
          </h1>
          <StatusPill status={app.status} />
          {app.member_id && (
            <Link
              href={`/admin/members/${app.member_id}`}
              className="text-sm text-clay-600 no-underline hover:underline inline-flex items-center gap-1"
            >
              View member <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_340px]">
        {/* Column One — application data */}
        <div>
          <div className="tv-eyebrow border-b border-line-100 pb-2 mb-3">Application</div>
          <div className="space-y-0">
            <DetailRow label="Received" value={`${formatDate(app.submitted_on, { month: "long", day: "numeric", year: "numeric" })}`} />
            <DetailRow label="Email" value={app.email} link={`mailto:${app.email}`} />
            <DetailRow label="LinkedIn" value={app.linkedin_profile} link={app.linkedin_profile} />
            <DetailRow label="Website" value={app.company_website} link={app.company_website?.startsWith("http") ? app.company_website : `https://${app.company_website}`} />
            <DetailRow label="Stage / Type" value={formatStageType(app.attendee_stagetype)} />
            {isActiveCEO && (
              <DetailRow label="Is startup CEO" value={app.i_am_my_startups_ceo || "N/A"} />
            )}
          </div>

          <div className="tv-eyebrow border-b border-line-100 pb-2 mb-3 mt-6">Demographics</div>
          <div className="space-y-0">
            <DetailRow label="Gender" value={app.gender} />
            <DetailRow label="Race" value={app.race} />
            <DetailRow label="Orientation" value={app.orientation} />
          </div>
        </div>

        {/* Column Two — actions */}
        <div>
          <Card>
            <div className="tv-eyebrow mb-3">Actions</div>
            <div className="flex flex-col gap-2">
              {showApprove && (
                <Button
                  onClick={handleApprove}
                  disabled={isPending || !!kickedOutWarning}
                  className="w-full justify-center"
                >
                  {isPending ? "Approving\u2026" : "Approve Application"}
                </Button>
              )}
              {showLink && (
                <Button variant="secondary" onClick={() => setShowLinkModal(true)} className="w-full justify-center">
                  Link To Existing Member
                </Button>
              )}
              {showReject && (
                <Button
                  variant="secondary"
                  onClick={() => setShowRejectModal(true)}
                  className="w-full justify-center !text-ember-600 !border-ember-600/30 hover:!bg-ember-600/[0.08]"
                >
                  Reject…
                </Button>
              )}
            </div>
            <p className="text-[12.5px] text-fg3 mt-4 leading-[1.5]">
              Approving creates a member record, grants community access, and sends the approval email template.
            </p>
          </Card>
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

// ── Detail Row ──

function DetailRow({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-2.5 border-b border-line-100">
      <span className="text-[13px] text-fg3">{label}</span>
      <span className="text-[14px] text-fg1">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-clay-600 underline decoration-line-200">
            {value}
          </a>
        ) : (
          value
        )}
      </span>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-cream-50 border border-line-200 p-6 shadow-lg">
        <h3 className="tv-h4 mb-4">Reject {name}</h3>

        <div className="space-y-3">
          <div>
            <Label>Rejection Reason</Label>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>

          {reason === "Other" && (
            <Input
              placeholder="Enter reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          )}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="!bg-ember-600 hover:!bg-ember-600/90"
            onClick={handleReject}
            disabled={isPending || (reason === "Other" && !customReason.trim())}
          >
            {isPending ? "Rejecting\u2026" : "Reject"}
          </Button>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-cream-50 border border-line-200 p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="tv-h4">Link To Existing Member</h3>
          <button onClick={onClose} className="text-fg4 cursor-pointer hover:text-fg2">
            <X size={18} />
          </button>
        </div>

        <Input
          placeholder="Search members by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
        />

        {searching && (
          <p className="mt-2 text-xs text-fg4">Searching...</p>
        )}

        {results.length > 0 && (
          <div className="mt-2 max-h-60 overflow-auto rounded-md border border-line-200">
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`flex w-full items-start gap-3 px-3 py-2 text-left cursor-pointer hover:bg-cream-100 ${
                  selected === m.id ? "bg-cream-200" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-fg1">{m.name}</div>
                  <div className="text-xs text-fg3">
                    {m.company_name || "\u2014"} &middot; {m.primary_email}
                  </div>
                </div>
                {selected === m.id && (
                  <span className="ml-auto text-xs text-clay-600">Selected</span>
                )}
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && !searching && results.length === 0 && (
          <p className="mt-2 text-xs text-fg4">No members found.</p>
        )}

        {error && (
          <p className="mt-2 rounded-md bg-[#F2D4CB] px-3 py-2 text-sm text-ember-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selected || isPending}>
            {isPending ? "Linking\u2026" : "Link & Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}
