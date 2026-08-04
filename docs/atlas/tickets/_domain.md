---
title: Tickets
why: Dinners are paid, capacity-bound events; entry has to be purchasable by members, refundable by the admin, and truthful about what "fulfilled" does and doesn't mean.
what: A Stripe-checkout purchase flow producing one ticket row per member per dinner, with fulfillment emails, refunds/credits, and a per-dinner seat cap that closes and reopens sales automatically.
status: live
---

## How

Members buy from the portal (`purchaseTicket`,
`src/app/portal/tickets/actions.ts` → Stripe Checkout → webhook inserts the
ticket). A with-guest purchase is one row with `quantity=2`. Price comes
from stagetype (`getTicketInfo`). The webhook sends an admin alert for
portal purchases only.

`fulfillment_status='fulfilled'` means "dinner-details email sent" — NOT
attended (attendance isn't tracked). Next-dinner tickets auto-fulfill on the
webhook; further-out tickets wait for the daily fulfill-tickets cron.
Refund/credit from `/admin/dinners/[id]` (full or guest-only $40).

Seat cap: per-dinner `dinners.seat_cap`, sold-out derived live — see
[seat-cap](seat-cap.md).

Ticket INSERT trigger sets `first_dinner_attended` (if null) and
`has_community_access`; `last_dinner_attended` is set by the post-dinner
cron, not the trigger.

## Decisions

- **2026-05-12** — Admin email alert on portal purchases only (hook in the
  Stripe handler, not the INSERT trigger, so comp/credit/historical don't
  fire). (795c184)
- **2026-05-13** — Notification showed $0.40: amount was cents-vs-dollars.
  (57aa67e)

## Graveyard

- **Tracking actual attendance** — not built by design; `fulfilled` gates
  the fulfillment email and nothing else. CoachingOS no-show handling works
  around it via the resend-request flag instead.
