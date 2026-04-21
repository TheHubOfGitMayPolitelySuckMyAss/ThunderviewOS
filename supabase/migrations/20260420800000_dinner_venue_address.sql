-- Add address column to dinners (venue already exists with default 'TBD')
ALTER TABLE dinners ADD COLUMN address TEXT NOT NULL DEFAULT '3960 High St, Denver, CO 80205';

-- Update venue default from 'TBD' to 'ID345'
ALTER TABLE dinners ALTER COLUMN venue SET DEFAULT 'ID345';

-- Backfill future dinners (May 2026 onward)
UPDATE dinners SET venue = 'ID345', address = '3960 High St, Denver, CO 80205' WHERE date >= '2026-05-01';
