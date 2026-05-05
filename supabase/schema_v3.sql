-- ============================================================
-- FifaPool 2026 — Schema v3: Fix RLS policies for writes
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop existing policies and recreate with explicit WITH CHECK
-- so INSERT and UPDATE work correctly

-- GROUP PICKS
drop policy if exists "Users can manage own group picks" on group_picks;
create policy "Users can select own group picks"
  on group_picks for select using (auth.uid() = user_id);
create policy "Users can insert own group picks"
  on group_picks for insert with check (auth.uid() = user_id);
create policy "Users can update own group picks"
  on group_picks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own group picks"
  on group_picks for delete using (auth.uid() = user_id);

-- WILDCARD PICKS
drop policy if exists "Users can manage own wildcard picks" on wildcard_picks;
create policy "Users can select own wildcard picks"
  on wildcard_picks for select using (auth.uid() = user_id);
create policy "Users can insert own wildcard picks"
  on wildcard_picks for insert with check (auth.uid() = user_id);
create policy "Users can delete own wildcard picks"
  on wildcard_picks for delete using (auth.uid() = user_id);

-- BRACKET PICKS
drop policy if exists "Users can manage own bracket picks" on bracket_picks;
create policy "Users can select own bracket picks"
  on bracket_picks for select using (auth.uid() = user_id);
create policy "Users can insert own bracket picks"
  on bracket_picks for insert with check (auth.uid() = user_id);
create policy "Users can update own bracket picks"
  on bracket_picks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own bracket picks"
  on bracket_picks for delete using (auth.uid() = user_id);

-- PROFILES — ensure users can insert their own profile
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Ensure bracket_unlock_at column exists (from schema_v2, safe to rerun)
alter table settings
  add column if not exists bracket_unlock_at timestamptz
  default '2026-06-27T23:00:00-04:00';

-- Ensure tiebreaker columns exist
alter table bracket_picks
  add column if not exists tiebreaker_score1 int,
  add column if not exists tiebreaker_score2 int;

-- Ensure potential_points column exists
alter table scores
  add column if not exists potential_points int default 0;
