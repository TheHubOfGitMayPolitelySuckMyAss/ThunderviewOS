-- email_instances: per-dinner copies of marketing email templates
CREATE TABLE email_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug TEXT NOT NULL REFERENCES email_templates(slug),
  dinner_id UUID NOT NULL REFERENCES dinners(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'test_sent', 'sent')),
  test_sent_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES members(id),
  recipient_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES members(id),
  UNIQUE (template_slug, dinner_id)
);

-- Auto-update updated_at trigger
CREATE TRIGGER trg_email_instances_updated_at
  BEFORE UPDATE ON email_instances
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

-- RLS
ALTER TABLE email_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read email_instances"
  ON email_instances FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can insert email_instances"
  ON email_instances FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin and team can update email_instances"
  ON email_instances FOR UPDATE
  USING (is_admin_or_team());

-- Seed marketing macro templates (no-op if already exist)
INSERT INTO email_templates (slug, subject, body) VALUES
('monday-before', 'Thunderview Dinner This Thursday', E'Hi [member.firstname],\n\nJust a quick reminder that our next Thunderview CEO Dinner is this Thursday, [dinner.date].\n\nLocation: [dinner.venue], [dinner.address]\nTime: 6:00 PM - 9:00 PM\n\nIf you haven''t bought your ticket yet, head over to the Community Portal to grab one.\n\nSee you Thursday!\nEric'),
('monday-after', 'Thanks for a Great Dinner', E'Hi [member.firstname],\n\nThank you to everyone who joined us for last Thursday''s Thunderview CEO Dinner on [dinner.date].\n\nIf you attended, please take a moment to update your Intro and Ask on the Community Portal. This helps other members connect with you between dinners.\n\nSee you next time!\nEric')
ON CONFLICT (slug) DO NOTHING;
