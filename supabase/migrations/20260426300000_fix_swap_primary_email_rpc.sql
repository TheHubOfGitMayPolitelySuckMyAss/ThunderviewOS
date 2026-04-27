-- Fix swap_primary_email RPC: clear old primary before setting new one
-- to avoid partial unique index violation on (member_id) WHERE is_primary = true
CREATE OR REPLACE FUNCTION swap_primary_email(p_member_id UUID, p_new_primary_email_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear existing primary first to avoid unique index violation
  UPDATE member_emails
  SET is_primary = false
  WHERE member_id = p_member_id AND is_primary = true;

  -- Set new primary
  UPDATE member_emails
  SET is_primary = true
  WHERE member_id = p_member_id AND id = p_new_primary_email_id;
END;
$$;
