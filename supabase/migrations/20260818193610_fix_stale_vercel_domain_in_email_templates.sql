-- The 2026-05-08 cutover to thunderviewceodinners.com left the seeded
-- transactional templates pointing at the pre-cutover vercel.app host.
-- Clicking those links lands members on a host that is NOT in Supabase's
-- redirect allow-list, so any magic link requested from there falls back to
-- Site URL and can never complete /auth/confirm.
UPDATE email_templates
SET body = replace(body, 'https://thunderview-os.vercel.app', 'https://thunderviewceodinners.com')
WHERE body LIKE '%thunderview-os.vercel.app%';
