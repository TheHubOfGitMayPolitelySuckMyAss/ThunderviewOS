"use server";

import { getActivityFeed } from "@/lib/activity-feed";

export async function fetchMemberHistory(args: {
  memberId: string;
  page: number;
  pageSize: number;
  eventTypes?: string[];
}) {
  const feed = await getActivityFeed({
    kind: "people",
    page: args.page,
    pageSize: args.pageSize,
    scopedToMemberId: args.memberId,
    eventTypes: args.eventTypes && args.eventTypes.length > 0 ? args.eventTypes : undefined,
  });
  return { rows: feed.rows, total: feed.total };
}
