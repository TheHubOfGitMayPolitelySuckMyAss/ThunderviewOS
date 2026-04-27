import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import MacroEditor from "./macro-editor";

export default async function MondayAfterMacroPage() {
  const admin = createAdminClient();

  const { data: macro } = await admin
    .from("monday_after_macro")
    .select("*")
    .limit(1)
    .single();

  if (!macro) {
    return <p className="text-ember-600">Macro template not found in database.</p>;
  }

  let updatedByName: string | null = null;
  if (macro.updated_by) {
    const { data: updater } = await admin
      .from("members")
      .select("first_name, last_name")
      .eq("id", macro.updated_by)
      .single();
    if (updater) updatedByName = formatName(updater.first_name, updater.last_name);
  }

  return (
    <div>
      <Link
        href="/admin/emails"
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        &larr; Emails
      </Link>

      <h2 className="tv-h2 !text-[36px] mb-2">
        Monday After Template
      </h2>
      <p className="text-sm text-fg3 mb-6">
        Default content for new Monday After email drafts. Changes here will seed future drafts — they won&rsquo;t affect existing ones.
      </p>

      <MacroEditor
        initialSubject={macro.subject}
        initialPreheader={macro.preheader}
        initialHeadline={macro.headline}
        initialOpeningText={macro.opening_text}
        initialRecapText={macro.recap_text}
        initialTeamShoutouts={macro.team_shoutouts}
        initialOurMission={macro.our_mission}
        initialIntrosAsksHeader={macro.intros_asks_header}
        initialPartnershipBoilerplate={macro.partnership_boilerplate}
        lastUpdatedAt={macro.updated_by ? macro.updated_at : null}
        lastUpdatedByName={updatedByName}
      />
    </div>
  );
}
