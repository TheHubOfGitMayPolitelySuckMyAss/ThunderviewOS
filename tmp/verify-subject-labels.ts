/**
 * Verify subject_label enrichment across event types.
 * Run with: npx tsx tmp/verify-subject-labels.ts
 *
 * Prints event_type + subject_label for a recent page of each feed.
 * All rows should show human-readable labels — no UUIDs or raw paths.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dep in this project)
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env.local not found; rely on existing env
}

import { getActivityFeed } from "../src/lib/activity-feed";

const SEP = "─".repeat(80);

async function printFeed(kind: "people" | "system" | "marketing", label: string) {
  console.log(`\n${SEP}`);
  console.log(`${label.toUpperCase()} FEED`);
  console.log(SEP);

  const result = await getActivityFeed({ kind, pageSize: 50 });
  if (!result.ok) {
    console.error(`  ERROR: ${result.error}`);
    return;
  }

  const { rows } = result;
  if (rows.length === 0) {
    console.log("  (no rows)");
    return;
  }

  const colW = 35;
  console.log(
    `${"event_type".padEnd(colW)}subject_label`
  );
  console.log(`${"-".repeat(colW)}${"-".repeat(40)}`);

  let uuidsFound = 0;
  for (const r of rows) {
    const label = r.subject_label ?? "(null)";
    const hasUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(label);
    const hasRawPath = label.startsWith("/") && /\/[0-9a-f]{8}/.test(label);
    const flag = hasUuid || hasRawPath ? " ⚠ UUID/PATH" : "";
    if (hasUuid || hasRawPath) uuidsFound++;
    console.log(`${r.event_type.padEnd(colW)}${label}${flag}`);
  }

  console.log(`\n  Total: ${rows.length} rows, ${uuidsFound} with UUID/path issues`);
}

async function main() {
  console.log("Activity feed subject_label verification");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await printFeed("people", "People");
  await printFeed("system", "System");
  await printFeed("marketing", "Marketing");

  console.log(`\n${SEP}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
