export type FeedSource = "system_events" | "email_events" | "audit";

export type FeedKind = "people" | "system" | "marketing";

/** Raw row as it lands from the activity_feed view. */
export type FeedRowRaw = {
  source: FeedSource;
  source_id: string;
  event_type: string;
  actor_id: string | null;
  actor_label: string | null;
  subject_member_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

/** Enriched row used by the UI. */
export type FeedRow = {
  source: FeedSource;
  source_id: string;
  event_type: string;
  actor_id: string | null;
  actor_label: string | null;
  actor_name: string | null;
  subject_member_id: string | null;
  subject_name: string | null;
  subject_label: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type FeedFilters = {
  kind: FeedKind;
  page?: number;
  pageSize?: number;
  eventTypes?: string[];
  actorMemberId?: string | null;
  /** Member History scoping: include rows where actor_id = member OR subject_member_id = member */
  scopedToMemberId?: string | null;
  /** Marketing feed: scope to a single anonymous visitor by anon_id. */
  anonId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
};

export type FeedPage = {
  rows: FeedRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type FeedResult =
  | ({ ok: true } & FeedPage)
  | { ok: false; error: string };

export type EventTypesResult =
  | { ok: true; types: string[] }
  | { ok: false; error: string };

/** Shape of metadata on audit-source rows. */
export type AuditMeta = {
  table_name: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  row_pk: Record<string, unknown>;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
};
