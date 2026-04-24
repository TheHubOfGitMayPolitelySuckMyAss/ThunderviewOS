-- Add current_give text field to members (no timestamp tracking)
ALTER TABLE members ADD COLUMN current_give TEXT;
