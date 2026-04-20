-- Allow NULL for preferred_dinner_date (field removed from application form in Sprint 10)
ALTER TABLE applications ALTER COLUMN preferred_dinner_date DROP NOT NULL;
