import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAIL_MERGE_SENDS_PER_MINUTE,
  MAIL_MERGE_SEND_SPACING_MS,
  estimateDrainMinutes,
  formatDrainDuration,
} from "../pacing.ts";

test("rate is 5/min and one run's allotment fits inside the cron's 60s maxDuration", () => {
  assert.equal(MAIL_MERGE_SENDS_PER_MINUTE, 5);
  // (n-1) gaps between n sends, plus headroom for the sends themselves.
  const runSpanMs = (MAIL_MERGE_SENDS_PER_MINUTE - 1) * MAIL_MERGE_SEND_SPACING_MS;
  assert.ok(runSpanMs <= 45_000, `run spans ${runSpanMs}ms`);
});

test("estimateDrainMinutes: 500 recipients ≈ 100 minutes", () => {
  assert.equal(estimateDrainMinutes(500), 100);
  assert.equal(estimateDrainMinutes(1), 1);
  assert.equal(estimateDrainMinutes(6), 2);
  assert.equal(estimateDrainMinutes(0), 0);
});

test("formatDrainDuration: human strings", () => {
  assert.equal(formatDrainDuration(500), "about 1 hour 40 minutes");
  assert.equal(formatDrainDuration(300), "about 1 hour");
  assert.equal(formatDrainDuration(15), "about 3 minutes");
  assert.equal(formatDrainDuration(3), "about a minute");
  assert.equal(formatDrainDuration(0), "no time");
  assert.equal(formatDrainDuration(1200), "about 4 hours");
});
