-- Rename fulfillment_status 'pending' → 'purchased'
-- Step 1: Drop old CHECK constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_fulfillment_status_check;

-- Step 2: Backfill existing rows
UPDATE tickets SET fulfillment_status = 'purchased' WHERE fulfillment_status = 'pending';

-- Step 3: Add new CHECK constraint with 'purchased' replacing 'pending'
ALTER TABLE tickets ADD CONSTRAINT tickets_fulfillment_status_check
  CHECK (fulfillment_status IN ('purchased', 'fulfilled', 'refunded', 'credited'));
