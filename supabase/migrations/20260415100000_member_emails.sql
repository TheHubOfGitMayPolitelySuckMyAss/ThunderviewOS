-- Multi-email support for members
-- Adds member_emails table, migrates existing data, drops members.email

-- 1. Create table
CREATE TABLE member_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL CHECK (source IN ('application', 'ticket', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_emails_member_id ON member_emails(member_id);
CREATE INDEX idx_member_emails_email ON member_emails(email);

CREATE UNIQUE INDEX idx_member_emails_one_primary_per_member
  ON member_emails(member_id)
  WHERE is_primary = true;

-- 2. Migrate existing data BEFORE adding constraint trigger
INSERT INTO member_emails (member_id, email, is_primary, source)
SELECT id, email, true, 'application'
FROM members
WHERE email IS NOT NULL;

-- 3. Drop old policy that depends on members.email, then drop column
DROP POLICY "Members can view own row" ON members;
DROP INDEX IF EXISTS idx_members_email;
ALTER TABLE members DROP COLUMN email;

-- 4. Now add the constraint trigger (after data migration and DDL are done)
CREATE OR REPLACE FUNCTION check_member_has_primary_email()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM member_emails WHERE member_id = OLD.member_id AND is_primary = true
    ) AND EXISTS (
      SELECT 1 FROM member_emails WHERE member_id = OLD.member_id
    ) THEN
      RAISE EXCEPTION 'Member % must have exactly one primary email', OLD.member_id;
    END IF;
    RETURN OLD;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM member_emails WHERE member_id = NEW.member_id AND is_primary = true
  ) THEN
    RAISE EXCEPTION 'Member % must have exactly one primary email', NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_member_has_primary_email
  AFTER INSERT OR UPDATE OR DELETE ON member_emails
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_member_has_primary_email();

-- 5. Recreate policy using member_emails
CREATE POLICY "Members can view own row"
  ON members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM member_emails me
      WHERE me.member_id = id
      AND me.email = auth.jwt() ->> 'email'
    )
  );

-- 6. Update is_admin_or_team()
CREATE OR REPLACE FUNCTION is_admin_or_team()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.jwt() ->> 'email' = 'eric@marcoullier.com' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM members m
    JOIN member_emails me ON me.member_id = m.id
    WHERE me.email = auth.jwt() ->> 'email'
    AND m.is_team = true
    AND m.kicked_out = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS on member_emails
ALTER TABLE member_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/team can view member_emails"
  ON member_emails FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Members can view own emails"
  ON member_emails FOR SELECT
  USING (auth.jwt() ->> 'email' = email);
