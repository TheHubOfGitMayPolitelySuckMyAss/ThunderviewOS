-- email_templates table for storing editable email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES members(id)
);

-- Auto-update updated_at trigger (same pattern as members)
CREATE OR REPLACE FUNCTION set_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read email_templates"
  ON email_templates FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can update email_templates"
  ON email_templates FOR UPDATE
  USING (is_admin_or_team());

-- Seed approval template
INSERT INTO email_templates (slug, subject, body) VALUES (
  'approval',
  'Welcome to the Thunderview Community!',
  E'Welcome aboard, [member.firstname]!\n\nI''m excited to let you know that you are now a member of the Thunderview community.\n\nPlease head over to <a href="https://thunderview-os.vercel.app/portal">the Thunderview Community Portal</a> where you can buy a ticket, search the community directory, enhance your profile and view recent community member''s Asks.\n\nNow that you''re in the community, you''ll never need to apply again. Just head to the Community Portal any time you want to buy a ticket for a dinner.\n\nIf you have any questions, feel free to respond to this email or drop me a note at <a href="mailto:eric@marcoullier.com">eric@marcoullier.com</a>.\n\nI hope to see you at a dinner soon.\n\nEric'
);
