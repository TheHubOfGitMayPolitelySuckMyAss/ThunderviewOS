-- Phase 4 sprint 1:
--   1. Migrate members.attendee_stagetype (singular TEXT) → members.attendee_stagetypes (TEXT[])
--   2. Update RPCs (add_member_with_application, approve_application, link_application_to_member)
--      to write the array column (and to set it on link_application_to_member, which previously did not).
--   3. Add trigger so kicking a member out revokes has_community_access (no auto-restore on un-kick).
--   4. Drop the singular column once writes are migrated.

-- 1. Add array column + backfill
ALTER TABLE members ADD COLUMN attendee_stagetypes TEXT[] NOT NULL DEFAULT '{}';
UPDATE members SET attendee_stagetypes = ARRAY[attendee_stagetype]
WHERE attendee_stagetype IS NOT NULL;

-- 2. RPC updates

CREATE OR REPLACE FUNCTION add_member_with_application(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_company_name TEXT,
  p_company_website TEXT,
  p_linkedin_profile TEXT,
  p_attendee_stagetype TEXT,
  p_preferred_dinner_date DATE,
  p_gender TEXT DEFAULT 'Prefer not to say',
  p_race TEXT DEFAULT 'Prefer not to say',
  p_orientation TEXT DEFAULT 'Prefer not to say',
  p_contact_preference TEXT DEFAULT 'linkedin',
  p_i_am_ceo TEXT DEFAULT NULL,
  p_not_services TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  INSERT INTO members (
    first_name, last_name, company_name, company_website, linkedin_profile,
    attendee_stagetypes, contact_preference,
    has_community_access, kicked_out, marketing_opted_in
  ) VALUES (
    p_first_name, p_last_name, p_company_name, p_company_website, p_linkedin_profile,
    ARRAY[p_attendee_stagetype], p_contact_preference,
    false, false, true
  )
  RETURNING id INTO v_member_id;

  INSERT INTO member_emails (member_id, email, is_primary, source)
  VALUES (v_member_id, p_email, true, 'manual');

  INSERT INTO applications (
    first_name, last_name, email, company_name, company_website, linkedin_profile,
    attendee_stagetype, preferred_dinner_date,
    gender, race, orientation,
    i_am_my_startups_ceo, my_startup_is_not_a_services_business,
    status, member_id, submitted_on, reviewed_at
  ) VALUES (
    p_first_name, p_last_name, p_email, p_company_name, COALESCE(p_company_website, ''),
    COALESCE(p_linkedin_profile, ''),
    p_attendee_stagetype, p_preferred_dinner_date,
    p_gender, p_race, p_orientation,
    p_i_am_ceo, p_not_services,
    'approved', v_member_id, now(), now()
  );

  RETURN v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION approve_application(p_application_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_app RECORD;
  v_member_id UUID;
  v_existing RECORD;
  v_is_existing BOOLEAN := false;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  SELECT m.id, m.first_name, m.last_name, m.kicked_out
  INTO v_existing
  FROM member_emails me
  JOIN members m ON m.id = me.member_id
  WHERE me.email = lower(v_app.email)
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.kicked_out THEN
      RETURN json_build_object(
        'member_id', v_existing.id,
        'member_name', CASE WHEN v_existing.last_name <> '' THEN v_existing.first_name || ' ' || v_existing.last_name ELSE v_existing.first_name END,
        'is_existing', true,
        'is_kicked_out', true
      );
    END IF;

    v_member_id := v_existing.id;
    v_is_existing := true;

    -- Overwrite member's stagetypes from the application (single-element array).
    -- Will erase any multi-role customization the member added; intentional for now.
    UPDATE members
    SET attendee_stagetypes = ARRAY[v_app.attendee_stagetype]
    WHERE id = v_member_id;

    PERFORM 1 FROM member_emails
    WHERE member_id = v_member_id AND email = lower(v_app.email) AND is_primary = true;
    IF NOT FOUND THEN
      UPDATE member_emails SET is_primary = false
      WHERE member_id = v_member_id AND is_primary = true;

      IF EXISTS (SELECT 1 FROM member_emails WHERE member_id = v_member_id AND email = lower(v_app.email)) THEN
        UPDATE member_emails SET is_primary = true
        WHERE member_id = v_member_id AND email = lower(v_app.email);
      ELSE
        INSERT INTO member_emails (member_id, email, is_primary, source, email_status)
        VALUES (v_member_id, lower(v_app.email), true, 'application', 'active');
      END IF;
    END IF;
  ELSE
    INSERT INTO members (
      first_name, last_name, company_name, company_website, linkedin_profile,
      attendee_stagetypes, contact_preference,
      has_community_access, kicked_out, marketing_opted_in
    ) VALUES (
      v_app.first_name, v_app.last_name, v_app.company_name, v_app.company_website, v_app.linkedin_profile,
      ARRAY[v_app.attendee_stagetype], 'linkedin',
      false, false, true
    )
    RETURNING id INTO v_member_id;

    INSERT INTO member_emails (member_id, email, is_primary, source)
    VALUES (v_member_id, lower(v_app.email), true, 'application');
  END IF;

  UPDATE applications
  SET status = 'approved',
      reviewed_at = now(),
      member_id = v_member_id,
      rejection_reason = NULL
  WHERE id = p_application_id;

  RETURN json_build_object(
    'member_id', v_member_id,
    'is_existing', v_is_existing,
    'is_kicked_out', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION link_application_to_member(
  p_application_id UUID,
  p_member_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_app RECORD;
  v_member RECORD;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  SELECT id, first_name, last_name, kicked_out INTO v_member FROM members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_member.kicked_out THEN
    RETURN json_build_object(
      'member_id', v_member.id,
      'member_name', CASE WHEN v_member.last_name <> '' THEN v_member.first_name || ' ' || v_member.last_name ELSE v_member.first_name END,
      'is_kicked_out', true
    );
  END IF;

  -- Overwrite member's stagetypes from the application. Same caveat as approve_application.
  UPDATE members
  SET attendee_stagetypes = ARRAY[v_app.attendee_stagetype]
  WHERE id = p_member_id;

  UPDATE applications
  SET status = 'approved',
      reviewed_at = now(),
      member_id = p_member_id,
      rejection_reason = NULL
  WHERE id = p_application_id;

  UPDATE member_emails SET is_primary = false
  WHERE member_id = p_member_id AND is_primary = true;

  IF EXISTS (SELECT 1 FROM member_emails WHERE member_id = p_member_id AND email = lower(v_app.email)) THEN
    UPDATE member_emails SET is_primary = true
    WHERE member_id = p_member_id AND email = lower(v_app.email);
  ELSE
    INSERT INTO member_emails (member_id, email, is_primary, source, email_status)
    VALUES (p_member_id, lower(v_app.email), true, 'application', 'active');
  END IF;

  RETURN json_build_object(
    'member_id', p_member_id,
    'member_name', CASE WHEN v_member.last_name <> '' THEN v_member.first_name || ' ' || v_member.last_name ELSE v_member.first_name END,
    'is_kicked_out', false
  );
END;
$$;

-- 3. Kick-out revokes community access (one-way; un-kick does not restore)
CREATE OR REPLACE FUNCTION revoke_community_access_on_kickout()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.kicked_out = false AND NEW.kicked_out = true THEN
    NEW.has_community_access := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_revoke_community_access_on_kickout
BEFORE UPDATE OF kicked_out ON members
FOR EACH ROW
EXECUTE FUNCTION revoke_community_access_on_kickout();

-- 4. Drop singular column (writes are migrated above)
ALTER TABLE members DROP COLUMN attendee_stagetype;
