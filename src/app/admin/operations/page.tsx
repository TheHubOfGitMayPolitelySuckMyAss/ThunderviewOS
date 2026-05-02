import PageHeader from "@/components/page-header";
import { getActivityFeed, getDistinctEventTypes, type FeedKind, type FeedRow } from "@/lib/activity-feed";
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
  const kind: FeedKind =
    sp.tab === "system"
      ? "system"
      : sp.tab === "marketing"
        ? "marketing"
        : "people";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const eventTypes = sp.events ? sp.events.split(",").filter(Boolean) : [];
  const actorMemberId = sp.actor || null;
  const fromDate = sp.from || null;
  const toDate = sp.to || null;

  const [feedResult, typesResult] = await Promise.all([
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

  const feedError = feedResult.ok ? null : feedResult.error;
  const feedRows: FeedRow[] = feedResult.ok ? feedResult.rows : [];
  const feedTotal = feedResult.ok ? feedResult.total : 0;
  const feedPage = feedResult.ok ? feedResult.page : page;
  const feedPageSize = feedResult.ok ? feedResult.pageSize : PAGE_SIZE;
  const allEventTypes = typesResult.ok ? typesResult.types : [];

  return (
    <div className="tv-container-admin">
      <PageHeader title="Activity" size="compact" />
      <OperationsClient
        kind={kind}
        page={feedPage}
        pageSize={feedPageSize}
        total={feedTotal}
        rows={feedRows}
        feedError={feedError}
        allEventTypes={allEventTypes}
        eventTypes={eventTypes}
        actorMemberId={actorMemberId}
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  );
}
