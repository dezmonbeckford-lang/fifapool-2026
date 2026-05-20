-- ══════════════════════════════════════════════════════════════════
-- FifaPool 2026 — Schema v5
-- Scoring update: 1st-place bonus reduced from +2 to +1
-- Run in: Supabase Dashboard → SQL Editor → New query → Run All
-- ══════════════════════════════════════════════════════════════════

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
