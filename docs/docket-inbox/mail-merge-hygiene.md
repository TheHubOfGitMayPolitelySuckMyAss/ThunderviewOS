State: done (2026-09-27)

Done line:

- 2026-09-27 — Mail-merge deliverability hygiene (Eric-approved): From name now resolves from whoever owns the connected Gmail (send-as name → owning member's name → bare + `email.sender_name_missing` warning; never hardcoded — the first cut's "Eric Marcoullier" constant was caught by Eric and removed), one-click `List-Unsubscribe` on merge sends via the existing `/api/unsubscribe` (POST now 200), drain throttled from ~1/sec to 5/min (agent default, one constant in `mail-merge/pacing.ts`) via advisory-locked claim RPC. Deploy READY; live one-click POST verified on an invalid token (400) — no real merge sent. (atlas: email/_domain, f3658cb + sender-name fix)
