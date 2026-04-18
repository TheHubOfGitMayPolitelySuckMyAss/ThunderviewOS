-- Add quantity column to tickets (for +1 guest tickets)
ALTER TABLE tickets ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Add 'portal' to payment_source CHECK constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_payment_source_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_payment_source_check
  CHECK (payment_source IN ('squarespace', 'credit', 'historical', 'portal'));
