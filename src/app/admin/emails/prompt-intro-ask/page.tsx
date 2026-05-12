import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import PromptIntroAskEditor from "./template-editor";

export default async function PromptIntroAskTemplatePage() {
  const admin = createAdminClient("read-only");

  const { data: templates } = await admin
    .from("email_templates")
    .select("*")
    .in("slug", ["prompt-intro-ask-missing", "prompt-intro-ask-stale"]);

  const missing = templates?.find((t) => t.slug === "prompt-intro-ask-missing");
  const stale = templates?.find((t) => t.slug === "prompt-intro-ask-stale");

  if (!missing || !stale) {
    return <p className="text-red-600">Template rows not found in database.</p>;
  }

  const updaterIds = Array.from(
    new Set([missing.updated_by, stale.updated_by].filter(Boolean) as string[])
  );
  const updaterNames: Record<string, string> = {};
  if (updaterIds.length > 0) {
    const { data: updaters } = await admin
      .from("members")
      .select("id, first_name, last_name")
      .in("id", updaterIds);
    for (const u of updaters ?? []) {
      updaterNames[u.id as string] = formatName(u.first_name, u.last_name);
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

      <h2 className="tv-h2 !text-[36px] mb-2">Prompt for Intro/Ask</h2>
      <p className="text-fg3 text-[14px] mb-8 max-w-2xl leading-relaxed">
        Sent Tuesday morning, 2 days before a dinner, to anyone who has a ticket for that
        dinner AND falls into one of the two situations below. Cron resolves which block
        fires per recipient. One person gets one of the two — never both.
      </p>

      <h3 className="tv-h4 mb-1">Block 1 — Missing Intro and Ask</h3>
      <p className="text-fg3 text-[13px] mb-4 max-w-2xl">
        Fires when both <code className="text-xs">current_intro</code> AND{" "}
        <code className="text-xs">current_ask</code> are empty. Give field is ignored.
      </p>
      <PromptIntroAskEditor
        slug="prompt-intro-ask-missing"
        initialSubject={missing.subject}
        initialBody={missing.body}
        lastUpdatedAt={missing.updated_by ? missing.updated_at : null}
        lastUpdatedByName={
          missing.updated_by ? updaterNames[missing.updated_by] ?? null : null
        }
      />

      <div className="border-t border-border my-10" />

      <h3 className="tv-h4 mb-1">Block 2 — Stale Ask</h3>
      <p className="text-fg3 text-[13px] mb-4 max-w-2xl">
        Fires when both intro and ask are filled, but{" "}
        <code className="text-xs">ask_updated_at &le; last_dinner_attended</code> — i.e.
        the member hasn&rsquo;t refreshed their Ask since the last dinner they attended.
        Same definition as the portal home prefill rule.
      </p>
      <PromptIntroAskEditor
        slug="prompt-intro-ask-stale"
        initialSubject={stale.subject}
        initialBody={stale.body}
        lastUpdatedAt={stale.updated_by ? stale.updated_at : null}
        lastUpdatedByName={
          stale.updated_by ? updaterNames[stale.updated_by] ?? null : null
        }
      />
    </div>
  );
}
