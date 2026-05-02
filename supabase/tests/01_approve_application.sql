-- pgTAP test: public.approve_application(uuid)
--
-- Coverage:
--   * S1 New member happy path: INSERTs member + primary email, sets has_community_access
--   * S2 Existing member rebind: rotates primary email when application's email differs
--   * S3 Kicked-out short-circuit: returns gracefully, leaves application 'pending'
--
-- Pattern: assertion outputs are captured into a temp table _tap_log so the
-- final SELECT returns all 14 rows (TAP plan + 13 assertions). Required because
-- the Supabase MCP execute_sql call only surfaces the last statement's result;
-- without the log table you only see finish(), not per-test pass/fail.
--
-- Run via Supabase MCP execute_sql with the entire body of this file (the
-- BEGIN; ... ROLLBACK; wrap is inside the file). Zero commit risk.

BEGIN;
SET search_path TO extensions, public;
CREATE TEMP TABLE _tap_log (seq int generated always as identity, line text);

INSERT INTO _tap_log (line) SELECT plan(13);

CREATE TEMP TABLE test_ids (key TEXT PRIMARY KEY, val UUID);

DO $$
DECLARE
  v_app_new UUID := gen_random_uuid();
  v_app_existing UUID := gen_random_uuid();
  v_app_kicked UUID := gen_random_uuid();
  v_member_existing UUID := gen_random_uuid();
  v_member_kicked UUID := gen_random_uuid();
BEGIN
  INSERT INTO test_ids VALUES
    ('app_new', v_app_new),
    ('app_existing', v_app_existing),
    ('app_kicked', v_app_kicked),
    ('member_existing', v_member_existing),
    ('member_kicked', v_member_kicked);

  -- Existing approved member with TWO emails: an existing primary, and a
  -- non-primary that the rebind application will use.
  INSERT INTO members (id, first_name, last_name, attendee_stagetypes,
                       has_community_access, kicked_out, marketing_opted_in)
  VALUES (v_member_existing, 'Existing', 'User', ARRAY['Investor'],
          true, false, true);

  INSERT INTO member_emails (member_id, email, is_primary, source) VALUES
    (v_member_existing, 'pgtap-existing-old@test.invalid', true, 'application'),
    (v_member_existing, 'pgtap-existing-new@test.invalid', false, 'manual');

  -- Kicked-out member
  INSERT INTO members (id, first_name, last_name, attendee_stagetypes,
                       has_community_access, kicked_out, marketing_opted_in)
  VALUES (v_member_kicked, 'Kicked', 'Out',
          ARRAY['Active CEO (Bootstrapping or VC-Backed)'],
          false, true, false);

  INSERT INTO member_emails (member_id, email, is_primary, source) VALUES
    (v_member_kicked, 'pgtap-kicked@test.invalid', true, 'application');

  INSERT INTO applications (id, email, first_name, last_name, attendee_stagetype,
                            status, company_name, company_website, linkedin_profile,
                            gender, race, orientation)
  VALUES
    (v_app_new, 'pgtap-new@test.invalid', 'New', 'Person',
     'Active CEO (Bootstrapping or VC-Backed)', 'pending',
     'NewCo', 'newco.test', 'linkedin.test/new', 'X', 'X', 'X'),
    (v_app_existing, 'pgtap-existing-new@test.invalid', 'Existing', 'User',
     'Active CEO (Bootstrapping or VC-Backed)', 'pending',
     'ExistingCo', 'existing.test', 'linkedin.test/existing', 'X', 'X', 'X'),
    (v_app_kicked, 'pgtap-kicked@test.invalid', 'Kicked', 'Out',
     'Active CEO (Bootstrapping or VC-Backed)', 'pending',
     'KickedCo', 'kicked.test', 'linkedin.test/kicked', 'X', 'X', 'X');
END $$;

-- Scenario 1: new email → new member created
SELECT approve_application((SELECT val FROM test_ids WHERE key = 'app_new'));

INSERT INTO _tap_log (line) SELECT is(
  (SELECT status FROM applications WHERE id = (SELECT val FROM test_ids WHERE key = 'app_new')),
  'approved'::text,
  'S1: new application status = approved'
);

INSERT INTO _tap_log (line) SELECT isnt(
  (SELECT member_id FROM applications WHERE id = (SELECT val FROM test_ids WHERE key = 'app_new')),
  NULL::uuid,
  'S1: new application member_id is set'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT attendee_stagetypes FROM members WHERE id = (
    SELECT member_id FROM applications WHERE id = (SELECT val FROM test_ids WHERE key = 'app_new')
  )),
  ARRAY['Active CEO (Bootstrapping or VC-Backed)']::text[],
  'S1: new member has correct attendee_stagetypes'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT has_community_access FROM members WHERE id = (
    SELECT member_id FROM applications WHERE id = (SELECT val FROM test_ids WHERE key = 'app_new')
  )),
  true,
  'S1: new member has community access'
);

INSERT INTO _tap_log (line) SELECT ok(
  EXISTS (
    SELECT 1 FROM member_emails
    WHERE email = 'pgtap-new@test.invalid' AND is_primary = true AND source = 'application'
  ),
  'S1: primary email row created with source=application'
);

-- Scenario 2: existing member, application email is non-primary alt → rotate
SELECT approve_application((SELECT val FROM test_ids WHERE key = 'app_existing'));

INSERT INTO _tap_log (line) SELECT is(
  (SELECT member_id FROM applications WHERE id = (SELECT val FROM test_ids WHERE key = 'app_existing')),
  (SELECT val FROM test_ids WHERE key = 'member_existing'),
  'S2: application linked to existing member (no new member created)'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT email FROM member_emails
   WHERE member_id = (SELECT val FROM test_ids WHERE key = 'member_existing') AND is_primary = true),
  'pgtap-existing-new@test.invalid'::text,
  'S2: primary email rotated to application email'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT is_primary FROM member_emails WHERE email = 'pgtap-existing-old@test.invalid'),
  false,
  'S2: old primary email demoted'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT attendee_stagetypes FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member_existing')),
  ARRAY['Active CEO (Bootstrapping or VC-Backed)']::text[],
  'S2: attendee_stagetypes overwritten with application value'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM member_emails
   WHERE member_id = (SELECT val FROM test_ids WHERE key = 'member_existing') AND is_primary = true),
  1,
  'S2: exactly one primary email after rotation'
);

-- Scenario 3: kicked-out member → short-circuit, no state change
SELECT approve_application((SELECT val FROM test_ids WHERE key = 'app_kicked'));

INSERT INTO _tap_log (line) SELECT is(
  (SELECT status FROM applications WHERE id = (SELECT val FROM test_ids WHERE key = 'app_kicked')),
  'pending'::text,
  'S3: application stays pending when targeted member is kicked-out'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT kicked_out FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member_kicked')),
  true,
  'S3: kicked member still kicked'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT has_community_access FROM members WHERE id = (SELECT val FROM test_ids WHERE key = 'member_kicked')),
  false,
  'S3: kicked member still has no community access'
);

INSERT INTO _tap_log (line) SELECT * FROM finish();

SELECT seq, line FROM _tap_log ORDER BY seq;

ROLLBACK;
