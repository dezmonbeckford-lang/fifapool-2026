# FifaPool 2026 — End-to-End Test Guide

Everything is pre-built. Follow these steps in order to run the full test.

---

## Step 1 — Apply RLS fix (one-time, if not done)

In **Supabase Dashboard → SQL Editor**, run:

```
supabase/schema_v4.sql
```

This lets authenticated users read each other's picks (needed for the player picks viewer).

---

## Step 2 — Load all test data

In **Supabase Dashboard → SQL Editor**, run:

```
supabase/seed_test.sql
```

This creates:
- **4 test accounts** — alex / jordan / sam / riley @ fifapool.test (password: `TestPool2026!`)
- All 12 group picks for each player (varying accuracy)
- 8 wildcard picks per player
- Group stage results + scoring (runs `calculate_group_scores()` automatically)
- Full bracket setup (32 R32 matches with teams)
- Bracket picks for all 4 users through the Final

**Expected group-phase scores after this script:**
| Player | Group Pts | Wildcard Pts | Total |
|--------|-----------|--------------|-------|
| Alex   | 112       | 16           | 128   |
| Jordan | 98        | 10           | 108   |
| Sam    | 85        | 8            | 93    |
| Riley  | 47        | 4            | 51    |

---

## Step 3 — Verify in the browser

1. Open the app → **Leaderboard** — should show all 4 players
2. Log in as `alex@fifapool.test` / `TestPool2026!`
3. Tap **Bracket Picks** — bracket should already be unlocked (Phase 2)
4. Tap a player's name on the Leaderboard → should show their group picks (locked = visible)

---

## Step 4 — Simulate full tournament results

In **Supabase Dashboard → SQL Editor**, run:

```
supabase/seed_bracket_results.sql
```

This enters all R32 → Final results and calls `score_bracket_match()` for every match.

**Champion: 🏆 Spain**

**Expected final standings:**
| Player | Group | Bracket | Total |
|--------|-------|---------|-------|
| Alex   | ~128  | ~252    | ~380  |
| Jordan | ~108  | ~220    | ~328  |
| Sam    | ~93   | ~155    | ~248  |
| Riley  | ~51   | ~62     | ~113  |

> **Riley note:** Riley picks Spain in the Final and gets the 17pt match + 25pt champion bonus = 42 extra pts!

---

## Step 5 — Test Admin Quick Actions (optional)

Admin → Settings → **⚡ Tournament Flow** panel has 3 one-click buttons:
1. **Lock Group Picks** — freezes group picks, makes them public
2. **Open Bracket Now** — sets `bracket_unlock_at` to now, advances to Phase 2
3. **Lock Bracket Picks** — freezes bracket picks before R32 starts

These are already in the correct state after running the seed scripts, but you can test them manually.

---

## Step 6 — Clean up test data

When done testing, run:

```
supabase/seed_cleanup.sql
```

Deletes all 4 test accounts and their picks. Does **not** touch real player data or tournament results.

To also wipe bracket matches and reset to Phase 1, uncomment the block at the bottom of that file.

---

## Test Credentials

| Name   | Email                  | Password       |
|--------|------------------------|----------------|
| Alex   | alex@fifapool.test     | TestPool2026!  |
| Jordan | jordan@fifapool.test   | TestPool2026!  |
| Sam    | sam@fifapool.test      | TestPool2026!  |
| Riley  | riley@fifapool.test    | TestPool2026!  |
