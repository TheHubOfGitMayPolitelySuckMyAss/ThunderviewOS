/**
 * One-time bulk backfill of Streak boxes for existing OS data.
 *
 * Forward sync from Prompt B handles every state change going forward, but
 * existing pending applications + the ~632 imported members predate that
 * wiring and have streak_box_key = NULL. This script pushes them.
 *
 * Run from local terminal:
 *   npx tsx --env-file=.env.local tmp/streak-backfill.ts
 *
 * Idempotent. The WHERE streak_box_key IS NULL filter on both phases means
 * a re-run after partial failure only touches rows that haven't landed yet.
 * Pushes that succeed persist the box key inside the same call, so they're
 * skipped automatically on the next pass.
 *
 * Single-flight: a lock file at tmp/streak-backfill.lock prevents concurrent
 * runs (and surfaces crashed prior runs that need cleanup).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import {
  ensureStreakReady,
  resetStreakCache,
} from "../src/lib/streak/bootstrap";
import {
  pushApplicationToStreak,
  pushMemberToStreak,
} from "../src/lib/streak/push";

const LOCK_PATH = resolve(process.cwd(), "tmp/streak-backfill.lock");
// Defensive ceiling for SELECT pagination — prod members are ~632 today.
// If we ever exceed this, the script will exit with a clear error rather
// than silently truncate.
const ROW_CEILING = 9999;

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function acquireLock(): void {
  if (existsSync(LOCK_PATH)) {
    console.error(
      `Backfill already running (or previous run crashed). Remove ${LOCK_PATH} to proceed.`
    );
    process.exit(1);
  }
  writeFileSync(LOCK_PATH, `${process.pid}\n${new Date().toISOString()}\n`, {
    flag: "wx",
  });
  const release = () => {
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      // Ignore — lock file may already be gone if a prior signal cleaned up.
    }
  };
  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(143);
  });
}

async function fetchPendingAppIds(sb: SupabaseClient): Promise<string[]> {
  const res = await sb
    .from("applications")
    .select("id")
    .eq("status", "pending")
    .is("member_id", null)
    .is("streak_box_key", null)
    .order("created_at", { ascending: true })
    .range(0, ROW_CEILING);
  if (res.error) throw new Error(`applications SELECT failed: ${res.error.message}`);
  const rows = (res.data ?? []) as { id: string }[];
  if (rows.length > ROW_CEILING)
    throw new Error(`applications SELECT exceeded ROW_CEILING (${ROW_CEILING})`);
  return rows.map((r) => r.id);
}

async function fetchMemberIds(sb: SupabaseClient): Promise<string[]> {
  const res = await sb
    .from("members")
    .select("id")
    .is("streak_box_key", null)
    .order("created_at", { ascending: true })
    .range(0, ROW_CEILING);
  if (res.error) throw new Error(`members SELECT failed: ${res.error.message}`);
  const rows = (res.data ?? []) as { id: string }[];
  if (rows.length > ROW_CEILING)
    throw new Error(`members SELECT exceeded ROW_CEILING (${ROW_CEILING})`);
  return rows.map((r) => r.id);
}

async function confirmContinue(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const ans = (await rl.question(prompt)).trim();
    return ans === "y" || ans === "Y";
  } finally {
    rl.close();
  }
}

async function runPhase(
  label: string,
  ids: string[],
  push: (id: string) => Promise<void>
): Promise<{ ok: number; failed: { id: string; error: string }[] }> {
  let ok = 0;
  const failed: { id: string; error: string }[] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      await push(id);
      ok++;
      console.log(`[${label}] (${i + 1}/${ids.length}) ${id} ok=true`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ id, error: msg });
      console.log(
        `[${label}] (${i + 1}/${ids.length}) ${id} ok=false error=${msg.slice(0, 200)}`
      );
    }
  }

  return { ok, failed };
}

async function main() {
  acquireLock();

  console.log("=== Streak backfill ===\n");

  // Pre-flight: pipeline diagnostics
  resetStreakCache();
  console.log("[preflight] resolving Streak pipeline + stages + fields…");
  const ready = await ensureStreakReady();
  console.log(`  pipelineKey: ${ready.pipelineKey}`);
  console.log("  stageKeys:");
  for (const [k, v] of Object.entries(ready.stageKeys)) {
    console.log(`    ${k.padEnd(13)} -> ${v}`);
  }
  console.log("  fieldKeys:");
  for (const [k, v] of Object.entries(ready.fieldKeys)) {
    console.log(`    ${k.padEnd(11)} -> ${v}`);
  }

  const sb = admin();

  // Pre-flight: counts
  console.log("\n[preflight] counting eligible rows…");
  const appIds = await fetchPendingAppIds(sb);
  const memberIds = await fetchMemberIds(sb);
  console.log(`  pending applications:   ${appIds.length}`);
  console.log(`  members (no box yet):   ${memberIds.length}`);
  console.log(`  total:                  ${appIds.length + memberIds.length}`);

  if (appIds.length === 0 && memberIds.length === 0) {
    console.log("\nNothing to backfill. Exiting.");
    return;
  }

  const proceed = await confirmContinue("\nContinue? (y/N) ");
  if (!proceed) {
    console.log("Aborted.");
    process.exit(0);
  }

  // Phase 1 — pending applications
  console.log("\n=== Phase 1: pending applications ===");
  const phase1 = await runPhase("application", appIds, pushApplicationToStreak);

  // Phase 2 — members
  console.log("\n=== Phase 2: members ===");
  const phase2 = await runPhase("member", memberIds, pushMemberToStreak);

  // Phase 3 — summary
  console.log("\n=== Summary ===");
  console.log(
    `Pending applications:  ${appIds.length} total, ${phase1.ok} succeeded, ${phase1.failed.length} failed`
  );
  console.log(
    `Members:               ${memberIds.length} total, ${phase2.ok} succeeded, ${phase2.failed.length} failed`
  );

  if (phase1.failed.length > 0) {
    console.log(`\nFailed application IDs:`);
    for (const f of phase1.failed) {
      console.log(`  ${f.id}  ${f.error.slice(0, 200)}`);
    }
  }
  if (phase2.failed.length > 0) {
    console.log(`\nFailed member IDs:`);
    for (const f of phase2.failed) {
      console.log(`  ${f.id}  ${f.error.slice(0, 200)}`);
    }
  }

  if (phase1.failed.length + phase2.failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Backfill threw:", err);
  process.exitCode = 1;
});
