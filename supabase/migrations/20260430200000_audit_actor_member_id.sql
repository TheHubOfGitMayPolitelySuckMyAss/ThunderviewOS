-- Plumb explicit actor_member_id into audit.row_history so admin server
-- actions (which use the service-role client) can attribute their writes
-- without auth.uid().
--
-- Mechanism: PostgREST sets per-request GUCs including `request.headers`,
-- a JSON object of all incoming HTTP headers. These GUCs are scoped to the
-- request's own transaction — under Supabase's transaction-pooled connections,
-- a header value set on one request CANNOT leak into another request that
-- reuses the same physical connection. (Each request opens a new transaction;
-- when it commits/rolls back, the GUC is reset.) This is the connection-pool-
-- safe alternative to session-level SET, which WOULD leak under pooling.
--
-- Server-side: the audit trigger reads `request.headers['x-audit-actor']` and
-- writes it to actor_member_id.
-- Client-side: `createAdminClientForCurrentActor()` attaches the header to
-- every request from that client.

ALTER TABLE audit.row_history
  ADD COLUMN actor_member_id UUID NULL;

CREATE INDEX idx_audit_actor_member_id
  ON audit.row_history (actor_member_id)
  WHERE actor_member_id IS NOT NULL;

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
  v_actor_member UUID;
  v_headers TEXT;
BEGIN
  IF TG_TABLE_NAME = 'dinner_speakers' THEN
    IF TG_OP = 'DELETE' THEN
      v_row_pk := jsonb_build_object('dinner_id', OLD.dinner_id, 'member_id', OLD.member_id);
    ELSE
      v_row_pk := jsonb_build_object('dinner_id', NEW.dinner_id, 'member_id', NEW.member_id);
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_row_pk := jsonb_build_object('id', OLD.id);
    ELSE
      v_row_pk := jsonb_build_object('id', NEW.id);
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := to_jsonb(OLD);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := to_jsonb(NEW);
  END IF;

  -- auth.uid() works for session-client calls (portal self-edits).
  -- Returns NULL for service-role calls.
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  -- Read x-audit-actor header set by service-role admin clients that opt in.
  -- request.headers is a per-request GUC set by PostgREST; safe under pooling.
  BEGIN
    v_headers := current_setting('request.headers', true);
    IF v_headers IS NOT NULL AND v_headers <> '' THEN
      v_actor_member := (v_headers::jsonb ->> 'x-audit-actor')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_actor_member := NULL;
  END;

  INSERT INTO audit.row_history (
    table_schema, table_name, op, row_pk, old_row, new_row,
    changed_by, changed_by_role, actor_member_id
  )
  VALUES (
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, v_row_pk, v_old, v_new,
    v_uid, current_user, v_actor_member
  );

  RETURN NULL;
END;
$$;

ALTER FUNCTION audit.log_row_change() OWNER TO postgres;
