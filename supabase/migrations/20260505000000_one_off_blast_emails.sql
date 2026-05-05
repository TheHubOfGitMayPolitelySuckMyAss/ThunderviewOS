-- One Off Blast email system: macro template + per-instance drafts
-- Bare-bones marketing broadcast: subject + body + uneditable CAN-SPAM footer.
-- No images, no dinner FK (multiple independent instances per type).

-- ============================================================
-- 1. Macro template (singleton row)
-- ============================================================
CREATE TABLE one_off_blast_macro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton = TRUE),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES members(id)
);

INSERT INTO one_off_blast_macro (singleton) VALUES (TRUE);

CREATE TRIGGER trg_one_off_blast_macro_updated_at
  BEFORE UPDATE ON one_off_blast_macro
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

ALTER TABLE one_off_blast_macro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read one_off_blast_macro"
  ON one_off_blast_macro FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can update one_off_blast_macro"
  ON one_off_blast_macro FOR UPDATE
  USING (is_admin_or_team());

-- ============================================================
-- 2. Per-instance email drafts
-- ============================================================
CREATE TABLE one_off_blast_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  test_sent_at TIMESTAMPTZ,
  test_sent_after_last_edit BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES members(id),
  audience_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_one_off_blast_emails_updated_at
  BEFORE UPDATE ON one_off_blast_emails
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

CREATE OR REPLACE FUNCTION lock_sent_one_off_blast_email()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'sent' THEN
    RAISE EXCEPTION 'Cannot modify a sent email (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_sent_one_off_blast_email
  BEFORE UPDATE ON one_off_blast_emails
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_one_off_blast_email();

ALTER TABLE one_off_blast_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read one_off_blast_emails"
  ON one_off_blast_emails FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can insert one_off_blast_emails"
  ON one_off_blast_emails FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin and team can update one_off_blast_emails"
  ON one_off_blast_emails FOR UPDATE
  USING (is_admin_or_team());
