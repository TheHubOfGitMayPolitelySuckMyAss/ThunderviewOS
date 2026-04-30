-- Drop the auth.users join from the audit subquery in activity_feed.
--
-- Background: the view originally COALESCEd actor_member_id (header-driven,
-- written by the audit trigger) with a fallback that resolved auth.uid() via
-- auth.users → member_emails. The fallback was for session-client writes
-- where the trigger captures changed_by via auth.uid().
--
-- Problem: the view runs WITH (security_invoker = true), so the caller
-- (service_role from server actions, authenticated from session client) needs
-- SELECT on auth.users. service_role does not have it by default in Supabase,
-- and granting it would expose password hashes. Errors in the view's subquery
-- bubble up as "permission denied for table users" and PostgREST returns the
-- whole query as an error — so the activity feed appears empty.
--
-- Fix: drop the auth.users join. All admin and portal write paths now go
-- through createAdminClientForCurrentActor (which sets X-Audit-Actor), so
-- actor_member_id is populated wherever a human actor exists. Cron and
-- webhook writes intentionally have no actor.
--
-- If a future code path uses the session client for audited writes and we
-- want auth.uid() resolution back, add it via a SECURITY DEFINER function
-- (which doesn't require granting auth.users to anon roles).

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
