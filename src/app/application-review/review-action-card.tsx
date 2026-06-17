"use client";

import { useState, useTransition } from "react";
import { Button, Textarea } from "@/components/ui";
import type { ApplicationAction } from "@/lib/application-action-token";
import { submitApplicationReview, type ReviewResult } from "./actions";

type Props = {
  token: string;
  action: ApplicationAction;
  applicantName: string;
  companyName: string | null;
  email: string;
  companyWebsite: string | null;
  linkedinProfile: string | null;
  attendeeStagetype: string | null;
  adminUrl: string;
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-[14px]">
      <span className="w-24 shrink-0 text-fg3">{label}</span>
      <span className="text-fg1 break-words min-w-0">{children}</span>
    </div>
  );
}

export default function ReviewActionCard(props: Props) {
  const { token, action, applicantName, companyName, email } = props;
  const isApprove = action === "approve";

  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const r = await submitApplicationReview(token, reason);
      setResult(r);
    });
  }

  if (result?.ok) {
    return (
      <div className="text-center">
        <h1 className="tv-h2 mb-4">{isApprove ? "Approved" : "Rejected"}</h1>
        <p className="text-fg2 leading-relaxed">{result.message}</p>
        <p className="mt-5">
          <a href={props.adminUrl} className="text-accent-hover underline">
            View in admin
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="tv-h2 mb-1">
        {isApprove ? "Approve application?" : "Reject application?"}
      </h1>
      <p className="text-fg2 mb-6">
        {isApprove
          ? "This adds them as a member and sends the approval email."
          : "This sends the rejection email and keeps them on the suppression list."}
      </p>

      <div className="border border-border rounded-lg bg-bg-tinted/40 px-4 py-3 mb-6">
        <div className="tv-h4 mb-1">{applicantName}</div>
        {companyName ? <div className="text-fg2 text-[14px] mb-2">{companyName}</div> : null}
        <DetailRow label="Email">{email}</DetailRow>
        {props.attendeeStagetype ? (
          <DetailRow label="Type">{props.attendeeStagetype}</DetailRow>
        ) : null}
        {props.companyWebsite ? (
          <DetailRow label="Website">
            <a href={props.companyWebsite} className="text-accent-hover underline" target="_blank" rel="noreferrer">
              {props.companyWebsite}
            </a>
          </DetailRow>
        ) : null}
        {props.linkedinProfile ? (
          <DetailRow label="LinkedIn">
            <a href={props.linkedinProfile} className="text-accent-hover underline" target="_blank" rel="noreferrer">
              {props.linkedinProfile}
            </a>
          </DetailRow>
        ) : null}
      </div>

      {!isApprove ? (
        <div className="mb-5">
          <label className="block text-[14px] text-fg2 mb-1.5">
            Rejection reason
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Shared internally; not sent to the applicant."
            error={result?.outcome === "missing_reason"}
          />
        </div>
      ) : null}

      {result && !result.ok ? (
        <p className="text-ember-600 text-[14px] mb-4">{result.message}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={pending || (!isApprove && reason.trim().length === 0)}
        >
          {pending
            ? "Working…"
            : isApprove
            ? "Confirm approval"
            : "Confirm rejection"}
        </Button>
        <a href={props.adminUrl} className="text-fg3 text-[14px] underline">
          Open full application
        </a>
      </div>
    </div>
  );
}
