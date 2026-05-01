/**
 * One-off smoke test: resolves the Thunderview pipeline, its 7 stages, and
 * the 4 custom fields. Auto-creates any missing fields. Prints the resolved
 * keys. Run this once after Prompt A deploys to confirm the bootstrap layer
 * is wired correctly and that the 4 fields exist on the pipeline.
 *
 *   npx tsx --env-file=.env.local tmp/streak-bootstrap-smoke.ts
 *
 * The --env-file flag loads STREAK_API_KEY from .env.local. The script
 * shells out to Streak's cloud API and Supabase, so a network connection
 * is required. No mutations to OS data — only Streak field-creation if any
 * of First Name / Last Name / Company / Email is missing.
 */

import {
  ensureStreakReady,
  resetStreakCache,
} from "../src/lib/streak/bootstrap";

async function main() {
  resetStreakCache();
  console.log("Resolving Thunderview pipeline + stages + fields…\n");
  const result = await ensureStreakReady();

  console.log("pipelineKey:", result.pipelineKey);
  console.log("\nstageKeys:");
  for (const [stage, key] of Object.entries(result.stageKeys)) {
    console.log(`  ${stage.padEnd(13)} -> ${key}`);
  }
  console.log("\nfieldKeys:");
  for (const [field, key] of Object.entries(result.fieldKeys)) {
    console.log(`  ${field.padEnd(11)} -> ${key}`);
  }
  console.log("\nBootstrap OK.");
}

main().catch((err) => {
  console.error("Bootstrap FAILED:", err);
  process.exit(1);
});
