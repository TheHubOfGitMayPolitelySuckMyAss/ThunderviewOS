-- Split members.name and applications.name into first_name + last_name

-- Pre-migration row counts (for verification via output)
DO $$
DECLARE
  v_members_count BIGINT;
  v_applications_count BIGINT;
BEGIN
  SELECT count(*) INTO v_members_count FROM members;
  SELECT count(*) INTO v_applications_count FROM applications;
  RAISE NOTICE 'PRE-MIGRATION: members=%, applications=%', v_members_count, v_applications_count;
END $$;

-- Add columns to members
ALTER TABLE members
  ADD COLUMN first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN last_name TEXT NOT NULL DEFAULT '';

-- Add columns to applications
ALTER TABLE applications
  ADD COLUMN first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN last_name TEXT NOT NULL DEFAULT '';

-- Backfill members
UPDATE members SET
  first_name = CASE
    WHEN position(' ' in name) > 0 THEN left(name, position(' ' in name) - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END;

-- Backfill applications
UPDATE applications SET
  first_name = CASE
    WHEN position(' ' in name) > 0 THEN left(name, position(' ' in name) - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END;

-- Drop old name columns
ALTER TABLE members DROP COLUMN name;
ALTER TABLE applications DROP COLUMN name;

-- Post-migration verification
DO $$
DECLARE
  v_members_count BIGINT;
  v_applications_count BIGINT;
  v_members_empty_last BIGINT;
  v_applications_empty_last BIGINT;
BEGIN
  SELECT count(*) INTO v_members_count FROM members;
  SELECT count(*) INTO v_applications_count FROM applications;
  SELECT count(*) INTO v_members_empty_last FROM members WHERE last_name = '';
  SELECT count(*) INTO v_applications_empty_last FROM applications WHERE last_name = '';
  RAISE NOTICE 'POST-MIGRATION: members=%, applications=%', v_members_count, v_applications_count;
  RAISE NOTICE 'EMPTY LAST_NAME: members=%, applications=%', v_members_empty_last, v_applications_empty_last;
END $$;
