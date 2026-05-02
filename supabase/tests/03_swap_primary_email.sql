-- pgTAP test: public.swap_primary_email(uuid, uuid) + the
-- DEFERRABLE INITIALLY DEFERRED trg_member_has_primary_email constraint
-- trigger that backstops it.
--
-- Coverage:
--   * S1 Happy path: secondary email promoted, old primary demoted
--   * S2 Idempotent: calling with already-primary target is a safe no-op
--        (the RPC's clear-then-set pattern coincidentally re-asserts the
--        same state when the target is the current primary)
--   * S3 Bad input (cross-member email_id): the swap completes silently
--        WITHIN the transaction (constraint deferred), but firing the
--        constraint via SET CONSTRAINTS ... IMMEDIATE raises — proving the
--        production COMMIT path catches the misuse loudly. We do NOT use
--        a SAVEPOINT here because rollback to a savepoint would discard
--        the _tap_log inserts; throws_ok internally catches the constraint
--        violation, then the outer ROLLBACK at end-of-file discards the
--        invalid state.
--
-- The deferred constraint is what makes the RPC's transient zero-primary
-- state safe. Without it, the first UPDATE in the RPC would crash the
-- happy path.
--
-- Wraps in BEGIN; ... ROLLBACK; — zero commit risk.

BEGIN;
SET search_path TO extensions, public;
CREATE TEMP TABLE _tap_log (seq int generated always as identity, line text);

INSERT INTO _tap_log (line) SELECT plan(7);

CREATE TEMP TABLE test_ids (key TEXT PRIMARY KEY, val UUID);

DO $$
DECLARE
  v_member1 UUID := gen_random_uuid();
  v_member2 UUID := gen_random_uuid();
  v_email_m1_primary UUID := gen_random_uuid();
  v_email_m1_secondary UUID := gen_random_uuid();
  v_email_m2 UUID := gen_random_uuid();
BEGIN
  INSERT INTO test_ids VALUES
    ('member1', v_member1),
    ('member2', v_member2),
    ('email_m1_primary', v_email_m1_primary),
    ('email_m1_secondary', v_email_m1_secondary),
    ('email_m2', v_email_m2);

  INSERT INTO members (id, first_name, last_name, attendee_stagetypes,
                       has_community_access, kicked_out, marketing_opted_in) VALUES
    (v_member1, 'Member', 'One', ARRAY['Investor'], true, false, true),
    (v_member2, 'Member', 'Two', ARRAY['Investor'], true, false, true);

  INSERT INTO member_emails (id, member_id, email, is_primary, source) VALUES
    (v_email_m1_primary,   v_member1, 'pgtap-swap-m1-pri@test.invalid',   true,  'application'),
    (v_email_m1_secondary, v_member1, 'pgtap-swap-m1-sec@test.invalid',   false, 'manual'),
    (v_email_m2,           v_member2, 'pgtap-swap-m2@test.invalid',       true,  'application');
END $$;

-- =========================================================================
-- S1: happy-path swap promotes secondary, demotes old primary
-- =========================================================================
SELECT swap_primary_email(
  (SELECT val FROM test_ids WHERE key = 'member1'),
  (SELECT val FROM test_ids WHERE key = 'email_m1_secondary')
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT is_primary FROM member_emails WHERE id = (SELECT val FROM test_ids WHERE key = 'email_m1_secondary')),
  true,
  'S1: secondary email promoted to primary'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT is_primary FROM member_emails WHERE id = (SELECT val FROM test_ids WHERE key = 'email_m1_primary')),
  false,
  'S1: old primary email demoted'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM member_emails
   WHERE member_id = (SELECT val FROM test_ids WHERE key = 'member1') AND is_primary = true),
  1,
  'S1: exactly-one-primary invariant holds after swap'
);

-- =========================================================================
-- S2: idempotent no-op when target is already primary
-- =========================================================================
SELECT swap_primary_email(
  (SELECT val FROM test_ids WHERE key = 'member1'),
  (SELECT val FROM test_ids WHERE key = 'email_m1_secondary')
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT is_primary FROM member_emails WHERE id = (SELECT val FROM test_ids WHERE key = 'email_m1_secondary')),
  true,
  'S2: idempotent — target stays primary when called with already-primary id'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM member_emails
   WHERE member_id = (SELECT val FROM test_ids WHERE key = 'member1') AND is_primary = true),
  1,
  'S2: still exactly one primary'
);

-- =========================================================================
-- S3: cross-member email_id silently leaves member1 with NO primary;
--     forcing the deferred constraint raises (the COMMIT-time guard)
-- =========================================================================
SELECT swap_primary_email(
  (SELECT val FROM test_ids WHERE key = 'member1'),
  (SELECT val FROM test_ids WHERE key = 'email_m2')
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM member_emails
   WHERE member_id = (SELECT val FROM test_ids WHERE key = 'member1') AND is_primary = true),
  0,
  'S3 setup: cross-member swap silently leaves member1 with 0 primaries (pre-commit)'
);

INSERT INTO _tap_log (line) SELECT throws_ok(
  'SET CONSTRAINTS trg_member_has_primary_email IMMEDIATE',
  'P0001',
  NULL,
  'S3: deferred constraint raises at commit-equivalent time (loud failure)'
);

INSERT INTO _tap_log (line) SELECT * FROM finish();

SELECT seq, line FROM _tap_log ORDER BY seq;

ROLLBACK;
