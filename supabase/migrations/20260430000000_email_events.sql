-- Email events table for Resend webhook bounce/complaint/failure tracking.
-- Extends member_emails.email_status to include 'complained'.

-- 1. Extend email_status CHECK constraint
ALTER TABLE public.member_emails DROP CONSTRAINT member_emails_email_status_check;
ALTER TABLE public.member_emails ADD CONSTRAINT member_emails_email_status_check
  CHECK (email_status = ANY (ARRAY['active'::text, 'bounced'::text, 'complained'::text]));

-- 2. email_events table
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type = ANY (ARRAY['bounced'::text, 'complained'::text, 'failed'::text])),
  resend_email_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  member_email_id UUID REFERENCES public.member_emails(id),
  member_id UUID REFERENCES public.members(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resend_email_id, event_type)
);

CREATE INDEX idx_email_events_occurred_at ON public.email_events (occurred_at DESC);

-- 3. RLS: admin/team SELECT, service role writes via webhook (no INSERT/UPDATE/DELETE policies)
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read email events"
  ON public.email_events
  FOR SELECT
  USING (public.is_admin_or_team());

-- 4. Audit trigger
CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.email_events
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();
