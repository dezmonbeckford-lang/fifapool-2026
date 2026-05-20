-- ══════════════════════════════════════════════════════════════════
-- FifaPool 2026 — Schema v6
-- 1. generate_bracket: pre-fills R32 matches 1-12 with FIFA 2026
--    group-position labels; matches 13-16 are wildcard slots (NULL)
-- 2. populate_bracket_teams: replaces labels with real team names
--    once group_results are entered
-- Run in: Supabase Dashboard → SQL Editor → New query → Run All
-- ══════════════════════════════════════════════════════════════════

-- ── generate_bracket ────────────────────────────────────────────
-- Creates the full bracket skeleton.
-- R32 matches 1-12 are pre-filled with the official FIFA 2026
-- cross-group matchup labels. Matches 13-16 are wildcard slots
-- (team1/team2 left NULL — admin fills after group stage).
CREATE OR REPLACE FUNCTION generate_bracket()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM bracket_picks WHERE true;
  DELETE FROM bracket_matches WHERE true;

  -- R32: 12 predetermined group matchups
  INSERT INTO bracket_matches (round, round_order, match_number, points_value, team1, team2) VALUES
    ('R32', 1,  1,  5, 'Winner Group A',   'Runner-up Group B'),
    ('R32', 1,  2,  5, 'Winner Group C',   'Runner-up Group D'),
    ('R32', 1,  3,  5, 'Winner Group E',   'Runner-up Group F'),
    ('R32', 1,  4,  5, 'Winner Group G',   'Runner-up Group H'),
    ('R32', 1,  5,  5, 'Winner Group I',   'Runner-up Group J'),
    ('R32', 1,  6,  5, 'Winner Group K',   'Runner-up Group L'),
    ('R32', 1,  7,  5, 'Winner Group B',   'Runner-up Group A'),
    ('R32', 1,  8,  5, 'Winner Group D',   'Runner-up Group C'),
    ('R32', 1,  9,  5, 'Winner Group F',   'Runner-up Group E'),
    ('R32', 1, 10,  5, 'Winner Group H',   'Runner-up Group G'),
    ('R32', 1, 11,  5, 'Winner Group J',   'Runner-up Group I'),
    ('R32', 1, 12,  5, 'Winner Group L',   'Runner-up Group K');

  -- R32: 4 wildcard slots (best 3rd-place teams, filled by admin)
  INSERT INTO bracket_matches (round, round_order, match_number, points_value) VALUES
    ('R32', 1, 13, 5),
    ('R32', 1, 14, 5),
    ('R32', 1, 15, 5),
    ('R32', 1, 16, 5);

  -- Rounds R16 → Final
  INSERT INTO bracket_matches (round, round_order, match_number, points_value)
  SELECT 'R16', 2, s.n, 8 FROM generate_series(1, 8) AS s(n);

  INSERT INTO bracket_matches (round, round_order, match_number, points_value)
  SELECT 'QF', 3, s.n, 11 FROM generate_series(1, 4) AS s(n);

  INSERT INTO bracket_matches (round, round_order, match_number, points_value)
  SELECT 'SF', 4, s.n, 14 FROM generate_series(1, 2) AS s(n);

  INSERT INTO bracket_matches (round, round_order, match_number, points_value)
  VALUES ('THIRD', 5, 1, 10);

  INSERT INTO bracket_matches (round, round_order, match_number, points_value, is_final)
  VALUES ('FINAL', 6, 1, 17, true);
END;
$$;


-- ── populate_bracket_teams ──────────────────────────────────────
-- Call this after group results are entered.
-- Replaces "Winner Group X" / "Runner-up Group X" labels in R32
-- matches 1-12 with the actual team names from group_results.
CREATE OR REPLACE FUNCTION populate_bracket_teams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  gr record;
BEGIN
  FOR gr IN SELECT group_id, winner, runner_up FROM group_results LOOP
    -- Replace winner labels
    UPDATE bracket_matches
       SET team1 = gr.winner
     WHERE round = 'R32'
       AND team1 = 'Winner Group ' || gr.group_id;

    UPDATE bracket_matches
       SET team2 = gr.winner
     WHERE round = 'R32'
       AND team2 = 'Winner Group ' || gr.group_id;

    -- Replace runner-up labels
    UPDATE bracket_matches
       SET team1 = gr.runner_up
     WHERE round = 'R32'
       AND team1 = 'Runner-up Group ' || gr.group_id;

    UPDATE bracket_matches
       SET team2 = gr.runner_up
     WHERE round = 'R32'
       AND team2 = 'Runner-up Group ' || gr.group_id;
  END LOOP;
END;
$$;
