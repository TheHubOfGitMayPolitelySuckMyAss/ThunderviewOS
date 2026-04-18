-- Add intro_updated_at column to members
ALTER TABLE members ADD COLUMN intro_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Trigger function: set intro_updated_at = now() when current_intro actually changes
CREATE OR REPLACE FUNCTION set_intro_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_intro IS DISTINCT FROM OLD.current_intro THEN
    NEW.intro_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_intro_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION set_intro_updated_at();
