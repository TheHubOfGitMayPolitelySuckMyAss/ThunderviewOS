-- Track who manually sent the morning-of email
ALTER TABLE dinners ADD COLUMN morning_of_sent_by UUID REFERENCES members(id);
