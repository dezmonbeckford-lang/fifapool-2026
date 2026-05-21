import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { GROUPS, TEAM_FLAGS } from '../data/groups'
import { ROUND_LABELS } from '../data/scoring'
import { saveWithRetry } from '../lib/saveWithRetry'
import { readWithRetry } from '../lib/readWithRetry'
import './Admin.css'

export default function Admin() {
  const { profile } = useAuth()

  const [tab, setTab] = useState('settings')
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (profile?.is_admin) loadSettings()
  }, [profile])

  async function loadSettings() {
    try {
      const res = await readWithRetry(sig => supabase.from('settings').select('*').single().abortSignal(sig))
      setSettings(res?.data || { phase: 1, group_picks_locked: false, bracket_picks_locked: false })
    } catch {
      setMsg('Failed to load settings — please refresh')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    // Only send the fields we actually manage — exclude auto-generated or legacy columns
    const payload = {
      id: 1,
      phase: settings.phase,
      group_picks_locked: settings.group_picks_locked,
      bracket_picks_locked: settings.bracket_picks_locked,
    }
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase.from('settings').upsert(payload).abortSignal(signal)
        if (error) throw error
      })
      setMsg('✓ Settings saved')
    } catch (err) {
      setMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Quick tournament-flow actions ───────────────────────────────
  async function quickAction(updates, successMsg) {
    setSaving(true)
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase.from('settings').upsert({ id: 1, ...updates }).abortSignal(signal)
        if (error) throw error
      })
      setSettings(s => ({ ...s, ...updates }))
      setMsg(successMsg)
    } catch (err) {
      setMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function recalcScores() {
    setSaving(true)
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase.rpc('calculate_group_scores').abortSignal(signal)
        if (error) throw error
      })
      setMsg('✓ All scores recalculated!')
    } catch (err) {
      setMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !profile?.is_admin) {
    return <div className="page-center"><div className="spinner" /></div>
  }

  const tabs = [
    ['settings', '⚙️ Settings'],
    ['groups', '🏟️ Groups'],
    ['bracket-setup', '🔧 Bracket Setup'],
    ['bracket-results', '🏆 Results'],
    ['players', '👥 Players'],
  ]

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🔧 Admin Panel</h1>
        <p>FifaPool 2026 Management</p>
      </div>

      <div className="admin-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={`admin-tab${tab === id ? ' active' : ''}`}
            onClick={() => { setTab(id); setMsg('') }}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={msg.startsWith('✓') ? 'success-msg' : 'error-msg'} style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {tab === 'settings' && settings && (
        <div className="admin-section card">
          <h2>Phase &amp; Lock Settings</h2>

          <div className="setting-row">
            <div>
              <div className="setting-label">Current Phase</div>
              <div className="setting-desc">Controls which phase is displayed to users</div>
            </div>
            <select
              className="input"
              style={{ width: 'auto' }}
              value={settings.phase}
              onChange={e => setSettings(s => ({ ...s, phase: parseInt(e.target.value) }))}
            >
              <option value={1}>Phase 1 — Group Stage</option>
              <option value={2}>Phase 2 — Bracket</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Lock Group Picks</div>
              <div className="setting-desc">Prevent users from editing group stage picks</div>
            </div>
            <button
              className={`toggle-btn${settings.group_picks_locked ? ' on' : ''}`}
              onClick={() => setSettings(s => ({ ...s, group_picks_locked: !s.group_picks_locked }))}
            >
              {settings.group_picks_locked ? '🔒 Locked' : '🔓 Open'}
            </button>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Lock Bracket Picks</div>
              <div className="setting-desc">Prevent users from editing bracket picks</div>
            </div>
            <button
              className={`toggle-btn${settings.bracket_picks_locked ? ' on' : ''}`}
              onClick={() => setSettings(s => ({ ...s, bracket_picks_locked: !s.bracket_picks_locked }))}
            >
              {settings.bracket_picks_locked ? '🔒 Locked' : '🔓 Open'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            <button className="btn btn-outline" onClick={recalcScores} disabled={saving}>
              🔄 Recalculate All Scores
            </button>
          </div>

          {/* ── Tournament Flow Quick Actions ── */}
          <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚡ Tournament Flow</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
              One-click shortcuts to advance through each phase. Run them in order.
            </p>

            <div className="qa-steps">
              <div className="qa-step">
                <div className="qa-num">1</div>
                <div className="qa-info">
                  <div className="qa-title">Lock Group Picks</div>
                  <div className="qa-desc">
                    Run after group stage deadline. Freezes all picks &amp; reveals them to everyone.
                  </div>
                </div>
                <button
                  className={`btn btn-sm${settings.group_picks_locked ? ' btn-outline' : ' btn-primary'}`}
                  onClick={() => quickAction({ group_picks_locked: true }, '✓ Group picks locked — picks are now public')}
                  disabled={saving || settings.group_picks_locked}
                >
                  {settings.group_picks_locked ? '🔒 Done' : '🔒 Lock Now'}
                </button>
              </div>

              <div className="qa-step">
                <div className="qa-num">2</div>
                <div className="qa-info">
                  <div className="qa-title">Open Bracket Picks</div>
                  <div className="qa-desc">
                    Run after entering R32 teams in Bracket Setup. Advances to Phase 2 instantly.
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => quickAction(
                    { bracket_unlock_at: new Date().toISOString(), phase: 2 },
                    '✓ Bracket open! Users can now make bracket picks.'
                  )}
                  disabled={saving}
                >
                  🏆 Open Now
                </button>
              </div>

              <div className="qa-step">
                <div className="qa-num">3</div>
                <div className="qa-info">
                  <div className="qa-title">Lock Bracket Picks</div>
                  <div className="qa-desc">
                    Run before the first R32 match kicks off. Then enter results in the Results tab.
                  </div>
                </div>
                <button
                  className={`btn btn-sm${settings.bracket_picks_locked ? ' btn-outline' : ' btn-primary'}`}
                  onClick={() => quickAction({ bracket_picks_locked: true }, '✓ Bracket picks locked — now enter results in the Results tab')}
                  disabled={saving || settings.bracket_picks_locked}
                >
                  {settings.bracket_picks_locked ? '🔒 Done' : '🔒 Lock Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'groups' && <GroupResultsTab onMsg={setMsg} />}
      {tab === 'bracket-setup' && <BracketSetupTab onMsg={setMsg} />}
      {tab === 'bracket-results' && <BracketResultsTab onMsg={setMsg} />}
      {tab === 'players' && <PlayersTab onMsg={setMsg} />}
    </div>
  )
}

// ── Group Results ───────────────────────────────────────────────
function GroupResultsTab({ onMsg }) {
  const [results, setResults] = useState({})
  const [wildcardAdvancers, setWildcardAdvancers] = useState([])
  const [existing, setExisting] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadExisting() }, [])

  async function loadExisting() {
    try {
      const [grRes, waRes] = await Promise.all([
        readWithRetry(sig => supabase.from('group_results').select('*').abortSignal(sig)),
        readWithRetry(sig => supabase.from('wildcard_advancers').select('team').abortSignal(sig)),
      ])
      const r = {}
      ;(grRes?.data || []).forEach(row => { r[row.group_id] = { winner: row.winner, runnerUp: row.runner_up } })
      setExisting(r)
      setResults(r)
      setWildcardAdvancers((waRes?.data || []).map(r => r.team))
    } catch { /* non-fatal, stays empty */ } finally {
      setLoading(false)
    }
  }

  function toggleWildcardAdvancer(team) {
    setWildcardAdvancers(prev => {
      if (prev.includes(team)) return prev.filter(t => t !== team)
      if (prev.length >= 8) return prev
      return [...prev, team]
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const rows = Object.entries(results)
        .filter(([, v]) => v.winner && v.runnerUp)
        .map(([groupId, v]) => ({ group_id: groupId, winner: v.winner, runner_up: v.runnerUp }))

      await saveWithRetry(async (signal) => {
        const [grRes, waDelRes] = await Promise.all([
          rows.length > 0
            ? supabase.from('group_results').upsert(rows, { onConflict: 'group_id' }).abortSignal(signal)
            : Promise.resolve({ error: null }),
          supabase.from('wildcard_advancers').delete().neq('id', '00000000-0000-0000-0000-000000000000').abortSignal(signal),
        ])
        if (grRes.error) throw grRes.error
        if (waDelRes.error) throw waDelRes.error

        if (wildcardAdvancers.length > 0) {
          const { error: waErr } = await supabase
            .from('wildcard_advancers')
            .insert(wildcardAdvancers.map(team => ({ team })))
            .abortSignal(signal)
          if (waErr) throw waErr
        }

        const { error: scoreErr } = await supabase.rpc('calculate_group_scores').abortSignal(signal)
        if (scoreErr) throw scoreErr
      })

      onMsg(`✓ ${rows.length} group results saved, scores updated!`)
      loadExisting()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner" />

  const allTeams = GROUPS.flatMap(g => g.teams)
  const pickedAsGroupAdvancer = new Set(
    Object.values(results).flatMap(r => [r.winner, r.runnerUp].filter(Boolean))
  )

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Group Stage Results</h2>
        <p>Enter 1st and 2nd place for each group. Then select the 8 best 3rd-place advancers.</p>
      </div>

      <div className="groups-results-grid">
        {GROUPS.map(group => {
          const r = results[group.id] || { winner: '', runnerUp: '' }
          const done = existing[group.id]
          return (
            <div key={group.id} className={`admin-group-card card${done ? ' done' : ''}`}>
              <div className="admin-group-label">
                Group {group.id} {done && <span className="badge badge-green">Done</span>}
              </div>
              <div className="admin-group-row">
                <label className="label">🥇 Winner</label>
                <select className="input" value={r.winner}
                  onChange={e => setResults(prev => ({ ...prev, [group.id]: { ...r, winner: e.target.value } }))}>
                  <option value="">— select —</option>
                  {group.teams.map(team => <option key={team} value={team}>{TEAM_FLAGS[team]} {team}</option>)}
                </select>
              </div>
              <div className="admin-group-row">
                <label className="label">🥈 Runner-up</label>
                <select className="input" value={r.runnerUp}
                  onChange={e => setResults(prev => ({ ...prev, [group.id]: { ...r, runnerUp: e.target.value } }))}>
                  <option value="">— select —</option>
                  {group.teams.map(team => <option key={team} value={team}>{TEAM_FLAGS[team]} {team}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="wildcard-advancers card">
        <h3>8 Best 3rd-Place Advancers ({wildcardAdvancers.length}/8)</h3>
        <p className="admin-sub">Select exactly 8 teams that advance as best 3rd-place finishers.</p>
        <div className="wa-grid">
          {allTeams.filter(t => !pickedAsGroupAdvancer.has(t)).map(team => {
            const on = wildcardAdvancers.includes(team)
            return (
              <button key={team} className={`wa-btn${on ? ' on' : ''}`}
                onClick={() => toggleWildcardAdvancer(team)}
                disabled={!on && wildcardAdvancers.length >= 8}>
                {TEAM_FLAGS[team]} {team} {on && '✓'}
              </button>
            )
          })}
        </div>
      </div>

      <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving & Scoring…' : '💾 Save Results & Score All Players'}
      </button>
    </div>
  )
}

// ── Bracket Setup ───────────────────────────────────────────────
const ROUND_POINTS = { R32: 5, R16: 8, QF: 11, SF: 14, THIRD: 10, FINAL: 17 }

// Matches 1-12 have pre-determined FIFA 2026 group-position matchups.
// Matches 13-16 are wildcard slots that the admin fills manually.
const WILDCARD_SLOTS = [13, 14, 15, 16]

function isLabel(val) {
  return val && (val.startsWith('Winner Group') || val.startsWith('Runner-up Group'))
}

function BracketSetupTab({ onMsg }) {
  const [r32Matches, setR32Matches] = useState([])
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    try {
      const res = await readWithRetry(sig => supabase.from('bracket_matches').select('*').eq('round', 'R32').order('match_number').abortSignal(sig))
      const data = res?.data || []
      if (data.length) {
        setInitialized(true)
        setR32Matches(data.map(m => ({ id: m.id, team1: m.team1 || '', team2: m.team2 || '', match_number: m.match_number })))
      } else {
        setInitialized(false)
        setR32Matches([])
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }

  async function handleInit() {
    if (!window.confirm('This will create the full bracket structure (R32 → Final) with FIFA 2026 matchups pre-filled, and CLEAR any existing bracket picks. Continue?')) return
    setSaving(true)
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase.rpc('generate_bracket').abortSignal(signal)
        if (error) throw error
      })
      onMsg('✓ Bracket created with FIFA matchups! Auto-fill from group results when ready, then set wildcard slots.')
      loadMatches()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleAutoFill() {
    if (!window.confirm('This will replace group-position labels (e.g. "Winner Group A") with the actual team names from your group results. Continue?')) return
    setSaving(true)
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase.rpc('populate_bracket_teams').abortSignal(signal)
        if (error) throw error
      })
      onMsg('✓ Bracket teams filled in from group results!')
      loadMatches()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveWildcards() {
    const wildcards = r32Matches.filter(m => WILDCARD_SLOTS.includes(m.match_number) && (m.team1 || m.team2))
    if (!wildcards.length) { onMsg('Error: Fill in at least one wildcard slot first'); return }
    setSaving(true)
    try {
      await saveWithRetry(async (signal) => {
        await Promise.all(
          wildcards.filter(m => m.id).map(m =>
            supabase.from('bracket_matches')
              .update({ team1: m.team1 || null, team2: m.team2 || null })
              .eq('id', m.id)
              .abortSignal(signal)
              .then(r => { if (r.error) throw r.error })
          )
        )
      })
      onMsg(`✓ Wildcard matchups saved!`)
      loadMatches()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  function update(idx, field, val) {
    setR32Matches(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m))
  }

  // Check if any matches still have un-replaced labels
  const hasLabels = r32Matches.some(m => isLabel(m.team1) || isLabel(m.team2))

  if (loading) return <div className="spinner" />

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Bracket Setup</h2>
        <p>Initialize the bracket, auto-fill from group results, then set the 4 wildcard matchups.</p>
      </div>

      {!initialized ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
          <h3>Bracket Not Initialized</h3>
          <p style={{ color: 'var(--text2)', margin: '8px 0 20px' }}>
            Creates the full bracket (R32 → Final). Matches 1–12 are pre-filled with the official
            FIFA 2026 group matchups. Matches 13–16 are wildcard slots you fill after the group stage.<br />
            <strong>Warning:</strong> This clears all existing bracket picks.
          </p>
          <button className="btn btn-primary btn-lg" onClick={handleInit} disabled={saving}>
            {saving ? 'Initializing…' : '🚀 Initialize Bracket Structure'}
          </button>
        </div>
      ) : (
        <>
          <div className="success-msg" style={{ marginBottom: 16 }}>
            ✓ Bracket initialized ({r32Matches.length} R32 matches)
          </div>

          {/* Auto-fill action */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>🔄 Auto-fill from Group Results</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {hasLabels
                  ? 'Replaces "Winner Group A" labels with actual team names from your saved group results.'
                  : '✓ All group matchups have real team names.'}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleAutoFill} disabled={saving || !hasLabels}>
              {saving ? 'Filling…' : 'Auto-fill Teams'}
            </button>
          </div>

          {/* Matches 1-12: group matchups (read-only display) */}
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Matches 1–12 — Group Stage Matchups</h3>
          <div className="bracket-setup-grid" style={{ marginBottom: 24 }}>
            {r32Matches.filter(m => !WILDCARD_SLOTS.includes(m.match_number)).map((row) => (
              <div key={row.match_number} className={`bsu-row card${isLabel(row.team1) || isLabel(row.team2) ? ' bsu-label' : ''}`}>
                <span className="bsu-num">{row.match_number}</span>
                <span className={`bsu-team-label${isLabel(row.team1) ? ' is-placeholder' : ''}`}>
                  {row.team1 || 'TBD'}
                </span>
                <span className="bsu-vs">vs</span>
                <span className={`bsu-team-label${isLabel(row.team2) ? ' is-placeholder' : ''}`}>
                  {row.team2 || 'TBD'}
                </span>
              </div>
            ))}
          </div>

          {/* Matches 13-16: wildcard slots (editable) */}
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Matches 13–16 — Wildcard Slots</h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 12px' }}>
            Fill these in once you know the 8 best 3rd-place teams (4 matches between them).
          </p>
          <div className="bracket-setup-grid" style={{ marginBottom: 16 }}>
            {r32Matches.filter(m => WILDCARD_SLOTS.includes(m.match_number)).map((row, idx) => {
              const globalIdx = r32Matches.findIndex(m => m.match_number === row.match_number)
              return (
                <div key={row.match_number} className="bsu-row card bsu-wildcard">
                  <span className="bsu-num">{row.match_number}</span>
                  <input className="input bsu-input" placeholder="Wildcard team"
                    value={row.team1} onChange={e => update(globalIdx, 'team1', e.target.value)} />
                  <span className="bsu-vs">vs</span>
                  <input className="input bsu-input" placeholder="Wildcard team"
                    value={row.team2} onChange={e => update(globalIdx, 'team2', e.target.value)} />
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary btn-lg" onClick={handleSaveWildcards} disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving…' : '💾 Save Wildcard Matchups'}
            </button>
            <button className="btn btn-outline" onClick={handleInit} disabled={saving}
              style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              Reset All
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Bracket Results ─────────────────────────────────────────────
function BracketResultsTab({ onMsg }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    try {
      const res = await readWithRetry(sig => supabase.from('bracket_matches').select('*').order('round_order', { ascending: true }).order('match_number', { ascending: true }).abortSignal(sig))
      setMatches(res?.data || [])
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }

  async function saveResult(matchId, winner) {
    setSaving(matchId)
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase
          .from('bracket_matches')
          .update({ actual_winner: winner, result_entered: true })
          .eq('id', matchId)
          .abortSignal(signal)
        if (error) throw error
        const { error: scoreErr } = await supabase.rpc('score_bracket_match', { match_id: matchId }).abortSignal(signal)
        if (scoreErr) throw scoreErr
      })
      onMsg('✓ Result saved and scores updated!')
      loadMatches()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="spinner" />

  const byRound = {}
  matches.forEach(m => {
    if (!byRound[m.round]) byRound[m.round] = []
    byRound[m.round].push(m)
  })

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Bracket Results</h2>
        <p>Enter match winners as games are played. Scores update instantly for all players.</p>
      </div>

      {matches.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
          No bracket matches yet. Go to "Bracket Setup" first.
        </div>
      )}

      {['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'].map(round => {
        const roundMatches = byRound[round]
        if (!roundMatches?.length) return null
        const done = roundMatches.filter(m => m.result_entered).length
        return (
          <div key={round} className="bracket-round">
            <div className="bracket-round-header">
              <h3>{ROUND_LABELS[round]}</h3>
              <span className="badge badge-gray">{done}/{roundMatches.length} done</span>
            </div>
            <div className="bracket-matches-list">
              {roundMatches.map(match => (
                <MatchResultRow key={match.id} match={match}
                  onSave={saveResult} isSaving={saving === match.id} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MatchResultRow({ match, onSave, isSaving }) {
  const [selected, setSelected] = useState(match.actual_winner || '')
  return (
    <div className={`match-row card${match.result_entered ? ' done' : ''}`}>
      <div className="match-teams">
        <span>{TEAM_FLAGS[match.team1] || '🏳️'} {match.team1 || 'TBD'}</span>
        <span className="vs">vs</span>
        <span>{TEAM_FLAGS[match.team2] || '🏳️'} {match.team2 || 'TBD'}</span>
      </div>
      {match.result_entered ? (
        <div className="match-result-done">✓ Winner: <strong>{TEAM_FLAGS[match.actual_winner]} {match.actual_winner}</strong></div>
      ) : (
        <div className="match-result-input">
          <select className="input" value={selected} onChange={e => setSelected(e.target.value)}
            disabled={!match.team1 || !match.team2}>
            <option value="">— select winner —</option>
            {match.team1 && <option value={match.team1}>{TEAM_FLAGS[match.team1]} {match.team1}</option>}
            {match.team2 && <option value={match.team2}>{TEAM_FLAGS[match.team2]} {match.team2}</option>}
          </select>
          <button className="btn btn-primary btn-sm"
            onClick={() => onSave(match.id, selected)}
            disabled={!selected || isSaving}>
            {isSaving ? '…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Players Tab ─────────────────────────────────────────────────
function PlayersTab({ onMsg }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    try {
      const [profRes, scoreRes, gpRes] = await Promise.all([
        readWithRetry(sig => supabase.from('profiles').select('id, display_name, email, is_admin, created_at').order('created_at').abortSignal(sig)),
        readWithRetry(sig => supabase.from('scores').select('user_id, group_points, bracket_points, total_points').abortSignal(sig)),
        readWithRetry(sig => supabase.from('group_picks').select('user_id').abortSignal(sig)),
      ])
      const scoreMap = {}
      ;(scoreRes?.data || []).forEach(s => { scoreMap[s.user_id] = s })
      const gpSet = new Set()
      ;(gpRes?.data || []).forEach(p => gpSet.add(p.user_id))
      setPlayers((profRes?.data || []).map(p => ({
        ...p,
        score: scoreMap[p.id] || null,
        hasPicks: gpSet.has(p.id),
      })))
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }

  async function toggleAdmin(userId, currentVal) {
    if (!window.confirm(`${currentVal ? 'Remove' : 'Grant'} admin access for this user?`)) return
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase.from('profiles').update({ is_admin: !currentVal }).eq('id', userId).abortSignal(signal)
        if (error) throw error
      })
      onMsg(`✓ Admin access ${currentVal ? 'removed' : 'granted'}.`)
      loadPlayers()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Players ({players.length})</h2>
        <p>All registered users, their pick status, and current scores.</p>
      </div>

      <div className="players-table card">
        <div className="players-header">
          <span>Player</span>
          <span>Picks</span>
          <span>Pts</span>
          <span>Admin</span>
        </div>
        {players.map(p => (
          <div key={p.id} className="player-row">
            <div className="player-info">
              <span className="player-name">{p.display_name}</span>
              <span className="player-email">{p.email}</span>
            </div>
            <span className={`picks-badge${p.hasPicks ? ' done' : ''}`}>
              {p.hasPicks ? '✓ Done' : '—'}
            </span>
            <span className="player-pts">{p.score?.total_points ?? 0}</span>
            <button
              className={`toggle-btn toggle-btn-sm${p.is_admin ? ' on' : ''}`}
              onClick={() => toggleAdmin(p.id, p.is_admin)}
            >
              {p.is_admin ? '✓' : '—'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
