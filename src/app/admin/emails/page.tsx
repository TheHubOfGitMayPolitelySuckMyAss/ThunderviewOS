import Link from "next/link";
import { Eyebrow } from "@/components/ui/typography";
import { Pill } from "@/components/ui/pill";
import PageHeader from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateFriendly, getTodayMT } from "@/lib/format";
import CreateInstanceButton from "./create-instance-button";
import CreateMondayBeforeButton from "./create-monday-before-button";

const transactionalEmails = [
  {
    href: "/admin/emails/approval",
    label: "Approval",
    description:
      "New member approved \u2014 \"you\u2019re in, buy a ticket\"",
  },
  {
    href: "/admin/emails/re-application",
    label: "Re-application",
    description:
      "Application linked to existing member \u2014 \"you\u2019re already in, just buy a ticket next time\"",
  },
  {
    href: "/admin/emails/rejection",
    label: "Rejection",
    description: "Application rejected",
  },
  {
    href: "/admin/emails/fulfillment",
    label: "Fulfillment",
    description: "Ticket transitions to fulfilled \u2014 dinner details email",
  },
  {
    href: "/admin/emails/morning-of",
    label: "Morning Of",
    description:
      "Morning-of-dinner email \u2014 intros & asks for tonight\u2019s attendees only",
  },
];

export default async function EmailsPage() {
  const admin = createAdminClient();
  const todayMT = getTodayMT();

  // Fetch target dinners
  const { data: nextDinner } = await admin
    .from("dinners")
    .select("id, date")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  const { data: lastDinner } = await admin
    .from("dinners")
    .select("id, date")
    .lt("date", todayMT)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  // Monday Before: check monday_before_emails for the next dinner
  let mondayBeforeEmail: { id: string; status: string } | null = null;
  if (nextDinner) {
    const { data } = await admin
      .from("monday_before_emails")
      .select("id, status")
      .eq("dinner_id", nextDinner.id)
      .single();
    mondayBeforeEmail = data;
  }

  // Monday After: still uses generic email_instances (for now)
  let mondayAfterInstance: { id: string; status: string } | null = null;
  if (lastDinner) {
    const { data } = await admin
      .from("email_instances")
      .select("id, status")
      .eq("template_slug", "monday-after")
      .eq("dinner_id", lastDinner.id)
      .single();
    mondayAfterInstance = data;
  }

  const nextDinnerLabel = nextDinner ? formatDateFriendly(nextDinner.date) : null;
  const lastDinnerLabel = lastDinner ? formatDateFriendly(lastDinner.date) : null;

  return (
    <div className="max-w-[720px]">
      <PageHeader title="Emails" size="compact" />

      {/* Transactional */}
      <section className="mb-7">
        <Eyebrow className="mb-3 pb-2.5 border-b border-border-subtle">Transactional</Eyebrow>
        <div className="space-y-4">
          {transactionalEmails.map((email) => (
            <div key={email.href}>
              <Link
                href={email.href}
                className="text-sm font-medium text-accent-hover no-underline hover:underline"
              >
                {email.label}
              </Link>
              <p className="mt-0.5 text-sm text-fg3">
                {email.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Marketing */}
      <section>
        <Eyebrow className="mb-3 pb-2.5 border-b border-border-subtle">Marketing</Eyebrow>
        <div className="space-y-5">

          {/* Monday Before */}
          <div>
            <Link
              href="/admin/emails/monday-before"
              className="text-sm font-medium text-accent-hover no-underline hover:underline"
            >
              Monday Before
            </Link>
            <p className="mt-0.5 text-sm text-fg3">
              Reminder email, sent the Monday before a dinner
            </p>
            <div className="mt-2">
              {!nextDinner ? (
                <span className="text-xs text-fg3 italic">No upcoming dinner</span>
              ) : !mondayBeforeEmail ? (
                <CreateMondayBeforeButton
                  dinnerId={nextDinner.id}
                  dinnerLabel={nextDinnerLabel!}
                />
              ) : mondayBeforeEmail.status === "sent" ? (
                <Link
                  href={`/admin/emails/monday-before/${mondayBeforeEmail.id}`}
                  className="inline-flex items-center gap-2 text-sm text-fg3 no-underline hover:underline"
                >
                  <Pill variant="success">Sent</Pill>
                  {nextDinnerLabel}
                </Link>
              ) : (
                <Link
                  href={`/admin/emails/monday-before/${mondayBeforeEmail.id}`}
                  className="inline-flex items-center gap-2 text-sm text-accent-hover no-underline hover:underline"
                >
                  <Pill variant="warn">Draft</Pill>
                  Continue draft &mdash; {nextDinnerLabel}
                </Link>
              )}
            </div>
          </div>

          {/* Monday After (still uses generic email_instances) */}
          <div>
            <Link
              href="/admin/emails/monday-after"
              className="text-sm font-medium text-accent-hover no-underline hover:underline"
            >
              Monday After
            </Link>
            <p className="mt-0.5 text-sm text-fg3">
              Recap email, sent the Monday after a dinner
            </p>
            <div className="mt-2">
              {!lastDinner ? (
                <span className="text-xs text-fg3 italic">No past dinner</span>
              ) : !mondayAfterInstance ? (
                <CreateInstanceButton
                  templateSlug="monday-after"
                  dinnerId={lastDinner.id}
                  dinnerLabel={lastDinnerLabel!}
                />
              ) : mondayAfterInstance.status === "sent" ? (
                <Link
                  href={`/admin/emails/instances/${mondayAfterInstance.id}`}
                  className="inline-flex items-center gap-2 text-sm text-fg3 no-underline hover:underline"
                >
                  <Pill variant="success">Sent</Pill>
                  {lastDinnerLabel}
                </Link>
              ) : (
                <Link
                  href={`/admin/emails/instances/${mondayAfterInstance.id}`}
                  className="inline-flex items-center gap-2 text-sm text-accent-hover no-underline hover:underline"
                >
                  <Pill variant="warn">Draft</Pill>
                  Edit &mdash; {lastDinnerLabel}
                </Link>
              )}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
