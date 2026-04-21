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

-- Seed templates
INSERT INTO email_templates (slug, subject, body) VALUES
('approval', 'Welcome to the Thunderview Community!', E'Welcome aboard, [member.firstname]!\n\nI''m excited to let you know that you are now a member of the Thunderview community.\n\nPlease head over to <a href="https://thunderview-os.vercel.app/portal">the Thunderview Community Portal</a> where you can buy a ticket, search the community directory, enhance your profile and view recent community member''s Asks.\n\nNow that you''re in the community, you''ll never need to apply again. Just head to the Community Portal any time you want to buy a ticket for a dinner.\n\nIf you have any questions, feel free to respond to this email or drop me a note at <a href="mailto:eric@marcoullier.com">eric@marcoullier.com</a>.\n\nI hope to see you at a dinner soon.\n\nEric'),
('re-application', 'You''re Already a Thunderview Member!', E'Hey [member.firstname],\n\nWe received your application to Thunderview CEO Dinners, but you''re already a member! No need to apply again.\n\nWhenever you''d like to attend a dinner, just head to <a href="https://thunderview-os.vercel.app/portal/tickets">the Thunderview Community Portal</a> and buy a ticket.\n\nIf you think this is an error or you have any questions, feel free to reply to this email or reach out to <a href="mailto:eric@marcoullier.com">eric@marcoullier.com</a>.\n\nEric'),
('rejection', 'Your Thunderview Application', E'Hi [applicant.firstname],\n\nThank you for your interest in Thunderview CEO Dinners. After reviewing your application, we''re not able to offer you a spot at this time.\n\nThunderview is specifically designed for active startup CEOs and we have limited capacity at each dinner, so we unfortunately can''t accommodate everyone who applies.\n\nIf your situation changes or you have questions, feel free to reach out to <a href="mailto:eric@marcoullier.com">eric@marcoullier.com</a>.\n\nBest,\nEric'),
('fulfillment', 'Your Thunderview Dinner Details', E'Hi [member.firstname],\n\nYou''re confirmed for the Thunderview CEO Dinner on [dinner.date]!\n\nHere are the details:\n\nTime: 6:00 PM - 9:00 PM\nLocation: [dinner.venue], [dinner.address]\n\nA few things to know:\n- Please update your Intro and Ask on <a href="https://thunderview-os.vercel.app/portal">the Community Portal</a> before the dinner. This is how other attendees will get to know you.\n- Arrive on time — we start seating right at 6:00 PM.\n- If you can no longer attend, you can request a credit or refund through the portal.\n\nIf you have any questions, reply to this email or reach out to <a href="mailto:eric@marcoullier.com">eric@marcoullier.com</a>.\n\nSee you there!\nEric'),
('morning-of', 'Tonight''s Thunderview Dinner', E'Hi [member.firstname],\n\nTonight''s the night! Here are the details for this evening''s Thunderview CEO Dinner:\n\nTime: 6:00 PM - 9:00 PM\nLocation: [dinner.venue], [dinner.address]\n\nBelow you''ll find the intros and asks from tonight''s attendees. Take a few minutes to look through them before the dinner — it''ll help you make the most of the evening.\n\nSee you tonight!\nEric');
