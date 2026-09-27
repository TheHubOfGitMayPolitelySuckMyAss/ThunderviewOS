State: done (2026-09-27)

Done line:

- 2026-09-27 — Mail-merge deliverability hygiene (Eric-approved): From now `Eric Marcoullier <eric@marcoullier.com>` (Gmail send-as name was empty), one-click `List-Unsubscribe` on merge sends via the existing `/api/unsubscribe` (POST now 200), drain throttled from ~1/sec to 5/min (agent default, one constant in `mail-merge/pacing.ts`) via advisory-locked claim RPC. Deploy READY; live one-click POST verified on an invalid token (400) — no real merge sent. (atlas: email/_domain, f3658cb)
