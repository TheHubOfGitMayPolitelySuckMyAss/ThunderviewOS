/**
 * Forward-sync verification: create a synthetic pending application, push it
 * through pushApplicationToStreak (now extended with the contact step), verify
 * the resulting Streak box has stage=Applied + a contact attached, then clean
 * up everything.
 *
 *   npx tsx --env-file=.env.local tmp/streak-contact-test-app.ts
 *
 * Mirrors the application code path used by `/apply` form submission: same
 * import, same primitive. If this passes, the production /apply route will
 * also produce a contact-attached box on the next real submission post-deploy.
 */

import { createClient } from "@supabase/supabase-js";
import {
  deleteApplicationBox,
  pushApplicationToStreak,
} from "../src/lib/streak/push";
import { getBox } from "../src/lib/streak/client";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const stamp = Date.now();
  const email = `streak-d-app-${stamp}@example.com`;
  const first = "PromptD";
  const last = `App-${stamp}`;

  let applicationId: string | null = null;

  try {
    console.log(`[1] inserting pending application (email=${email})…`);
    const ins = await sb
      .from("applications")
      .insert({
        first_name: first,
        last_name: last,
        email,
        linkedin_profile: "",
        gender: "Prefer not to say",
        race: "Prefer not to say",
        orientation: "Prefer not to say",
        company_name: "Prompt D Co",
        company_website: "",
        attendee_stagetype: "Active CEO (Bootstrapping or VC-Backed)",
        i_am_my_startups_ceo: "Yes",
        my_startup_is_not_a_services_business: "Yes",
        status: "pending",
        submitted_on: new Date().toISOString(),
        member_id: null,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) throw new Error(`insert: ${ins.error?.message}`);
    applicationId = ins.data.id as string;
    console.log(`    application_id=${applicationId}`);

    console.log(`\n[2] pushApplicationToStreak…`);
    await pushApplicationToStreak(applicationId);

    const row = await sb
      .from("applications")
      .select("streak_box_key")
      .eq("id", applicationId)
      .single();
    const boxKey = row.data?.streak_box_key as string | null;
    if (!boxKey) throw new Error("streak_box_key not persisted");
    console.log(`    box_key=${boxKey.slice(0, 32)}…`);

    console.log(`\n[3] fetching box JSON…`);
    const box = (await getBox(boxKey)) as Record<string, unknown>;
    const summary = {
      name: box.name,
      stageKey: box.stageKey,
      contacts: box.contacts,
      fields: box.fields,
    };
    console.log(JSON.stringify(summary, null, 2));

    if (box.stageKey !== "5001")
      throw new Error(`expected stageKey=5001 (Applied), got ${box.stageKey}`);
    const contacts = box.contacts as Array<{ key: string }> | undefined;
    if (!contacts || contacts.length === 0)
      throw new Error("box has no contacts attached");

    console.log(`\n=== PASS ===`);
  } catch (err) {
    console.error(`\nFAIL:`, err);
    process.exitCode = 1;
  } finally {
    console.log(`\n[cleanup]…`);
    try {
      if (applicationId) {
        await deleteApplicationBox(applicationId);
        console.log(`    Streak box deleted`);
        const r = await sb.from("applications").delete().eq("id", applicationId);
        if (r.error) console.error(`    application delete:`, r.error.message);
        else console.log(`    application row deleted`);
      }
    } catch (e) {
      console.error(`    cleanup failed:`, e);
    }
  }
}

main().catch((err) => {
  console.error("threw:", err);
  process.exitCode = 1;
});
