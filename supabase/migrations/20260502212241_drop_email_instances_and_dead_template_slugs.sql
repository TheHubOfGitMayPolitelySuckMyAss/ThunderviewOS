-- Cleanup: drop the orphaned email_instances table and its two dead template slugs.
--
-- email_instances was the original generic per-dinner email system. It was
-- superseded by the dedicated monday_before_emails / monday_after_emails tables
-- (with their own dedicated routes, templates, and image pipelines). The table
-- had 0 rows and 0 audit history; no app code reads or writes it after the
-- /admin/emails/instances/[id]/ route was removed.
--
-- The two slugs `monday-before` and `monday-after` in email_templates were only
-- ever loaded by that dead route. The 5 live transactional templates remain:
-- approval, re-application, rejection, fulfillment, morning-of.

DROP TABLE IF EXISTS public.email_instances;

DELETE FROM public.email_templates
WHERE slug IN ('monday-before', 'monday-after');
