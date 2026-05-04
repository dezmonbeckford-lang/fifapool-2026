-- ============================================================
-- FifaPool 2026 — Schema v2: Bracket Picks Phase
-- Run this in Supabase SQL Editor AFTER the original schema
-- ============================================================

-- Add bracket unlock timestamp to settings
alter table settings
  add column if not exists bracket_unlock_at timestamptz
  default '2026-06-27T23:00:00-04:00'; -- 11pm ET on June 27

-- Update existing settings row with unlock time
update settings set bracket_unlock_at = '2026-06-27T23:00:00-04:00' where id = 1;

-- Add tiebreaker columns to bracket_picks (for the Final)
alter table bracket_picks
  add column if not exists tiebreaker_score1 int,
  add column if not exists tiebreaker_score2 int;

-- Add potential points to scores
alter table scores
  add column if not exists potential_points int default 0;

-- Re-enable realtime for leaderboard (scores table)
-- (already done in v1, but safe to run again)
alter publication supabase_realtime add table scores;
