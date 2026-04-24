-- Add title and description to dinners
ALTER TABLE dinners ADD COLUMN title TEXT NULL;
ALTER TABLE dinners ADD COLUMN description TEXT NULL;

-- Dinner speakers join table
CREATE TABLE dinner_speakers (
  dinner_id UUID NOT NULL REFERENCES dinners(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (dinner_id, member_id)
);

-- RLS on dinner_speakers: same pattern as dinners
ALTER TABLE dinner_speakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/team can view dinner_speakers"
  ON dinner_speakers FOR SELECT
  USING (is_admin_or_team());

CREATE POLICY "Admin/team can insert dinner_speakers"
  ON dinner_speakers FOR INSERT
  WITH CHECK (is_admin_or_team());

CREATE POLICY "Admin/team can delete dinner_speakers"
  ON dinner_speakers FOR DELETE
  USING (is_admin_or_team());

-- Authenticated members can read (for portal display)
CREATE POLICY "Authenticated members can view dinner_speakers"
  ON dinner_speakers FOR SELECT
  USING (auth.role() = 'authenticated');
