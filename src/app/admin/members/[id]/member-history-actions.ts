"use server";

import { getActivityFeed, type FeedRow } from "@/lib/activity-feed";

export type MemberHistoryResult =
  | { ok: true; rows: FeedRow[]; total: number }
  | { ok: false; error: string };

export async function fetchMemberHistory(args: {
  memberId: string;
  page: number;
  pageSize: number;
  eventTypes?: string[];
}): Promise<MemberHistoryResult> {
  const result = await getActivityFeed({
    kind: "people",
    page: args.page,
    pageSize: args.pageSize,
    scopedToMemberId: args.memberId,
    eventTypes: args.eventTypes && args.eventTypes.length > 0 ? args.eventTypes : undefined,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, rows: result.rows, total: result.total };
}
