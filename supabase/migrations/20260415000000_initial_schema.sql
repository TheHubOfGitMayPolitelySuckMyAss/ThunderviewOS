-- Thunderview OS - Phase 1 Initial Schema
-- Table creation order: dinners → members → applications, tickets, credits

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE dinners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  venue TEXT NOT NULL DEFAULT 'TBD'
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  contact_preference TEXT NOT NULL DEFAULT 'linkedin' CHECK (contact_preference IN ('email', 'linkedin')),
  linkedin_profile TEXT,
  company_name TEXT,
  company_website TEXT,
  attendee_stagetype TEXT,
  marketing_opted_in BOOLEAN NOT NULL DEFAULT true,
  kicked_out BOOLEAN NOT NULL DEFAULT false,
  last_dinner_attended DATE,
  current_intro TEXT,
  current_ask TEXT,
  ask_updated_at TIMESTAMPTZ,
  has_attended BOOLEAN NOT NULL DEFAULT false,
  is_team BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  gender TEXT NOT NULL,
  race TEXT NOT NULL,
  orientation TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_website TEXT NOT NULL,
  attendee_stagetype TEXT NOT NULL CHECK (attendee_stagetype IN (
    'Active CEO (Bootstrapping or VC-Backed)',
    'Exited CEO (Acquisition or IPO)',
    'Investor',
    'Guest (Speaker/Press/Etc)'
  )),
  preferred_dinner_date DATE NOT NULL,
  i_am_my_startups_ceo TEXT CHECK (i_am_my_startups_ceo IN ('Yes', 'No')),
  my_startup_is_not_a_services_business TEXT CHECK (my_startup_is_not_a_services_business IN ('Yes', 'No')),
  linkedin_profile TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  member_id UUID REFERENCES members(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id),
  dinner_id UUID NOT NULL REFERENCES dinners(id),
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('new_ceo', 'returning_ceo', 'investor', 'guest', 'team')),
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  squarespace_order_id TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'fulfilled', 'refunded', 'credited')),
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID,
  fulfillment_notes TEXT,
  payment_source TEXT NOT NULL DEFAULT 'squarespace' CHECK (payment_source IN ('squarespace', 'credit')),
  match_confidence TEXT CHECK (match_confidence IN ('email_exact', 'name_exact', 'manual'))
);

CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id),
  source_ticket_id UUID NOT NULL REFERENCES tickets(id),
  status TEXT NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'redeemed')),
  redeemed_ticket_id UUID REFERENCES tickets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_applications_email ON applications(email);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_kicked_out ON members(kicked_out);
CREATE INDEX idx_tickets_member_id ON tickets(member_id);
CREATE INDEX idx_tickets_dinner_id ON tickets(dinner_id);
CREATE INDEX idx_tickets_fulfillment_status ON tickets(fulfillment_status);
CREATE INDEX idx_credits_member_id ON credits(member_id);
CREATE INDEX idx_credits_status ON credits(status);

-- ============================================================
-- TRIGGER: auto-update members.updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin_or_team()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.jwt() ->> 'email' = 'eric@marcoullier.com' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM members
    WHERE email = auth.jwt() ->> 'email'
    AND is_team = true
    AND kicked_out = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE dinners ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

-- Admin/team can read all tables
CREATE POLICY "Admin/team can view dinners"
  ON dinners FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin/team can view members"
  ON members FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Members can view own row"
  ON members FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Admin/team can view applications"
  ON applications FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin/team can view tickets"
  ON tickets FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin/team can view credits"
  ON credits FOR SELECT
  USING (is_admin_or_team());
