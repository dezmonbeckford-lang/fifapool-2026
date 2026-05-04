import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { GROUPS, TEAM_FLAGS, WILDCARD_COUNT } from '../data/groups'
import './Picks.css'

export default function Picks() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const wildcardRef = useRef(null)

  const [locked, setLocked] = useState(false)
  const [groupPicks, setGroupPicks] = useState(() => {
    const init = {}
    GROUPS.forEach(g => { init[g.id] = { winner: '', runnerUp: '' } })
    return init
  })
  const [wildcardPicks, setWildcardPicks] = useState([])
  const [step, setStep] = useState(1) // 1 = group picks, 2 = wildcard picks
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const { data: settings } = await supabase.from('settings').select('*').single()
      if (settings) setLocked(settings.group_picks_locked)

      const { data: gp } = await supabase
        .from('group_picks').select('*').eq('user_id', user.id)

      if (gp && gp.length > 0) {
        const parsed = {}
        gp.forEach(row => {
          parsed[row.group_id] = { winner: row.winner || '', runnerUp: row.runner_up || '' }
        })
        // merge with defaults so all groups exist
        GROUPS.forEach(g => {
          if (!parsed[g.id]) parsed[g.id] = { winner: '', runnerUp: '' }
        })
        setGroupPicks(parsed)
      }

      const { data: wp } = await supabase
        .from('wildcard_picks').select('team').eq('user_id', user.id)
      if (wp && wp.length > 0) setWildcardPicks(wp.map(r => r.team))
    } catch {
      setError('Failed to load picks')
    } finally {
      setLoading(false)
    }
  }

  // Teams already picked as winner or runner-up across all groups
  const pickedTeams = new Set(
    Object.values(groupPicks).flatMap(p => [p.winner, p.runnerUp].filter(Boolean))
  )

  // Teams eligible for wildcard (not already picked in group stage)
  const wildcardEligibleTeams = GROUPS.map(group => ({
    ...group,
    teams: group.teams.filter(t => !pickedTeams.has(t)),
  })).filter(g => g.teams.length > 0)

  const completedGroups = GROUPS.filter(g => {
    const p = groupPicks[g.id]
    return p?.winner && p?.runnerUp
  }).length

  const allGroupsDone = completedGroups === GROUPS.length

  function setWinner(groupId, team) {
    if (locked) return
    setGroupPicks(prev => {
      const cur = prev[groupId]
      return {
        ...prev,
        [groupId]: {
          winner: cur.winner === team ? '' : team,
          runnerUp: cur.runnerUp === team ? '' : cur.runnerUp,
        },
      }
    })
  }

  function setRunnerUp(groupId, team) {
    if (locked) return
    setGroupPicks(prev => {
      const cur = prev[groupId]
      return {
        ...prev,
        [groupId]: {
          runnerUp: cur.runnerUp === team ? '' : team,
          winner: cur.winner === team ? '' : cur.winner,
        },
      }
    })
  }

  function toggleWildcard(team) {
    if (locked) return
    setWildcardPicks(prev =>
      prev.includes(team)
        ? prev.filter(t => t !== team)
        : prev.length >= WILDCARD_COUNT ? prev : [...prev, team]
    )
  }

  function goToWildcards() {
    setStep(2)
    setTimeout(() => wildcardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function handleSave() {
    if (locked) return
    setError('')
    setSaving(true)
    try {
      const rows = GROUPS.map(g => ({
        user_id: user.id,
        group_id: g.id,
        winner: groupPicks[g.id]?.winner || null,
        runner_up: groupPicks[g.id]?.runnerUp || null,
      }))
      const { error: gpErr } = await supabase
        .from('group_picks')
        .upsert(rows, { onConflict: 'user_id,group_id' })
      if (gpErr) throw gpErr

      await supabase.from('wildcard_picks').delete().eq('user_id', user.id)
      if (wildcardPicks.length > 0) {
        const { error: wpErr } = await supabase
          .from('wildcard_picks')
          .insert(wildcardPicks.map(team => ({ user_id: user.id, team })))
        if (wpErr) throw wpErr
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save picks')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-center"><div className="spinner" /></div>

  return (
    <div className="picks-page">
      {/* Step indicator */}
      <div className="picks-steps">
        <button
          className={`step-btn${step === 1 ? ' active' : ''}`}
          onClick={() => setStep(1)}
        >
          <span className="step-num">1</span>
          <span>Group Picks</span>
          <span className="step-count">{completedGroups}/12</span>
        </button>
        <div className="step-divider" />
        <button
          className={`step-btn${step === 2 ? ' active' : ''}${!allGroupsDone ? ' disabled' : ''}`}
          onClick={() => allGroupsDone && setStep(2)}
        >
          <span className="step-num">2</span>
          <span>Wildcard Picks</span>
          <span className="step-count">{wildcardPicks.length}/8</span>
        </button>
      </div>

      {locked && (
        <div className="locked-banner">🔒 Picks are locked. Good luck!</div>
      )}
      {error && <div className="error-msg" style={{ margin: '0 0 12px' }}>{error}</div>}
      {saved && <div className="success-msg" style={{ margin: '0 0 12px' }}>✓ All picks saved!</div>}

      {/* ── STEP 1: Group Picks ── */}
      {step === 1 && (
        <>
          <div className="section-header">
            <h2>Pick 1st &amp; 2nd from each group</h2>
            <p>Tap <strong>1st</strong> for the group winner, <strong>2nd</strong> for runner-up.</p>
          </div>

          <div className="groups-grid">
            {GROUPS.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                picks={groupPicks[group.id]}
                onWinner={team => setWinner(group.id, team)}
                onRunnerUp={team => setRunnerUp(group.id, team)}
                locked={locked}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="picks-progress-bar">
            <div className="ppb-label">
              <span>{completedGroups} of 12 groups done</span>
              {allGroupsDone && <span className="ppb-done">✓ All done!</span>}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(completedGroups / 12) * 100}%` }} />
            </div>
          </div>

          <div className="step1-actions">
            {!locked && (
              <button className="btn btn-outline btn-lg" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Progress'}
              </button>
            )}
            {allGroupsDone && (
              <button className="btn btn-primary btn-lg" onClick={goToWildcards}>
                Next: Wildcard Picks →
              </button>
            )}
          </div>
        </>
      )}

      {/* ── STEP 2: Wildcard Picks ── */}
      {step === 2 && (
        <div ref={wildcardRef}>
          <div className="section-header">
            <h2>Pick your 8 Wildcard teams</h2>
            <p>
              These are 8 teams you think will advance through the group stage — chosen from the teams <strong>you didn't already pick as 1st or 2nd</strong> in any group.
            </p>
            <div className="wc-counter">
              <span className={wildcardPicks.length === WILDCARD_COUNT ? 'wc-full' : ''}>
                {wildcardPicks.length} / {WILDCARD_COUNT} selected
              </span>
              {wildcardPicks.length === WILDCARD_COUNT && <span className="wc-done-badge">✓ All 8 picked!</span>}
            </div>
          </div>

          {/* Selected chips */}
          {wildcardPicks.length > 0 && (
            <div className="wc-selected">
              <div className="wc-selected-label">Your picks:</div>
              <div className="wc-chips">
                {wildcardPicks.map(team => (
                  <button
                    key={team}
                    className="wc-chip"
                    onClick={() => toggleWildcard(team)}
                    disabled={locked}
                    title="Tap to remove"
                  >
                    {TEAM_FLAGS[team]} {team} {!locked && '✕'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available teams by group */}
          <div className="wildcard-grid">
            {wildcardEligibleTeams.map(group => (
              <div key={group.id} className="wildcard-group">
                <div className="wildcard-group-label">Group {group.id}</div>
                {group.teams.map(team => {
                  const chosen = wildcardPicks.includes(team)
                  const full = !chosen && wildcardPicks.length >= WILDCARD_COUNT
                  return (
                    <button
                      key={team}
                      className={`wildcard-team${chosen ? ' chosen' : ''}${full ? ' dimmed' : ''}`}
                      onClick={() => toggleWildcard(team)}
                      disabled={locked || full}
                    >
                      <span>{TEAM_FLAGS[team] || '🏳️'}</span>
                      <span>{team}</span>
                      {chosen && <span className="wc-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="step2-actions">
            <button className="btn btn-outline btn-lg" onClick={() => setStep(1)}>
              ← Back to Groups
            </button>
            {!locked && (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : '💾 Save All Picks'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GroupCard({ group, picks, onWinner, onRunnerUp, locked }) {
  const done = picks.winner && picks.runnerUp
  return (
    <div className={`group-card card${done ? ' done' : ''}`}>
      <div className="group-card-header">
        <span className="group-label">Group {group.id}</span>
        {done
          ? <span className="group-done-badge">✓</span>
          : <span className="group-picks-hint">pick 1st &amp; 2nd</span>
        }
      </div>

      {done && (
        <div className="group-summary">
          <span className="gs-winner">🥇 {TEAM_FLAGS[picks.winner]} {picks.winner}</span>
          <span className="gs-runner">🥈 {TEAM_FLAGS[picks.runnerUp]} {picks.runnerUp}</span>
        </div>
      )}

      <div className="group-teams">
        {group.teams.map(team => {
          const isWinner = picks.winner === team
          const isRunnerUp = picks.runnerUp === team
          return (
            <div
              key={team}
              className={`team-row${isWinner ? ' is-winner' : ''}${isRunnerUp ? ' is-runner' : ''}`}
            >
              <span className="team-flag">{TEAM_FLAGS[team] || '🏳️'}</span>
              <span className="team-name">{team}</span>
              <div className="team-btns">
                <button
                  className={`pick-btn winner-btn${isWinner ? ' active' : ''}`}
                  onClick={() => onWinner(team)}
                  disabled={locked}
                >
                  1st
                </button>
                <button
                  className={`pick-btn runner-btn${isRunnerUp ? ' active' : ''}`}
                  onClick={() => onRunnerUp(team)}
                  disabled={locked}
                >
                  2nd
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
