import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const wildcardRef   = useRef(null)
  const mountedRef    = useRef(true)
  const dataLoadedRef = useRef(false)  // guards auto-save from firing before DB data arrives
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

  // Auto-save picks to localStorage draft — but ONLY after DB data has loaded.
  // Without this guard the initial empty state fires before loadData returns and
  // overwrites any existing draft with blank picks.
  useEffect(() => {
    if (user?.id && !locked && dataLoadedRef.current) saveDraft(user.id, groupPicks, wildcardPicks)
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

      // DB is now the source of truth — clear any stale draft so it can't
      // override real picks on the next visit, then allow auto-save going forward.
      clearDraft(user.id)
      dataLoadedRef.current = true
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
      // ── Save group picks (independent retry — never touches wildcards) ──
      await saveWithRetry(async (signal) => {
        const { error: delErr } = await supabase
          .from('group_picks').delete().eq('user_id', user.id).abortSignal(signal)
        if (delErr) throw new Error(delErr.message)
        if (groupRows.length > 0) {
          const { error: insErr } = await supabase
            .from('group_picks').insert(groupRows).abortSignal(signal)
          if (insErr) throw new Error(insErr.message)
        }
      }, { onRetry: () => setSaveStatus('Retrying group picks…') })

      // ── Save wildcard picks (independent retry — group picks already safe) ──
      setSaveStatus('Saving wildcard picks…')
      await saveWithRetry(async (signal) => {
        const { error: delErr } = await supabase
          .from('wildcard_picks').delete().eq('user_id', user.id).abortSignal(signal)
        if (delErr) throw new Error(delErr.message)
        if (wildcardPicks.length > 0) {
          const { error: insErr } = await supabase
            .from('wildcard_picks')
            .insert(wildcardPicks.map(team => ({ user_id: user.id, team })))
            .abortSignal(signal)
          if (insErr) throw new Error(insErr.message)
        }
      }, { onRetry: () => setSaveStatus('Retrying wildcard picks…') })

      // ── Success ──────────────────────────────────────────────────
      setSaveStatus('')
      setSaved(true)
      bustCache(cacheKey)
      clearDraft(user.id)
      setTimeout(() => setSaved(false), 4000)
      return true

    } catch (err) {
      // Save may have timed out client-side but still landed on the server.
      // Verify both tables — use readWithRetry so this can't hang forever.
      try {
        setSaveStatus('Verifying…')
        const [gpRes, wpRes] = await Promise.all([
          readWithRetry(sig => supabase.from('group_picks').select('group_id').eq('user_id', user.id).abortSignal(sig)),
          readWithRetry(sig => supabase.from('wildcard_picks').select('team').eq('user_id', user.id).abortSignal(sig)),
        ])
        const gpOk = (gpRes?.data?.length ?? 0) >= groupRows.length && groupRows.length > 0
        const wpOk = wildcardPicks.length === 0 || (wpRes?.data?.length ?? 0) >= wildcardPicks.length
        if (gpOk && wpOk) {
          setSaveStatus('')
          setSaved(true)
          bustCache(cacheKey)
          clearDraft(user.id)
          setTimeout(() => setSaved(false), 4000)
          return true
        }
      } catch { /* verification timed out — fall through to error */ }
      setError('Could not save picks. Check your connection and try again — your progress is safe.')
      return false
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
              <button
                className={`btn btn-lg btn-full${allGroupsDone ? ' btn-primary' : ' btn-outline'}`}
                onClick={allGroupsDone ? async () => { const ok = await handleSave(); if (ok !== false) goToWildcards() } : handleSave}
                disabled={saving}
              >
                {saving
                  ? (saveStatus || 'Saving…')
                  : allGroupsDone
                    ? '💾 Save & Continue →'
                    : '💾 Save Progress'}
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
                onClick={async () => { const ok = await handleSave(); if (ok === true) navigate('/') }}
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
