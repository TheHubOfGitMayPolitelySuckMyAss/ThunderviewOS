-- Per-dinner seat cap. Default 45; December dinners hold 80.
-- Sold-out remains DERIVED (seats sold vs this cap) — no stored closed flag.
ALTER TABLE dinners
  ADD COLUMN seat_cap integer NOT NULL DEFAULT 45
  CHECK (seat_cap > 0);

UPDATE dinners SET seat_cap = 80 WHERE EXTRACT(MONTH FROM date) = 12;
