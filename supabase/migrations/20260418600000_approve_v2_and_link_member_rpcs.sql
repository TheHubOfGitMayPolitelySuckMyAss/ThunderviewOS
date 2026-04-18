-- Replace approve_application with v2: handles kicked-out check, primary email flip
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
  v_is_kicked_out BOOLEAN := false;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Check if email belongs to an existing member
  SELECT m.id, m.name, m.kicked_out
  INTO v_existing
  FROM member_emails me
  JOIN members m ON m.id = me.member_id
  WHERE me.email = lower(v_app.email)
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.kicked_out THEN
      RETURN json_build_object(
        'member_id', v_existing.id,
        'member_name', v_existing.name,
        'is_existing', true,
        'is_kicked_out', true
      );
    END IF;

    v_member_id := v_existing.id;
    v_is_existing := true;

    -- Flip primary email to the application email if different
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
      name, company_name, company_website, linkedin_profile,
      attendee_stagetype, contact_preference,
      has_community_access, kicked_out, marketing_opted_in
    ) VALUES (
      v_app.name, v_app.company_name, v_app.company_website, v_app.linkedin_profile,
      v_app.attendee_stagetype, 'linkedin',
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

-- RPC to link an application to an existing member (manual match)
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

  SELECT id, name, kicked_out INTO v_member FROM members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_member.kicked_out THEN
    RETURN json_build_object(
      'member_id', v_member.id,
      'member_name', v_member.name,
      'is_kicked_out', true
    );
  END IF;

  UPDATE applications
  SET status = 'approved',
      reviewed_at = now(),
      member_id = p_member_id,
      rejection_reason = NULL
  WHERE id = p_application_id;

  -- Demote current primary
  UPDATE member_emails SET is_primary = false
  WHERE member_id = p_member_id AND is_primary = true;

  -- Upsert application email as primary
  IF EXISTS (SELECT 1 FROM member_emails WHERE member_id = p_member_id AND email = lower(v_app.email)) THEN
    UPDATE member_emails SET is_primary = true
    WHERE member_id = p_member_id AND email = lower(v_app.email);
  ELSE
    INSERT INTO member_emails (member_id, email, is_primary, source, email_status)
    VALUES (p_member_id, lower(v_app.email), true, 'application', 'active');
  END IF;

  RETURN json_build_object(
    'member_id', p_member_id,
    'member_name', v_member.name,
    'is_kicked_out', false
  );
END;
$$;
