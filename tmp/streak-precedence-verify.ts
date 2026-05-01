/**
 * Runnable verification of the Streak member-stage precedence ladder.
 *
 * Exercises the pure computeStageForMember(state) function with synthetic
 * MemberStreakState objects covering each of the 6 precedence cases.
 * Prints expected vs actual; exits non-zero on any mismatch.
 *
 * Run from local terminal:
 *   npx tsx tmp/streak-precedence-verify.ts
 *
 * No DB or network access — pure function only.
 */

import {
  computeStageForApplication,
  computeStageForMember,
  type MemberStreakState,
} from "../src/lib/streak/compute-stage";
import type { StreakStage } from "../src/lib/streak/stages";

type Case = {
  name: string;
  state: MemberStreakState;
  expected: StreakStage;
};

// Baseline "approved" state — no flags tripped, no tickets, no exclusion,
// never attended. Each test case mutates one or two fields and expects a
// specific stage. This makes precedence wins/losses obvious from the diff.
const baseline: MemberStreakState = {
  is_team: false,
  marketing_opted_in: true,
  kicked_out: false,
  email_statuses: ["active"],
  has_upcoming_ticket: false,
  has_active_exclusion: false,
  last_dinner_attended: null,
};

const cases: Case[] = [
  // 0. team — top precedence, beats every other state
  {
    name: "team: is_team beats kicked_out + bounced + everything else",
    state: {
      ...baseline,
      is_team: true,
      kicked_out: true,
      marketing_opted_in: false,
      email_statuses: ["bounced"],
      has_upcoming_ticket: true,
      last_dinner_attended: "2026-04-02",
    },
    expected: "team",
  },
  // 1. opted_out — wins over everything else
  {
    name: "opted_out: marketing_opted_in=false dominates an active ticket holder",
    state: {
      ...baseline,
      marketing_opted_in: false,
      has_upcoming_ticket: true,
      last_dinner_attended: "2026-04-02",
    },
    expected: "opted_out",
  },
  {
    name: "opted_out: kicked_out=true also dominates",
    state: {
      ...baseline,
      kicked_out: true,
      has_upcoming_ticket: true,
    },
    expected: "opted_out",
  },

  // 2. bounced — only when ALL emails bounced
  {
    name: "bounced: every email bounced beats has_ticket",
    state: {
      ...baseline,
      email_statuses: ["bounced", "bounced"],
      has_upcoming_ticket: true,
    },
    expected: "bounced",
  },
  {
    name: "bounced (negative): mixed bounced+active does NOT trip bounced rule",
    state: {
      ...baseline,
      email_statuses: ["bounced", "active"],
      has_upcoming_ticket: true,
    },
    expected: "has_ticket",
  },
  {
    name: "bounced (negative): zero email rows is NOT vacuously bounced",
    state: {
      ...baseline,
      email_statuses: [],
    },
    expected: "approved",
  },

  // 3. has_ticket — beats not_this_one, attended, approved
  {
    name: "has_ticket: upcoming ticket beats prior attendance",
    state: {
      ...baseline,
      has_upcoming_ticket: true,
      last_dinner_attended: "2026-04-02",
    },
    expected: "has_ticket",
  },

  // 4. not_this_one — only when no upcoming ticket
  {
    name: "not_this_one: active exclusion beats prior attendance",
    state: {
      ...baseline,
      has_active_exclusion: true,
      last_dinner_attended: "2026-04-02",
    },
    expected: "not_this_one",
  },
  {
    name: "not_this_one (loses to has_ticket): exclusion + ticket → has_ticket",
    state: {
      ...baseline,
      has_active_exclusion: true,
      has_upcoming_ticket: true,
    },
    expected: "has_ticket",
  },

  // 5. attended — only when nothing higher applies
  {
    name: "attended: prior attendance, no ticket, no exclusion",
    state: {
      ...baseline,
      last_dinner_attended: "2026-04-02",
    },
    expected: "attended",
  },

  // 6. approved — fallthrough
  {
    name: "approved: clean slate baseline",
    state: { ...baseline },
    expected: "approved",
  },
];

let failures = 0;
console.log(`Running ${cases.length} member precedence cases…\n`);
for (const c of cases) {
  const actual = computeStageForMember(c.state);
  const ok = actual === c.expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  expected=${c.expected.padEnd(13)} actual=${actual.padEnd(13)} — ${c.name}`
  );
}

console.log("\nApplication stage cases:");
const appCases: Array<{
  name: string;
  app: { status: string; member_id: string | null };
  expected: "applied" | null;
}> = [
  {
    name: "pending + no member → applied",
    app: { status: "pending", member_id: null },
    expected: "applied",
  },
  {
    name: "pending + linked member → null (no standalone box)",
    app: { status: "pending", member_id: "abc" },
    expected: null,
  },
  {
    name: "approved → null",
    app: { status: "approved", member_id: "abc" },
    expected: null,
  },
  {
    name: "rejected → null",
    app: { status: "rejected", member_id: null },
    expected: null,
  },
];
for (const c of appCases) {
  const actual = computeStageForApplication(c.app);
  const ok = actual === c.expected;
  if (!ok) failures++;
  const expectedLabel = c.expected ?? "null";
  const actualLabel = actual ?? "null";
  console.log(
    `${ok ? "PASS" : "FAIL"}  expected=${expectedLabel.padEnd(7)} actual=${actualLabel.padEnd(7)} — ${c.name}`
  );
}

if (failures > 0) {
  console.error(`\n${failures} case(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length + appCases.length} cases passed.`);
