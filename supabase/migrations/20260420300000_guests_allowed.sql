-- Add guests_allowed flag to dinners
ALTER TABLE dinners ADD COLUMN guests_allowed BOOLEAN NOT NULL DEFAULT false;

-- Backfill: December dinners get guests_allowed = true
UPDATE dinners SET guests_allowed = true WHERE EXTRACT(MONTH FROM date) = 12;
