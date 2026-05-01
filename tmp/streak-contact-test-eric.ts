/**
 * Single-user test for the Prompt D Contacts wiring.
 *
 *   npx tsx --env-file=.env.local tmp/streak-contact-test-eric.ts <member_id>
 *
 * 1. Pushes the member to Streak (which now also creates+attaches a Contact).
 * 2. Fetches the resulting box and prints the JSON, with attention to whichever
 *    field carries the linked contacts.
 * 3. Reports which `linkedContactKeys`-or-equivalent field name the client
 *    discovered worked, so we can document it in CLAUDE.md.
 *
 * Eric runs this on his own member ID and verifies in the Streak UI that
 * (a) the box's Contacts section shows his email, (b) the mail-merge UI lets
 * him target that contact. If either fails, surface before bulk run.
 */

import { pushMemberToStreak } from "../src/lib/streak/push";
import { getBox } from "../src/lib/streak/client";
import { ensureStreakReady, resetStreakCache } from "../src/lib/streak/bootstrap";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const memberId = process.argv[2];
  if (!memberId) {
    console.error("usage: tsx tmp/streak-contact-test-eric.ts <member_id>");
    process.exit(2);
  }

  resetStreakCache();
  console.log("[1] ensureStreakReady…");
  const ready = await ensureStreakReady();
  console.log(`    pipelineKey=${ready.pipelineKey}`);
  console.log(`    teamKey=${ready.teamKey}`);

  console.log(`\n[2] pushMemberToStreak(${memberId})…`);
  await pushMemberToStreak(memberId);
  console.log(`    ok`);

  // Look up the box key from Supabase
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: row, error } = await sb
    .from("members")
    .select("streak_box_key, first_name, last_name")
    .eq("id", memberId)
    .single();
  if (error || !row?.streak_box_key) {
    console.error(
      `Could not read streak_box_key for member ${memberId}:`,
      error?.message ?? "no row"
    );
    process.exit(1);
  }
  console.log(
    `\n[3] member: ${row.first_name} ${row.last_name}, box=${(row.streak_box_key as string).slice(0, 32)}…`
  );

  console.log(`\n[4] Fetching box JSON…`);
  const box = (await getBox(row.streak_box_key as string)) as Record<string, unknown>;

  // Pick out fields likely to carry contact links so they're easy to spot.
  const interesting = [
    "boxKey",
    "name",
    "stageKey",
    "contacts",
    "linkedBoxKeys",
    "fields",
  ];
  const summary: Record<string, unknown> = {};
  for (const k of interesting) {
    if (k in box) summary[k] = box[k];
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
