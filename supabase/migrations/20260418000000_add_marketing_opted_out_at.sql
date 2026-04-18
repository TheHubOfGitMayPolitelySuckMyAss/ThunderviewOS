-- Add marketing_opted_out_at column to members
ALTER TABLE members ADD COLUMN marketing_opted_out_at TIMESTAMPTZ;

-- Trigger function: set/clear marketing_opted_out_at when marketing_opted_in changes
CREATE OR REPLACE FUNCTION set_marketing_opted_out_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.marketing_opted_in IS DISTINCT FROM OLD.marketing_opted_in THEN
    IF NEW.marketing_opted_in = false THEN
      NEW.marketing_opted_out_at = now();
    ELSE
      NEW.marketing_opted_out_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketing_opted_out_at
  BEFORE UPDATE OF marketing_opted_in ON members
  FOR EACH ROW
  EXECUTE FUNCTION set_marketing_opted_out_at();

-- Backfill: existing opted-out members get updated_at as best-guess timestamp
UPDATE members
SET marketing_opted_out_at = updated_at
WHERE marketing_opted_in = false AND marketing_opted_out_at IS NULL;
