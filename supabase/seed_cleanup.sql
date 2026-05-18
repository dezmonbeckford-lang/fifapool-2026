-- ══════════════════════════════════════════════════════════════════
-- FifaPool 2026 — Test Data Cleanup
-- Run in: Supabase Dashboard → SQL Editor → New query → Run All
-- ══════════════════════════════════════════════════════════════════
--
-- Removes ALL test data created by seed_test.sql and seed_bracket_results.sql.
-- Safe to run multiple times (uses DELETE WHERE / ON CONFLICT conditions).
-- Does NOT touch real player data or app settings.
--
-- Test UUIDs targeted:
--   aaaabbbb-0000-0000-0000-000000000001 (Alex)
--   aaaabbbb-0000-0000-0000-000000000002 (Jordan)
--   aaaabbbb-0000-0000-0000-000000000003 (Sam)
--   aaaabbbb-0000-0000-0000-000000000004 (Riley)
-- ══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  test_ids UUID[] := ARRAY[
    'aaaabbbb-0000-0000-0000-000000000001'::uuid,
    'aaaabbbb-0000-0000-0000-000000000002'::uuid,
    'aaaabbbb-0000-0000-0000-000000000003'::uuid,
    'aaaabbbb-0000-0000-0000-000000000004'::uuid
  ];
BEGIN

  -- 1. Bracket picks
  DELETE FROM bracket_picks WHERE user_id = ANY(test_ids);
  RAISE NOTICE 'Deleted bracket_picks for test users';

  -- 2. Group picks
  DELETE FROM group_picks WHERE user_id = ANY(test_ids);
  RAISE NOTICE 'Deleted group_picks for test users';

  -- 3. Wildcard picks
  DELETE FROM wildcard_picks WHERE user_id = ANY(test_ids);
  RAISE NOTICE 'Deleted wildcard_picks for test users';

  -- 4. Scores
  DELETE FROM scores WHERE user_id = ANY(test_ids);
  RAISE NOTICE 'Deleted scores for test users';

  -- 5. Profiles
  DELETE FROM profiles WHERE id = ANY(test_ids);
  RAISE NOTICE 'Deleted profiles for test users';

  -- 6. Auth identities
  DELETE FROM auth.identities WHERE user_id = ANY(test_ids);
  RAISE NOTICE 'Deleted auth identities for test users';

  -- 7. Auth users
  DELETE FROM auth.users WHERE id = ANY(test_ids);
  RAISE NOTICE 'Deleted auth users for test users';

END $$;

-- ─────────────────────────────────────────────────────────────────
-- Optional: also wipe bracket + group stage data if you want a
-- completely clean slate (comment out if you want to keep results)
-- ─────────────────────────────────────────────────────────────────

-- Uncomment the block below to also clear ALL bracket + group data:
/*
DELETE FROM bracket_picks;
DELETE FROM bracket_matches;
DELETE FROM group_results;
DELETE FROM wildcard_advancers;
DELETE FROM scores;

UPDATE settings SET
  phase = 1,
  group_picks_locked = false,
  bracket_picks_locked = false,
  bracket_unlock_at = null
WHERE id = 1;

RAISE NOTICE 'Full tournament data cleared and settings reset to Phase 1';
*/

-- ─────────────────────────────────────────────────────────────────
-- VERIFY — Should show 0 for all test user counts
-- ─────────────────────────────────────────────────────────────────
SELECT 'profiles'       AS tbl, count(*) AS remaining FROM profiles      WHERE id::text LIKE 'aaaabbbb%'
UNION ALL
SELECT 'group_picks',            count(*)              FROM group_picks   WHERE user_id::text LIKE 'aaaabbbb%'
UNION ALL
SELECT 'wildcard_picks',         count(*)              FROM wildcard_picks WHERE user_id::text LIKE 'aaaabbbb%'
UNION ALL
SELECT 'bracket_picks',          count(*)              FROM bracket_picks  WHERE user_id::text LIKE 'aaaabbbb%'
UNION ALL
SELECT 'scores',                 count(*)              FROM scores         WHERE user_id::text LIKE 'aaaabbbb%'
UNION ALL
SELECT 'auth.users',             count(*)              FROM auth.users     WHERE id::text LIKE 'aaaabbbb%';

-- All counts should be 0 ✓
