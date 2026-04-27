-- Monday After email system: macro template + per-dinner drafts + image groups

-- ============================================================
-- 1. Macro template (singleton row)
-- ============================================================
CREATE TABLE monday_after_macro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton = TRUE),
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  opening_text TEXT NOT NULL DEFAULT '',
  recap_text TEXT NOT NULL DEFAULT '',
  team_shoutouts TEXT NOT NULL DEFAULT '',
  our_mission TEXT NOT NULL DEFAULT '',
  intros_asks_header TEXT NOT NULL DEFAULT '',
  partnership_boilerplate TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES members(id)
);

INSERT INTO monday_after_macro (singleton) VALUES (TRUE);

CREATE TRIGGER trg_monday_after_macro_updated_at
  BEFORE UPDATE ON monday_after_macro
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

ALTER TABLE monday_after_macro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read monday_after_macro"
  ON monday_after_macro FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can update monday_after_macro"
  ON monday_after_macro FOR UPDATE
  USING (is_admin_or_team());

-- ============================================================
-- 2. Per-dinner email drafts
-- ============================================================
CREATE TABLE monday_after_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dinner_id UUID NOT NULL UNIQUE REFERENCES dinners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  opening_text TEXT NOT NULL DEFAULT '',
  recap_text TEXT NOT NULL DEFAULT '',
  team_shoutouts TEXT NOT NULL DEFAULT '',
  our_mission TEXT NOT NULL DEFAULT '',
  intros_asks_header TEXT NOT NULL DEFAULT '',
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

CREATE TRIGGER trg_monday_after_emails_updated_at
  BEFORE UPDATE ON monday_after_emails
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

CREATE OR REPLACE FUNCTION lock_sent_monday_after_email()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'sent' THEN
    RAISE EXCEPTION 'Cannot modify a sent email (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_sent_monday_after_email
  BEFORE UPDATE ON monday_after_emails
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_after_email();

ALTER TABLE monday_after_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read monday_after_emails"
  ON monday_after_emails FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can insert monday_after_emails"
  ON monday_after_emails FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin and team can update monday_after_emails"
  ON monday_after_emails FOR UPDATE
  USING (is_admin_or_team());

-- ============================================================
-- 3. Image groups (5 groups: 1, 2, 3, 4, 5)
-- ============================================================
CREATE TABLE monday_after_email_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES monday_after_emails(id) ON DELETE CASCADE,
  group_number INT NOT NULL CHECK (group_number IN (1, 2, 3, 4, 5)),
  display_order INT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_monday_after_email_images_order
  ON monday_after_email_images(email_id, group_number, display_order);

CREATE OR REPLACE FUNCTION lock_sent_monday_after_images()
RETURNS TRIGGER AS $$
DECLARE
  email_status TEXT;
BEGIN
  SELECT status INTO email_status
    FROM monday_after_emails
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

CREATE TRIGGER trg_lock_sent_after_images_insert
  BEFORE INSERT ON monday_after_email_images
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_after_images();

CREATE TRIGGER trg_lock_sent_after_images_update
  BEFORE UPDATE ON monday_after_email_images
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_after_images();

CREATE TRIGGER trg_lock_sent_after_images_delete
  BEFORE DELETE ON monday_after_email_images
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_monday_after_images();

ALTER TABLE monday_after_email_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read monday_after_email_images"
  ON monday_after_email_images FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can insert monday_after_email_images"
  ON monday_after_email_images FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin and team can update monday_after_email_images"
  ON monday_after_email_images FOR UPDATE
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can delete monday_after_email_images"
  ON monday_after_email_images FOR DELETE
  USING (is_admin_or_team());
