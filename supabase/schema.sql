-- ============================================================
-- FifaPool 2026 — Full Database Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  email text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read all profiles"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- ============================================================
-- SETTINGS (single row, id=1)
-- ============================================================
create table if not exists settings (
  id int primary key default 1,
  phase int default 1,
  group_picks_locked boolean default false,
  bracket_picks_locked boolean default false,
  updated_at timestamptz default now()
);

-- Insert default settings row
insert into settings (id, phase, group_picks_locked, bracket_picks_locked)
values (1, 1, false, false)
on conflict (id) do nothing;

alter table settings enable row level security;

create policy "Anyone can read settings"
  on settings for select using (true);

create policy "Admins can update settings"
  on settings for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- GROUP PICKS (user's predictions for group stage)
-- ============================================================
create table if not exists group_picks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  group_id text not null,       -- 'A' through 'L'
  winner text,
  runner_up text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, group_id)
);

alter table group_picks enable row level security;

create policy "Users can manage own group picks"
  on group_picks for all using (auth.uid() = user_id);

create policy "Admins can read all group picks"
  on group_picks for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- WILDCARD PICKS (user's 8 extra picks)
-- ============================================================
create table if not exists wildcard_picks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  team text not null,
  created_at timestamptz default now(),
  unique(user_id, team)
);

alter table wildcard_picks enable row level security;

create policy "Users can manage own wildcard picks"
  on wildcard_picks for all using (auth.uid() = user_id);

-- ============================================================
-- GROUP RESULTS (admin enters the real outcomes)
-- ============================================================
create table if not exists group_results (
  id uuid primary key default uuid_generate_v4(),
  group_id text not null unique,
  winner text not null,
  runner_up text not null,
  created_at timestamptz default now()
);

alter table group_results enable row level security;

create policy "Anyone can read group results"
  on group_results for select using (true);

create policy "Admins can manage group results"
  on group_results for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- WILDCARD ADVANCERS (8 real best 3rd-place teams, set by admin)
-- ============================================================
create table if not exists wildcard_advancers (
  id uuid primary key default uuid_generate_v4(),
  team text not null unique,
  created_at timestamptz default now()
);

alter table wildcard_advancers enable row level security;

create policy "Anyone can read wildcard advancers"
  on wildcard_advancers for select using (true);

create policy "Admins can manage wildcard advancers"
  on wildcard_advancers for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- SCORES (one row per user, updated by scoring functions)
-- ============================================================
create table if not exists scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  group_points int default 0,
  bracket_points int default 0,
  total_points int default 0,
  updated_at timestamptz default now()
);

alter table scores enable row level security;

create policy "Anyone can read scores"
  on scores for select using (true);

create policy "System can manage scores"
  on scores for all using (true);

-- ============================================================
-- BRACKET MATCHES
-- ============================================================
create table if not exists bracket_matches (
  id uuid primary key default uuid_generate_v4(),
  round text not null,          -- 'R32','R16','QF','SF','THIRD','FINAL'
  round_order int not null,     -- 1=R32, 2=R16, 3=QF, 4=SF, 5=THIRD, 6=FINAL
  match_number int not null,
  team1 text,
  team2 text,
  actual_winner text,
  result_entered boolean default false,
  points_value int not null,
  is_final boolean default false,
  created_at timestamptz default now()
);

alter table bracket_matches enable row level security;

create policy "Anyone can read bracket matches"
  on bracket_matches for select using (true);

create policy "Admins can manage bracket matches"
  on bracket_matches for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- BRACKET PICKS (user picks winner of each match)
-- ============================================================
create table if not exists bracket_picks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  match_id uuid not null references bracket_matches(id) on delete cascade,
  picked_winner text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, match_id)
);

alter table bracket_picks enable row level security;

create policy "Users can manage own bracket picks"
  on bracket_picks for all using (auth.uid() = user_id);

create policy "Admins can read all bracket picks"
  on bracket_picks for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- SCORING FUNCTION: Group Stage
-- Called by admin after entering group results
-- ============================================================
create or replace function calculate_group_scores()
returns void
language plpgsql
security definer
as $$
declare
  u         record;
  gp        record;
  gr        record;
  wa_teams  text[];
  wp_team   text;
  top2_teams text[];
  new_group_pts int;
  wp_pts    int;
begin
  -- Collect real wildcard advancers
  select array_agg(team) into wa_teams from wildcard_advancers;
  if wa_teams is null then wa_teams := '{}'; end if;

  -- Collect all teams that finished top-2 in any group
  select array_agg(team) into top2_teams
    from (
      select winner as team from group_results
      union all
      select runner_up as team from group_results
    ) t;
  if top2_teams is null then top2_teams := '{}'; end if;

  -- Loop over every user
  for u in select id from profiles loop
    new_group_pts := 0;

    -- ── Group picks ──────────────────────────────────────────────
    -- Points based on how the picked team actually advanced,
    -- not whether it landed in the predicted slot.
    for gr in select * from group_results loop
      select * into gp
        from group_picks
       where user_id = u.id and group_id = gr.group_id;

      if found then
        -- Score the "winner" pick
        if gp.winner is not null then
          if gp.winner = gr.winner then
            -- Exact 1st-place match: 3 + 1 bonus
            new_group_pts := new_group_pts + 4;
          elsif gp.winner = gr.runner_up then
            -- Team finished top-2, wrong slot
            new_group_pts := new_group_pts + 3;
          elsif gp.winner = any(wa_teams) then
            -- Team advanced but as a wildcard
            new_group_pts := new_group_pts + 2;
          end if;
        end if;

        -- Score the "runner_up" pick
        if gp.runner_up is not null then
          if gp.runner_up = gr.runner_up then
            -- Exact 2nd-place match: 3 pts
            new_group_pts := new_group_pts + 3;
          elsif gp.runner_up = gr.winner then
            -- Team finished top-2, wrong slot
            new_group_pts := new_group_pts + 3;
          elsif gp.runner_up = any(wa_teams) then
            -- Team advanced but as a wildcard
            new_group_pts := new_group_pts + 2;
          end if;
        end if;
      end if;
    end loop;

    -- ── Wildcard picks ───────────────────────────────────────────
    -- 3 pts if team finished top-2, 2 pts if it advanced as wildcard
    wp_pts := 0;
    for wp_team in
      select team from wildcard_picks where user_id = u.id
    loop
      if wp_team = any(top2_teams) then
        wp_pts := wp_pts + 3;
      elsif wp_team = any(wa_teams) then
        wp_pts := wp_pts + 2;
      end if;
    end loop;
    new_group_pts := new_group_pts + wp_pts;

    -- ── Upsert scores ────────────────────────────────────────────
    insert into scores (user_id, group_points, bracket_points, total_points, updated_at)
    values (u.id, new_group_pts, 0, new_group_pts, now())
    on conflict (user_id) do update
      set group_points = new_group_pts,
          total_points = new_group_pts + scores.bracket_points,
          updated_at = now();
  end loop;
end;
$$;

-- ============================================================
-- SCORING FUNCTION: Single Bracket Match
-- Called by admin each time they save a match result
-- ============================================================
create or replace function score_bracket_match(match_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  m record;
  bp record;
  extra_pts int;
begin
  select * into m from bracket_matches where id = match_id;
  if not found then return; end if;
  if m.actual_winner is null then return; end if;

  -- For each user who picked this winner
  for bp in
    select * from bracket_picks
    where bracket_picks.match_id = score_bracket_match.match_id
      and picked_winner = m.actual_winner
  loop
    extra_pts := m.points_value;
    -- Champion bonus: if this is the Final and they got it right, +25
    if m.is_final then
      extra_pts := extra_pts + 25;
    end if;

    insert into scores (user_id, group_points, bracket_points, total_points, updated_at)
    values (bp.user_id, 0, extra_pts, extra_pts, now())
    on conflict (user_id) do update
      set bracket_points = scores.bracket_points + extra_pts,
          total_points = scores.group_points + scores.bracket_points + extra_pts,
          updated_at = now();
  end loop;
end;
$$;

-- ============================================================
-- FUNCTION: Generate bracket matches after group stage
-- Admin calls this once group stage is done
-- ============================================================
create or replace function generate_bracket()
returns void
language plpgsql
security definer
as $$
begin
  -- Clear existing bracket
  delete from bracket_picks;
  delete from bracket_matches;

  -- Round of 32 (16 matches)
  -- Teams TBD — filled in by admin or future automation
  -- Insert placeholder matches for all rounds
  -- R32: 16 matches
  insert into bracket_matches (round, round_order, match_number, points_value)
  select 'R32', 1, s.n, 5
  from generate_series(1, 16) as s(n);

  -- R16: 8 matches
  insert into bracket_matches (round, round_order, match_number, points_value)
  select 'R16', 2, s.n, 8
  from generate_series(1, 8) as s(n);

  -- QF: 4 matches
  insert into bracket_matches (round, round_order, match_number, points_value)
  select 'QF', 3, s.n, 11
  from generate_series(1, 4) as s(n);

  -- SF: 2 matches
  insert into bracket_matches (round, round_order, match_number, points_value)
  select 'SF', 4, s.n, 14
  from generate_series(1, 2) as s(n);

  -- Third place: 1 match
  insert into bracket_matches (round, round_order, match_number, points_value)
  values ('THIRD', 5, 1, 10);

  -- Final: 1 match (is_final=true for champion bonus)
  insert into bracket_matches (round, round_order, match_number, points_value, is_final)
  values ('FINAL', 6, 1, 17, true);
end;
$$;

-- ============================================================
-- Realtime: enable for leaderboard live updates
-- ============================================================
alter publication supabase_realtime add table scores;
