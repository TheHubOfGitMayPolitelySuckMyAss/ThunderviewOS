---
title: Seat cap
why: The dinners have finite seats; before this existed the homepage promised "Closes when full" but nothing enforced it — sales only stopped when the date passed.
what: Each dinner closes ticket sales automatically at its cap and reopens automatically if a refund or credit frees seats.
status: live
---

## How

`dinners.seat_cap` (integer, NOT NULL DEFAULT 45, CHECK > 0). Seats sold =
SUM of `tickets.quantity` over `purchased`/`fulfilled` rows — a with-guest
ticket is 2 seats. Sold-out is DERIVED live, never stored, so refunds and
credits reopen sales with no extra state (`getSeatsSold` /
`getSeatsSoldByDinner`, `src/lib/seat-cap.ts`; THROWS on DB error so a
failed count can't read as zero and reopen a full dinner).

Enforcement is in `purchaseTicket` before the Stripe session is created:
`seatsSold + quantity > seat_cap` → redirect. The portal UI (tickets page +
portal home) threads `seatsLeft` into `TicketPurchase`: "Sold out" button
state, guest button hidden at 1 seat left, "— Sold out" in the dinner
dropdown.

December dinners get 80 seats: `seatCapForMonth` (`DEFAULT_SEAT_CAP=45`,
`DECEMBER_SEAT_CAP=80`), applied by the generate-dinner cron at insert.
Admin edits any dinner's cap on `/admin/dinners/[id]` — the Purchased card's
"Cap: X" line, click to edit (`updateDinnerSeatCap`).

## Decisions

- **2026-08-04** — Cap enforced for the first time, hardcoded 45, derived
  not stored. Accepted race: Checkout sessions in flight at cap can
  overshoot; declining at the webhook would mean auto-refunding a completed
  charge — not worth it at this scale. (9ea5b74)
- **2026-08-04** — Per-dinner `seat_cap` column replaced the constant, at
  Eric's direction: "December can always have 80 guests … Maybe a max guests
  count on each dinner with a default of 45?" December rule lives in the
  generation cron; existing December rows backfilled by migration
  `add_dinners_seat_cap`. (44c2c71)
- **2026-08-04** — Admin UI: separate Seat Cap stat card merged into the
  Purchased card — Eric: "There's no reason to have two separate cards for
  that." Big number is sold; "Cap: X" underneath, click to edit. (41bba36)

## Graveyard

- **Stored sold-out/closed flag** — rejected at design time; deriving from
  active tickets makes refund-reopen free and can't drift stale. (9ea5b74)
- **Webhook-side enforcement (refund overflow purchases)** — rejected; the
  race window is tiny at this scale and auto-refunding completed charges is
  worse than an occasional +1 overshoot. (9ea5b74)
