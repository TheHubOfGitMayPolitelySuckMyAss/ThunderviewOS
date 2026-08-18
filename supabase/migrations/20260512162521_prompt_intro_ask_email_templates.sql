-- Two rows for the "Prompt for Intro/Ask" transactional email. One logical
-- email, two conditional bodies. The cron picks the slug at send time based
-- on each recipient's intro/ask state.
--   *_missing  → fires when current_intro IS NULL/empty AND current_ask IS NULL/empty
--   *_stale    → fires when both filled but ask_updated_at <= last_dinner_attended
INSERT INTO public.email_templates (slug, subject, body)
VALUES
  ('prompt-intro-ask-missing', 'Help us help you on [dinner.date]', 'Hi [member.firstname], TODO write the body for members missing their Intro and Ask.'),
  ('prompt-intro-ask-stale',   'Refresh your Ask for [dinner.date]', 'Hi [member.firstname], TODO write the body for members with a stale Ask.')
ON CONFLICT (slug) DO NOTHING;
