-- Remove last_dinner_attended update from fulfillment trigger.
-- last_dinner_attended is now set by the post-dinner cron (day after each dinner).
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

  IF NEW.fulfillment_status IN ('refunded', 'credited') THEN
    -- Recalculate last_dinner_attended from remaining fulfilled tickets
    -- Only consider past dinners (date <= today)
    SELECT MAX(d.date) INTO v_new_last
    FROM tickets t
    JOIN dinners d ON t.dinner_id = d.id
    WHERE t.member_id = NEW.member_id
    AND t.fulfillment_status = 'fulfilled'
    AND t.id != NEW.id
    AND d.date <= CURRENT_DATE;

    UPDATE members SET last_dinner_attended = v_new_last
    WHERE id = NEW.member_id;

    -- Revert first_dinner_attended if it matches this ticket's dinner
    UPDATE members SET first_dinner_attended = NULL
    WHERE id = NEW.member_id
    AND first_dinner_attended = v_dinner_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix Eric's last_dinner_attended (was incorrectly set to future dinner)
UPDATE members SET last_dinner_attended = '2026-04-03'
WHERE id = '8440da17-b5ee-47b9-a35e-b3d7624fa9ae';
