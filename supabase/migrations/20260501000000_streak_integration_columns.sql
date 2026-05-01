-- Sprint 20 — Streak integration foundations.
--
-- Adds the columns the OS needs to mirror its state into Streak. No code is
-- wired to call Streak from any state-change site yet (that is Prompt B); this
-- migration ships with the library scaffolding only.
--
-- streak_box_key:  per-row pointer to the Streak box that mirrors this row.
--                  Set on first push, persisted thereafter so subsequent pushes
--                  update in place rather than creating duplicates.
-- excluded_from_dinner_id (members): tracks "Not This One" state, set by the
--                  inbound Streak webhook in Prompt B and cleared by the
--                  post-dinner cron extension once the dinner has passed.
--                  ON DELETE SET NULL keeps the dinner authoritative — if a
--                  dinner is ever removed, exclusion silently clears.

ALTER TABLE applications
  ADD COLUMN streak_box_key TEXT NULL;

ALTER TABLE members
  ADD COLUMN streak_box_key TEXT NULL,
  ADD COLUMN excluded_from_dinner_id UUID NULL
    REFERENCES dinners(id) ON DELETE SET NULL;
