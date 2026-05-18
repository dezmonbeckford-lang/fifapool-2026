-- ══════════════════════════════════════════════════════════════════
-- FifaPool 2026 — Bracket Results Seed
-- Run AFTER seed_test.sql to simulate the full tournament outcome
-- Run in: Supabase Dashboard → SQL Editor → New query → Run All
-- ══════════════════════════════════════════════════════════════════
--
-- This script:
--   1. Sets actual_winner + team names for all rounds (R32 → Final)
--   2. Calls score_bracket_match() for each completed match
--   3. Prints final leaderboard at the end
--
-- Simulated tournament path:
--   R32 Winners:  Mexico, Canada, Brazil, USA, Germany, Netherlands,
--                 Belgium, Spain, France, Argentina, Portugal, England,
--                 Morocco, Japan, Colombia, Türkiye
--   R16 Winners:  Canada, Brazil, Germany, Spain, France, Portugal, Morocco, Colombia
--   QF Winners:   Brazil, Spain, France, Morocco
--   SF Winners:   Spain, France
--   Third Place:  Brazil
--   Champion:     🏆 SPAIN
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- ROUND OF 32 — Set results
-- ─────────────────────────────────────────────────────────────────
UPDATE bracket_matches SET actual_winner='Mexico',      result_entered=true WHERE round='R32' AND match_number=1;
UPDATE bracket_matches SET actual_winner='Canada',      result_entered=true WHERE round='R32' AND match_number=2;
UPDATE bracket_matches SET actual_winner='Brazil',      result_entered=true WHERE round='R32' AND match_number=3;
UPDATE bracket_matches SET actual_winner='USA',         result_entered=true WHERE round='R32' AND match_number=4;
UPDATE bracket_matches SET actual_winner='Germany',     result_entered=true WHERE round='R32' AND match_number=5;
UPDATE bracket_matches SET actual_winner='Netherlands', result_entered=true WHERE round='R32' AND match_number=6;
UPDATE bracket_matches SET actual_winner='Belgium',     result_entered=true WHERE round='R32' AND match_number=7;
UPDATE bracket_matches SET actual_winner='Spain',       result_entered=true WHERE round='R32' AND match_number=8;
UPDATE bracket_matches SET actual_winner='France',      result_entered=true WHERE round='R32' AND match_number=9;
UPDATE bracket_matches SET actual_winner='Argentina',   result_entered=true WHERE round='R32' AND match_number=10;
UPDATE bracket_matches SET actual_winner='Portugal',    result_entered=true WHERE round='R32' AND match_number=11;
UPDATE bracket_matches SET actual_winner='England',     result_entered=true WHERE round='R32' AND match_number=12;
UPDATE bracket_matches SET actual_winner='Morocco',     result_entered=true WHERE round='R32' AND match_number=13;
UPDATE bracket_matches SET actual_winner='Japan',       result_entered=true WHERE round='R32' AND match_number=14;
UPDATE bracket_matches SET actual_winner='Colombia',    result_entered=true WHERE round='R32' AND match_number=15;
UPDATE bracket_matches SET actual_winner='Türkiye',     result_entered=true WHERE round='R32' AND match_number=16;

-- Score all R32 matches
SELECT score_bracket_match(id) FROM bracket_matches WHERE round='R32';

-- ─────────────────────────────────────────────────────────────────
-- ROUND OF 16 — Set teams from R32 winners, then results
--
-- Bracket pairings (winners of R32 matches 1-2, 3-4, … 15-16):
--   M1: Mexico vs Canada       M2: Brazil vs USA
--   M3: Germany vs Netherlands M4: Belgium vs Spain
--   M5: France vs Argentina    M6: Portugal vs England
--   M7: Morocco vs Japan       M8: Colombia vs Türkiye
-- ─────────────────────────────────────────────────────────────────
UPDATE bracket_matches SET
  team1='Mexico',      team2='Canada',
  actual_winner='Canada',      result_entered=true
WHERE round='R16' AND match_number=1;

UPDATE bracket_matches SET
  team1='Brazil',      team2='USA',
  actual_winner='Brazil',      result_entered=true
WHERE round='R16' AND match_number=2;

UPDATE bracket_matches SET
  team1='Germany',     team2='Netherlands',
  actual_winner='Germany',     result_entered=true
WHERE round='R16' AND match_number=3;

UPDATE bracket_matches SET
  team1='Belgium',     team2='Spain',
  actual_winner='Spain',       result_entered=true
WHERE round='R16' AND match_number=4;

UPDATE bracket_matches SET
  team1='France',      team2='Argentina',
  actual_winner='France',      result_entered=true
WHERE round='R16' AND match_number=5;

UPDATE bracket_matches SET
  team1='Portugal',    team2='England',
  actual_winner='Portugal',    result_entered=true
WHERE round='R16' AND match_number=6;

UPDATE bracket_matches SET
  team1='Morocco',     team2='Japan',
  actual_winner='Morocco',     result_entered=true
WHERE round='R16' AND match_number=7;

UPDATE bracket_matches SET
  team1='Colombia',    team2='Türkiye',
  actual_winner='Colombia',    result_entered=true
WHERE round='R16' AND match_number=8;

-- Score all R16 matches
SELECT score_bracket_match(id) FROM bracket_matches WHERE round='R16';

-- ─────────────────────────────────────────────────────────────────
-- QUARTERFINALS — Set teams from R16 winners, then results
--
-- Pairings (winners of R16 matches 1-2, 3-4, 5-6, 7-8):
--   M1: Canada vs Brazil       M2: Germany vs Spain
--   M3: France vs Portugal     M4: Morocco vs Colombia
-- ─────────────────────────────────────────────────────────────────
UPDATE bracket_matches SET
  team1='Canada',      team2='Brazil',
  actual_winner='Brazil',      result_entered=true
WHERE round='QF' AND match_number=1;

UPDATE bracket_matches SET
  team1='Germany',     team2='Spain',
  actual_winner='Spain',       result_entered=true
WHERE round='QF' AND match_number=2;

UPDATE bracket_matches SET
  team1='France',      team2='Portugal',
  actual_winner='France',      result_entered=true
WHERE round='QF' AND match_number=3;

UPDATE bracket_matches SET
  team1='Morocco',     team2='Colombia',
  actual_winner='Morocco',     result_entered=true
WHERE round='QF' AND match_number=4;

-- Score all QF matches
SELECT score_bracket_match(id) FROM bracket_matches WHERE round='QF';

-- ─────────────────────────────────────────────────────────────────
-- SEMIFINALS — Set teams from QF winners, then results
--
-- Pairings:
--   M1: Brazil vs Spain
--   M2: France vs Morocco
-- ─────────────────────────────────────────────────────────────────
UPDATE bracket_matches SET
  team1='Brazil',      team2='Spain',
  actual_winner='Spain',       result_entered=true
WHERE round='SF' AND match_number=1;

UPDATE bracket_matches SET
  team1='France',      team2='Morocco',
  actual_winner='France',      result_entered=true
WHERE round='SF' AND match_number=2;

-- Score all SF matches
SELECT score_bracket_match(id) FROM bracket_matches WHERE round='SF';

-- ─────────────────────────────────────────────────────────────────
-- THIRD PLACE — SF losers face off
--   Brazil vs Morocco → Brazil wins bronze
-- ─────────────────────────────────────────────────────────────────
UPDATE bracket_matches SET
  team1='Brazil',      team2='Morocco',
  actual_winner='Brazil',      result_entered=true
WHERE round='THIRD' AND match_number=1;

SELECT score_bracket_match(id) FROM bracket_matches WHERE round='THIRD';

-- ─────────────────────────────────────────────────────────────────
-- FINAL — 🏆 Spain vs France → SPAIN WINS
-- ─────────────────────────────────────────────────────────────────
UPDATE bracket_matches SET
  team1='Spain',       team2='France',
  actual_winner='Spain',       result_entered=true
WHERE round='FINAL' AND match_number=1;

SELECT score_bracket_match(id) FROM bracket_matches WHERE round='FINAL';

-- Lock bracket picks now that tournament is over
UPDATE settings SET bracket_picks_locked=true WHERE id=1;

-- ─────────────────────────────────────────────────────────────────
-- VERIFY — Final scores
-- ─────────────────────────────────────────────────────────────────
SELECT
  p.display_name,
  s.group_points,
  s.bracket_points,
  s.total_points
FROM profiles p
JOIN scores s ON s.user_id = p.id
WHERE p.id LIKE 'aaaabbbb%'
ORDER BY s.total_points DESC;

-- ══════════════════════════════════════════════════════════════════
-- EXPECTED FINAL STANDINGS (approximate):
--
--   Alex   — group 112 + group wildcard 16 + bracket ~252 ≈ 380 pts
--            (all R32 correct = 80pts, all R16 = 64, all QF = 44,
--             SF+Final = 28+17+25bonus = 70)
--   Jordan — group 98 + wildcard 10 + bracket ~220 ≈ 328 pts
--            (misses 2 R32 picks, misses R16 M3+M6)
--   Sam    — group 85 + wildcard 8 + bracket ~155 ≈ 248 pts
--            (8/16 R32, misses R16 M1, Final pick wrong)
--   Riley  — group 47 + wildcard 4 + bracket ~62 ≈ 113 pts
--            (4/16 R32, all R16 wrong, picks Spain in Final for 42pts!)
-- ══════════════════════════════════════════════════════════════════
