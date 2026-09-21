-- Known Quantity (formerly CoachingOS) rebuilt its intake as a monthly CSV
-- push; its inbound webhook was deleted and the "Didn't come" button with it.
-- Our /api/webhooks/coachingos/no-show receiver is gone, so this flag has no
-- writer and no reader. The monthly CSV sends every attendee in a rolling
-- 90-day window, not just first-timers, so the re-arm pulse is moot.
--
-- If "bought a ticket and didn't show" ever matters again, it's a new column
-- with an internal writer — this one carried no history worth keeping.
ALTER TABLE members
  DROP COLUMN IF EXISTS coachingos_resend_requested;
