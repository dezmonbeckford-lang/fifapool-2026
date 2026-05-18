import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { readWithRetry } from '../lib/readWithRetry'
import { useLoadGuard } from '../lib/useLoadGuard.jsx'
import { GROUPS, TEAM_FLAGS, WILDCARD_COUNT } from '../data/groups'
import { BRACKET_POINTS, ROUND_LABELS } from '../data/scoring'
import './PlayerPicks.css'

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']

export default function PlayerPicks() {
  const { userId } = useParams()
  const { user } = useAuth()

  const [player, setPlayer]           = useState(null)
  const [settings, setSettings]       = useState(null)
  const [groupPicks, setGroupPicks]   = useState({})
  const [wildcardPicks, setWildcard]  = useState([])
  const [bracketPicks, setBracket]    = useState({})
  const [bracketMatches, setMatches]  = useState([])
  const [score, setScore]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState('')
  const [activeTab, setActiveTab]     = useState('groups')
  const [notFound, setNotFound]       = useState(false)

  useEffect(() => {
    if (userId) loadData()
  }, [userId])

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const [profileRes, settingsRes, gpRes, wpRes, bpRes, matchesRes, scoreRes] = await Promise.all([
        readWithRetry(sig => supabase.from('profiles').select('id, display_name, email').eq('id', userId).single().abortSignal(sig)),
        readWithRetry(sig => supabase.from('settings').select('*').single().abortSignal(sig)),
        readWithRetry(sig => supabase.from('group_picks').select('*').eq('user_id', userId).abortSignal(sig)),
        readWithRetry(sig => supabase.from('wildcard_picks').select('team').eq('user_id', userId).abortSignal(sig)),
        readWithRetry(sig => supabase.from('bracket_picks').select('*').eq('user_id', userId).abortSignal(sig)),
        readWithRetry(sig => supabase.from('bracket_matches').select('*').order('round_order').order('match_number').abortSignal(sig)),
        readWithRetry(sig => supabase.from('scores').select('*').eq('user_id', userId).single().abortSignal(sig)),
      ])

      if (profileRes?.error || !profileRes?.data) { setNotFound(true); return }

      setPlayer(profileRes.data)
      setSettings(settingsRes?.data || null)
      setScore(scoreRes?.data || null)

      // Group picks
      const gMap = {}
      ;(gpRes?.data || []).forEach(row => {
        gMap[row.group_id] = { winner: row.winner || '', runnerUp: row.runner_up || '' }
      })
      setGroupPicks(gMap)
      setWildcard((wpRes?.data || []).map(r => r.team))

      // Bracket picks
      const bMap = {}
      ;(bpRes?.data || []).forEach(p => {
        bMap[p.match_id] = {
          picked_winner: p.picked_winner,
          tb1: p.tiebreaker_score1,
          tb2: p.tiebreaker_score2,
        }
      })
      setBracket(bMap)
      setMatches(matchesRes?.data || [])
    } catch (err) {
      const isAbort = err?.name === 'AbortError' || err?.message?.toLowerCase().includes('abort')
      if (isAbort) {
        setLoadError('Server is waking up — tap retry')
      } else {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const { guardEl } = useLoadGuard(loading, loadData)
  if (loading) return guardEl

  if (loadError) return (
    <div className="page-center">
      <div className="card" style={{ textAlign: 'center', padding: 40, maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚽</div>
        <p style={{ color: 'var(--text2)', marginBottom: 20 }}>{loadError}</p>
        <button className="btn btn-primary" onClick={loadData}>Retry</button>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="page-center">
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40 }}>🤷</div>
        <h2 style={{ marginTop: 12 }}>Player not found</h2>
        <Link to="/leaderboard" className="btn btn-outline" style={{ marginTop: 20 }}>← Leaderboard</Link>
      </div>
    </div>
  )

  const groupPicksLocked = settings?.group_picks_locked
  const bracketActive    = bracketMatches.length > 0
  const isOwnProfile     = user?.id === userId
  const displayName      = player.display_name || player.email?.split('@')[0] || 'Player'

  // Points breakdown
  const groupPts   = score?.group_points   ?? 0
  const bracketPts = score?.bracket_points ?? 0
  const totalPts   = score?.total_points   ?? 0

  // Completed group picks count
  const completedGroups = GROUPS.filter(g => {
    const p = groupPicks[g.id]
    return p?.winner && p?.runnerUp
  }).length

  // Bracket picks count
  const bracketPickCount = Object.values(bracketPicks).filter(p => p.picked_winner).length

  // Build round → matches map
  const byRound = {}
  ROUND_ORDER.forEach(r => { byRound[r] = bracketMatches.filter(m => m.round === r) })

  return (
    <div className="player-picks-page">

      {/* ── Header ── */}
      <div className="pp-header">
        <Link to="/leaderboard" className="pp-back">← Leaderboard</Link>

        <div className="pp-hero card">
          <div className="pp-avatar">{displayName.charAt(0).toUpperCase()}</div>
          <div className="pp-info">
            <h1 className="pp-name">{displayName}{isOwnProfile && <span className="you-tag">you</span>}</h1>
            <div className="pp-score-row">
              <div className="pp-score-item">
                <span className="pp-score-val">{totalPts}</span>
                <span className="pp-score-label">Total pts</span>
              </div>
              <div className="pp-score-sep">·</div>
              <div className="pp-score-item">
                <span className="pp-score-val">{groupPts}</span>
                <span className="pp-score-label">Group</span>
              </div>
              <div className="pp-score-sep">·</div>
              <div className="pp-score-item">
                <span className="pp-score-val">{bracketPts}</span>
                <span className="pp-score-label">Bracket</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Picks content ── */}
      <>
          {/* Tab bar — only show if bracket is also active */}
          {bracketActive && (
            <div className="pp-tabs">
              <button
                className={`pp-tab${activeTab === 'groups' ? ' active' : ''}`}
                onClick={() => setActiveTab('groups')}
              >
                🏟️ Group Picks
                <span className="pp-tab-count">{completedGroups}/12</span>
              </button>
              <button
                className={`pp-tab${activeTab === 'bracket' ? ' active' : ''}`}
                onClick={() => setActiveTab('bracket')}
              >
                🏆 Bracket Picks
                <span className="pp-tab-count">{bracketPickCount}/{bracketMatches.length}</span>
              </button>
            </div>
          )}

          {/* ── GROUP PICKS TAB ── */}
          {(activeTab === 'groups' || !bracketActive) && (
            <div className="pp-section">
              {completedGroups === 0 ? (
                <div className="pp-empty card">
                  <span>⚽</span>
                  <p>This player didn't submit any group picks.</p>
                </div>
              ) : (
                <>
                  <div className="pp-section-header">
                    <h2>Group Stage Picks</h2>
                    <span className="pp-section-sub">{completedGroups} of 12 groups picked</span>
                  </div>

                  <div className="pp-groups-grid">
                    {GROUPS.map(group => {
                      const pick = groupPicks[group.id] || {}
                      const done = pick.winner && pick.runnerUp
                      return (
                        <div key={group.id} className={`pp-group-card card${done ? '' : ' pp-no-pick'}`}>
                          <div className="pp-group-label">Group {group.id}</div>
                          {done ? (
                            <div className="pp-group-picks">
                              <div className="pp-gpick winner">
                                <span className="pp-gpick-rank">🥇</span>
                                <span className="pp-gpick-flag">{TEAM_FLAGS[pick.winner] || '🏳️'}</span>
                                <span className="pp-gpick-name">{pick.winner}</span>
                              </div>
                              <div className="pp-gpick runner">
                                <span className="pp-gpick-rank">🥈</span>
                                <span className="pp-gpick-flag">{TEAM_FLAGS[pick.runnerUp] || '🏳️'}</span>
                                <span className="pp-gpick-name">{pick.runnerUp}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="pp-missing">No pick</div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Wildcard picks */}
                  <div className="pp-section-header" style={{ marginTop: 32 }}>
                    <h2>Wildcard Picks</h2>
                    <span className="pp-section-sub">{wildcardPicks.length}/{WILDCARD_COUNT} selected</span>
                  </div>

                  {wildcardPicks.length > 0 ? (
                    <div className="pp-wc-chips">
                      {wildcardPicks.map(team => (
                        <div key={team} className="pp-wc-chip">
                          <span>{TEAM_FLAGS[team] || '🏳️'}</span>
                          <span>{team}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pp-empty card">
                      <span>⚽</span>
                      <p>No wildcard picks submitted.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── BRACKET PICKS TAB ── */}
          {activeTab === 'bracket' && bracketActive && (
            <div className="pp-section">
              {bracketPickCount === 0 ? (
                <div className="pp-empty card">
                  <span>🏆</span>
                  <p>This player hasn't submitted any bracket picks yet.</p>
                </div>
              ) : (
                ROUND_ORDER.map(round => {
                  const roundMatches = byRound[round] || []
                  if (!roundMatches.length) return null

                  const roundPickCount = roundMatches.filter(m => bracketPicks[m.id]?.picked_winner).length
                  const roundCorrect  = roundMatches.filter(m =>
                    m.result_entered && bracketPicks[m.id]?.picked_winner === m.actual_winner
                  ).length
                  const roundPlayed   = roundMatches.filter(m => m.result_entered).length

                  return (
                    <div key={round} className="pp-round">
                      <div className="pp-round-header">
                        <h3 className="pp-round-label">{ROUND_LABELS[round]}</h3>
                        <div className="pp-round-meta">
                          <span>{roundPickCount}/{roundMatches.length} picked</span>
                          {roundPlayed > 0 && (
                            <span className="pp-round-correct">
                              {roundCorrect}/{roundPlayed} correct
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pp-bracket-grid">
                        {roundMatches.map(match => {
                          const pick    = bracketPicks[match.id]
                          const picked  = pick?.picked_winner
                          const correct = match.result_entered && picked === match.actual_winner
                          const wrong   = match.result_entered && picked && picked !== match.actual_winner
                          const pending = !match.result_entered && picked
                          const pts     = BRACKET_POINTS[match.round] + (match.is_final ? BRACKET_POINTS.CHAMPION : 0)

                          return (
                            <div
                              key={match.id}
                              className={`pp-match card${correct ? ' pp-correct' : wrong ? ' pp-wrong' : ''}`}
                            >
                              <div className="pp-match-meta">
                                <span className="pp-match-pts">+{pts} pts</span>
                                {correct && <span className="pp-badge correct">✓ Correct</span>}
                                {wrong   && <span className="pp-badge wrong">✗ Wrong</span>}
                                {pending && <span className="pp-badge pending">⏳ Pending</span>}
                              </div>

                              <div className="pp-match-teams">
                                <div className={`pp-mteam${picked === match.team1 ? ' is-pick' : ''}${match.actual_winner === match.team1 ? ' is-winner' : ''}${match.result_entered && match.actual_winner !== match.team1 ? ' is-loser' : ''}`}>
                                  <span className="pp-mteam-flag">{TEAM_FLAGS[match.team1] || '🏳️'}</span>
                                  <span className="pp-mteam-name">{match.team1 || 'TBD'}</span>
                                  {picked === match.team1 && <span className="pp-mteam-crown">⭐</span>}
                                </div>

                                <span className="pp-match-vs">vs</span>

                                <div className={`pp-mteam${picked === match.team2 ? ' is-pick' : ''}${match.actual_winner === match.team2 ? ' is-winner' : ''}${match.result_entered && match.actual_winner !== match.team2 ? ' is-loser' : ''}`}>
                                  <span className="pp-mteam-flag">{TEAM_FLAGS[match.team2] || '🏳️'}</span>
                                  <span className="pp-mteam-name">{match.team2 || 'TBD'}</span>
                                  {picked === match.team2 && <span className="pp-mteam-crown">⭐</span>}
                                </div>
                              </div>

                              {!picked && (
                                <div className="pp-no-pick-small">No pick for this match</div>
                              )}

                              {match.is_final && picked && pick.tb1 != null && (
                                <div className="pp-tiebreaker">
                                  🏆 Tiebreaker prediction: {match.team1} {pick.tb1} – {pick.tb2} {match.team2}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
      </>
    </div>
  )
}
