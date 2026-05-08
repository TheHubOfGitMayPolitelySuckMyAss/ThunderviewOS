// Admin-only batch Streak push. Authorization: Bearer ${CRON_SECRET}.
// Body: { member_ids: string[] } — calls safePushMember for each.
// Used for backfills and one-off resyncs when SQL has bypassed app-layer push.

import { NextResponse } from "next/server";
import { safePushMember } from "@/lib/streak/safe-push";

export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const memberIds =
    body && typeof body === "object" && "member_ids" in body
      ? (body as { member_ids: unknown }).member_ids
      : null;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: "member_ids must be a non-empty array" }, { status: 400 });
  }

  const op =
    body && typeof body === "object" && "op" in body && typeof (body as { op: unknown }).op === "string"
      ? (body as { op: string }).op
      : "admin_streak_push_batch";

  const results: { member_id: string; ok: boolean }[] = [];
  for (const id of memberIds) {
    if (typeof id !== "string") {
      results.push({ member_id: String(id), ok: false });
      continue;
    }
    try {
      await safePushMember(id, op);
      results.push({ member_id: id, ok: true });
    } catch {
      results.push({ member_id: id, ok: false });
    }
  }

  return NextResponse.json({
    pushed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
