-- DigiEric (CoachingOS) "Didn't come" → re-send flag.
--
-- The coachingos-attendee-sync cron only sends first-time attendees
-- (last_dinner_attended IS NULL). A no-show still gets last_dinner_attended
-- stamped by the post-dinner cron (it keys off fulfilled tickets, not actual
-- attendance), so they'd never be re-sent to DigiEric even if they attend a
-- future dinner. DigiEric's "Didn't come" button POSTs back here to arm this
-- flag; the sync then re-includes the member on their next fulfilled dinner
-- and clears the flag (one-shot pulse — re-armed by each "Didn't come").
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS coachingos_resend_requested boolean NOT NULL DEFAULT false;
