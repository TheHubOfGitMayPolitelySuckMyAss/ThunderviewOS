-- Cleanup: drop three columns that are never read or written by app code.
--
-- applications.reviewed_by — the approve_application RPC sets reviewed_at
-- and member_id but never sets reviewed_by. All 712 rows have it NULL.
-- Zero references in src/.
--
-- monday_before_emails.signoff_member_id and monday_after_emails.signoff_member_id —
-- both columns exist as FKs to members.id but are never read or written by
-- any code path. They appear to be placeholders for a "signed by" UI feature
-- that was never built; the actual signoff is hard-coded in the email body.

ALTER TABLE public.applications
  DROP COLUMN IF EXISTS reviewed_by;

ALTER TABLE public.monday_before_emails
  DROP COLUMN IF EXISTS signoff_member_id;

ALTER TABLE public.monday_after_emails
  DROP COLUMN IF EXISTS signoff_member_id;
