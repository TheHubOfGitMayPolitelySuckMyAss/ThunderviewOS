-- Add morning_of_sent_at to dinners so morning-of cron is idempotent
ALTER TABLE dinners ADD COLUMN morning_of_sent_at TIMESTAMPTZ NULL;
