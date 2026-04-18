-- RPC function to create a member + member_emails + approved application in one transaction
CREATE OR REPLACE FUNCTION add_member_with_application(
  p_name TEXT,
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
  -- Create member
  INSERT INTO members (
    name, company_name, company_website, linkedin_profile,
    attendee_stagetype, contact_preference,
    has_community_access, kicked_out, marketing_opted_in
  ) VALUES (
    p_name, p_company_name, p_company_website, p_linkedin_profile,
    p_attendee_stagetype, p_contact_preference,
    false, false, true
  )
  RETURNING id INTO v_member_id;

  -- Create primary email
  INSERT INTO member_emails (member_id, email, is_primary, source)
  VALUES (v_member_id, p_email, true, 'manual');

  -- Create approved application
  INSERT INTO applications (
    name, email, company_name, company_website, linkedin_profile,
    attendee_stagetype, preferred_dinner_date,
    gender, race, orientation,
    i_am_my_startups_ceo, my_startup_is_not_a_services_business,
    status, member_id, submitted_on, reviewed_at
  ) VALUES (
    p_name, p_email, p_company_name, COALESCE(p_company_website, ''),
    COALESCE(p_linkedin_profile, ''),
    p_attendee_stagetype, p_preferred_dinner_date,
    p_gender, p_race, p_orientation,
    p_i_am_ceo, p_not_services,
    'approved', v_member_id, now(), now()
  );

  RETURN v_member_id;
END;
$$;
