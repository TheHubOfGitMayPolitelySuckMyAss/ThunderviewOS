-- Mail merge system: personal one-to-one-looking emails sent through Eric's
-- Gmail (not Resend), replacing Streak's mail merge. Audience = the Streak
-- stage-precedence ladder (compute-stage.ts), which survives the Streak
-- teardown as the segmentation engine.
--
-- Three tables:
--   google_oauth_tokens   — single-row Google OAuth token store (gmail.send).
--                           Service-role only; RLS enabled with NO policies.
--   mail_merges           — draft/sending/sent artifact, sent-locked.
--   mail_merge_recipients — frozen audience + send queue + per-bucket counts,
--                           one row per recipient with individual status.

-- ============================================================
-- 1. Google OAuth token store (single row, secrets — service-role only)
-- ============================================================
CREATE TABLE google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (lock = TRUE),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scope TEXT,
  connected_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_google_oauth_tokens_updated_at
  BEFORE UPDATE ON google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

-- RLS on, zero policies: only the service-role client can touch raw tokens.
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Mail merges (draft -> sending -> sent; sent rows immutable)
-- ============================================================
CREATE TABLE mail_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  -- Selected send groups (buckets from the precedence ladder). Only
  -- 'investors' / 'attended' / 'approved' are selectable; 'team' is always
  -- included implicitly at audience-freeze time.
  groups TEXT[] NOT NULL DEFAULT '{}',
  test_sent_at TIMESTAMPTZ,
  test_sent_after_last_edit BOOLEAN NOT NULL DEFAULT FALSE,
  send_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mail_merges_updated_at
  BEFORE UPDATE ON mail_merges
  FOR EACH ROW
  EXECUTE FUNCTION set_email_templates_updated_at();

CREATE OR REPLACE FUNCTION lock_sent_mail_merge()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'sent' THEN
    RAISE EXCEPTION 'Cannot modify a sent mail merge (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_sent_mail_merge
  BEFORE UPDATE ON mail_merges
  FOR EACH ROW
  EXECUTE FUNCTION lock_sent_mail_merge();

ALTER TABLE mail_merges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read mail_merges"
  ON mail_merges FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin and team can insert mail_merges"
  ON mail_merges FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin and team can update mail_merges"
  ON mail_merges FOR UPDATE
  USING (is_admin_or_team());

-- ============================================================
-- 3. Recipients: frozen audience + send queue, one row per person
-- ============================================================
CREATE TABLE mail_merge_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_merge_id UUID NOT NULL REFERENCES mail_merges(id),
  member_id UUID NOT NULL REFERENCES members(id),
  first_name TEXT NOT NULL,
  -- NULL when the member had no active email at freeze time (row is created
  -- as 'skipped' so the gap is visible, never silent).
  email TEXT,
  -- Ladder bucket this person occupied at freeze time: team / investors /
  -- attended / approved.
  bucket TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  gmail_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mail_merge_id, member_id)
);

CREATE INDEX idx_mail_merge_recipients_merge_status
  ON mail_merge_recipients (mail_merge_id, status);

ALTER TABLE mail_merge_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read mail_merge_recipients"
  ON mail_merge_recipients FOR SELECT
  USING (is_admin_or_team());

-- Writes happen only through the service-role client (audience freeze +
-- drain), which bypasses RLS. No insert/update policies on purpose.

-- ============================================================
-- 4. Atomic claim: pluck ONE pending recipient of a sending merge.
-- FOR UPDATE SKIP LOCKED so overlapping drain runs (send-action kickoff +
-- per-minute cron) can never double-claim — and therefore never double-send.
-- Claim-one (not batch) keeps the crash blast radius to a single row.
-- ============================================================
CREATE OR REPLACE FUNCTION claim_mail_merge_recipient()
RETURNS SETOF mail_merge_recipients
LANGUAGE sql
AS $$
  UPDATE mail_merge_recipients
  SET status = 'processing', claimed_at = NOW()
  WHERE id = (
    SELECT r.id
    FROM mail_merge_recipients r
    JOIN mail_merges m ON m.id = r.mail_merge_id
    WHERE r.status = 'pending' AND m.status = 'sending'
    ORDER BY r.created_at, r.id
    LIMIT 1
    FOR UPDATE OF r SKIP LOCKED
  )
  RETURNING *;
$$;

REVOKE EXECUTE ON FUNCTION claim_mail_merge_recipient() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_mail_merge_recipient() FROM anon;
REVOKE EXECUTE ON FUNCTION claim_mail_merge_recipient() FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_mail_merge_recipient() TO service_role;
