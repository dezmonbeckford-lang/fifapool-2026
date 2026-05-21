import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { GROUPS, TEAM_FLAGS, WILDCARD_COUNT } from '../data/groups'
import { saveWithRetry } from '../lib/saveWithRetry'
import { readWithRetry } from '../lib/readWithRetry'
import { useLoadGuard } from '../lib/useLoadGuard.jsx'
import { getCached, setCached, bustCache } from '../lib/dataCache'
import './Picks.css'

function getDraftKey(userId) { return `picks-draft-${userId}` }
function saveDraft(userId, groupPicks, wildcardPicks) {
  try { localStorage.setItem(getDraftKey(userId), JSON.stringify({ groupPicks, wildcardPicks })) } catch {}
}
function loadDraft(userId) {
  try { const d = localStorage.getItem(getDraftKey(userId)); return d ? JSON.parse(d) : null } catch { return null }
}
function clearDraft(userId) {
  try { localStorage.removeItem(getDraftKey(userId)) } catch {}
}

export default function Picks() {
  const { user } = useAuth()
  const wildcardRef = useRef(null)
  const mountedRef  = useRef(true)
  const cacheKey = `picks-${user?.id}`
  const cached = getCached(cacheKey)

  const emptyGroupPicks = () => {
    const init = {}
    GROUPS.forEach(g => { init[g.id] = { winner: '', runnerUp: '' } })
    return init
  }

  // Restore draft from localStorage if available (survives crashes and reloads)
  const draft = user?.id ? loadDraft(user.id) : null

  const [locked, setLocked] = useState(cached?.locked || false)
  const [groupPicks, setGroupPicks] = useState(draft?.groupPicks || cached?.groupPicks || emptyGroupPicks())
  const [wildcardPicks, setWildcardPicks] = useState(draft?.wildcardPicks || cached?.wildcardPicks || [])
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    mountedRef.current = true
    if (user?.id) loadData()
    return () => { mountedRef.current = false }
  }, [user?.id])

  // Auto-save picks to localStorage draft whenever they change
  useEffect(() => {
    if (user?.id && !locked) saveDraft(user.id, groupPicks, wildcardPicks)
  }, [groupPicks, wildcardPicks])

  async function loadData() {
    if (!user?.id) return  // guard: retry button can fire before auth resolves
    if (!getCached(cacheKey) && mountedRef.current) setLoading(true)
    try {
      const [settingsRes, gpRes, wpRes] = await Promise.all([
        readWithRetry(sig => supabase.from('settings').select('group_picks_locked').single().abortSignal(sig)),
        readWithRetry(sig => supabase.from('group_picks').select('group_id, winner, runner_up').eq('user_id', user.id).abortSignal(sig)),
        readWithRetry(sig => supabase.from('wildcard_picks').select('team').eq('user_id', user.id).abortSignal(sig)),
      ])

      if (!mountedRef.current) return

      const lockedVal = settingsRes?.data?.group_picks_locked ?? false
      setLocked(lockedVal)

      const gp_data = gpRes?.data || []
      let parsedPicks = emptyGroupPicks()
      if (gp_data.length > 0) {
        gp_data.forEach(row => {
          parsedPicks[row.group_id] = { winner: row.winner || '', runnerUp: row.runner_up || '' }
        })
        setGroupPicks(parsedPicks)
      }

      const wp_data = wpRes?.data || []
      const wc = wp_data.map(r => r.team)
      if (wp_data.length > 0) setWildcardPicks(wc)

      setCached(cacheKey, { locked: lockedVal, groupPicks: parsedPicks, wildcardPicks: wc })
    } catch {
      if (mountedRef.current && !getCached(cacheKey)) setError('Failed to load picks. Check your connection.')
    } finally {
      if (mountedRef.current) setLoading(false)
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
      const next = {
        ...prev,
        [groupId]: {
          winner: cur.winner === team ? '' : team,
          runnerUp: cur.runnerUp === team ? '' : cur.runnerUp,
        },
      }
      // Remove newly-picked teams from wildcards so a team can't be in both
      const newlyPicked = new Set(Object.values(next).flatMap(p => [p.winner, p.runnerUp].filter(Boolean)))
      setWildcardPicks(wc => wc.filter(t => !newlyPicked.has(t)))
      return next
    })
  }

  function setRunnerUp(groupId, team) {
    if (locked) return
    setGroupPicks(prev => {
      const cur = prev[groupId]
      const next = {
        ...prev,
        [groupId]: {
          runnerUp: cur.runnerUp === team ? '' : team,
          winner: cur.winner === team ? '' : cur.winner,
        },
      }
      // Remove newly-picked teams from wildcards so a team can't be in both
      const newlyPicked = new Set(Object.values(next).flatMap(p => [p.winner, p.runnerUp].filter(Boolean)))
      setWildcardPicks(wc => wc.filter(t => !newlyPicked.has(t)))
      return next
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
    setSaveStatus('Saving…')

    const groupRows = GROUPS
      .filter(g => groupPicks[g.id]?.winner || groupPicks[g.id]?.runnerUp)
      .map(g => ({
        user_id: user.id,
        group_id: g.id,
        winner: groupPicks[g.id]?.winner || null,
        runner_up: groupPicks[g.id]?.runnerUp || null,
      }))

    try {
      await saveWithRetry(
        async (signal) => {
          const [{ error: delGpErr }, { error: delWpErr }] = await Promise.all([
            supabase.from('group_picks').delete().eq('user_id', user.id).abortSignal(signal),
            supabase.from('wildcard_picks').delete().eq('user_id', user.id).abortSignal(signal),
          ])
          if (delGpErr) throw new Error(`Clear group picks: ${delGpErr.message}`)
          if (delWpErr) throw new Error(`Clear wildcard picks: ${delWpErr.message}`)

          const inserts = []
          if (groupRows.length > 0) {
            inserts.push(
              supabase.from('group_picks').insert(groupRows).abortSignal(signal)
                .then(r => { if (r.error) throw new Error(`Group picks: ${r.error.message}`) })
            )
          }
          if (wildcardPicks.length > 0) {
            inserts.push(
              supabase.from('wildcard_picks')
                .insert(wildcardPicks.map(team => ({ user_id: user.id, team })))
                .abortSignal(signal)
                .then(r => { if (r.error) throw new Error(`Wildcard picks: ${r.error.message}`) })
            )
          }
          await Promise.all(inserts)
        },
        { onRetry: () => setSaveStatus('Server warming up, retrying…') }
      )

      setSaveStatus('')
      setSaved(true)
      bustCache(cacheKey)  // force fresh load next visit
      clearDraft(user.id)  // picks are saved — no need to keep the draft
      setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      setError(err.message || 'Failed to save picks. Try again.')
    } finally {
      setSaving(false)
      setSaveStatus('')
    }
  }

  const { guardEl } = useLoadGuard(loading, loadData)
  if (loading) return guardEl

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
          <span className="step-count">{completedGroups}/{GROUPS.length}</span>
        </button>
        <div className="step-divider" />
        <button
          className={`step-btn${step === 2 ? ' active' : ''}${!allGroupsDone ? ' disabled' : ''}`}
          onClick={() => allGroupsDone && setStep(2)}
        >
          <span className="step-num">2</span>
          <span>Wildcard Picks</span>
          <span className="step-count">{wildcardPicks.length}/{WILDCARD_COUNT}</span>
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
              <span>{completedGroups} of {GROUPS.length} groups done</span>
              {allGroupsDone && <span className="ppb-done">✓ All done!</span>}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(completedGroups / GROUPS.length) * 100}%` }} />
            </div>
          </div>

          <div className="step1-actions">
            {!locked && (
              <button className="btn btn-outline btn-lg" onClick={handleSave} disabled={saving}>
                {saving ? (saveStatus || 'Saving…') : '💾 Save Progress'}
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
                {saving ? (saveStatus || 'Saving…') : '💾 Save All Picks'}
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
