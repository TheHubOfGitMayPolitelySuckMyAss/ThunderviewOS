import PageHeader from "@/components/page-header";
import { getActivityFeed, getDistinctEventTypes, type FeedKind } from "@/lib/activity-feed";
import OperationsClient from "./operations-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string;
  page?: string;
  events?: string;
  actor?: string;
  from?: string;
  to?: string;
};

const PAGE_SIZE = 100;

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const kind: FeedKind = sp.tab === "system" ? "system" : "people";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const eventTypes = sp.events ? sp.events.split(",").filter(Boolean) : [];
  const actorMemberId = sp.actor || null;
  const fromDate = sp.from || null;
  const toDate = sp.to || null;

  const [feed, allEventTypes] = await Promise.all([
    getActivityFeed({
      kind,
      page,
      pageSize: PAGE_SIZE,
      eventTypes: eventTypes.length > 0 ? eventTypes : undefined,
      actorMemberId,
      fromDate,
      toDate,
    }),
    getDistinctEventTypes(kind),
  ]);

  return (
    <div className="tv-container-admin">
      <PageHeader title="Activity" size="compact" />
      <OperationsClient
        kind={kind}
        page={feed.page}
        pageSize={feed.pageSize}
        total={feed.total}
        rows={feed.rows}
        allEventTypes={allEventTypes}
        eventTypes={eventTypes}
        actorMemberId={actorMemberId}
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  );
}
