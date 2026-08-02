-- Deleting a member_emails row previously failed whenever the email had any
-- tracked event (a bounced email always does — the bounce itself). The event
-- row keeps its own member_id + recipient_email, so the history loses nothing.
ALTER TABLE public.email_events
  DROP CONSTRAINT email_events_member_email_id_fkey;

ALTER TABLE public.email_events
  ADD CONSTRAINT email_events_member_email_id_fkey
  FOREIGN KEY (member_email_id) REFERENCES public.member_emails(id)
  ON DELETE SET NULL;
