import Link from "next/link";
import { Eyebrow } from "@/components/ui/typography";

const marketingEmails = [
  {
    href: "/admin/emails/monday-before",
    label: "Monday Before",
    description: "Reminder email, sent the Monday before a dinner",
  },
  {
    href: "/admin/emails/monday-after",
    label: "Monday After",
    description: "Recap email, sent the Monday after a dinner",
  },
];

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

export default function EmailsPage() {
  return (
    <div className="tv-container-admin">
      <h1 className="tv-h2 !text-[36px] mb-6">Emails</h1>

      {/* Marketing */}
      <section className="mb-10">
        <Eyebrow className="mb-3 pb-2.5 border-b border-border-subtle">Marketing</Eyebrow>
        <div className="space-y-4">
          {marketingEmails.map((email) => (
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

      {/* Transactional */}
      <section>
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
    </div>
  );
}
