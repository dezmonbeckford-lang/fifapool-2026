-- ══════════════════════════════════════════════════════════════════
-- FifaPool 2026 — Schema v5
-- 1. Scoring update: 1st-place bonus reduced from +2 to +1
-- 2. generate_bracket: DELETE → DELETE WHERE true (Supabase safety)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run All
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_bracket()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM bracket_picks WHERE true;
  DELETE FROM bracket_matches WHERE true;

  INSERT INTO bracket_matches (round, round_order, match_number, points_value)
  SELECT 'R32', 1, s.n, 5 FROM generate_series(1, 16) AS s(n);

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

create or replace function calculate_group_scores()
returns void
language plpgsql
security definer
as $$
declare
  u record;
  gp record;
  gr record;
  wa_teams text[];
  wp_team text;
  new_group_pts int;
  wp_pts int;
begin
  -- Collect real wildcard advancers
  select array_agg(team) into wa_teams from wildcard_advancers;
  if wa_teams is null then wa_teams := '{}'; end if;

  -- Loop over every user
  for u in select id from profiles loop
    new_group_pts := 0;

    -- Score group picks against group results
    for gr in select * from group_results loop
      select * into gp
        from group_picks
       where user_id = u.id and group_id = gr.group_id;

      if found then
        -- Winner pick: 3 pts if the team is in top 2, +1 bonus if nailed as 1st
        if gp.winner = gr.winner then
          new_group_pts := new_group_pts + 3; -- team is in top 2
          new_group_pts := new_group_pts + 1; -- bonus: nailed 1st place exactly
        elsif gp.winner = gr.runner_up then
          new_group_pts := new_group_pts + 3; -- team is in top 2 (wrong slot)
        end if;

        -- Runner-up pick: 3 pts if the team is in top 2 (either slot)
        if gp.runner_up = gr.runner_up then
          new_group_pts := new_group_pts + 3; -- team is in top 2
        elsif gp.runner_up = gr.winner then
          new_group_pts := new_group_pts + 3; -- team is in top 2 (wrong slot)
        end if;
      end if;
    end loop;

    -- Score wildcard picks
    wp_pts := 0;
    for wp_team in
      select team from wildcard_picks where user_id = u.id
    loop
      if wp_team = any(wa_teams) then
        wp_pts := wp_pts + 2;
      end if;
    end loop;
    new_group_pts := new_group_pts + wp_pts;

    -- Upsert scores
    insert into scores (user_id, group_points, bracket_points, total_points, updated_at)
    values (u.id, new_group_pts, 0, new_group_pts, now())
    on conflict (user_id) do update
      set group_points = new_group_pts,
          total_points = new_group_pts + scores.bracket_points,
          updated_at = now();
  end loop;
end;
$$;
