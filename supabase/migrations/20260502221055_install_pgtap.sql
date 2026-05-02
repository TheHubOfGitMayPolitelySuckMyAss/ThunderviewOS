-- Install pgTAP for in-database unit testing.
-- pgTAP provides assertion helpers (ok, is, throws_ok, results_eq, etc.)
-- so test files can be plain SQL run inside BEGIN; ... ROLLBACK; blocks.
-- Functions land in the extensions schema to keep public clean.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
