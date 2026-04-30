-- system_events: append-only event log for things not captured by
-- audit.row_history (DB row changes) or email_events (Resend webhook events).
--
-- Examples: auth login success/failure, cron run completions, transactional
-- email dispatch, bulk email send, webhook receipt, feedback submissions,
-- caught errors in cron and webhook handlers.
--
-- event_type uses a namespaced convention (auth.login, cron.fulfill_tickets,
-- email.transactional_sent, etc).
--
-- Not audited (intentional): system_events is itself an append-only event log;
-- auditing it would just produce duplicate noise.

CREATE TABLE public.system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES public.members(id),
  actor_label TEXT,
  subject_member_id UUID REFERENCES public.members(id),
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_events_occurred_at ON public.system_events (occurred_at DESC);
CREATE INDEX idx_system_events_event_type ON public.system_events (event_type);
CREATE INDEX idx_system_events_actor_id ON public.system_events (actor_id);
CREATE INDEX idx_system_events_subject_member_id ON public.system_events (subject_member_id);

-- RLS: admin/team SELECT only. Writes happen via service-role client only —
-- no INSERT/UPDATE/DELETE policies defined.
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read system events"
  ON public.system_events
  FOR SELECT
  USING (public.is_admin_or_team());

-- Audit indexes for the activity feed:
--
-- 1. changed_by — needed to scope Member History to "actions by this member."
--    audit.log_row_change() captures auth.uid() in changed_by but until now it
--    wasn't indexed.
--
-- 2. (table_name, (row_pk->>'id')) — already exists from the original migration
--    (idx_audit_table_row_pk includes table_schema). That index already serves
--    subject lookups via a (schema, table, id) prefix scan, so no new index
--    needed for that requirement.

CREATE INDEX idx_audit_changed_by ON audit.row_history (changed_by) WHERE changed_by IS NOT NULL;
