-- Delete email_events rows that originated from senders other than Thunderview.
--
-- The Resend webhook is account-scoped: every app on Eric's Resend account
-- POSTs to /api/webhooks/resend, including unrelated apps (Show Harder).
-- The webhook handler is being updated in the same deploy to filter at
-- ingestion, but rows already persisted before that fix need to be cleaned up.
--
-- Match by parsing the @domain off raw_payload->'data'->>'from'. Handles both
-- bare ("foo@bar.com") and bracket ("Name <foo@bar.com>") forms.

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH targeted AS (
    SELECT id
    FROM public.email_events
    WHERE lower(split_part(
            regexp_replace(raw_payload->'data'->>'from', '.*<([^>]+)>.*', '\1'),
            '@', 2
          )) <> 'thunderviewceodinners.com'
  ),
  deleted AS (
    DELETE FROM public.email_events
    WHERE id IN (SELECT id FROM targeted)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  RAISE NOTICE 'cleanup_non_thunderview_email_events: deleted % rows', v_count;
END$$;
