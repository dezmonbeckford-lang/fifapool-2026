import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { GROUPS, TEAM_FLAGS, WILDCARD_COUNT } from '../data/groups'
import './Picks.css'

export default function Picks() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState(null)          // null = loading
  const [locked, setLocked] = useState(false)
  const [bracketLocked, setBracketLocked] = useState(false)
  const [groupPicks, setGroupPicks] = useState({})   // { A: { winner: '', runnerUp: '' }, ... }
  const [wildcardPicks, setWildcardPicks] = useState([]) // array of team names, max 8
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
      // Load phase settings
      const { data: settings } = await supabase.from('settings').select('*').single()
      if (settings) {
        setPhase(settings.phase)
        setLocked(settings.group_picks_locked)
        setBracketLocked(settings.bracket_picks_locked)
      }

      // Load existing group picks
      const { data: gp } = await supabase
        .from('group_picks')
        .select('*')
        .eq('user_id', user.id)

      if (gp && gp.length > 0) {
        const parsed = {}
        gp.forEach(row => {
          parsed[row.group_id] = { winner: row.winner, runnerUp: row.runner_up }
        })
        setGroupPicks(parsed)
      } else {
        const init = {}
        GROUPS.forEach(g => { init[g.id] = { winner: '', runnerUp: '' } })
        setGroupPicks(init)
      }

      // Load wildcard picks
      const { data: wp } = await supabase
        .from('wildcard_picks')
        .select('team')
        .eq('user_id', user.id)
      if (wp) setWildcardPicks(wp.map(r => r.team))
    } catch (err) {
      setError('Failed to load picks')
    } finally {
      setLoading(false)
    }
  }

  function setWinner(groupId, team) {
    if (locked) return
    setGroupPicks(prev => {
      const existing = prev[groupId] || { winner: '', runnerUp: '' }
      const newState = { ...existing, winner: team }
      // Clear runner-up if it matches the new winner
      if (existing.runnerUp === team) newState.runnerUp = ''
      return { ...prev, [groupId]: newState }
    })
  }

  function setRunnerUp(groupId, team) {
    if (locked) return
    setGroupPicks(prev => {
      const existing = prev[groupId] || { winner: '', runnerUp: '' }
      const newState = { ...existing, runnerUp: team }
      // Clear winner if it matches
      if (existing.winner === team) newState.winner = ''
      return { ...prev, [groupId]: newState }
    })
  }

  function toggleWildcard(team) {
    if (locked) return
    setWildcardPicks(prev => {
      if (prev.includes(team)) return prev.filter(t => t !== team)
      if (prev.length >= WILDCARD_COUNT) return prev
      return [...prev, team]
    })
  }

  function isWildcardEligible(team) {
    // Can't pick a team as wildcard if already picked as winner/runner-up
    const alreadyPicked = Object.values(groupPicks).some(
      p => p.winner === team || p.runnerUp === team
    )
    return !alreadyPicked
  }

  function getCompletedGroups() {
    return GROUPS.filter(g => {
      const p = groupPicks[g.id]
      return p?.winner && p?.runnerUp
    }).length
  }

  async function handleSave() {
    if (locked) return
    setError('')
    setSaving(true)

    try {
      // Upsert group picks
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

      // Replace wildcard picks
      await supabase.from('wildcard_picks').delete().eq('user_id', user.id)
      if (wildcardPicks.length > 0) {
        const wRows = wildcardPicks.map(team => ({ user_id: user.id, team }))
        const { error: wpErr } = await supabase.from('wildcard_picks').insert(wRows)
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

  const completedGroups = getCompletedGroups()
  const allGroupsDone = completedGroups === GROUPS.length

  return (
    <div className="picks-page">
      <div className="picks-header">
        <h1>My Picks</h1>
        <div className="picks-progress">
          <span>{completedGroups}/{GROUPS.length} groups done</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(completedGroups / GROUPS.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {locked && (
        <div className="locked-banner">
          🔒 Group stage picks are locked. Results coming soon!
        </div>
      )}

      {error && <div className="error-msg" style={{ margin: '0 16px' }}>{error}</div>}
      {saved && <div className="success-msg" style={{ margin: '0 16px' }}>✓ Picks saved!</div>}

      <section className="picks-section">
        <div className="section-header">
          <h2>Group Stage Picks</h2>
          <p>Pick the top 2 teams from each group</p>
        </div>

        <div className="groups-grid">
          {GROUPS.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              picks={groupPicks[group.id] || { winner: '', runnerUp: '' }}
              onWinner={team => setWinner(group.id, team)}
              onRunnerUp={team => setRunnerUp(group.id, team)}
              locked={locked}
            />
          ))}
        </div>
      </section>

      <section className="picks-section">
        <div className="section-header">
          <h2>8 Wildcard Picks</h2>
          <p>
            Pick {WILDCARD_COUNT} more teams you think will advance through the group stage.
            <br />
            <span className="section-note">
              Don't pick teams already selected as winner or runner-up.
              ({wildcardPicks.length}/{WILDCARD_COUNT} selected)
            </span>
          </p>
        </div>

        <div className="wildcard-grid">
          {GROUPS.map(group => (
            <div key={group.id} className="wildcard-group">
              <div className="wildcard-group-label">Group {group.id}</div>
              {group.teams.map(team => {
                const isChosen = wildcardPicks.includes(team)
                const ineligible = isWildcardEligible(team) === false
                return (
                  <button
                    key={team}
                    className={`wildcard-team${isChosen ? ' chosen' : ''}${ineligible ? ' ineligible' : ''}`}
                    onClick={() => toggleWildcard(team)}
                    disabled={locked || ineligible || (!isChosen && wildcardPicks.length >= WILDCARD_COUNT)}
                  >
                    <span>{TEAM_FLAGS[team] || '🏳️'}</span>
                    <span>{team}</span>
                    {isChosen && <span className="wc-check">✓</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      {!locked && (
        <div className="picks-save-bar">
          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : '💾 Save All Picks'}
          </button>
        </div>
      )}
    </div>
  )
}

function GroupCard({ group, picks, onWinner, onRunnerUp, locked }) {
  const isDone = picks.winner && picks.runnerUp

  return (
    <div className={`group-card card${isDone ? ' done' : ''}`}>
      <div className="group-card-header">
        <span className="group-label">Group {group.id}</span>
        {isDone && <span className="group-done-badge">✓</span>}
      </div>
      <div className="group-teams">
        {group.teams.map(team => {
          const isWinner = picks.winner === team
          const isRunnerUp = picks.runnerUp === team
          return (
            <div key={team} className={`team-row${isWinner ? ' is-winner' : ''}${isRunnerUp ? ' is-runner-up' : ''}`}>
              <span className="team-flag">{TEAM_FLAGS[team] || '🏳️'}</span>
              <span className="team-name">{team}</span>
              <div className="team-btns">
                <button
                  className={`pick-btn winner-btn${isWinner ? ' active' : ''}`}
                  onClick={() => onWinner(team)}
                  disabled={locked}
                  title="Pick as group winner"
                >
                  1st
                </button>
                <button
                  className={`pick-btn runner-btn${isRunnerUp ? ' active' : ''}`}
                  onClick={() => onRunnerUp(team)}
                  disabled={locked}
                  title="Pick as runner-up"
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
