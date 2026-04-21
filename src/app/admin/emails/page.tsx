import Link from "next/link";

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
      "New member approved — \"you're in, buy a ticket\"",
  },
  {
    href: "/admin/emails/re-application",
    label: "Re-application",
    description:
      "Application linked to existing member — \"you're already in, just buy a ticket next time\"",
  },
  {
    href: "/admin/emails/rejection",
    label: "Rejection",
    description: "Application rejected",
  },
  {
    href: "/admin/emails/fulfillment",
    label: "Fulfillment",
    description: "Ticket transitions to fulfilled — dinner details email",
  },
  {
    href: "/admin/emails/refund-confirmation",
    label: "Refund Confirmation",
    description: "Successful Stripe refund",
  },
];

export default function EmailsPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Emails</h2>

      {/* Marketing */}
      <section className="mb-10">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">Marketing</h3>
        <div className="space-y-4">
          {marketingEmails.map((email) => (
            <div key={email.href}>
              <Link
                href={email.href}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                {email.label}
              </Link>
              <p className="mt-0.5 text-sm text-gray-500">
                {email.description}
              </p>
              {/* Space reserved for per-month customized email list */}
              <div className="mt-2" />
            </div>
          ))}
        </div>
      </section>

      {/* Transactional */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          Transactional
        </h3>
        <div className="space-y-4">
          {transactionalEmails.map((email) => (
            <div key={email.href}>
              <Link
                href={email.href}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                {email.label}
              </Link>
              <p className="mt-0.5 text-sm text-gray-500">
                {email.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
