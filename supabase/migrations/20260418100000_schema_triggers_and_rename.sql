-- 1. Add first_dinner_attended to members
ALTER TABLE members ADD COLUMN first_dinner_attended DATE;

-- Backfill first_dinner_attended from existing tickets
UPDATE members m SET first_dinner_attended = (
  SELECT MIN(d.date)
  FROM tickets t
  JOIN dinners d ON t.dinner_id = d.id
  WHERE t.member_id = m.id
  AND t.fulfillment_status NOT IN ('refunded', 'credited')
);

-- 2. Rename has_attended to has_community_access
ALTER TABLE members RENAME COLUMN has_attended TO has_community_access;

-- 3. Combined trigger function for ticket INSERT:
--    - Set has_community_access = true on the member
--    - Set first_dinner_attended if null
CREATE OR REPLACE FUNCTION on_ticket_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_dinner_date DATE;
BEGIN
  SELECT date INTO v_dinner_date FROM dinners WHERE id = NEW.dinner_id;

  UPDATE members SET
    has_community_access = true,
    first_dinner_attended = CASE
      WHEN first_dinner_attended IS NULL THEN v_dinner_date
      ELSE first_dinner_attended
    END
  WHERE id = NEW.member_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_insert
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION on_ticket_insert();

-- 4. Combined trigger function for ticket UPDATE of fulfillment_status:
--    - On 'fulfilled': set last_dinner_attended if later than current
--    - On 'refunded'/'credited': recalculate last_dinner_attended and
--      revert first_dinner_attended if it matches this ticket's dinner
CREATE OR REPLACE FUNCTION on_ticket_fulfillment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_dinner_date DATE;
  v_new_last DATE;
  v_new_first DATE;
BEGIN
  IF OLD.fulfillment_status IS NOT DISTINCT FROM NEW.fulfillment_status THEN
    RETURN NEW;
  END IF;

  SELECT date INTO v_dinner_date FROM dinners WHERE id = NEW.dinner_id;

  IF NEW.fulfillment_status = 'fulfilled' THEN
    -- Set last_dinner_attended if this dinner is later
    UPDATE members SET
      last_dinner_attended = v_dinner_date
    WHERE id = NEW.member_id
    AND (last_dinner_attended IS NULL OR last_dinner_attended < v_dinner_date);

  ELSIF NEW.fulfillment_status IN ('refunded', 'credited') THEN
    -- Recalculate last_dinner_attended from remaining fulfilled tickets
    SELECT MAX(d.date) INTO v_new_last
    FROM tickets t
    JOIN dinners d ON t.dinner_id = d.id
    WHERE t.member_id = NEW.member_id
    AND t.fulfillment_status = 'fulfilled'
    AND t.id != NEW.id;

    UPDATE members SET last_dinner_attended = v_new_last
    WHERE id = NEW.member_id;

    -- Revert first_dinner_attended if it matches this ticket's dinner
    UPDATE members SET first_dinner_attended = NULL
    WHERE id = NEW.member_id
    AND first_dinner_attended = v_dinner_date;

    -- If we nulled it, recalculate from remaining non-refunded/credited tickets
    IF FOUND THEN
      SELECT MIN(d.date) INTO v_new_first
      FROM tickets t
      JOIN dinners d ON t.dinner_id = d.id
      WHERE t.member_id = NEW.member_id
      AND t.fulfillment_status NOT IN ('refunded', 'credited')
      AND t.id != NEW.id;

      UPDATE members SET first_dinner_attended = v_new_first
      WHERE id = NEW.member_id
      AND first_dinner_attended IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_fulfillment_change
  AFTER UPDATE OF fulfillment_status ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION on_ticket_fulfillment_change();
