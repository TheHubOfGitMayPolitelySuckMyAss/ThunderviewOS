# Migrations

Applied to the cloud project directly (Supabase MCP `apply_migration`), never
via a local stack. Every applied migration has a file here — verified
2026-08-18.

**Do not run `supabase db push`.** The filenames here and the versions recorded
in `supabase_migrations.schema_migrations` are two different numbering
universes: the same change is often filed under a different timestamp (and
sometimes a different name — `member_emails` here is `member_emails_v3` there).
A push would treat already-applied migrations as new and try to re-run them.
Reconciling the two would mean rewriting ~40 history rows; nobody needs that
until a local stack or a from-scratch rebuild is actually on the table.

Apply new migrations with `apply_migration`, then commit a file here with the
**same version prefix and name** it was recorded under, so the two stay in step
going forward.
