-- pgTAP test: audit trigger captures post-BEFORE-trigger state
--
-- This is the regression that the `zzz_` trigger-naming convention prevents.
-- PostgreSQL fires AFTER triggers alphabetically; audit triggers MUST fire
-- last so their snapshot reflects all sibling triggers' modifications.
--
-- The members table has these BEFORE UPDATE triggers that mutate NEW:
--   * set_members_updated_at        — sets NEW.updated_at = now()
--   * trg_intro_updated_at          — sets NEW.intro_updated_at when current_intro changes
--   * trg_marketing_opted_out_at    — sets NEW.marketing_opted_out_at when opted_in flips
--   * trg_revoke_community_access_on_kickout — clears NEW.has_community_access on kickout
-- ...and one AFTER UPDATE trigger:
--   * zzz_audit_row_change          — snapshots OLD/NEW into audit.row_history
--
-- A user UPDATE that touches only `kicked_out` should produce an audit row
-- whose new_row reflects the BEFORE triggers' work — has_community_access
-- flipped to false, updated_at bumped. If audit.log_row_change ran BEFORE
-- the kickout trigger (e.g. alphabetically named `audit_*`), it would
-- snapshot the pre-modification NEW and the audit row would be wrong.
--
-- Two pgTAP-quirk notes:
--   * audit.row_history.id is the only monotonic ordering key. changed_at
--     defaults to now(), which returns transaction-start for every row in
--     the same transaction — so all audit rows in this test share the
--     identical changed_at. We MUST order by id, not changed_at.
--   * Likewise, every BEFORE-trigger-set timestamp resolves to the SAME
--     now() across the test transaction; we can only assert IS NOT NULL,
--     not strict `>` comparisons.
--
-- Wraps in BEGIN; ... ROLLBACK; — zero commit risk.

BEGIN;
SET search_path TO extensions, public, audit;
CREATE TEMP TABLE _tap_log (seq int generated always as identity, line text);

INSERT INTO _tap_log (line) SELECT plan(7);

CREATE TEMP TABLE test_ids (key TEXT PRIMARY KEY, val UUID);

DO $$
DECLARE
  v_member UUID := gen_random_uuid();
BEGIN
  INSERT INTO test_ids VALUES ('member', v_member);

  -- Member starts: NOT kicked, HAS community access, opted IN to marketing,
  -- with a current_intro so we can exercise intro_updated_at trigger.
  INSERT INTO members (id, first_name, last_name, attendee_stagetypes,
                       has_community_access, kicked_out, marketing_opted_in,
                       current_intro)
  VALUES (v_member, 'Audit', 'Test', ARRAY['Investor'],
          true, false, true,
          'initial intro text');

  INSERT INTO member_emails (member_id, email, is_primary, source) VALUES
    (v_member, 'pgtap-audit@test.invalid', true, 'application');
END $$;

-- =========================================================================
-- Action 1: kick the member out. BEFORE trigger should clear
-- has_community_access. AFTER audit trigger should snapshot the cleared
-- state, not the user's intended state.
-- =========================================================================
UPDATE members SET kicked_out = true
WHERE id = (SELECT val FROM test_ids WHERE key = 'member');

INSERT INTO _tap_log (line) SELECT is(
  (SELECT (new_row->>'has_community_access')::boolean
   FROM audit.row_history
   WHERE table_name = 'members'
     AND (row_pk->>'id')::uuid = (SELECT val FROM test_ids WHERE key = 'member')
     AND op = 'UPDATE'
   ORDER BY id DESC LIMIT 1),
  false,
  'A1: audit new_row reflects BEFORE trigger clearing has_community_access on kickout'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT (old_row->>'has_community_access')::boolean
   FROM audit.row_history
   WHERE table_name = 'members'
     AND (row_pk->>'id')::uuid = (SELECT val FROM test_ids WHERE key = 'member')
     AND op = 'UPDATE'
   ORDER BY id DESC LIMIT 1),
  true,
  'A1: audit old_row preserves pre-kickout has_community_access = true'
);

INSERT INTO _tap_log (line) SELECT is(
  (SELECT (new_row->>'kicked_out')::boolean
   FROM audit.row_history
   WHERE table_name = 'members'
     AND (row_pk->>'id')::uuid = (SELECT val FROM test_ids WHERE key = 'member')
     AND op = 'UPDATE'
   ORDER BY id DESC LIMIT 1),
  true,
  'A1: audit new_row captures the user-driven kicked_out = true'
);

-- =========================================================================
-- Action 2: opt the member out of marketing. BEFORE trigger should set
-- marketing_opted_out_at. AFTER audit should capture it on new_row.
-- =========================================================================
UPDATE members SET marketing_opted_in = false
WHERE id = (SELECT val FROM test_ids WHERE key = 'member');

INSERT INTO _tap_log (line) SELECT isnt(
  (SELECT new_row->>'marketing_opted_out_at'
   FROM audit.row_history
   WHERE table_name = 'members'
     AND (row_pk->>'id')::uuid = (SELECT val FROM test_ids WHERE key = 'member')
     AND op = 'UPDATE'
   ORDER BY id DESC LIMIT 1),
  NULL,
  'A2: audit new_row captures BEFORE trigger setting marketing_opted_out_at'
);

-- =========================================================================
-- Action 3: change current_intro. BEFORE trigger set_intro_updated_at
-- should set intro_updated_at. (NB: there is no symmetric trigger for
-- current_ask — ask_updated_at is set by the portal save action only.)
-- =========================================================================
UPDATE members SET current_intro = 'updated intro text'
WHERE id = (SELECT val FROM test_ids WHERE key = 'member');

INSERT INTO _tap_log (line) SELECT isnt(
  (SELECT new_row->>'intro_updated_at'
   FROM audit.row_history
   WHERE table_name = 'members'
     AND (row_pk->>'id')::uuid = (SELECT val FROM test_ids WHERE key = 'member')
     AND op = 'UPDATE'
   ORDER BY id DESC LIMIT 1),
  NULL,
  'A3: audit new_row captures BEFORE trigger setting intro_updated_at'
);

-- updated_at sanity: every UPDATE bumps NEW.updated_at via the BEFORE trigger.
-- Within this single test transaction every now() resolves to the same value,
-- so we can only assert NOT NULL, not strict monotonic increase.
INSERT INTO _tap_log (line) SELECT isnt(
  (SELECT new_row->>'updated_at'
   FROM audit.row_history
   WHERE table_name = 'members'
     AND (row_pk->>'id')::uuid = (SELECT val FROM test_ids WHERE key = 'member')
     AND op = 'UPDATE'
   ORDER BY id DESC LIMIT 1),
  NULL,
  'updated_at: audit new_row.updated_at is set after the UPDATE'
);

-- Sanity: we produced 4 audit rows for this member (1 INSERT + 3 UPDATEs)
INSERT INTO _tap_log (line) SELECT is(
  (SELECT count(*)::int FROM audit.row_history
   WHERE table_name = 'members'
     AND (row_pk->>'id')::uuid = (SELECT val FROM test_ids WHERE key = 'member')),
  4,
  'Audit count: 1 INSERT + 3 UPDATEs = 4 rows for the test member'
);

INSERT INTO _tap_log (line) SELECT * FROM finish();

SELECT seq, line FROM _tap_log ORDER BY seq;

ROLLBACK;
