CREATE OR REPLACE FUNCTION swap_primary_email(p_member_id UUID, p_new_primary_email_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE member_emails
  SET is_primary = (id = p_new_primary_email_id)
  WHERE member_id = p_member_id;
END;
$$;
