/**
 * One-off: push every is_team=true member to Streak so their boxes move to
 * the new Team stage. After the precedence change in compute-stage.ts adds
 * is_team as top-precedence, a normal pushMemberToStreak call is enough —
 * computeStageForMember returns 'team' and updateBox flips the stage.
 *
 *   npx tsx --env-file=.env.local tmp/streak-push-team.ts
 */

import { createClient } from "@supabase/supabase-js";
import { pushMemberToStreak } from "../src/lib/streak/push";
import { resetStreakCache } from "../src/lib/streak/bootstrap";

async function main() {
  resetStreakCache();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const res = await sb
    .from("members")
    .select("id, first_name, last_name")
    .eq("is_team", true)
    .order("first_name");
  if (res.error) throw new Error(`SELECT failed: ${res.error.message}`);
  const team = (res.data ?? []) as { id: string; first_name: string; last_name: string }[];

  console.log(`Pushing ${team.length} team members to Streak…\n`);
  let ok = 0;
  const failed: { id: string; name: string; error: string }[] = [];
  for (const m of team) {
    try {
      await pushMemberToStreak(m.id);
      ok++;
      console.log(`  ok    ${m.first_name} ${m.last_name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ id: m.id, name: `${m.first_name} ${m.last_name}`, error: msg });
      console.log(`  FAIL  ${m.first_name} ${m.last_name} — ${msg.slice(0, 200)}`);
    }
  }
  console.log(`\n${ok}/${team.length} pushed`);
  if (failed.length > 0) {
    console.log(`Failed:`);
    for (const f of failed) console.log(`  ${f.id} ${f.name} — ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
