-- Thunderview OS - Seed Data (development only)
-- Run with: psql or via Supabase SQL Editor

-- ============================================================
-- DINNERS: First Thursday of each month, 12 months out, skip Jan & Jul
-- Starting from May 2026 (today is April 15, 2026)
-- ============================================================

INSERT INTO dinners (date, venue) VALUES
  ('2026-05-07', 'TBD'),  -- May 2026
  ('2026-06-04', 'TBD'),  -- Jun 2026
  -- skip July
  ('2026-08-06', 'TBD'),  -- Aug 2026
  ('2026-09-03', 'TBD'),  -- Sep 2026
  ('2026-10-01', 'TBD'),  -- Oct 2026
  ('2026-11-05', 'TBD'),  -- Nov 2026
  ('2026-12-03', 'TBD'),  -- Dec 2026
  -- skip January
  ('2027-02-04', 'TBD'),  -- Feb 2027
  ('2027-03-04', 'TBD'),  -- Mar 2027
  ('2027-04-01', 'TBD')   -- Apr 2027
ON CONFLICT (date) DO NOTHING;

-- ============================================================
-- MEMBERS
-- ============================================================

INSERT INTO members (id, name, email, company_name, company_website, attendee_stagetype, is_team, linkedin_profile, marketing_opted_in, kicked_out, has_attended, current_intro, current_ask, ask_updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Eric Marcoullier', 'eric@marcoullier.com', 'Thunderview', 'https://thunderview.com', 'Guest (Speaker/Press/Etc)', true, 'https://linkedin.com/in/ericmarcoullier', true, false, true, 'I run Thunderview CEO Dinners', 'Looking for speakers for upcoming dinners', now()),
  ('a0000000-0000-0000-0000-000000000002', 'Sarah Chen', 'sarah@example.com', 'TeamCo', 'https://teamco.example.com', 'Active CEO (Bootstrapping or VC-Backed)', true, 'https://linkedin.com/in/sarachen', true, false, true, 'CEO of TeamCo, Series A startup', NULL, now()),
  ('a0000000-0000-0000-0000-000000000003', 'Mike Johnson', 'mike@example.com', 'StartupX', 'https://startupx.example.com', 'Active CEO (Bootstrapping or VC-Backed)', false, 'https://linkedin.com/in/mikejohnson', true, false, true),
  ('a0000000-0000-0000-0000-000000000004', 'Lisa Park', 'lisa@example.com', 'OldCo', 'https://oldco.example.com', 'Exited CEO (Acquisition or IPO)', false, 'https://linkedin.com/in/lisapark', true, true, true),
  ('a0000000-0000-0000-0000-000000000005', 'Dave Wilson', 'dave@example.com', 'FundCap', 'https://fundcap.example.com', 'Investor', false, 'https://linkedin.com/in/davewilson', false, false, false);

-- ============================================================
-- APPLICATIONS
-- ============================================================

INSERT INTO applications (name, email, gender, race, orientation, company_name, company_website, attendee_stagetype, preferred_dinner_date, i_am_my_startups_ceo, my_startup_is_not_a_services_business, linkedin_profile, status, member_id, reviewed_at) VALUES
  ('Mike Johnson', 'mike@example.com', 'Male', 'White', 'Straight', 'StartupX', 'https://startupx.example.com', 'Active CEO (Bootstrapping or VC-Backed)', '2026-05-07', 'Yes', 'Yes', 'https://linkedin.com/in/mikejohnson', 'approved', 'a0000000-0000-0000-0000-000000000003', now()),
  ('Jane Doe', 'jane@example.com', 'Female', 'Asian', 'Straight', 'NewVenture', 'https://newventure.example.com', 'Active CEO (Bootstrapping or VC-Backed)', '2026-06-04', 'Yes', 'Yes', 'https://linkedin.com/in/janedoe', 'pending', NULL, NULL),
  ('Bob Smith', 'bob@example.com', 'Male', 'Black', 'Gay', 'FailedCo', 'https://failedco.example.com', 'Active CEO (Bootstrapping or VC-Backed)', '2026-05-07', 'No', 'Yes', 'https://linkedin.com/in/bobsmith', 'rejected', NULL, now());

-- ============================================================
-- TICKETS
-- ============================================================

INSERT INTO tickets (member_id, dinner_id, ticket_type, amount_paid, fulfillment_status, payment_source, match_confidence) VALUES
  ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM dinners WHERE date = '2026-05-07'), 'team', 0, 'fulfilled', 'squarespace', 'email_exact'),
  ('a0000000-0000-0000-0000-000000000002', (SELECT id FROM dinners WHERE date = '2026-05-07'), 'team', 0, 'fulfilled', 'squarespace', 'email_exact'),
  ('a0000000-0000-0000-0000-000000000003', (SELECT id FROM dinners WHERE date = '2026-05-07'), 'new_ceo', 125.00, 'pending', 'squarespace', 'email_exact'),
  ('a0000000-0000-0000-0000-000000000003', (SELECT id FROM dinners WHERE date = '2026-06-04'), 'returning_ceo', 125.00, 'pending', 'squarespace', 'email_exact'),
  ('a0000000-0000-0000-0000-000000000005', (SELECT id FROM dinners WHERE date = '2026-06-04'), 'investor', 0, 'refunded', 'squarespace', 'name_exact');

-- ============================================================
-- CREDITS
-- ============================================================

INSERT INTO credits (member_id, source_ticket_id, status) VALUES
  ('a0000000-0000-0000-0000-000000000005', (SELECT id FROM tickets WHERE member_id = 'a0000000-0000-0000-0000-000000000005' LIMIT 1), 'outstanding');
