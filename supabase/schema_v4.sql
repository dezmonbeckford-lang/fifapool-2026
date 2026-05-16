-- ─────────────────────────────────────────────────────────────
-- schema_v4.sql  —  allow any signed-in user to READ other players' picks
-- Run this in the Supabase SQL Editor (one click, no edits needed)
-- ─────────────────────────────────────────────────────────────

-- group_picks: replace own-only SELECT with read-all
DROP POLICY IF EXISTS "group_picks_select_own"    ON group_picks;
DROP POLICY IF EXISTS "group_picks_read_all"      ON group_picks;
CREATE POLICY "group_picks_read_all"
  ON group_picks FOR SELECT
  USING (auth.role() = 'authenticated');

-- wildcard_picks: same
DROP POLICY IF EXISTS "wildcard_picks_select_own" ON wildcard_picks;
DROP POLICY IF EXISTS "wildcard_picks_read_all"   ON wildcard_picks;
CREATE POLICY "wildcard_picks_read_all"
  ON wildcard_picks FOR SELECT
  USING (auth.role() = 'authenticated');

-- bracket_picks: same
DROP POLICY IF EXISTS "bracket_picks_select_own"  ON bracket_picks;
DROP POLICY IF EXISTS "bracket_picks_read_all"    ON bracket_picks;
CREATE POLICY "bracket_picks_read_all"
  ON bracket_picks FOR SELECT
  USING (auth.role() = 'authenticated');

-- profiles: allow reading other players' display names
-- (already public in most setups, but ensure it's consistent)
DROP POLICY IF EXISTS "profiles_read_all"         ON profiles;
CREATE POLICY "profiles_read_all"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- scores: allow any signed-in user to read all scores
DROP POLICY IF EXISTS "scores_read_all"           ON scores;
CREATE POLICY "scores_read_all"
  ON scores FOR SELECT
  USING (true);   -- scores are already shown on leaderboard, keep public
