// Admin-only batch backfill of current_*_short columns. Authorization: Bearer ${CRON_SECRET}.
// POST body (all optional):
//   { onlyMissing?: boolean = true, memberIds?: string[], concurrency?: number = 5 }
// onlyMissing=true (default): only summarize fields that have full text and a NULL short.
// onlyMissing=false: regenerate every short for matched members regardless of existing value.
// Uses the same summarize-profile code path as portal save actions.
//
// Why this endpoint exists: members with intro/ask/give that pre-date the
// auto-regen plumbing have no shorts. This is the one-time catch-up.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeChangedFields } from "@/lib/summarize-profile";

export const maxDuration = 300;

type Member = {
  id: string;
  current_intro: string | null;
  current_ask: string | null;
  current_give: string | null;
  current_intro_short: string | null;
  current_ask_short: string | null;
  current_give_short: string | null;
};

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { onlyMissing?: boolean; memberIds?: string[]; concurrency?: number } = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const onlyMissing = body.onlyMissing ?? true;
  const concurrency = Math.min(Math.max(body.concurrency ?? 5, 1), 10);

  const admin = createAdminClient("system-internal");

  let query = admin
    .from("members")
    .select(
      "id, current_intro, current_ask, current_give, current_intro_short, current_ask_short, current_give_short",
    )
    .eq("has_community_access", true)
    .eq("kicked_out", false);

  if (Array.isArray(body.memberIds) && body.memberIds.length > 0) {
    query = query.in("id", body.memberIds);
  }

  // Either has at least one populated source field (full backfill mode), OR
  // (onlyMissing) has at least one populated source where the short is null.
  // Postgrest .or() takes a comma-separated string of conditions.
  if (onlyMissing) {
    query = query.or(
      [
        "and(current_intro.not.is.null,current_intro_short.is.null)",
        "and(current_ask.not.is.null,current_ask_short.is.null)",
        "and(current_give.not.is.null,current_give_short.is.null)",
      ].join(","),
    );
  } else {
    query = query.or(
      "current_intro.not.is.null,current_ask.not.is.null,current_give.not.is.null",
    );
  }

  const { data, error } = await query.range(0, 999);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members = (data ?? []) as Member[];

  let updated = 0;
  let skipped = 0;
  const failures: { id: string; error: string }[] = [];

  async function processOne(m: Member) {
    const fields: { intro?: string; ask?: string; give?: string } = {};
    if (m.current_intro && (!onlyMissing || m.current_intro_short === null)) {
      fields.intro = m.current_intro;
    }
    if (m.current_ask && (!onlyMissing || m.current_ask_short === null)) {
      fields.ask = m.current_ask;
    }
    if (m.current_give && (!onlyMissing || m.current_give_short === null)) {
      fields.give = m.current_give;
    }
    if (Object.keys(fields).length === 0) {
      skipped++;
      return;
    }

    try {
      const shorts = await summarizeChangedFields(fields);
      if (Object.keys(shorts).length === 0) {
        failures.push({ id: m.id, error: "all summary calls failed" });
        return;
      }
      const { error: updateError } = await admin
        .from("members")
        .update(shorts)
        .eq("id", m.id);
      if (updateError) {
        failures.push({ id: m.id, error: updateError.message });
        return;
      }
      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ id: m.id, error: msg });
    }
  }

  // Simple concurrency pool: chunk and run in parallel batches.
  for (let i = 0; i < members.length; i += concurrency) {
    const chunk = members.slice(i, i + concurrency);
    await Promise.all(chunk.map(processOne));
  }

  return NextResponse.json({
    matched: members.length,
    updated,
    skipped,
    failed: failures.length,
    failures,
  });
}
