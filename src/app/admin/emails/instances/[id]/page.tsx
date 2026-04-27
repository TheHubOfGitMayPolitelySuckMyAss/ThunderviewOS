import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateFriendly, formatName } from "@/lib/format";
import InstanceEditor from "./instance-editor";
import { getRecipientCount } from "./actions";

const TEMPLATE_LABELS: Record<string, string> = {
  "monday-before": "Monday Before",
  "monday-after": "Monday After",
};

export default async function InstancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: instance } = await admin
    .from("email_instances")
    .select("*, dinners!inner(date, venue, address)")
    .eq("id", id)
    .single();

  if (!instance) notFound();

  const dinner = instance.dinners as unknown as {
    date: string;
    venue: string;
    address: string;
  };

  // Get updater name
  let updatedByName: string | null = null;
  if (instance.updated_by) {
    const { data: updater } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", instance.updated_by)
      .single();
    if (updater) updatedByName = formatName(updater.first_name, updater.last_name);
  }

  // Get sender name
  let sentByName: string | null = null;
  if (instance.sent_by) {
    const { data: sender } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", instance.sent_by)
      .single();
    if (sender) sentByName = formatName(sender.first_name, sender.last_name);
  }

  const recipientCount = await getRecipientCount();
  const templateLabel = TEMPLATE_LABELS[instance.template_slug] ?? instance.template_slug;
  const dinnerDateDisplay = formatDateFriendly(dinner.date);

  return (
    <div>
      <Link
        href="/admin/emails"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        &larr; Emails
      </Link>

      <h2 className="tv-h2 !text-[36px] mb-6">
        {templateLabel} &mdash; {dinnerDateDisplay}
      </h2>

      <InstanceEditor
        instanceId={instance.id}
        templateSlug={instance.template_slug}
        initialSubject={instance.subject}
        initialBody={instance.body}
        initialStatus={instance.status as "draft" | "test_sent" | "sent"}
        recipientCount={recipientCount}
        sentAt={instance.sent_at}
        sentByName={sentByName}
        sentCount={instance.recipient_count}
        lastUpdatedAt={instance.updated_by ? instance.updated_at : null}
        lastUpdatedByName={updatedByName}
      />
    </div>
  );
}
