/**
 * FIFA 2026 World Cup — knockout bracket connections
 *
 * Structure:
 *   LEFT BRACKET  (R16 matches 1-4 → QF 1-2 → SF 1)
 *   RIGHT BRACKET (R16 matches 5-8 → QF 3-4 → SF 2)
 *
 * Key principle: complementary group matches go to OPPOSITE halves
 *   Match 1 (1A vs 2B)  ←→  Match 7 (1B vs 2A)  →  can only meet in Final
 *   Match 2 (1C vs 2D)  ←→  Match 8 (1D vs 2C)  →  can only meet in Final
 *   etc.
 *
 * Wildcards (matches 13-16) are split 2 per bracket half.
 */

// R32 match_number → { r16: R16 match_number, slot: 1|2 }
export const R32_TO_R16 = {
  1:  { r16: 1, slot: 1 },  // LEFT  — 1A vs 2B
  2:  { r16: 1, slot: 2 },  //         1C vs 2D
  3:  { r16: 2, slot: 1 },  //         1E vs 2F
  4:  { r16: 2, slot: 2 },  //         1G vs 2H
  5:  { r16: 3, slot: 1 },  //         1I vs 2J
  6:  { r16: 3, slot: 2 },  //         1K vs 2L
  13: { r16: 4, slot: 1 },  //         Wildcard
  14: { r16: 4, slot: 2 },  //         Wildcard
  7:  { r16: 5, slot: 1 },  // RIGHT  — 1B vs 2A  (complement of match 1)
  8:  { r16: 5, slot: 2 },  //         1D vs 2C  (complement of match 2)
  9:  { r16: 6, slot: 1 },  //         1F vs 2E  (complement of match 3)
  10: { r16: 6, slot: 2 },  //         1H vs 2G
  11: { r16: 7, slot: 1 },  //         1J vs 2I
  12: { r16: 7, slot: 2 },  //         1L vs 2K
  15: { r16: 8, slot: 1 },  //         Wildcard
  16: { r16: 8, slot: 2 },  //         Wildcard
}

// Inverse: R16 match_number → the two R32 match_numbers that feed it
// slot 1 = team1, slot 2 = team2
export const R16_FEEDERS = Object.entries(R32_TO_R16).reduce((acc, [r32, { r16, slot }]) => {
  if (!acc[r16]) acc[r16] = {}
  acc[r16][slot] = Number(r32)
  return acc
}, {})

/**
 * Returns the R32 feeder match numbers for a given R16 match.
 * Used for display / navigation only.
 */
export function getR16Feeders(r16MatchNum) {
  const f = R16_FEEDERS[r16MatchNum] || {}
  return { feeder1: f[1] ?? null, feeder2: f[2] ?? null }
}

/**
 * Where does the winner of `round`/`matchNum` feed into next?
 * Returns { round, matchNum, slot } or null for Final/Third.
 */
export function getNextSlot(round, matchNum) {
  if (round === 'R32') {
    const m = R32_TO_R16[matchNum]
    if (!m) return null
    return { round: 'R16', matchNum: m.r16, slot: m.slot }
  }
  // R16 → QF, QF → SF: standard consecutive pairing
  if (round === 'R16' || round === 'QF') {
    const nextRound = round === 'R16' ? 'QF' : 'SF'
    return {
      round: nextRound,
      matchNum: Math.ceil(matchNum / 2),
      slot: matchNum % 2 === 1 ? 1 : 2,
    }
  }
  // SF winners go to Final (SF1 winner → FINAL team1, SF2 winner → FINAL team2)
  if (round === 'SF') {
    return {
      round: 'FINAL',
      matchNum: 1,
      slot: matchNum === 1 ? 1 : 2,
    }
  }
  return null
}

/**
 * What two matches feed into `round`/`matchNum`?
 * Returns array of { round, matchNum, type } where type = 'winner' | 'loser'
 */
export function getFeeders(round, matchNum) {
  if (round === 'R16') {
    const f = R16_FEEDERS[matchNum] || {}
    return [
      { round: 'R32', matchNum: f[1], type: 'winner' },
      { round: 'R32', matchNum: f[2], type: 'winner' },
    ]
  }
  if (round === 'QF') {
    return [
      { round: 'R16', matchNum: matchNum * 2 - 1, type: 'winner' },
      { round: 'R16', matchNum: matchNum * 2,     type: 'winner' },
    ]
  }
  if (round === 'SF') {
    return [
      { round: 'QF', matchNum: matchNum * 2 - 1, type: 'winner' },
      { round: 'QF', matchNum: matchNum * 2,     type: 'winner' },
    ]
  }
  if (round === 'FINAL') {
    return [
      { round: 'SF', matchNum: 1, type: 'winner' },
      { round: 'SF', matchNum: 2, type: 'winner' },
    ]
  }
  if (round === 'THIRD') {
    return [
      { round: 'SF', matchNum: 1, type: 'loser' },
      { round: 'SF', matchNum: 2, type: 'loser' },
    ]
  }
  return []
}
