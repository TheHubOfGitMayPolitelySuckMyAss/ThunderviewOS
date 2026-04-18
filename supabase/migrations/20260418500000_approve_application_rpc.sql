CREATE OR REPLACE FUNCTION approve_application(p_application_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_app RECORD;
  v_member_id UUID;
  v_existing_member_id UUID;
  v_is_existing BOOLEAN := false;
BEGIN
  -- Get application
  SELECT * INTO v_app FROM applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Check if email belongs to an existing member
  SELECT me.member_id INTO v_existing_member_id
  FROM member_emails me
  WHERE me.email = lower(v_app.email)
  LIMIT 1;

  IF v_existing_member_id IS NOT NULL THEN
    -- Existing member: link application, don't create new member
    v_member_id := v_existing_member_id;
    v_is_existing := true;
  ELSE
    -- Create new member
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

    -- Create primary email
    INSERT INTO member_emails (member_id, email, is_primary, source)
    VALUES (v_member_id, lower(v_app.email), true, 'application');
  END IF;

  -- Update application
  UPDATE applications
  SET status = 'approved',
      reviewed_at = now(),
      member_id = v_member_id,
      rejection_reason = NULL
  WHERE id = p_application_id;

  RETURN json_build_object(
    'member_id', v_member_id,
    'is_existing', v_is_existing
  );
END;
$$;
