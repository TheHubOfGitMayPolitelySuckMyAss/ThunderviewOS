-- The activity_feed view UNIONs from audit.row_history. The view is created
-- WITH (security_invoker = true) so it runs with the caller's privileges.
-- Without explicit grants, neither service_role nor authenticated can read
-- the audit table even though an admin/team RLS policy exists — they don't
-- even have USAGE on the audit schema, so RLS never gets a chance to apply.
-- Symptom: PostgREST returns "permission denied for table row_history" on
-- every query against activity_feed.
--
-- Grant the minimum needed:
--   - USAGE on schema audit (so callers can reference audit.row_history)
--   - SELECT on audit.row_history (RLS still gates rows for authenticated;
--     service_role bypasses RLS)

GRANT USAGE ON SCHEMA audit TO service_role, authenticated;
GRANT SELECT ON audit.row_history TO service_role, authenticated;
