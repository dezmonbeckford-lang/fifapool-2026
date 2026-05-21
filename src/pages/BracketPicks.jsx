import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { TEAM_FLAGS } from '../data/groups'
import { BRACKET_POINTS, ROUND_LABELS } from '../data/scoring'
import { saveWithRetry } from '../lib/saveWithRetry'
import { readWithRetry } from '../lib/readWithRetry'
import { useLoadGuard } from '../lib/useLoadGuard.jsx'
import { getCached, setCached } from '../lib/dataCache'
import './BracketPicks.css'

// ── Bracket tree helpers ─────────────────────────────────────────
// Standard bracket: R16 match N → R32 matches (2N-1) and (2N), etc.
const ROUND_SEQUENCE = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']
const PREV_ROUND     = { R16: 'R32', QF: 'R16', SF: 'QF', FINAL: 'SF' }

/**
 * Compute which teams appear in a given match slot.
 * For R32: use the real team names from bracket_matches.
 * For later rounds: use the user's picks from previous rounds.
 * For THIRD: use the losers of both SF matches.
 */
function getMatchTeams(round, matchNum, byRound, picks) {
  if (round === 'R32') {
    const m = byRound.R32?.find(x => x.match_number === matchNum)
    return { team1: m?.team1 || null, team2: m?.team2 || null }
  }
  if (round === 'THIRD') {
    // Losers of SF matches 1 & 2
    return {
      team1: resolveLoser('SF', 1, byRound, picks),
      team2: resolveLoser('SF', 2, byRound, picks),
    }
  }
  const prev = PREV_ROUND[round]
  return {
    team1: resolveWinner(prev, matchNum * 2 - 1, byRound, picks),
    team2: resolveWinner(prev, matchNum * 2,     byRound, picks),
  }
}

function resolveWinner(round, matchNum, byRound, picks) {
  const m = byRound[round]?.find(x => x.match_number === matchNum)
  if (!m) return null
  if (m.result_entered) return m.actual_winner
  return picks[m.id]?.picked_winner || null
}

function resolveLoser(round, matchNum, byRound, picks) {
  const m = byRound[round]?.find(x => x.match_number === matchNum)
  if (!m) return null
  const { team1, team2 } = getMatchTeams(round, matchNum, byRound, picks)
  if (!team1 || !team2) return null
  if (m.result_entered) return m.team1 === m.actual_winner ? m.team2 : m.team1
  const pick = picks[m.id]?.picked_winner
  if (!pick) return null
  return pick === team1 ? team2 : team1
}

/** After changing a pick, wipe any downstream picks that are now invalid. */
function clearOrphans(picks, byRound) {
  const out = { ...picks }
  for (const round of ['R16', 'QF', 'SF', 'THIRD', 'FINAL']) {
    for (const m of (byRound[round] || [])) {
      const { team1, team2 } = getMatchTeams(round, m.match_number, byRound, out)
      const pick = out[m.id]?.picked_winner
      if (pick && pick !== team1 && pick !== team2) {
        out[m.id] = { ...out[m.id], picked_winner: null }
      }
    }
  }
  return out
}

function isGroupLabel(val) {
  return val && (val.startsWith('Winner Group') || val.startsWith('Runner-up Group'))
}

// ── Component ────────────────────────────────────────────────────
export default function BracketPicks() {
  const { user } = useAuth()
  const cacheKey  = `bracket-picks-${user?.id || 'anon'}`
  const cached    = getCached(cacheKey)

  const [matches,     setMatches]     = useState(cached?.matches    || [])
  const [myPicks,     setMyPicks]     = useState(cached?.myPicks    || {})
  const [results,     setResults]     = useState(cached?.results    || {})
  const [locked,      setLocked]      = useState(cached?.locked     || false)
  const [phase,       setPhase]       = useState(cached?.phase      || 1)
  const [groupPts,    setGroupPts]    = useState(cached?.groupPts   ?? null)
  const [activeRound, setActiveRound] = useState('R32')
  const [saving,      setSaving]      = useState(false)
  const [saveStatus,  setSaveStatus]  = useState('')
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(!cached)

  useEffect(() => { loadData() }, [user?.id])

  async function loadData() {
    if (!getCached(cacheKey)) setLoading(true)
    try {
      const queries = [
        readWithRetry(sig => supabase.from('settings').select('phase, bracket_picks_locked').single().abortSignal(sig)),
        readWithRetry(sig => supabase.from('bracket_matches').select('*').order('round_order').order('match_number').abortSignal(sig)),
      ]
      if (user?.id) {
        queries.push(readWithRetry(sig => supabase.from('bracket_picks').select('*').eq('user_id', user.id).abortSignal(sig)))
        queries.push(readWithRetry(sig => supabase.from('scores').select('group_points').eq('user_id', user.id).single().abortSignal(sig)))
      }
      const [settingsRes, matchesRes, picksRes, scoreRes] = await Promise.all(queries)

      const lockedVal = settingsRes?.data?.bracket_picks_locked ?? false
      const phaseVal  = settingsRes?.data?.phase ?? 1
      setLocked(lockedVal)
      setPhase(phaseVal)

      const matchData = matchesRes?.data || []
      setMatches(matchData)

      const resultMap = {}
      matchData.forEach(m => { if (m.result_entered) resultMap[m.id] = m.actual_winner })
      setResults(resultMap)

      const pickMap = {}
      if (picksRes?.data) {
        picksRes.data.forEach(p => {
          pickMap[p.match_id] = {
            picked_winner:     p.picked_winner,
            tb1:               p.tiebreaker_score1,
            tb2:               p.tiebreaker_score2,
          }
        })
        setMyPicks(pickMap)
      }

      const gPts = scoreRes?.data?.group_points ?? 0
      setGroupPts(gPts)

      setCached(cacheKey, { matches: matchData, myPicks: pickMap, results: resultMap, locked: lockedVal, phase: phaseVal, groupPts: gPts })
    } catch {
      if (!getCached(cacheKey)) setError('Failed to load bracket')
    } finally {
      setLoading(false)
    }
  }

  const { guardEl } = useLoadGuard(loading, loadData)
  if (loading) return guardEl

  const isOpen = phase >= 2

  // Group matches by round
  const byRound = {}
  ROUND_SEQUENCE.forEach(r => { byRound[r] = matches.filter(m => m.round === r) })

  // Points calc
  const { currentPts, potentialPts, eliminatedTeams } = calcPoints(matches, myPicks, results)

  // ── Handlers ────────────────────────────────────────────────────
  function pickWinner(matchId, team) {
    if (locked || !isOpen) return
    setMyPicks(prev => {
      const next = { ...prev, [matchId]: { ...prev[matchId], picked_winner: team } }
      return clearOrphans(next, byRound)
    })
  }

  function setTiebreaker(matchId, field, val) {
    if (locked || !isOpen) return
    const num = parseInt(val)
    setMyPicks(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: isNaN(num) ? '' : num } }))
  }

  async function handleSave() {
    if (!user || locked || !isOpen) return
    setSaving(true)
    setSaveStatus('Saving…')
    setError('')
    const rows = Object.entries(myPicks)
      .filter(([, v]) => v.picked_winner)
      .map(([matchId, v]) => ({
        user_id:           user.id,
        match_id:          matchId,
        picked_winner:     v.picked_winner,
        tiebreaker_score1: v.tb1 ?? null,
        tiebreaker_score2: v.tb2 ?? null,
      }))
    try {
      await saveWithRetry(
        async (signal) => {
          // Clear existing picks first, then insert fresh — avoids any conflict issues
          const { error: delErr } = await supabase
            .from('bracket_picks')
            .delete()
            .eq('user_id', user.id)
            .abortSignal(signal)
          if (delErr) throw new Error(`Clear picks: ${delErr.message}`)

          if (rows.length > 0) {
            const { error: insErr } = await supabase
              .from('bracket_picks')
              .insert(rows)
              .abortSignal(signal)
            if (insErr) throw new Error(`Save picks: ${insErr.message}`)
          }
        },
        { onRetry: () => setSaveStatus('Retrying…') }
      )
      setSaveStatus('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save picks. Try again.')
    } finally {
      setSaving(false)
      setSaveStatus('')
    }
  }

  // ── Gate screens ─────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="bracket-locked-screen">
        <div className="bls-card card">
          <div className="bls-icon">🏆</div>
          <h2>Bracket Picks Opening Soon</h2>
          <p>The Round of 32 bracket will open once the group stage is complete.</p>
          <p className="bls-sub">Check back after the group stage — you'll be able to pick winners for every round all the way to the Final.</p>
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="page-center">
        <div className="card" style={{ textAlign: 'center', padding: 32, maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <h2>Bracket Not Set Yet</h2>
          <p style={{ color: 'var(--text2)', marginTop: 8 }}>The admin is setting up the Round of 32 matchups. Check back soon.</p>
        </div>
      </div>
    )
  }

  // Check if R32 still has labels (admin hasn't auto-filled yet)
  const r32HasLabels = (byRound.R32 || []).some(m => isGroupLabel(m.team1) || isGroupLabel(m.team2))
  if (r32HasLabels) {
    return (
      <div className="page-center">
        <div className="card" style={{ textAlign: 'center', padding: 32, maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚽</div>
          <h2>Bracket Coming Soon</h2>
          <p style={{ color: 'var(--text2)', marginTop: 8 }}>The admin is finalising the R32 matchups. Come back in a few minutes.</p>
        </div>
      </div>
    )
  }

  // ── Round navigation helpers ─────────────────────────────────────
  const activeRounds    = ROUND_SEQUENCE.filter(r => (byRound[r] || []).length > 0)
  const activeIdx       = activeRounds.indexOf(activeRound)
  const prevRound       = activeIdx > 0 ? activeRounds[activeIdx - 1] : null
  const nextRound       = activeIdx < activeRounds.length - 1 ? activeRounds[activeIdx + 1] : null
  const isFinalRound    = activeRound === 'FINAL'

  function roundPickCount(r)  { return (byRound[r] || []).filter(m => myPicks[m.id]?.picked_winner).length }
  function roundTotal(r)      { return (byRound[r] || []).length }
  function isRoundComplete(r) { return roundPickCount(r) === roundTotal(r) && roundTotal(r) > 0 }

  const totalPicked = Object.values(myPicks).filter(p => p.picked_winner).length
  const totalAll    = matches.length

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="bracket-page">

      {/* Points banner */}
      <div className="pts-banner">
        {groupPts !== null && (
          <>
            <div className="pts-item">
              <div className="pts-val">{groupPts}</div>
              <div className="pts-label">Group pts</div>
            </div>
            <div className="pts-sep">+</div>
          </>
        )}
        <div className="pts-item">
          <div className="pts-val">{currentPts}</div>
          <div className="pts-label">Bracket pts</div>
        </div>
        <div className="pts-sep">+</div>
        <div className="pts-item potential">
          <div className="pts-val">{potentialPts}</div>
          <div className="pts-label">Potential</div>
        </div>
        <div className="pts-sep">=</div>
        <div className="pts-item max">
          <div className="pts-val">{(groupPts ?? 0) + currentPts + potentialPts}</div>
          <div className="pts-label">Max total</div>
        </div>
      </div>

      {locked && <div className="locked-banner">🔒 Bracket picks are locked. Good luck!</div>}
      {error  && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {saved  && <div className="success-msg" style={{ marginBottom: 12 }}>✓ Picks saved!</div>}

      {/* Round progress tabs */}
      <div className="round-tabs">
        {activeRounds.map(r => {
          const done = isRoundComplete(r)
          return (
            <button
              key={r}
              className={`round-tab${activeRound === r ? ' active' : ''}${done ? ' done' : ''}`}
              onClick={() => setActiveRound(r)}
            >
              <span className="rt-label">{ROUND_LABELS[r]}</span>
              <span className="rt-count">{roundPickCount(r)}/{roundTotal(r)}</span>
            </button>
          )
        })}
      </div>

      {/* Match cards */}
      <div className="bracket-matches">
        {(byRound[activeRound] || []).map(match => {
          const { team1, team2 } = getMatchTeams(activeRound, match.match_number, byRound, myPicks)
          const myPick    = myPicks[match.id]?.picked_winner
          const result    = results[match.id]
          const isCorrect = result && myPick === result
          const isWrong   = result && myPick && myPick !== result
          const t1Elim    = eliminatedTeams.has(team1)
          const t2Elim    = eliminatedTeams.has(team2)
          const pts       = BRACKET_POINTS[match.round] + (match.is_final ? BRACKET_POINTS.CHAMPION : 0)
          const bothKnown = !!(team1 && team2)

          return (
            <div key={match.id} className={`bm-card card${isCorrect ? ' correct' : ''}${isWrong ? ' wrong' : ''}`}>
              <div className="bm-header">
                <span className="bm-pts">+{pts} pts</span>
                {result ? (
                  <span className={`bm-result-badge ${isCorrect ? 'correct' : isWrong ? 'wrong' : ''}`}>
                    {isCorrect ? '✓ Correct' : isWrong ? '✗ Wrong' : `Result: ${result}`}
                  </span>
                ) : myPick && !result ? (
                  <span className="bm-pick-badge">⭐ {myPick}</span>
                ) : null}
              </div>

              <div className="bm-teams">
                <TeamPickBtn
                  team={team1}
                  picked={myPick === team1}
                  isWinner={result === team1}
                  isLoser={!!(result && result !== team1)}
                  eliminated={t1Elim}
                  onClick={() => bothKnown && pickWinner(match.id, team1)}
                  disabled={locked || !!result || !isOpen || !bothKnown}
                />
                <span className="bm-vs">VS</span>
                <TeamPickBtn
                  team={team2}
                  picked={myPick === team2}
                  isWinner={result === team2}
                  isLoser={!!(result && result !== team2)}
                  eliminated={t2Elim}
                  onClick={() => bothKnown && pickWinner(match.id, team2)}
                  disabled={locked || !!result || !isOpen || !bothKnown}
                />
              </div>

              {/* Tiebreaker for Final */}
              {match.is_final && (
                <div className="tiebreaker">
                  <div className="tb-label">🏆 Tiebreaker — Predict the final score:</div>
                  <div className="tb-inputs">
                    <div className="tb-team">
                      <span>{TEAM_FLAGS[team1] || '🏳️'} {team1 || '?'}</span>
                      <input type="number" min="0" max="20" className="input tb-input"
                        value={myPicks[match.id]?.tb1 ?? ''} placeholder="0"
                        onChange={e => setTiebreaker(match.id, 'tb1', e.target.value)}
                        disabled={locked || !isOpen} />
                    </div>
                    <span className="tb-dash">—</span>
                    <div className="tb-team">
                      <input type="number" min="0" max="20" className="input tb-input"
                        value={myPicks[match.id]?.tb2 ?? ''} placeholder="0"
                        onChange={e => setTiebreaker(match.id, 'tb2', e.target.value)}
                        disabled={locked || !isOpen} />
                      <span>{team2 || '?'} {TEAM_FLAGS[team2] || '🏳️'}</span>
                    </div>
                  </div>
                  <p className="tb-note">Used only as a tiebreaker on the leaderboard</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Round navigation */}
      <div className="bracket-round-nav">
        {prevRound ? (
          <button className="btn btn-outline brn-btn" onClick={() => setActiveRound(prevRound)}>
            ← {ROUND_LABELS[prevRound]}
          </button>
        ) : <div />}

        {nextRound && (
          <button
            className={`btn brn-btn${isRoundComplete(activeRound) ? ' btn-primary' : ' btn-outline'}`}
            onClick={() => setActiveRound(nextRound)}
          >
            {ROUND_LABELS[nextRound]} →
          </button>
        )}
      </div>

      {/* Save bar — fixed at bottom */}
      {!locked && isOpen && (
        <div className="bracket-save-bar">
          <div className="bsb-progress">
            {totalPicked}/{totalAll} picked
            {isFinalRound && totalPicked === totalAll && <span className="bsb-all-done"> ✓ All done!</span>}
          </div>
          <button
            className={`btn btn-lg btn-full${isFinalRound && totalPicked === totalAll ? ' btn-success' : ' btn-primary'}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? (saveStatus || 'Saving…')
              : isFinalRound && totalPicked === totalAll
                ? '🏆 Confirm All Picks'
                : '💾 Save Progress'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── TeamPickBtn ──────────────────────────────────────────────────
function TeamPickBtn({ team, picked, isWinner, isLoser, eliminated, onClick, disabled }) {
  if (!team) {
    return (
      <div className="tpb tpb-tbd">
        <span className="tpb-flag">⏳</span>
        <span className="tpb-name">Pick earlier rounds first</span>
      </div>
    )
  }
  return (
    <button
      className={`tpb${picked ? ' picked' : ''}${isWinner ? ' winner' : ''}${isLoser ? ' loser' : ''}${eliminated ? ' elim' : ''}`}
      onClick={onClick}
      disabled={disabled || eliminated}
    >
      <span className="tpb-flag">{TEAM_FLAGS[team] || '🏳️'}</span>
      <span className="tpb-name">{team}</span>
      {isWinner && <span className="tpb-crown">👑</span>}
      {picked && !isWinner && !isLoser && <span className="tpb-crown">⭐</span>}
    </button>
  )
}

// ── Points calculation ───────────────────────────────────────────
function calcPoints(matches, myPicks, results) {
  const eliminatedTeams = new Set()
  matches.forEach(m => {
    if (m.result_entered && m.actual_winner) {
      const loser = m.team1 === m.actual_winner ? m.team2 : m.team1
      if (loser) eliminatedTeams.add(loser)
    }
  })

  let currentPts = 0
  let potentialPts = 0

  matches.forEach(m => {
    const pick = myPicks[m.id]?.picked_winner
    if (!pick) return
    const pts = BRACKET_POINTS[m.round] + (m.is_final ? BRACKET_POINTS.CHAMPION : 0)
    if (m.result_entered) {
      if (pick === m.actual_winner) currentPts += pts
    } else {
      if (!eliminatedTeams.has(pick)) potentialPts += pts
    }
  })

  return { currentPts, potentialPts, eliminatedTeams }
}
