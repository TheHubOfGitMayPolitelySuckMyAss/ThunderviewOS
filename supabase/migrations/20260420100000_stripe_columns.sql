-- Add Stripe identifiers to tickets table
ALTER TABLE tickets ADD COLUMN stripe_session_id TEXT NULL;
ALTER TABLE tickets ADD COLUMN stripe_payment_intent_id TEXT NULL;

-- Partial unique index for idempotency (only where stripe_session_id is set)
CREATE UNIQUE INDEX idx_tickets_stripe_session_id
  ON tickets (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
