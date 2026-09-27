-- Throttled mail-merge claim (2026-09-27).
--
-- Same claim-ONE semantics as claim_mail_merge_recipient() (FOR UPDATE SKIP
-- LOCKED, oldest pending row of any 'sending' merge), gated by a global
-- rolling-60s cap: returns no row once p_per_minute recipients have been
-- claimed in the last minute. The advisory xact lock serializes the
-- count-then-claim across concurrent drainers (inline after() + cron), so
-- overlapping runs can't add up past the cap.
--
-- Released claims (fatal Gmail error) null claimed_at and so give their slot
-- back; sent/failed/stalled rows keep claimed_at and count. The rate itself
-- lives in src/lib/mail-merge/pacing.ts (MAIL_MERGE_SENDS_PER_MINUTE).
--
-- claim_mail_merge_recipient() is left in place (unused by the app) so the
-- previous deploy keeps working until this one is live.

CREATE INDEX IF NOT EXISTS mail_merge_recipients_claimed_at_idx
  ON mail_merge_recipients (claimed_at)
  WHERE claimed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION claim_mail_merge_recipient_throttled(p_per_minute integer)
RETURNS SETOF mail_merge_recipients
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('claim_mail_merge_recipient_throttled'));

  IF (
    SELECT count(*)
    FROM mail_merge_recipients
    WHERE claimed_at > now() - interval '60 seconds'
  ) >= p_per_minute THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE mail_merge_recipients
  SET status = 'processing', claimed_at = now()
  WHERE id = (
    SELECT r.id
    FROM mail_merge_recipients r
    JOIN mail_merges m ON m.id = r.mail_merge_id
    WHERE r.status = 'pending' AND m.status = 'sending'
    ORDER BY r.created_at, r.id
    LIMIT 1
    FOR UPDATE OF r SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_mail_merge_recipient_throttled(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_mail_merge_recipient_throttled(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_mail_merge_recipient_throttled(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_mail_merge_recipient_throttled(integer) TO service_role;
