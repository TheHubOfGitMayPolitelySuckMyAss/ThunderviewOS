-- pgTAP test: public.claim_mail_merge_recipient_throttled(int)
--
-- Coverage:
--   * T1 Claims one row at a time up to the per-minute cap
--   * T2 Cap reached → no row (even though pending rows remain)
--   * T3 A released claim (claimed_at NULL, back to pending) frees its slot
--   * T4 Claims older than 60s stop counting
--   * T5 Draft merges are never claimed
--   * T6 Empty queue → no row
--
-- Reuses existing member ids for the FK only (rows are rolled back). The cap
-- is global, so a real merge sending at the same moment would skew counts —
-- run when nothing is 'sending'.
--
-- Wraps in BEGIN; ... ROLLBACK; — zero commit risk.

BEGIN;
SET search_path TO extensions, public;
CREATE TEMP TABLE _tap_log (seq int generated always as identity, line text);

INSERT INTO _tap_log (line) SELECT plan(7);

CREATE TEMP TABLE test_ids (key TEXT PRIMARY KEY, val UUID);

DO $$
DECLARE
  v_sending UUID := gen_random_uuid();
  v_draft UUID := gen_random_uuid();
BEGIN
  INSERT INTO test_ids VALUES ('sending', v_sending), ('draft', v_draft);
  INSERT INTO mail_merges (id, status, subject) VALUES
    (v_sending, 'sending', 'pgtap throttle'),
    (v_draft, 'draft', 'pgtap throttle draft');

  INSERT INTO mail_merge_recipients (mail_merge_id, member_id, first_name, email, bucket)
  SELECT v_sending, m.id, 'T', 'throttle-' || row_number() OVER () || '@test.invalid', 'team'
  FROM (SELECT id FROM members ORDER BY id LIMIT 7) m;

  INSERT INTO mail_merge_recipients (mail_merge_id, member_id, first_name, email, bucket)
  SELECT v_draft, m.id, 'T', 'throttle-draft@test.invalid', 'team'
  FROM (SELECT id FROM members ORDER BY id LIMIT 1) m;
END $$;

-- T1: five claims at cap 5 each return exactly one row
CREATE TEMP TABLE _claims (n int);
INSERT INTO _claims SELECT (SELECT count(*) FROM claim_mail_merge_recipient_throttled(5));
INSERT INTO _claims SELECT (SELECT count(*) FROM claim_mail_merge_recipient_throttled(5));
INSERT INTO _claims SELECT (SELECT count(*) FROM claim_mail_merge_recipient_throttled(5));
INSERT INTO _claims SELECT (SELECT count(*) FROM claim_mail_merge_recipient_throttled(5));
INSERT INTO _claims SELECT (SELECT count(*) FROM claim_mail_merge_recipient_throttled(5));
INSERT INTO _tap_log (line) SELECT is(
  (SELECT sum(n)::int FROM _claims), 5, 'T1: five single-row claims under cap 5');

-- T2: sixth claim in the same minute is refused
INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM claim_mail_merge_recipient_throttled(5)), 0,
  'T2: cap reached → no row while pending rows remain');
INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM mail_merge_recipients
    WHERE mail_merge_id = (SELECT val FROM test_ids WHERE key='sending') AND status = 'pending'),
  2, 'T2: two rows still pending');

-- T3: releasing a claim gives its slot back
UPDATE mail_merge_recipients SET status = 'pending', claimed_at = NULL
WHERE id = (SELECT id FROM mail_merge_recipients
  WHERE mail_merge_id = (SELECT val FROM test_ids WHERE key='sending') AND status = 'processing'
  LIMIT 1);
INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM claim_mail_merge_recipient_throttled(5)), 1,
  'T3: released claim frees one slot');

-- T4: claims older than 60s no longer count
UPDATE mail_merge_recipients SET claimed_at = now() - interval '61 seconds'
WHERE mail_merge_id = (SELECT val FROM test_ids WHERE key='sending') AND claimed_at IS NOT NULL;
INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM claim_mail_merge_recipient_throttled(5)), 1,
  'T4: aged-out claims stop counting toward the cap');

-- T5 + T6: drain the rest with a high cap; the draft row is never claimed
INSERT INTO _claims SELECT (SELECT count(*) FROM claim_mail_merge_recipient_throttled(100));
INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM claim_mail_merge_recipient_throttled(100)), 0,
  'T6: empty queue → no row');
INSERT INTO _tap_log (line) SELECT is(
  (SELECT status FROM mail_merge_recipients
    WHERE mail_merge_id = (SELECT val FROM test_ids WHERE key='draft')),
  'pending', 'T5: draft merge row never claimed');

INSERT INTO _tap_log (line) SELECT * FROM finish();
SELECT line FROM _tap_log ORDER BY seq;

ROLLBACK;
