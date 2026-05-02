-- get_distinct_people_event_types: server-side DISTINCT over the activity_feed
-- view's event_type column for the People-feed filter dropdown.
--
-- Previous TS implementation pulled rows client-side and deduped via a Set,
-- which silently truncated at the PostgREST 1k cap. activity_feed has tens
-- of thousands of rows (cron heartbeats, page views, Streak API calls), so
-- rare event_types could be missing from the dropdown until they fired
-- recently enough to land in the most-recent 1k.
--
-- excluded_prefixes / excluded_types come from src/lib/activity-feed/filters.ts
-- so the filter logic stays defined in exactly one place. The SQL just
-- executes the filter the caller provides.

CREATE OR REPLACE FUNCTION public.get_distinct_people_event_types(
  excluded_prefixes text[],
  excluded_types text[]
)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_agg(et ORDER BY et), ARRAY[]::text[])
  FROM (
    SELECT DISTINCT event_type AS et
    FROM public.activity_feed
    WHERE actor_id IS NOT NULL
      AND source <> 'email_events'
      AND event_type <> ALL(excluded_types)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(excluded_prefixes) AS p
        WHERE event_type LIKE p || '%'
      )
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_people_event_types(text[], text[]) TO service_role, authenticated;
