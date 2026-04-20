-- Add 'comp' to payment_source CHECK constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_payment_source_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_payment_source_check
  CHECK (payment_source IN ('squarespace', 'credit', 'historical', 'portal', 'comp'));
