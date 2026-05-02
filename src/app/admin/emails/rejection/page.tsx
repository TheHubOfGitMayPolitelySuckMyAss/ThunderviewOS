import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import RejectionEditor from "./template-editor";

export default async function RejectionTemplatePage() {
  const admin = createAdminClient("read-only");

  const { data: template } = await admin
    .from("email_templates")
    .select("*")
    .eq("slug", "rejection")
    .single();

  if (!template) {
    return <p className="text-red-600">Template not found in database.</p>;
  }

  let updatedByName: string | null = null;
  if (template.updated_by) {
    const { data: updater } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", template.updated_by)
      .single();
    if (updater) {
      updatedByName = formatName(updater.first_name, updater.last_name);
    }
  }

  return (
    <div>
      <Link
        href="/admin/emails"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        &larr; Emails
      </Link>

      <h2 className="tv-h2 !text-[36px] mb-6">
        Rejection Email Template
      </h2>

      <RejectionEditor
        slug="rejection"
        initialSubject={template.subject}
        initialBody={template.body}
        lastUpdatedAt={template.updated_by ? template.updated_at : null}
        lastUpdatedByName={updatedByName}
      />
    </div>
  );
}
