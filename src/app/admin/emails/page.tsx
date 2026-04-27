import Link from "next/link";
import { Eyebrow } from "@/components/ui/typography";
import { Pill } from "@/components/ui/pill";
import PageHeader from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateFriendly, getTodayMT } from "@/lib/format";
import CreateInstanceButton from "./create-instance-button";

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

type MarketingTemplate = {
  slug: string;
  label: string;
  description: string;
  targetDinnerQuery: "next" | "last";
};

const marketingTemplates: MarketingTemplate[] = [
  {
    slug: "monday-before",
    label: "Monday Before",
    description: "Reminder email, sent the Monday before a dinner",
    targetDinnerQuery: "next",
  },
  {
    slug: "monday-after",
    label: "Monday After",
    description: "Recap email, sent the Monday after a dinner",
    targetDinnerQuery: "last",
  },
];

export default async function EmailsPage() {
  const admin = createAdminClient();
  const todayMT = getTodayMT();

  // Fetch target dinners for marketing templates
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

  // Fetch existing instances for target dinners
  const dinnerIds = [nextDinner?.id, lastDinner?.id].filter(Boolean) as string[];
  let instances: { id: string; template_slug: string; dinner_id: string; status: string }[] = [];
  if (dinnerIds.length > 0) {
    const { data } = await admin
      .from("email_instances")
      .select("id, template_slug, dinner_id, status")
      .in("dinner_id", dinnerIds);
    instances = data ?? [];
  }

  function getTargetDinner(query: "next" | "last") {
    return query === "next" ? nextDinner : lastDinner;
  }

  function getInstance(slug: string, dinnerId: string | undefined) {
    if (!dinnerId) return null;
    return instances.find((i) => i.template_slug === slug && i.dinner_id === dinnerId) ?? null;
  }

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
          {marketingTemplates.map((tmpl) => {
            const dinner = getTargetDinner(tmpl.targetDinnerQuery);
            const instance = getInstance(tmpl.slug, dinner?.id);
            const dinnerLabel = dinner ? formatDateFriendly(dinner.date) : null;

            return (
              <div key={tmpl.slug}>
                <Link
                  href={`/admin/emails/${tmpl.slug}`}
                  className="text-sm font-medium text-accent-hover no-underline hover:underline"
                >
                  {tmpl.label}
                </Link>
                <p className="mt-0.5 text-sm text-fg3">
                  {tmpl.description}
                </p>

                <div className="mt-2">
                  {!dinner ? (
                    <span className="text-xs text-fg3 italic">
                      {tmpl.targetDinnerQuery === "next"
                        ? "No upcoming dinner"
                        : "No past dinner"}
                    </span>
                  ) : !instance ? (
                    <CreateInstanceButton
                      templateSlug={tmpl.slug}
                      dinnerId={dinner.id}
                      dinnerLabel={dinnerLabel!}
                    />
                  ) : instance.status === "sent" ? (
                    <Link
                      href={`/admin/emails/instances/${instance.id}`}
                      className="inline-flex items-center gap-2 text-sm text-fg3 no-underline hover:underline"
                    >
                      <Pill variant="success">Sent</Pill>
                      {dinnerLabel}
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/emails/instances/${instance.id}`}
                      className="inline-flex items-center gap-2 text-sm text-accent-hover no-underline hover:underline"
                    >
                      <Pill variant="warn">Draft</Pill>
                      Edit &mdash; {dinnerLabel}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
