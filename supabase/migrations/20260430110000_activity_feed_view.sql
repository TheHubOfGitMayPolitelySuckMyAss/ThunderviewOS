-- Unified activity feed view combining the three event sources to a common
-- shape: system_events (direct), email_events (translated), and audit.row_history
-- (translated; UPDATE-row event_type is further refined client-side based on
-- the old/new diff).
--
-- The view is queried via the service-role admin client (RLS bypassed). It is
-- also marked WITH (security_invoker = true) so that callers using the session
-- client see it through their own RLS — the underlying tables only grant
-- SELECT to admin/team via is_admin_or_team(), which is the desired policy.
--
-- Audit rows on the email_events table are excluded so events don't appear
-- twice (once via the dedicated email_events source).

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
    ('email.' || ee.event_type)::text AS event_type,
    NULL::uuid AS actor_id,
    'webhook:resend'::text AS actor_label,
    ee.member_id AS subject_member_id,
    NULL::text AS summary,
    jsonb_build_object(
      'recipient', ee.recipient_email,
      'subject', ee.subject,
      'resend_email_id', ee.resend_email_id,
      'member_email_id', ee.member_email_id
    ) AS metadata,
    ee.occurred_at
  FROM public.email_events ee

  UNION ALL

  SELECT
    'audit'::text AS source,
    ar.id::text AS source_id,
    (lower(ar.table_name) || '.' || lower(ar.op))::text AS event_type,
    -- Resolve auth.uid() (changed_by) to a members.id via member_emails.
    -- Service-role writes have changed_by = NULL → actor_id = NULL.
    -- (Header-driven actor attribution is added in a later migration.)
    (
      SELECT me.member_id
      FROM auth.users u
      JOIN public.member_emails me ON lower(me.email) = lower(u.email)
      WHERE u.id = ar.changed_by
      LIMIT 1
    ) AS actor_id,
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
