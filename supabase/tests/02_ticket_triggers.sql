-- pgTAP test: tickets table triggers
--   trg_ticket_insert  → on_ticket_insert()
--   trg_ticket_fulfillment_change → on_ticket_fulfillment_change()
--
-- Coverage:
--   * S1 First ticket INSERT sets first_dinner_attended + has_community_access
--   * S2 Second ticket INSERT does NOT overwrite first_dinner_attended
--   * S3 Refund of a ticket whose dinner != first_dinner_attended:
--        - first_dinner_attended unchanged
--        - last_dinner_attended recalculated from remaining fulfilled past tickets
--   * S4 Refund of a ticket whose dinner == first_dinner_attended:
--        - first_dinner_attended reverts to NULL
--        - last_dinner_attended NULL when no remaining fulfilled tickets
--
-- Uses bogus 1900-* dinner dates to avoid colliding with real dinners.
-- Wraps in BEGIN; ... ROLLBACK; — zero commit risk.

BEGIN;
SET search_path TO extensions, public;
CREATE TEMP TABLE _tap_log (seq int generated always as identity, line text);

INSERT INTO _tap_log (line) SELECT plan(8);

CREATE TEMP TABLE test_ids (key TEXT PRIMARY KEY, val UUID);

DO $$
DECLARE
  v_member1 UUID := gen_random_uuid();
  v_member3 UUID := gen_random_uuid();
  v_member4 UUID := gen_random_uuid();
  v_dinner_a UUID := gen_random_uuid();
  v_dinner_b UUID := gen_random_uuid();
  v_dinner_c UUID := gen_random_uuid();
  v_dinner_d UUID := gen_random_uuid();
  v_dinner_e UUID := gen_random_uuid();
  v_ticket_s3_d UUID := gen_random_uuid();
  v_ticket_s4_e UUID := gen_random_uuid();
BEGIN
  INSERT INTO test_ids VALUES
    ('member1', v_member1),
    ('member3', v_member3),
    ('member4', v_member4),
    ('dinner_a', v_dinner_a),
    ('dinner_b', v_dinner_b),
    ('dinner_c', v_dinner_c),
    ('dinner_d', v_dinner_d),
    ('dinner_e', v_dinner_e),
    ('ticket_s3_d', v_ticket_s3_d),
    ('ticket_s4_e', v_ticket_s4_e);

  -- Members all start with first_dinner_attended NULL, has_community_access false
  INSERT INTO members (id, first_name, last_name, attendee_stagetypes,
                       has_community_access, kicked_out, marketing_opted_in) VALUES
    (v_member1, 'M1', 'Test', ARRAY['Investor'], false, false, true),
    (v_member3, 'M3', 'Test', ARRAY['Investor'], false, false, true),
    (v_member4, 'M4', 'Test', ARRAY['Investor'], false, false, true);

  INSERT INTO member_emails (member_id, email, is_primary, source) VALUES
    (v_member1, 'pgtap-tk-m1@test.invalid', true, 'application'),
    (v_member3, 'pgtap-tk-m3@test.invalid', true, 'application'),
    (v_member4, 'pgtap-tk-m4@test.invalid', true, 'application');

  -- Bogus past dinners (1900-*) to avoid colliding with real first-Thursdays
  INSERT INTO dinners (id, date, venue, guests_allowed, address) VALUES
    (v_dinner_a, '1900-01-01', 'Test Venue A', false, 'Test Addr'),
    (v_dinner_b, '1900-02-01', 'Test Venue B', false, 'Test Addr'),
    (v_dinner_c, '1900-03-01', 'Test Venue C', false, 'Test Addr'),
    (v_dinner_d, '1900-04-01', 'Test Venue D', false, 'Test Addr'),
    (v_dinner_e, '1900-05-01', 'Test Venue E', false, 'Test Addr');
END $$;

-- =========================================================================
-- S1: first ticket INSERT sets first_dinner_attended + has_community_access
-- =========================================================================
INSERT INTO tickets (member_id, dinner_id, ticket_type, amount_paid, payment_source, fulfillment_status)
VALUES (
  (SELECT val FROM test_ids WHERE key = 'member1'),
  (SELECT val FROM test_ids WHERE key = 'dinner_a'),
  'returning_ceo', 200, 'comp', 'purchased'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT first_dinner_attended FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member1')),
  '1900-01-01'::date,
  'S1: first_dinner_attended set to dinner_a date by insert trigger'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT has_community_access FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member1')),
  true,
  'S1: has_community_access flipped true by insert trigger'
);

-- =========================================================================
-- S2: second ticket INSERT does not overwrite first_dinner_attended
-- =========================================================================
INSERT INTO tickets (member_id, dinner_id, ticket_type, amount_paid, payment_source, fulfillment_status)
VALUES (
  (SELECT val FROM test_ids WHERE key = 'member1'),
  (SELECT val FROM test_ids WHERE key = 'dinner_b'),
  'returning_ceo', 200, 'comp', 'purchased'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT first_dinner_attended FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member1')),
  '1900-01-01'::date,
  'S2: first_dinner_attended unchanged after second ticket insert'
);

-- =========================================================================
-- S3: refund of a ticket whose dinner != first_dinner_attended
--     - first_dinner_attended unchanged (different dinner)
--     - last_dinner_attended recalculated from remaining fulfilled past tickets
-- =========================================================================
-- Member3 starts: insert two fulfilled tickets for past dinners c (earlier)
-- and d (later). Manually backfill last_dinner_attended to d (post-dinner cron
-- would normally do this).
INSERT INTO tickets (member_id, dinner_id, ticket_type, amount_paid, payment_source, fulfillment_status)
VALUES (
  (SELECT val FROM test_ids WHERE key = 'member3'),
  (SELECT val FROM test_ids WHERE key = 'dinner_c'),
  'returning_ceo', 200, 'comp', 'fulfilled'
);

INSERT INTO tickets (id, member_id, dinner_id, ticket_type, amount_paid, payment_source, fulfillment_status)
VALUES (
  (SELECT val FROM test_ids WHERE key = 'ticket_s3_d'),
  (SELECT val FROM test_ids WHERE key = 'member3'),
  (SELECT val FROM test_ids WHERE key = 'dinner_d'),
  'returning_ceo', 200, 'comp', 'fulfilled'
);

UPDATE members SET last_dinner_attended = '1900-04-01'
WHERE id = (SELECT val FROM test_ids WHERE key = 'member3');

-- Now refund the dinner_d ticket (later dinner)
UPDATE tickets SET fulfillment_status = 'refunded'
WHERE id = (SELECT val FROM test_ids WHERE key = 'ticket_s3_d');

INSERT INTO _tap_log (line) SELECT is(
  (SELECT first_dinner_attended FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member3')),
  '1900-03-01'::date,
  'S3: first_dinner_attended unchanged when refunded dinner != first_dinner_attended'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT last_dinner_attended FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member3')),
  '1900-03-01'::date,
  'S3: last_dinner_attended recalculated to remaining fulfilled past dinner'
);

-- =========================================================================
-- S4: refund of a ticket whose dinner == first_dinner_attended
--     - first_dinner_attended reverts to NULL
--     - last_dinner_attended NULL (no remaining fulfilled tickets)
-- =========================================================================
INSERT INTO tickets (id, member_id, dinner_id, ticket_type, amount_paid, payment_source, fulfillment_status)
VALUES (
  (SELECT val FROM test_ids WHERE key = 'ticket_s4_e'),
  (SELECT val FROM test_ids WHERE key = 'member4'),
  (SELECT val FROM test_ids WHERE key = 'dinner_e'),
  'returning_ceo', 200, 'comp', 'fulfilled'
);

UPDATE members SET last_dinner_attended = '1900-05-01'
WHERE id = (SELECT val FROM test_ids WHERE key = 'member4');

UPDATE tickets SET fulfillment_status = 'refunded'
WHERE id = (SELECT val FROM test_ids WHERE key = 'ticket_s4_e');

INSERT INTO _tap_log (line) SELECT is(
  (SELECT first_dinner_attended FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member4')),
  NULL::date,
  'S4: first_dinner_attended reverts to NULL when refunded dinner matches'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT last_dinner_attended FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member4')),
  NULL::date,
  'S4: last_dinner_attended is NULL when no remaining fulfilled tickets'
);

-- has_community_access stays true even after a refund (intentional per CLAUDE.md:
-- "Revoked when kicked_out flips false→true. Does NOT auto-restore on un-kick.")
INSERT INTO _tap_log (line) SELECT is(
  (SELECT has_community_access FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member4')),
  true,
  'S4: has_community_access stays true after refund (only revoked by kickout)'
);

INSERT INTO _tap_log (line) SELECT * FROM finish();

SELECT seq, line FROM _tap_log ORDER BY seq;

ROLLBACK;
