import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { TEAM_FLAGS } from '../data/groups'
import { BRACKET_POINTS, ROUND_LABELS } from '../data/scoring'
import { saveWithRetry } from '../lib/saveWithRetry'
import './BracketPicks.css'

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']

export default function BracketPicks() {
  const { user } = useAuth()
  const [matches, setMatches]         = useState([])
  const [myPicks, setMyPicks]         = useState({})   // { matchId: { picked_winner, tb1, tb2 } }
  const [results, setResults]         = useState({})   // { matchId: actual_winner }
  const [locked, setLocked]           = useState(false)
  const [unlockAt, setUnlockAt]       = useState(null)
  const [now, setNow]                 = useState(new Date())
  const [activeRound, setActiveRound] = useState('R32')
  const [saving, setSaving]           = useState(false)
  const [saveStatus, setSaveStatus]   = useState('')
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    loadData()
    timerRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timerRef.current)
  }, [user?.id])

  async function loadData() {
    setLoading(true)
    const safeguard = setTimeout(() => setLoading(false), 8000)
    try {
      const queries = [
        supabase.from('settings').select('*').single(),
        supabase.from('bracket_matches').select('*').order('round_order').order('match_number'),
      ]
      if (user?.id) {
        queries.push(supabase.from('bracket_picks').select('*').eq('user_id', user.id))
      }

      const [{ data: settings }, { data: matchData }, picksRes] = await Promise.all(queries)

      if (settings) {
        setLocked(settings.bracket_picks_locked)
        setUnlockAt(settings.bracket_unlock_at ? new Date(settings.bracket_unlock_at) : null)
      }

      setMatches(matchData || [])
      const resultMap = {}
      ;(matchData || []).forEach(m => {
        if (m.result_entered) resultMap[m.id] = m.actual_winner
      })
      setResults(resultMap)

      if (picksRes?.data) {
        const pickMap = {}
        picksRes.data.forEach(p => {
          pickMap[p.match_id] = {
            picked_winner: p.picked_winner,
            tb1: p.tiebreaker_score1,
            tb2: p.tiebreaker_score2,
          }
        })
        setMyPicks(pickMap)
      }
    } catch (e) {
      setError('Failed to load bracket')
    } finally {
      clearTimeout(safeguard)
      setLoading(false)
    }
  }

  const isOpen = unlockAt ? now >= unlockAt : false
  const byRound = {}
  ROUND_ORDER.forEach(r => { byRound[r] = matches.filter(m => m.round === r) })

  // ── Potential & current points ──────────────────────────────
  const { currentPts, potentialPts, eliminatedTeams } = calcPoints(matches, myPicks, results)

  function pickWinner(matchId, team) {
    if (locked || !isOpen) return
    setMyPicks(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], picked_winner: team }
    }))
  }

  function setTiebreaker(matchId, field, val) {
    if (locked || !isOpen) return
    const num = parseInt(val)
    setMyPicks(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: isNaN(num) ? '' : num }
    }))
  }

  async function handleSave() {
    if (!user || locked || !isOpen) return
    setSaving(true)
    setSaveStatus('Saving…')
    setError('')

    const rows = Object.entries(myPicks)
      .filter(([, v]) => v.picked_winner)
      .map(([matchId, v]) => ({
        user_id: user.id,
        match_id: matchId,
        picked_winner: v.picked_winner,
        tiebreaker_score1: v.tb1 ?? null,
        tiebreaker_score2: v.tb2 ?? null,
      }))

    try {
      if (rows.length > 0) {
        await saveWithRetry(
          async (signal) => {
            const { error: err } = await supabase
              .from('bracket_picks')
              .upsert(rows, { onConflict: 'user_id,match_id' })
              .abortSignal(signal)
            if (err) throw err
          },
          { onRetry: () => setSaveStatus('Server warming up, retrying…') }
        )
      }
      setSaveStatus('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
      setSaveStatus('')
    }
  }

  if (loading) return <div className="page-center"><div className="spinner" /></div>

  // ── Countdown screen ─────────────────────────────────────────
  if (!isOpen && unlockAt) {
    const diff = unlockAt - now
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)

    return (
      <div className="bracket-locked-screen">
        <div className="bls-card card">
          <div className="bls-icon">🏆</div>
          <h2>Bracket Picks Opening Soon</h2>
          <p>The Round of 32 bracket will unlock once the group stage is complete.</p>
          <div className="countdown">
            <div className="cd-unit"><span>{d}</span><label>Days</label></div>
            <div className="cd-sep">:</div>
            <div className="cd-unit"><span>{String(h).padStart(2,'0')}</span><label>Hrs</label></div>
            <div className="cd-sep">:</div>
            <div className="cd-unit"><span>{String(m).padStart(2,'0')}</span><label>Min</label></div>
            <div className="cd-sep">:</div>
            <div className="cd-unit"><span>{String(s).padStart(2,'0')}</span><label>Sec</label></div>
          </div>
          <p className="bls-sub">Unlocks June 27 at 11:00 PM ET — after the last group stage game</p>
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="page-center">
        <div className="card" style={{ textAlign:'center', padding:32, maxWidth:400 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⏳</div>
          <h2>Bracket Not Set Yet</h2>
          <p style={{ color:'var(--text2)', marginTop:8 }}>The admin will upload the Round of 32 bracket once the group stage is complete.</p>
        </div>
      </div>
    )
  }

  const pickedCount = Object.values(myPicks).filter(p => p.picked_winner).length
  const totalMatches = matches.length

  return (
    <div className="bracket-page">
      {/* Points banner */}
      <div className="pts-banner">
        <div className="pts-item">
          <div className="pts-val">{currentPts}</div>
          <div className="pts-label">Current pts</div>
        </div>
        <div className="pts-sep">+</div>
        <div className="pts-item potential">
          <div className="pts-val">{potentialPts}</div>
          <div className="pts-label">Potential pts</div>
        </div>
        <div className="pts-sep">=</div>
        <div className="pts-item max">
          <div className="pts-val">{currentPts + potentialPts}</div>
          <div className="pts-label">Max possible</div>
        </div>
      </div>

      {locked && <div className="locked-banner">🔒 Bracket picks are locked. Good luck!</div>}
      {error && <div className="error-msg" style={{marginBottom:12}}>{error}</div>}
      {saved && <div className="success-msg" style={{marginBottom:12}}>✓ Bracket picks saved!</div>}

      {/* Round tabs */}
      <div className="round-tabs">
        {ROUND_ORDER.filter(r => byRound[r]?.length > 0).map(r => {
          const roundPicks = byRound[r].filter(m => myPicks[m.id]?.picked_winner).length
          const roundTotal = byRound[r].length
          const allDone = roundPicks === roundTotal
          return (
            <button
              key={r}
              className={`round-tab${activeRound === r ? ' active' : ''}${allDone ? ' done' : ''}`}
              onClick={() => setActiveRound(r)}
            >
              <span className="rt-label">{ROUND_LABELS[r]}</span>
              <span className="rt-count">{roundPicks}/{roundTotal}</span>
            </button>
          )
        })}
      </div>

      {/* Matches for active round */}
      <div className="bracket-matches">
        {(byRound[activeRound] || []).map(match => {
          const myPick = myPicks[match.id]?.picked_winner
          const result = results[match.id]
          const isCorrect = result && myPick === result
          const isWrong   = result && myPick && myPick !== result
          const t1Elim = eliminatedTeams.has(match.team1)
          const t2Elim = eliminatedTeams.has(match.team2)
          const pts = BRACKET_POINTS[match.round] + (match.is_final ? BRACKET_POINTS.CHAMPION : 0)

          return (
            <div key={match.id} className={`bm-card card${isCorrect ? ' correct' : ''}${isWrong ? ' wrong' : ''}`}>
              <div className="bm-header">
                <span className="bm-pts">+{pts} pts</span>
                {result && (
                  <span className={`bm-result-badge ${isCorrect ? 'correct' : isWrong ? 'wrong' : ''}`}>
                    {isCorrect ? '✓ Correct' : isWrong ? '✗ Wrong' : `Result: ${result}`}
                  </span>
                )}
              </div>

              <div className="bm-teams">
                <TeamPickBtn
                  team={match.team1}
                  picked={myPick === match.team1}
                  isWinner={result === match.team1}
                  isLoser={result && result !== match.team1}
                  eliminated={t1Elim}
                  onClick={() => pickWinner(match.id, match.team1)}
                  disabled={locked || !!result || !isOpen}
                />
                <span className="bm-vs">VS</span>
                <TeamPickBtn
                  team={match.team2}
                  picked={myPick === match.team2}
                  isWinner={result === match.team2}
                  isLoser={result && result !== match.team2}
                  eliminated={t2Elim}
                  onClick={() => pickWinner(match.id, match.team2)}
                  disabled={locked || !!result || !isOpen}
                />
              </div>

              {/* Tiebreaker for Final */}
              {match.is_final && (
                <div className="tiebreaker">
                  <div className="tb-label">🏆 Tiebreaker — Predict the final score:</div>
                  <div className="tb-inputs">
                    <div className="tb-team">
                      <span>{TEAM_FLAGS[match.team1] || '🏳️'} {match.team1 || '?'}</span>
                      <input
                        type="number" min="0" max="20"
                        className="input tb-input"
                        value={myPicks[match.id]?.tb1 ?? ''}
                        onChange={e => setTiebreaker(match.id, 'tb1', e.target.value)}
                        disabled={locked || !isOpen}
                        placeholder="0"
                      />
                    </div>
                    <span className="tb-dash">—</span>
                    <div className="tb-team">
                      <input
                        type="number" min="0" max="20"
                        className="input tb-input"
                        value={myPicks[match.id]?.tb2 ?? ''}
                        onChange={e => setTiebreaker(match.id, 'tb2', e.target.value)}
                        disabled={locked || !isOpen}
                        placeholder="0"
                      />
                      <span>{match.team2 || '?'} {TEAM_FLAGS[match.team2] || '🏳️'}</span>
                    </div>
                  </div>
                  <p className="tb-note">Used only as a tiebreaker on the leaderboard</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Save bar */}
      {!locked && isOpen && (
        <div className="bracket-save-bar">
          <div className="bsb-progress">{pickedCount} of {totalMatches} matches picked</div>
          <button className="btn btn-primary btn-lg btn-full" onClick={handleSave} disabled={saving}>
            {saving ? (saveStatus || 'Saving…') : '💾 Save Bracket Picks'}
          </button>
        </div>
      )}
    </div>
  )
}

function TeamPickBtn({ team, picked, isWinner, isLoser, eliminated, onClick, disabled }) {
  if (!team) {
    return (
      <div className="tpb tpb-tbd">
        <span className="tpb-flag">🔲</span>
        <span className="tpb-name">TBD</span>
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
    </button>
  )
}

// ── Points calculation ──────────────────────────────────────────
function calcPoints(matches, myPicks, results) {
  // Build set of eliminated teams from known results
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
      // wrong pick → no potential
    } else {
      // Match not played yet
      if (!eliminatedTeams.has(pick)) {
        potentialPts += pts
      }
    }
  })

  return { currentPts, potentialPts, eliminatedTeams }
}
