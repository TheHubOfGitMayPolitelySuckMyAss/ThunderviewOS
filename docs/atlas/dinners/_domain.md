---
title: Dinners
why: The dinner is the product — a monthly first-Thursday event that must exist in the system a year ahead, carry its own venue/speakers/capacity, and trigger the right emails at the right hours without anyone remembering to.
what: Dinner rows generated automatically 12 months out, managed on an admin page, with the day-of and day-after automation keyed to their dates.
status: live
---

## How

`generate-dinner` cron (daily, acts the day after each first Thursday)
inserts the first-Thursday dinner 12 months out; skips January and July;
December dinners get `seat_cap=80`, all others default 45.

Admin page `/admin/dinners/[id]`: inline-editable venue/address/title/
description, speakers (member search), Purchased/Refunded/Credited counts
with the editable seat cap, per-ticket refund/credit actions, and the
manual "Send To Attendees" morning-of button (fallback — the morning-of
cron sends automatically at 8am MT on dinner day, idempotent via
`morning_of_sent_at`).

Post-dinner cron (daily): if yesterday was a dinner, stamps
`last_dinner_attended` for fulfilled-ticket holders and clears stale
`excluded_from_dinner_id`. The `known-quantity-csv` cron runs the same
morning: it uploads a CSV of everyone who held a fulfilled ticket in the
last 90 days (`WINDOW_DAYS=90`), one row per person, to Known Quantity's
tokenised intake URL. Dinners are monthly, so that's a monthly file.

## Decisions

- **2026-05-19** — First-time attendees pushed to CoachingOS on dinner day —
  the only Thunderview→CoachingOS flow. (a7632ea)
- **2026-06-05** — Morning-of send automated via cron; the admin button
  demoted to fallback. Send helper deliberately in `src/lib/` so it can't be
  POSTed as a public server action. (7da0405)
- **2026-06-21** — No-show loop: DigiEric "Didn't come" sets
  `coachingos_resend_requested`, next dinner's sync re-includes and clears —
  because `last_dinner_attended` stamps no-shows too. (f8cfdff)
  *Reversed 2026-09-21 — both sides of that loop are deleted.*
- **2026-08-04** — Per-dinner seat cap on the dinner row; see
  [tickets/seat-cap](../tickets/seat-cap.md). (44c2c71)

- **2026-09-21** — Dinner-day JSON push to CoachingOS replaced by a monthly
  CSV upload to Known Quantity the morning AFTER each dinner; their inbound
  webhook was deleted and started 404ing. Rolling 90-day window of everyone
  who held a fulfilled ticket, not just first-timers, so the no-show re-arm
  flag lost its purpose and the column was dropped. Kicked-out members ride
  along with a Membership Status column — Eric's call: the meeting happened,
  KQ decides what to do with it.

## Graveyard

- **Quoting newlines inside CSV fields** — RFC 4180 allows it; the KQ intake
  parser counts an embedded newline as a new record (a correct 2-record file
  came back `rows: 3`). Every field is flattened to one line instead.
- **January and July dinners** — off months by program design; the
  generation cron skips them.
