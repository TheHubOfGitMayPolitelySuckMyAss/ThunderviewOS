/**
 * Prompt B end-to-end acceptance test.
 *
 * Exercises the full Streak ↔ OS sync chain against PRODUCTION DATA, with
 * full cleanup at the end. Run from local terminal:
 *
 *   npx tsx --env-file=.env.local tmp/streak-prompt-b-e2e.ts
 *
 * Steps:
 *   1. Insert a synthetic pending application (test email).
 *   2. pushApplicationToStreak — Applied box appears in Streak.
 *   3. Verify box exists with stage=Applied and the right name.
 *   4. Call approve_application RPC — member created.
 *   5. Run the housekeeping migration the server action does — copy app's
 *      box_key onto member, null app's box_key.
 *   6. pushMemberToStreak — box updates to Approved stage with member fields.
 *   7. Curl POST /api/webhooks/streak/not-this-one with the box_key — verify
 *      member.excluded_from_dinner_id flips to next dinner id.
 *   8. Curl POST /api/webhooks/streak/opted-out with the box_key — verify
 *      member.marketing_opted_in flips to false.
 *   9. Cleanup: delete Streak box, delete member_emails, member, application.
 *
 * Exits non-zero on any failure. Always tries to clean up even on partial
 * failure so we don't leave test rows or orphan Streak boxes around.
 */

import { createClient } from "@supabase/supabase-js";
import {
  pushApplicationToStreak,
  pushMemberToStreak,
  deleteMemberBox,
} from "../src/lib/streak/push";
import { getBox } from "../src/lib/streak/client";

const PROD_URL = "https://thunderview-os.vercel.app";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function main() {
  const sb = admin();
  const stamp = Date.now();
  const testEmail = `streak-e2e-${stamp}@example.com`;
  const testFirst = "Streak";
  const testLast = `Test-${stamp}`;

  let applicationId: string | null = null;
  let memberId: string | null = null;
  let boxKey: string | null = null;

  try {
    // --- 1. Insert pending application ---
    console.log(`\n[1] Inserting pending application (email=${testEmail})…`);
    const ins = await sb
      .from("applications")
      .insert({
        first_name: testFirst,
        last_name: testLast,
        email: testEmail,
        linkedin_profile: "",
        gender: "Prefer not to say",
        race: "Prefer not to say",
        orientation: "Prefer not to say",
        company_name: "Streak E2E Co",
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
    if (ins.error || !ins.data)
      throw new Error(`application insert failed: ${ins.error?.message}`);
    applicationId = ins.data.id as string;
    console.log(`    application_id=${applicationId}`);

    // --- 2. Push application → Applied box ---
    console.log(`\n[2] pushApplicationToStreak…`);
    await pushApplicationToStreak(applicationId);
    const appRow = await sb
      .from("applications")
      .select("streak_box_key")
      .eq("id", applicationId)
      .single();
    boxKey = appRow.data?.streak_box_key as string | null;
    if (!boxKey) throw new Error("streak_box_key not persisted on application");
    console.log(`    box_key=${boxKey.slice(0, 24)}…`);

    // --- 3. Verify box exists with stage=Applied + correct name ---
    console.log(`\n[3] Fetching box from Streak…`);
    const box1 = (await getBox(boxKey)) as {
      name: string;
      stageKey: string;
    };
    console.log(`    name=${box1.name} stageKey=${box1.stageKey}`);
    if (box1.name !== `${testFirst} ${testLast}`)
      throw new Error(`unexpected box name: ${box1.name}`);
    if (box1.stageKey !== "5001")
      throw new Error(`expected stage=5001 (Applied), got ${box1.stageKey}`);

    // --- 4. Approve application via RPC ---
    console.log(`\n[4] approve_application RPC…`);
    const approve = await sb.rpc("approve_application", {
      p_application_id: applicationId,
    });
    if (approve.error)
      throw new Error(`approve_application failed: ${approve.error.message}`);
    const approveResult = approve.data as {
      member_id: string;
      is_existing: boolean;
      is_kicked_out: boolean;
    };
    memberId = approveResult.member_id;
    console.log(
      `    member_id=${memberId} is_existing=${approveResult.is_existing}`
    );

    // --- 5. Housekeeping migration (mirrors server action) ---
    console.log(`\n[5] Box-key migration: app → member…`);
    const memberRow = await sb
      .from("members")
      .select("streak_box_key")
      .eq("id", memberId!)
      .single();
    if (memberRow.data?.streak_box_key) {
      // Existing member already had a box — orphan-delete the app box.
      // For our brand-new approval this branch shouldn't fire.
      console.log(
        `    member already has box ${(memberRow.data.streak_box_key as string).slice(0, 24)}… (orphan path)`
      );
    } else {
      const upMember = await sb
        .from("members")
        .update({ streak_box_key: boxKey })
        .eq("id", memberId!);
      if (upMember.error)
        throw new Error(`member box-key migrate failed: ${upMember.error.message}`);
      const upApp = await sb
        .from("applications")
        .update({ streak_box_key: null })
        .eq("id", applicationId!);
      if (upApp.error)
        throw new Error(`application box-key null failed: ${upApp.error.message}`);
      console.log(`    migrated`);
    }

    // --- 6. Push member → Approved (or higher precedence) ---
    console.log(`\n[6] pushMemberToStreak…`);
    await pushMemberToStreak(memberId!);
    const box2 = (await getBox(boxKey!)) as { name: string; stageKey: string };
    console.log(`    name=${box2.name} stageKey=${box2.stageKey}`);
    // Expect 5002 (Approved). If a future precedence rule moves them higher
    // (e.g., they had email_status=bounced because Streak retains data) the
    // test would surface it — flag rather than swallow.
    if (box2.stageKey !== "5002")
      throw new Error(
        `expected stage=5002 (Approved) after push, got ${box2.stageKey}`
      );

    // --- 7. Webhook: Not This One ---
    console.log(`\n[7] POST /api/webhooks/streak/not-this-one…`);
    const ntoSecret = process.env.STREAK_WEBHOOK_SECRET!;
    const ntoRes = await fetch(
      `${PROD_URL}/api/webhooks/streak/not-this-one?secret=${ntoSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ box_key: boxKey }),
      }
    );
    console.log(`    status=${ntoRes.status} body=${(await ntoRes.text()).slice(0, 200)}`);
    if (ntoRes.status !== 200)
      throw new Error(`NTO webhook returned ${ntoRes.status}`);
    // Verify member.excluded_from_dinner_id is set
    const memberAfterNto = await sb
      .from("members")
      .select("excluded_from_dinner_id")
      .eq("id", memberId!)
      .single();
    if (!memberAfterNto.data?.excluded_from_dinner_id)
      throw new Error("excluded_from_dinner_id not set after NTO webhook");
    console.log(
      `    excluded_from_dinner_id=${memberAfterNto.data.excluded_from_dinner_id}`
    );

    // --- 8. Webhook: Opted Out ---
    console.log(`\n[8] POST /api/webhooks/streak/opted-out…`);
    const ooRes = await fetch(
      `${PROD_URL}/api/webhooks/streak/opted-out?secret=${ntoSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ box_key: boxKey }),
      }
    );
    console.log(`    status=${ooRes.status} body=${(await ooRes.text()).slice(0, 200)}`);
    if (ooRes.status !== 200)
      throw new Error(`Opted-Out webhook returned ${ooRes.status}`);
    const memberAfterOO = await sb
      .from("members")
      .select("marketing_opted_in")
      .eq("id", memberId!)
      .single();
    if (memberAfterOO.data?.marketing_opted_in !== false)
      throw new Error(
        `expected marketing_opted_in=false after opted-out webhook, got ${memberAfterOO.data?.marketing_opted_in}`
      );
    console.log(`    marketing_opted_in=false ✓`);

    console.log(`\n=== ALL ACCEPTANCE STEPS PASSED ===`);
  } catch (err) {
    console.error(`\n[FAIL]`, err);
    process.exitCode = 1;
  } finally {
    // Cleanup: delete Streak box, member_emails, member, application.
    console.log(`\n[cleanup]…`);
    try {
      if (memberId && boxKey) {
        await deleteMemberBox(memberId);
        console.log(`    Streak box deleted`);
      }
    } catch (e) {
      console.error(`    Streak box delete failed:`, e);
    }
    try {
      const sb = admin();
      // Order matters — applications and system_events both reference members
      // by FK. Delete applications first, NULL out system_events references,
      // then delete the member (member_emails cascades).
      if (applicationId) {
        const r = await sb.from("applications").delete().eq("id", applicationId);
        if (r.error) console.error(`    applications delete:`, r.error.message);
      }
      if (memberId) {
        const a = await sb.from("member_emails").delete().eq("member_id", memberId);
        if (a.error) console.error(`    member_emails delete:`, a.error.message);
        await sb
          .from("system_events")
          .update({ subject_member_id: null })
          .eq("subject_member_id", memberId);
        await sb
          .from("system_events")
          .update({ actor_id: null })
          .eq("actor_id", memberId);
        const m = await sb.from("members").delete().eq("id", memberId);
        if (m.error) console.error(`    members delete:`, m.error.message);
      }
      console.log(`    DB cleanup done`);
    } catch (e) {
      console.error(`    DB cleanup error:`, e);
    }
  }
}

main();
