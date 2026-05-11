-- Split bounce events into hard vs soft at the view layer.
--
-- Background: email_events.event_type is just 'bounced' for both hard and
-- soft bounces. The activity_feed view used to expose all of them as
-- 'email.bounced', which lands in the System tab (per
-- SYSTEM_FEED_INCLUDED_TYPES). After our first big send, ~80% of the
-- bounces were Transient soft bounces — operationally meaningless noise
-- that pushed real failures off the screen.
--
-- Fix: in the view's email_events branch, classify on
-- raw_payload->'data'->'bounce'->>'type'. Permanent → 'email.bounced'
-- (continues to appear in System). Anything else (Transient,
-- Undetermined, missing) → 'email.bounced_soft' (still queryable, still
-- shows up in scoped member history, but does NOT match the System
-- inclusion list).
--
-- Also surface bounce_type in the view's metadata for any UI that
-- wants to display it.

CREATE OR REPLACE VIEW public.activity_feed
WITH (security_invoker = true)
AS
  SELECT
    'system_events'::text AS source,
    se.id::text AS source_id,
    se.event_type,
    se.actor_id,
    se.actor_label,
    se.subject_member_id,
    se.summary,
    se.metadata,
    se.occurred_at
  FROM public.system_events se

  UNION ALL

  SELECT
    'email_events'::text AS source,
    ee.id::text AS source_id,
    CASE
      WHEN ee.event_type = 'bounced'
           AND COALESCE(ee.raw_payload->'data'->'bounce'->>'type', '') <> 'Permanent'
        THEN 'email.bounced_soft'
      ELSE 'email.' || ee.event_type
    END::text AS event_type,
    NULL::uuid AS actor_id,
    'webhook:resend'::text AS actor_label,
    ee.member_id AS subject_member_id,
    NULL::text AS summary,
    jsonb_build_object(
      'recipient', ee.recipient_email,
      'subject', ee.subject,
      'resend_email_id', ee.resend_email_id,
      'member_email_id', ee.member_email_id,
      'bounce_type', ee.raw_payload->'data'->'bounce'->>'type'
    ) AS metadata,
    ee.occurred_at
  FROM public.email_events ee

  UNION ALL

  SELECT
    'audit'::text AS source,
    ar.id::text AS source_id,
    (lower(ar.table_name) || '.' || lower(ar.op))::text AS event_type,
    ar.actor_member_id AS actor_id,
    NULL::text AS actor_label,
    CASE
      WHEN ar.table_name = 'members' THEN (ar.row_pk->>'id')::uuid
      WHEN ar.table_name IN ('tickets', 'applications', 'credits', 'member_emails')
        THEN COALESCE(
          NULLIF(ar.new_row->>'member_id', '')::uuid,
          NULLIF(ar.old_row->>'member_id', '')::uuid
        )
      ELSE NULL
    END AS subject_member_id,
    NULL::text AS summary,
    jsonb_build_object(
      'table_name', ar.table_name,
      'op', ar.op,
      'row_pk', ar.row_pk,
      'old_row', ar.old_row,
      'new_row', ar.new_row,
      'changed_by_role', ar.changed_by_role
    ) AS metadata,
    ar.changed_at AS occurred_at
  FROM audit.row_history ar
  WHERE ar.table_schema = 'public'
    AND ar.table_name <> 'email_events';

GRANT SELECT ON public.activity_feed TO authenticated, service_role;
