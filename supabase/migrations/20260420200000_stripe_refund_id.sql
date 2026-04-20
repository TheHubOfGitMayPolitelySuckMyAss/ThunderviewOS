-- Add Stripe refund ID to tickets table
ALTER TABLE tickets ADD COLUMN stripe_refund_id TEXT NULL;
