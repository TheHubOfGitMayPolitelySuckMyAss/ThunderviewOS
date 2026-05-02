/**
 * Member History — People feed scoped to actor_id = memberId OR
 * subject_member_id = memberId. Renders as a section at the bottom of the
 * member detail page.
 *
 * Pagination + filter state lives in URL search params (mh_page, mh_events)
 * so this section composes cleanly inside the existing server component.
 */

import { getActivityFeed, getDistinctEventTypes } from "@/lib/activity-feed";
import MemberHistoryClient from "./member-history-client";

const PAGE_SIZE = 25;

export default async function MemberHistory({ memberId }: { memberId: string }) {
  // Initial render: page 1, no filters. Client component handles
  // pagination + filtering via the fetchMemberHistory server action.
  const [feedResult, typesResult] = await Promise.all([
    getActivityFeed({
      kind: "people",
      page: 1,
      pageSize: PAGE_SIZE,
      scopedToMemberId: memberId,
    }),
    getDistinctEventTypes("people"),
  ]);

  return (
    <section className="mt-section pt-stack border-t border-border">
      <h2 className="tv-h3 mb-tight">Member History</h2>
      <MemberHistoryClient
        memberId={memberId}
        initialRows={feedResult.ok ? feedResult.rows : []}
        initialTotal={feedResult.ok ? feedResult.total : 0}
        initialError={feedResult.ok ? null : feedResult.error}
        pageSize={PAGE_SIZE}
        allEventTypes={typesResult.ok ? typesResult.types : []}
      />
    </section>
  );
}
