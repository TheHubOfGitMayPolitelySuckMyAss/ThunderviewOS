import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import ReApplicationEditor from "./template-editor";

export default async function ReApplicationTemplatePage() {
  const admin = createAdminClient();

  const { data: template } = await admin
    .from("email_templates")
    .select("*")
    .eq("slug", "re-application")
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
        Re-application Email Template
      </h2>

      <ReApplicationEditor
        slug="re-application"
        initialSubject={template.subject}
        initialBody={template.body}
        lastUpdatedAt={template.updated_by ? template.updated_at : null}
        lastUpdatedByName={updatedByName}
      />
    </div>
  );
}
