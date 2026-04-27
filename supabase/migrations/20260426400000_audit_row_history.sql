-- Audit logging: captures before/after snapshots of every INSERT, UPDATE, DELETE
-- on business-critical tables for individual row recovery.
--
-- Covers: members, applications, tickets, credits, member_emails, dinners,
--         dinner_speakers, email_templates, email_instances.
--
-- Does NOT cover: monday_before_*, monday_after_* (lower recovery value,
-- already have lock triggers preventing post-send edits).
--
-- Limitations: TRUNCATE and DROP TABLE bypass row-level triggers and are NOT
-- captured. Use Supabase PITR backups for catastrophic DDL recovery.

-- 1. Separate schema keeps audit data out of the public namespace
CREATE SCHEMA IF NOT EXISTS audit;

-- 2. History table
CREATE TABLE audit.row_history (
  id          BIGSERIAL PRIMARY KEY,
  table_schema TEXT        NOT NULL,
  table_name   TEXT        NOT NULL,
  op           TEXT        NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  row_pk       JSONB       NOT NULL,
  old_row      JSONB,                  -- null on INSERT
  new_row      JSONB,                  -- null on DELETE
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by   UUID,                   -- auth.uid() when available, else null
  changed_by_role TEXT                 -- current_user (postgres, anon, authenticated, etc.)
);

-- 3. Indexes
--    Composite for querying a specific table's history by time
CREATE INDEX idx_audit_table_changed_at
  ON audit.row_history (table_schema, table_name, changed_at DESC);

--    Look up history for a specific row by its PK
CREATE INDEX idx_audit_table_row_pk
  ON audit.row_history (table_schema, table_name, ((row_pk->>'id')));

--    BRIN on changed_at for efficient time-range scans on the append-only table
CREATE INDEX idx_audit_changed_at_brin
  ON audit.row_history USING brin (changed_at);

-- 4. Trigger function
--
--    PK resolution: hardcoded rather than information_schema lookup.
--    Every audited table uses "id" UUID as PK except dinner_speakers which
--    has a composite PK (dinner_id, member_id). Hardcoding avoids a catalog
--    query on every row change. If a new table is added to audit, add its
--    PK pattern here.
--
--    Trigger naming: all audit triggers are prefixed "zzz_audit_" so they
--    fire after all other AFTER triggers on the same table (Postgres fires
--    same-timing triggers in alphabetical order). This ensures the audit
--    snapshot captures the final state including trigger-driven changes
--    (updated_at, marketing_opted_out_at, etc.).

CREATE OR REPLACE FUNCTION audit.log_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public
AS $$
DECLARE
  v_row_pk JSONB;
  v_old    JSONB;
  v_new    JSONB;
  v_uid    UUID;
BEGIN
  -- Build row_pk based on table
  IF TG_TABLE_NAME = 'dinner_speakers' THEN
    -- Composite PK
    IF TG_OP = 'DELETE' THEN
      v_row_pk := jsonb_build_object('dinner_id', OLD.dinner_id, 'member_id', OLD.member_id);
    ELSE
      v_row_pk := jsonb_build_object('dinner_id', NEW.dinner_id, 'member_id', NEW.member_id);
    END IF;
  ELSE
    -- Single "id" PK (all other audited tables)
    IF TG_OP = 'DELETE' THEN
      v_row_pk := jsonb_build_object('id', OLD.id);
    ELSE
      v_row_pk := jsonb_build_object('id', NEW.id);
    END IF;
  END IF;

  -- Capture old/new row
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := to_jsonb(OLD);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := to_jsonb(NEW);
  END IF;

  -- Try to read auth.uid(); may not exist in cron/migration contexts
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  INSERT INTO audit.row_history (table_schema, table_name, op, row_pk, old_row, new_row, changed_by, changed_by_role)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, v_row_pk, v_old, v_new, v_uid, current_user);

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$;

-- Ensure the function is owned by postgres so SECURITY DEFINER has full write access
ALTER FUNCTION audit.log_row_change() OWNER TO postgres;

-- 5. Attach triggers (zzz_ prefix ensures they fire last)

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.credits
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.member_emails
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.dinners
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.dinner_speakers
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

CREATE TRIGGER zzz_audit_row_change
  AFTER INSERT OR UPDATE OR DELETE ON public.email_instances
  FOR EACH ROW EXECUTE FUNCTION audit.log_row_change();

-- 6. RLS: only admin/team can read audit history; writes happen via SECURITY DEFINER trigger only

ALTER TABLE audit.row_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read audit history"
  ON audit.row_history
  FOR SELECT
  USING (public.is_admin_or_team());
