-- Monday Before email system: macro template + per-dinner drafts + image groups

-- ============================================================
-- 1. Macro template (singleton row)
-- ============================================================
CREATE TABLE monday_before_macro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton = TRUE),
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  custom_text TEXT NOT NULL DEFAULT '',
  partnership_boilerplate TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES members(id)
);

-- Seed the single row
INSERT INTO monday_before_macro (singleton) VALUES (TRUE);

-- Auto-update updated_at
CREATE TRIGGER trg_monday_before_macro_updated_at
  BEFORE UPDATE ON monday_before_macro
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

-- RLS
ALTER TABLE monday_before_macro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read monday_before_macro"
  ON monday_before_macro FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can update monday_before_macro"
  ON monday_before_macro FOR UPDATE
  USING (is_admin_or_team());

-- ============================================================
-- 2. Per-dinner email drafts
-- ============================================================
CREATE TABLE monday_before_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dinner_id UUID NOT NULL UNIQUE REFERENCES dinners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  custom_text TEXT NOT NULL DEFAULT '',
  partnership_boilerplate TEXT NOT NULL DEFAULT '',
  signoff_member_id UUID REFERENCES members(id),
  test_sent_at TIMESTAMPTZ,
  test_sent_after_last_edit BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES members(id),
  audience_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER trg_monday_before_emails_updated_at
  BEFORE UPDATE ON monday_before_emails
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

-- Sent-lock trigger: block edits after status = 'sent'
-- Only allow the status flip from draft→sent (with sent_at, sent_by, audience_snapshot)
CREATE OR REPLACE FUNCTION lock_sent_monday_before_email()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'sent' THEN
    RAISE EXCEPTION 'Cannot modify a sent email (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_sent_monday_before_email
  BEFORE UPDATE ON monday_before_emails
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_before_email();

-- RLS
ALTER TABLE monday_before_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read monday_before_emails"
  ON monday_before_emails FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can insert monday_before_emails"
  ON monday_before_emails FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin and team can update monday_before_emails"
  ON monday_before_emails FOR UPDATE
  USING (is_admin_or_team());

-- ============================================================
-- 3. Image groups
-- ============================================================
CREATE TABLE monday_before_email_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES monday_before_emails(id) ON DELETE CASCADE,
  group_number INT NOT NULL CHECK (group_number IN (1, 5)),
  display_order INT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_email_images_order
  ON monday_before_email_images(email_id, group_number, display_order);

-- Block image writes when parent email is sent
CREATE OR REPLACE FUNCTION lock_sent_monday_before_images()
RETURNS TRIGGER AS $$
DECLARE
  email_status TEXT;
BEGIN
  -- For INSERT/UPDATE use NEW.email_id, for DELETE use OLD.email_id
  SELECT status INTO email_status
    FROM monday_before_emails
    WHERE id = COALESCE(NEW.email_id, OLD.email_id);

  IF email_status = 'sent' THEN
    RAISE EXCEPTION 'Cannot modify images for a sent email';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_sent_images_insert
  BEFORE INSERT ON monday_before_email_images
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_before_images();

CREATE TRIGGER trg_lock_sent_images_update
  BEFORE UPDATE ON monday_before_email_images
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_before_images();

CREATE TRIGGER trg_lock_sent_images_delete
  BEFORE DELETE ON monday_before_email_images
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_before_images();

-- RLS
ALTER TABLE monday_before_email_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read monday_before_email_images"
  ON monday_before_email_images FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can insert monday_before_email_images"
  ON monday_before_email_images FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin and team can update monday_before_email_images"
  ON monday_before_email_images FOR UPDATE
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can delete monday_before_email_images"
  ON monday_before_email_images FOR DELETE
  USING (is_admin_or_team());
