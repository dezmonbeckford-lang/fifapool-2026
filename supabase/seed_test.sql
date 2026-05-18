-- ══════════════════════════════════════════════════════════════════
-- FifaPool 2026 — Full End-to-End Test Seed
-- Run in: Supabase Dashboard → SQL Editor → New query → Run All
-- ══════════════════════════════════════════════════════════════════
--
-- Creates 4 test players, all their group picks, group results,
-- scoring, a full bracket setup, and bracket picks so you can
-- test every part of the platform.
--
-- Test login credentials (all 4 accounts):
--   Emails: alex@fifapool.test | jordan@fifapool.test
--           sam@fifapool.test  | riley@fifapool.test
--   Password: TestPool2026!
--
-- SIMULATED RESULTS (the "correct answers"):
--   Group winners: Mexico, Canada, Brazil, USA, Germany, Netherlands,
--                  Belgium, Spain, France, Argentina, Portugal, England
--   3rd-place advancers: Australia, Scotland, Sweden, Norway,
--                         Algeria, Iran, South Africa, Ghana
--   Bracket champion: Spain
-- ══════════════════════════════════════════════════════════════════

-- Enable pgcrypto for password hashing (already on in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────
-- STEP 1 — Create 4 test auth users
-- (If this step errors due to schema differences on your Supabase
--  version, skip it and manually register the 4 accounts from the
--  app's Register page, then re-run from STEP 2 with the real UUIDs.)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pass TEXT := crypt('TestPool2026!', gen_salt('bf', 10));
  u1 UUID := 'aaaabbbb-0000-0000-0000-000000000001';
  u2 UUID := 'aaaabbbb-0000-0000-0000-000000000002';
  u3 UUID := 'aaaabbbb-0000-0000-0000-000000000003';
  u4 UUID := 'aaaabbbb-0000-0000-0000-000000000004';
BEGIN

  -- Auth users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data, is_super_admin, is_sso_user
  ) VALUES
    (u1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'alex@fifapool.test',   pass, now(), now(), now(),
     '{"display_name":"Alex"}',   '{"provider":"email","providers":["email"]}', false, false),
    (u2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'jordan@fifapool.test', pass, now(), now(), now(),
     '{"display_name":"Jordan"}', '{"provider":"email","providers":["email"]}', false, false),
    (u3,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'sam@fifapool.test',    pass, now(), now(), now(),
     '{"display_name":"Sam"}',    '{"provider":"email","providers":["email"]}', false, false),
    (u4,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'riley@fifapool.test',  pass, now(), now(), now(),
     '{"display_name":"Riley"}',  '{"provider":"email","providers":["email"]}', false, false)
  ON CONFLICT (id) DO NOTHING;

  -- Auth identities (required for email/password login)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES
    (u1, u1, jsonb_build_object('sub',u1::text,'email','alex@fifapool.test'),   'email','alex@fifapool.test',   now(),now(),now()),
    (u2, u2, jsonb_build_object('sub',u2::text,'email','jordan@fifapool.test'), 'email','jordan@fifapool.test', now(),now(),now()),
    (u3, u3, jsonb_build_object('sub',u3::text,'email','sam@fifapool.test'),    'email','sam@fifapool.test',    now(),now(),now()),
    (u4, u4, jsonb_build_object('sub',u4::text,'email','riley@fifapool.test'),  'email','riley@fifapool.test',  now(),now(),now())
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Step 1 complete: auth users created (password: TestPool2026!)';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 2 — Create profiles
-- ─────────────────────────────────────────────────────────────────
INSERT INTO profiles (id, display_name, email, is_admin)
VALUES
  ('aaaabbbb-0000-0000-0000-000000000001', 'Alex',   'alex@fifapool.test',   false),
  ('aaaabbbb-0000-0000-0000-000000000002', 'Jordan', 'jordan@fifapool.test', false),
  ('aaaabbbb-0000-0000-0000-000000000003', 'Sam',    'sam@fifapool.test',    false),
  ('aaaabbbb-0000-0000-0000-000000000004', 'Riley',  'riley@fifapool.test',  false)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- ─────────────────────────────────────────────────────────────────
-- STEP 3 — Group Picks
--
-- Actual results:  A:Mexico/SK  B:Canada/Swiss  C:Brazil/Morocco
--   D:USA/Turkiye  E:Germany/Ecuador  F:Netherlands/Japan
--   G:Belgium/Egypt  H:Spain/Uruguay  I:France/Senegal
--   J:Argentina/Austria  K:Portugal/Colombia  L:England/Croatia
--
-- Alex   — perfect picks (112 pts group phase)
-- Jordan — 9 groups correct, 1 swapped, 2 wrong 2nd picks (98 pts)
-- Sam    — 6 groups fully correct, many wrong 2nd picks (85 pts)
-- Riley  — mostly wrong, gets 3 groups right (47 pts)
-- ─────────────────────────────────────────────────────────────────
DELETE FROM group_picks
WHERE user_id IN (
  'aaaabbbb-0000-0000-0000-000000000001',
  'aaaabbbb-0000-0000-0000-000000000002',
  'aaaabbbb-0000-0000-0000-000000000003',
  'aaaabbbb-0000-0000-0000-000000000004'
);

INSERT INTO group_picks (user_id, group_id, winner, runner_up) VALUES
-- ── Alex (all correct) ──────────────────────────────────────────
('aaaabbbb-0000-0000-0000-000000000001','A','Mexico',      'South Korea'),
('aaaabbbb-0000-0000-0000-000000000001','B','Canada',      'Switzerland'),
('aaaabbbb-0000-0000-0000-000000000001','C','Brazil',      'Morocco'),
('aaaabbbb-0000-0000-0000-000000000001','D','USA',         'Türkiye'),
('aaaabbbb-0000-0000-0000-000000000001','E','Germany',     'Ecuador'),
('aaaabbbb-0000-0000-0000-000000000001','F','Netherlands', 'Japan'),
('aaaabbbb-0000-0000-0000-000000000001','G','Belgium',     'Egypt'),
('aaaabbbb-0000-0000-0000-000000000001','H','Spain',       'Uruguay'),
('aaaabbbb-0000-0000-0000-000000000001','I','France',      'Senegal'),
('aaaabbbb-0000-0000-0000-000000000001','J','Argentina',   'Austria'),
('aaaabbbb-0000-0000-0000-000000000001','K','Portugal',    'Colombia'),
('aaaabbbb-0000-0000-0000-000000000001','L','England',     'Croatia'),
-- ── Jordan (1 swap F, 2 wrong runner-ups I+K) ───────────────────
('aaaabbbb-0000-0000-0000-000000000002','A','Mexico',      'South Korea'),
('aaaabbbb-0000-0000-0000-000000000002','B','Canada',      'Switzerland'),
('aaaabbbb-0000-0000-0000-000000000002','C','Brazil',      'Morocco'),
('aaaabbbb-0000-0000-0000-000000000002','D','USA',         'Türkiye'),
('aaaabbbb-0000-0000-0000-000000000002','E','Germany',     'Ecuador'),
('aaaabbbb-0000-0000-0000-000000000002','F','Japan',       'Netherlands'), -- SWAPPED (correct teams, wrong order → 3+3 no bonus)
('aaaabbbb-0000-0000-0000-000000000002','G','Belgium',     'Egypt'),
('aaaabbbb-0000-0000-0000-000000000002','H','Spain',       'Uruguay'),
('aaaabbbb-0000-0000-0000-000000000002','I','France',      'Norway'),      -- Norway wrong (Senegal was 2nd)
('aaaabbbb-0000-0000-0000-000000000002','J','Argentina',   'Austria'),
('aaaabbbb-0000-0000-0000-000000000002','K','Portugal',    'Uzbekistan'),  -- Uzbekistan wrong (Colombia was 2nd)
('aaaabbbb-0000-0000-0000-000000000002','L','England',     'Croatia'),
-- ── Sam (misses several 2nd picks) ──────────────────────────────
('aaaabbbb-0000-0000-0000-000000000003','A','Mexico',      'South Africa'),  -- S.Africa wrong
('aaaabbbb-0000-0000-0000-000000000003','B','Canada',      'Switzerland'),
('aaaabbbb-0000-0000-0000-000000000003','C','Brazil',      'Scotland'),      -- Scotland wrong
('aaaabbbb-0000-0000-0000-000000000003','D','USA',         'Australia'),     -- Australia wrong
('aaaabbbb-0000-0000-0000-000000000003','E','Germany',     'Ivory Coast'),   -- Ivory Coast wrong
('aaaabbbb-0000-0000-0000-000000000003','F','Netherlands', 'Japan'),
('aaaabbbb-0000-0000-0000-000000000003','G','Belgium',     'Egypt'),
('aaaabbbb-0000-0000-0000-000000000003','H','Spain',       'Uruguay'),
('aaaabbbb-0000-0000-0000-000000000003','I','France',      'Senegal'),
('aaaabbbb-0000-0000-0000-000000000003','J','Austria',     'Argentina'),     -- SWAPPED (both right teams)
('aaaabbbb-0000-0000-0000-000000000003','K','Portugal',    'Colombia'),
('aaaabbbb-0000-0000-0000-000000000003','L','Ghana',       'England'),       -- Ghana 1st wrong, England 2nd (in top 2)
-- ── Riley (mostly random) ───────────────────────────────────────
('aaaabbbb-0000-0000-0000-000000000004','A','Czechia',     'South Africa'),  -- both wrong
('aaaabbbb-0000-0000-0000-000000000004','B','Qatar',       'Bosnia-Herzegovina'), -- both wrong
('aaaabbbb-0000-0000-0000-000000000004','C','Brazil',      'Morocco'),       -- correct!
('aaaabbbb-0000-0000-0000-000000000004','D','Türkiye',     'USA'),           -- SWAPPED
('aaaabbbb-0000-0000-0000-000000000004','E','Germany',     'Curaçao'),       -- Curaçao wrong
('aaaabbbb-0000-0000-0000-000000000004','F','Sweden',      'Tunisia'),       -- both wrong
('aaaabbbb-0000-0000-0000-000000000004','G','Iran',        'Egypt'),         -- Iran wrong, Egypt correct
('aaaabbbb-0000-0000-0000-000000000004','H','Spain',       'Uruguay'),       -- correct!
('aaaabbbb-0000-0000-0000-000000000004','I','France',      'Iraq'),          -- Iraq wrong
('aaaabbbb-0000-0000-0000-000000000004','J','Jordan',      'Algeria'),       -- both wrong
('aaaabbbb-0000-0000-0000-000000000004','K','Uzbekistan',  'DR Congo'),      -- both wrong
('aaaabbbb-0000-0000-0000-000000000004','L','England',     'Croatia');       -- correct!

-- ─────────────────────────────────────────────────────────────────
-- STEP 4 — Wildcard Picks (8 per user)
--
-- Actual 8 advancing 3rd-place teams:
--   Australia, Scotland, Sweden, Norway, Algeria, Iran, South Africa, Ghana
-- ─────────────────────────────────────────────────────────────────
DELETE FROM wildcard_picks
WHERE user_id IN (
  'aaaabbbb-0000-0000-0000-000000000001',
  'aaaabbbb-0000-0000-0000-000000000002',
  'aaaabbbb-0000-0000-0000-000000000003',
  'aaaabbbb-0000-0000-0000-000000000004'
);

INSERT INTO wildcard_picks (user_id, team) VALUES
-- Alex — all 8 correct (16 pts)
('aaaabbbb-0000-0000-0000-000000000001','Australia'),
('aaaabbbb-0000-0000-0000-000000000001','Scotland'),
('aaaabbbb-0000-0000-0000-000000000001','Sweden'),
('aaaabbbb-0000-0000-0000-000000000001','Norway'),
('aaaabbbb-0000-0000-0000-000000000001','Algeria'),
('aaaabbbb-0000-0000-0000-000000000001','Iran'),
('aaaabbbb-0000-0000-0000-000000000001','South Africa'),
('aaaabbbb-0000-0000-0000-000000000001','Ghana'),
-- Jordan — 5/8 correct (10 pts) — swaps 3 for wrong teams
('aaaabbbb-0000-0000-0000-000000000002','Australia'),
('aaaabbbb-0000-0000-0000-000000000002','Scotland'),
('aaaabbbb-0000-0000-0000-000000000002','Sweden'),
('aaaabbbb-0000-0000-0000-000000000002','Norway'),
('aaaabbbb-0000-0000-0000-000000000002','Algeria'),
('aaaabbbb-0000-0000-0000-000000000002','Qatar'),          -- wrong
('aaaabbbb-0000-0000-0000-000000000002','Saudi Arabia'),   -- wrong
('aaaabbbb-0000-0000-0000-000000000002','Ivory Coast'),    -- wrong
-- Sam — 4/8 correct (8 pts)
('aaaabbbb-0000-0000-0000-000000000003','Australia'),
('aaaabbbb-0000-0000-0000-000000000003','Scotland'),
('aaaabbbb-0000-0000-0000-000000000003','Iran'),
('aaaabbbb-0000-0000-0000-000000000003','South Africa'),
('aaaabbbb-0000-0000-0000-000000000003','Jordan'),         -- wrong
('aaaabbbb-0000-0000-0000-000000000003','Iraq'),           -- wrong
('aaaabbbb-0000-0000-0000-000000000003','Ivory Coast'),    -- wrong
('aaaabbbb-0000-0000-0000-000000000003','Bosnia-Herzegovina'), -- wrong
-- Riley — 2/8 correct (4 pts)
('aaaabbbb-0000-0000-0000-000000000004','Scotland'),
('aaaabbbb-0000-0000-0000-000000000004','Iran'),
('aaaabbbb-0000-0000-0000-000000000004','Qatar'),
('aaaabbbb-0000-0000-0000-000000000004','Bosnia-Herzegovina'),
('aaaabbbb-0000-0000-0000-000000000004','Saudi Arabia'),
('aaaabbbb-0000-0000-0000-000000000004','Ivory Coast'),
('aaaabbbb-0000-0000-0000-000000000004','Jordan'),
('aaaabbbb-0000-0000-0000-000000000004','Uzbekistan');

-- ─────────────────────────────────────────────────────────────────
-- STEP 5 — Group Stage Results (all 12 groups)
-- ─────────────────────────────────────────────────────────────────
DELETE FROM group_results;
DELETE FROM wildcard_advancers;

INSERT INTO group_results (group_id, winner, runner_up) VALUES
  ('A', 'Mexico',      'South Korea'),
  ('B', 'Canada',      'Switzerland'),
  ('C', 'Brazil',      'Morocco'),
  ('D', 'USA',         'Türkiye'),
  ('E', 'Germany',     'Ecuador'),
  ('F', 'Netherlands', 'Japan'),
  ('G', 'Belgium',     'Egypt'),
  ('H', 'Spain',       'Uruguay'),
  ('I', 'France',      'Senegal'),
  ('J', 'Argentina',   'Austria'),
  ('K', 'Portugal',    'Colombia'),
  ('L', 'England',     'Croatia');

-- Best 8 third-place advancers (the wildcard teams)
INSERT INTO wildcard_advancers (team) VALUES
  ('Australia'), ('Scotland'), ('Sweden'),  ('Norway'),
  ('Algeria'),   ('Iran'),     ('South Africa'), ('Ghana');

-- ─────────────────────────────────────────────────────────────────
-- STEP 6 — Calculate group scores
-- ─────────────────────────────────────────────────────────────────
SELECT calculate_group_scores();

-- ─────────────────────────────────────────────────────────────────
-- STEP 7 — Lock group picks + set Phase 2 in settings
-- ─────────────────────────────────────────────────────────────────
UPDATE settings SET
  group_picks_locked = true,
  phase = 2,
  -- Set bracket_unlock_at 1 second ago so bracket is already open
  bracket_unlock_at = (NOW() - INTERVAL '1 second')
WHERE id = 1;

-- Confirm (should show group_picks_locked=true, bracket open)
SELECT phase, group_picks_locked, bracket_picks_locked, bracket_unlock_at FROM settings WHERE id = 1;

-- ─────────────────────────────────────────────────────────────────
-- STEP 8 — Initialize bracket structure
-- ─────────────────────────────────────────────────────────────────
SELECT generate_bracket();

-- ─────────────────────────────────────────────────────────────────
-- STEP 9 — Set R32 matchup teams (16 matches)
--
-- Bracket design:
--   Match  1: Mexico      vs Uruguay      Match  9: France    vs South Korea
--   Match  2: Canada      vs South Africa Match 10: Argentina vs Egypt
--   Match  3: Brazil      vs Algeria      Match 11: Portugal  vs Scotland
--   Match  4: USA         vs Croatia      Match 12: England   vs Senegal
--   Match  5: Germany     vs Ghana        Match 13: Morocco   vs Australia
--   Match  6: Netherlands vs Ecuador      Match 14: Japan     vs Austria
--   Match  7: Belgium     vs Switzerland  Match 15: Colombia  vs Norway
--   Match  8: Spain       vs Sweden       Match 16: Türkiye   vs Iran
-- ─────────────────────────────────────────────────────────────────
UPDATE bracket_matches SET team1='Mexico',      team2='Uruguay'       WHERE round='R32' AND match_number=1;
UPDATE bracket_matches SET team1='Canada',      team2='South Africa'  WHERE round='R32' AND match_number=2;
UPDATE bracket_matches SET team1='Brazil',      team2='Algeria'       WHERE round='R32' AND match_number=3;
UPDATE bracket_matches SET team1='USA',         team2='Croatia'       WHERE round='R32' AND match_number=4;
UPDATE bracket_matches SET team1='Germany',     team2='Ghana'         WHERE round='R32' AND match_number=5;
UPDATE bracket_matches SET team1='Netherlands', team2='Ecuador'       WHERE round='R32' AND match_number=6;
UPDATE bracket_matches SET team1='Belgium',     team2='Switzerland'   WHERE round='R32' AND match_number=7;
UPDATE bracket_matches SET team1='Spain',       team2='Sweden'        WHERE round='R32' AND match_number=8;
UPDATE bracket_matches SET team1='France',      team2='South Korea'   WHERE round='R32' AND match_number=9;
UPDATE bracket_matches SET team1='Argentina',   team2='Egypt'         WHERE round='R32' AND match_number=10;
UPDATE bracket_matches SET team1='Portugal',    team2='Scotland'      WHERE round='R32' AND match_number=11;
UPDATE bracket_matches SET team1='England',     team2='Senegal'       WHERE round='R32' AND match_number=12;
UPDATE bracket_matches SET team1='Morocco',     team2='Australia'     WHERE round='R32' AND match_number=13;
UPDATE bracket_matches SET team1='Japan',       team2='Austria'       WHERE round='R32' AND match_number=14;
UPDATE bracket_matches SET team1='Colombia',    team2='Norway'        WHERE round='R32' AND match_number=15;
UPDATE bracket_matches SET team1='Türkiye',     team2='Iran'          WHERE round='R32' AND match_number=16;

-- ─────────────────────────────────────────────────────────────────
-- STEP 10 — Bracket picks for all 4 users
--
-- Alex   (near-perfect) — picks all 16 R32 correct, mostly right after
-- Jordan (good) — 14/16 R32, strong through semifinals
-- Sam    (average) — 8/16 R32, recovers later
-- Riley  (random) — 4/16 R32, but gets Spain in the final
-- ─────────────────────────────────────────────────────────────────
DELETE FROM bracket_picks
WHERE user_id IN (
  'aaaabbbb-0000-0000-0000-000000000001',
  'aaaabbbb-0000-0000-0000-000000000002',
  'aaaabbbb-0000-0000-0000-000000000003',
  'aaaabbbb-0000-0000-0000-000000000004'
);

-- Helper: insert picks by (round, match_number) so we don't need IDs
-- ── R32 picks ────────────────────────────────────────────────────
INSERT INTO bracket_picks (user_id, match_id, picked_winner)
SELECT u.uid, m.id, u.pick
FROM (VALUES
  -- Alex picks all R32 winners correctly
  ('aaaabbbb-0000-0000-0000-000000000001'::uuid,'R32',1,'Mexico'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',2,'Canada'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',3,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',4,'USA'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',5,'Germany'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',6,'Netherlands'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',7,'Belgium'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',8,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',9,'France'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',10,'Argentina'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',11,'Portugal'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',12,'England'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',13,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',14,'Japan'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',15,'Colombia'),
  ('aaaabbbb-0000-0000-0000-000000000001','R32',16,'Türkiye'),
  -- Jordan — misses M4 (picks Croatia) and M13 (picks Australia)
  ('aaaabbbb-0000-0000-0000-000000000002','R32',1,'Mexico'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',2,'Canada'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',3,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',4,'Croatia'),    -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000002','R32',5,'Germany'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',6,'Netherlands'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',7,'Belgium'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',8,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',9,'France'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',10,'Argentina'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',11,'Portugal'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',12,'England'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',13,'Australia'),  -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000002','R32',14,'Japan'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',15,'Colombia'),
  ('aaaabbbb-0000-0000-0000-000000000002','R32',16,'Türkiye'),
  -- Sam — 8/16 correct
  ('aaaabbbb-0000-0000-0000-000000000003','R32',1,'Uruguay'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000003','R32',2,'Canada'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',3,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',4,'USA'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',5,'Ghana'),       -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000003','R32',6,'Ecuador'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000003','R32',7,'Switzerland'), -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000003','R32',8,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',9,'South Korea'), -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000003','R32',10,'Argentina'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',11,'Portugal'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',12,'Senegal'),    -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000003','R32',13,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',14,'Austria'),    -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000003','R32',15,'Colombia'),
  ('aaaabbbb-0000-0000-0000-000000000003','R32',16,'Iran'),       -- WRONG
  -- Riley — 4/16 correct
  ('aaaabbbb-0000-0000-0000-000000000004','R32',1,'Uruguay'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',2,'South Africa'),-- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',3,'Algeria'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',4,'Croatia'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',5,'Ghana'),       -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',6,'Netherlands'), -- correct
  ('aaaabbbb-0000-0000-0000-000000000004','R32',7,'Belgium'),     -- correct
  ('aaaabbbb-0000-0000-0000-000000000004','R32',8,'Sweden'),      -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',9,'South Korea'), -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',10,'Egypt'),      -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',11,'Scotland'),   -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',12,'England'),    -- correct
  ('aaaabbbb-0000-0000-0000-000000000004','R32',13,'Australia'),  -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',14,'Japan'),      -- correct
  ('aaaabbbb-0000-0000-0000-000000000004','R32',15,'Norway'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R32',16,'Iran')        -- WRONG
) AS u(uid, round, num, pick)
JOIN bracket_matches m ON m.round = u.round AND m.match_number = u.num::int
ON CONFLICT (user_id, match_id) DO UPDATE SET picked_winner = EXCLUDED.picked_winner;

-- ── R16 picks (based on actual R16 bracket) ──────────────────────
-- R16 matchups (winners of R32 pairs 1-2, 3-4, 5-6, 7-8, 9-10, 11-12, 13-14, 15-16):
--   M1:Mexico vs Canada     M2:Brazil vs USA      M3:Germany vs Netherlands
--   M4:Belgium vs Spain     M5:France vs Argentina M6:Portugal vs England
--   M7:Morocco vs Japan     M8:Colombia vs Türkiye
-- NOTE: R16 teams won't appear until R32 results are entered (run seed_bracket_results.sql)
-- These picks are pre-loaded so scoring works once results are entered

-- ── QF picks ─────────────────────────────────────────────────────
-- QF matchups:
--   M1:Canada vs Brazil  M2:Germany vs Spain  M3:France vs Portugal  M4:Morocco vs Colombia

-- ── SF picks ─────────────────────────────────────────────────────
-- SF: Brazil vs Spain  |  France vs Morocco

-- ── Third Place & Final ───────────────────────────────────────────
-- Third: Brazil vs Morocco  |  Final: Spain vs France (Spain wins, champion!)

-- Insert R16 through Final picks for all rounds
INSERT INTO bracket_picks (user_id, match_id, picked_winner)
SELECT u.uid, m.id, u.pick
FROM (VALUES
  -- Alex — perfect through all rounds
  ('aaaabbbb-0000-0000-0000-000000000001'::uuid,'R16',1,'Canada'),
  ('aaaabbbb-0000-0000-0000-000000000001','R16',2,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000001','R16',3,'Germany'),
  ('aaaabbbb-0000-0000-0000-000000000001','R16',4,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000001','R16',5,'France'),
  ('aaaabbbb-0000-0000-0000-000000000001','R16',6,'Portugal'),
  ('aaaabbbb-0000-0000-0000-000000000001','R16',7,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000001','R16',8,'Colombia'),
  ('aaaabbbb-0000-0000-0000-000000000001','QF',1,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000001','QF',2,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000001','QF',3,'France'),
  ('aaaabbbb-0000-0000-0000-000000000001','QF',4,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000001','SF',1,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000001','SF',2,'France'),
  ('aaaabbbb-0000-0000-0000-000000000001','THIRD',1,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000001','FINAL',1,'Spain'),
  -- Jordan — strong, misses Netherlands in R16 M3 and England in M6
  ('aaaabbbb-0000-0000-0000-000000000002','R16',1,'Canada'),
  ('aaaabbbb-0000-0000-0000-000000000002','R16',2,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000002','R16',3,'Netherlands'), -- WRONG (Germany wins)
  ('aaaabbbb-0000-0000-0000-000000000002','R16',4,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000002','R16',5,'France'),
  ('aaaabbbb-0000-0000-0000-000000000002','R16',6,'England'),     -- WRONG (Portugal wins)
  ('aaaabbbb-0000-0000-0000-000000000002','R16',7,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000002','R16',8,'Colombia'),
  ('aaaabbbb-0000-0000-0000-000000000002','QF',1,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000002','QF',2,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000002','QF',3,'France'),
  ('aaaabbbb-0000-0000-0000-000000000002','QF',4,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000002','SF',1,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000002','SF',2,'France'),
  ('aaaabbbb-0000-0000-0000-000000000002','THIRD',1,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000002','FINAL',1,'Spain'),
  -- Sam — average through rounds
  ('aaaabbbb-0000-0000-0000-000000000003','R16',1,'Mexico'),      -- WRONG (Canada wins)
  ('aaaabbbb-0000-0000-0000-000000000003','R16',2,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000003','R16',3,'Germany'),
  ('aaaabbbb-0000-0000-0000-000000000003','R16',4,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000003','R16',5,'France'),
  ('aaaabbbb-0000-0000-0000-000000000003','R16',6,'Portugal'),
  ('aaaabbbb-0000-0000-0000-000000000003','R16',7,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000003','R16',8,'Colombia'),
  ('aaaabbbb-0000-0000-0000-000000000003','QF',1,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000003','QF',2,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000003','QF',3,'France'),
  ('aaaabbbb-0000-0000-0000-000000000003','QF',4,'Morocco'),
  ('aaaabbbb-0000-0000-0000-000000000003','SF',1,'Spain'),
  ('aaaabbbb-0000-0000-0000-000000000003','SF',2,'France'),
  ('aaaabbbb-0000-0000-0000-000000000003','THIRD',1,'Brazil'),
  ('aaaabbbb-0000-0000-0000-000000000003','FINAL',1,'France'),    -- WRONG (Spain wins)
  -- Riley — random, but gets Spain in the Final
  ('aaaabbbb-0000-0000-0000-000000000004','R16',1,'Mexico'),      -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R16',2,'USA'),         -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R16',3,'Netherlands'), -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R16',4,'Belgium'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R16',5,'Argentina'),   -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R16',6,'England'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R16',7,'Japan'),       -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','R16',8,'Türkiye'),     -- WRONG
  ('aaaabbbb-0000-0000-0000-000000000004','QF',1,'Brazil'),       -- correct (vs Canada)
  ('aaaabbbb-0000-0000-0000-000000000004','QF',2,'Germany'),      -- WRONG (Spain wins)
  ('aaaabbbb-0000-0000-0000-000000000004','QF',3,'Portugal'),     -- WRONG (France wins)
  ('aaaabbbb-0000-0000-0000-000000000004','QF',4,'Colombia'),     -- WRONG (Morocco wins)
  ('aaaabbbb-0000-0000-0000-000000000004','SF',1,'Brazil'),       -- WRONG (Spain wins)
  ('aaaabbbb-0000-0000-0000-000000000004','SF',2,'Morocco'),      -- WRONG (France wins)
  ('aaaabbbb-0000-0000-0000-000000000004','THIRD',1,'Morocco'),   -- WRONG (Brazil wins)
  ('aaaabbbb-0000-0000-0000-000000000004','FINAL',1,'Spain')      -- CORRECT (Spain wins!)
) AS u(uid, round, num, pick)
JOIN bracket_matches m ON m.round = u.round AND m.match_number = u.num::int
ON CONFLICT (user_id, match_id) DO UPDATE SET picked_winner = EXCLUDED.picked_winner;

-- ─────────────────────────────────────────────────────────────────
-- DONE — Verify everything looks right
-- ─────────────────────────────────────────────────────────────────
SELECT 'profiles'      AS tbl, count(*) FROM profiles     WHERE id LIKE 'aaaabbbb%'
UNION ALL
SELECT 'group_picks'   AS tbl, count(*) FROM group_picks  WHERE user_id LIKE 'aaaabbbb%'
UNION ALL
SELECT 'wildcard_picks'AS tbl, count(*) FROM wildcard_picks WHERE user_id LIKE 'aaaabbbb%'
UNION ALL
SELECT 'group_results' AS tbl, count(*) FROM group_results
UNION ALL
SELECT 'bracket_matches'AS tbl,count(*) FROM bracket_matches
UNION ALL
SELECT 'bracket_picks' AS tbl, count(*) FROM bracket_picks WHERE user_id LIKE 'aaaabbbb%';

-- Expected group-phase scores (before bracket):
--   Alex: 112  Jordan: 98  Sam: 85  Riley: 47
SELECT p.display_name, s.group_points, s.bracket_points, s.total_points
FROM profiles p
LEFT JOIN scores s ON s.user_id = p.id
WHERE p.id LIKE 'aaaabbbb%'
ORDER BY s.total_points DESC NULLS LAST;

-- ══════════════════════════════════════════════════════════════════
-- NEXT STEPS IN THE BROWSER:
--   1. Open the app — you should see all 4 players on the Leaderboard
--   2. Admin → Settings → "Open Bracket Now" is already done by this script
--   3. Log in as alex@fifapool.test (pass: TestPool2026!) to verify picks visible
--   4. Run seed_bracket_results.sql to simulate the full tournament and score it
-- ══════════════════════════════════════════════════════════════════
