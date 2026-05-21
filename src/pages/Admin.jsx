import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { GROUPS, TEAM_FLAGS } from '../data/groups'
import { ROUND_LABELS } from '../data/scoring'
import { getNextSlot } from '../data/bracketTree'
import { saveWithRetry } from '../lib/saveWithRetry'
import { readWithRetry } from '../lib/readWithRetry'
import './Admin.css'
import './BracketPicks.css'

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

// Matches 1-12: predetermined FIFA 2026 group matchups
// Matches 13-16: wildcard slots (auto-filled from wildcard_advancers)
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
    if (!window.confirm('This fills all 16 R32 matches from your saved group results and wildcard advancers, and saves them immediately. Continue?')) return
    setSaving(true)
    try {
      await saveWithRetry(async (signal) => {
        const { error } = await supabase.rpc('populate_bracket_teams').abortSignal(signal)
        if (error) throw error
      })
      onMsg('✓ Bracket saved! All 16 matchups now have real team names. Users will see them once you open the bracket.')
      loadMatches()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Check if any matches still have un-replaced labels or empty wildcard slots
  const hasLabels = r32Matches.some(m => isLabel(m.team1) || isLabel(m.team2))
  const wildcardsFilled = r32Matches
    .filter(m => WILDCARD_SLOTS.includes(m.match_number))
    .every(m => m.team1 && m.team2)
  const needsAutoFill = hasLabels || !wildcardsFilled
  const bracketReady = initialized && !needsAutoFill

  if (loading) return <div className="spinner" />

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Bracket Setup</h2>
        <p>Initialize the bracket structure, then auto-fill all 16 R32 matchups from group results.</p>
      </div>

      {!initialized ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
          <h3>Bracket Not Initialized</h3>
          <p style={{ color: 'var(--text2)', margin: '8px 0 20px' }}>
            Creates the full bracket (R32 → Final). All 16 R32 matchups are pre-filled with the
            official FIFA 2026 structure — group matchups for 1–12, wildcard slots for 13–16.<br />
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
          <div className="card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderColor: bracketReady ? 'var(--success)' : undefined }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {bracketReady ? '✅ Bracket Ready' : '🔄 Auto-fill All Matchups'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {bracketReady
                  ? 'All 16 R32 matchups have real team names and are saved. Open the bracket when ready.'
                  : 'Fills matches 1–12 from group results and 13–16 from wildcard advancers. Saves immediately to DB.'}
              </div>
            </div>
            {needsAutoFill && (
              <button className="btn btn-primary" onClick={handleAutoFill} disabled={saving}>
                {saving ? 'Filling & Saving…' : '🔄 Auto-fill & Save'}
              </button>
            )}
          </div>

          {/* All 16 matches — read-only display */}
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>All 16 R32 Matches</h3>
          <div className="bracket-setup-grid" style={{ marginBottom: 16 }}>
            {r32Matches.map((row) => (
              <div
                key={row.match_number}
                className={`bsu-row card${isLabel(row.team1) || isLabel(row.team2) ? ' bsu-label' : ''}${WILDCARD_SLOTS.includes(row.match_number) && (!row.team1 || !row.team2) ? ' bsu-wildcard' : ''}`}
              >
                <span className="bsu-num">{row.match_number}</span>
                <span className={`bsu-team-label${isLabel(row.team1) || !row.team1 ? ' is-placeholder' : ''}`}>
                  {row.team1 || (WILDCARD_SLOTS.includes(row.match_number) ? 'Wildcard TBD' : 'TBD')}
                </span>
                <span className="bsu-vs">vs</span>
                <span className={`bsu-team-label${isLabel(row.team2) || !row.team2 ? ' is-placeholder' : ''}`}>
                  {row.team2 || (WILDCARD_SLOTS.includes(row.match_number) ? 'Wildcard TBD' : 'TBD')}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn btn-outline" onClick={handleInit} disabled={saving}
              style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              Reset Bracket
            </button>
          </div>
        </>
      )}
    </div>
  )
}


const RESULT_ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']
const PREV_ROUND_MAP = { R16: 'R32', QF: 'R16', SF: 'QF', THIRD: 'SF', FINAL: 'SF' }
// After saving SF → go to THIRD tab first (loser match), then FINAL
const NEXT_ROUND_MAP = { R32: 'R16', R16: 'QF', QF: 'SF', SF: 'THIRD', THIRD: 'FINAL' }

// ── Bracket Results ─────────────────────────────────────────────
function BracketResultsTab({ onMsg }) {
  const [matches,      setMatches]      = useState([])
  const [picks,        setPicks]        = useState({})   // { matchId: winner } — pending local picks
  const [finalScores,  setFinalScores]  = useState({})   // { matchId: { s1, s2 } }
  const [loading,      setLoading]      = useState(true)
  const [savingMatch,  setSavingMatch]  = useState(null) // matchId currently saving
  const [advancing,    setAdvancing]    = useState(false)
  const [resetting,    setResetting]    = useState(false)
  const [activeRound,  setActiveRound]  = useState('R32')

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    try {
      const res = await readWithRetry(sig =>
        supabase.from('bracket_matches').select('*')
          .order('round_order', { ascending: true })
          .order('match_number', { ascending: true })
          .abortSignal(sig)
      )
      setMatches(res?.data || [])
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }

  async function resetResults() {
    if (!window.confirm('Reset ALL bracket results? Clears every result and zeroes all bracket points. Cannot be undone.')) return
    setResetting(true)
    try {
      const { error: e1 } = await supabase
        .from('bracket_matches')
        .update({ actual_winner: null, result_entered: false, actual_score1: null, actual_score2: null, team1: null, team2: null })
        .in('round', ['R16', 'QF', 'SF', 'THIRD', 'FINAL'])
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('bracket_matches')
        .update({ actual_winner: null, result_entered: false })
        .eq('round', 'R32')
      if (e2) throw e2
      const { error: e3 } = await supabase.rpc('recalculate_bracket_scores')
      if (e3) throw e3
      setPicks({})
      setFinalScores({})
      setActiveRound('R32')
      onMsg('✓ All results cleared and scores reset.')
      loadMatches()
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setResetting(false)
    }
  }

  // Save a single match result immediately — updates scores right away
  async function saveMatch(match) {
    const winner = picks[match.id]
    if (!winner) return
    if (match.is_final) {
      const fs = finalScores[match.id] || {}
      if (fs.s1 === '' || fs.s1 == null || fs.s2 === '' || fs.s2 == null) {
        onMsg('Enter the final score before saving.')
        return
      }
    }

    setSavingMatch(match.id)
    try {
      const payload = { actual_winner: winner, result_entered: true }
      if (match.is_final) {
        const fs = finalScores[match.id] || {}
        payload.actual_score1 = Number(fs.s1)
        payload.actual_score2 = Number(fs.s2)
      }
      const { error } = await supabase.from('bracket_matches').update(payload).eq('id', match.id)
      if (error) throw error

      // Recalculate all bracket scores from scratch (reliable, no fire-and-forget)
      const { error: scoreErr } = await supabase.rpc('recalculate_bracket_scores')
      if (scoreErr) throw scoreErr

      // Clear the pending pick for this match
      setPicks(prev => { const n = { ...prev }; delete n[match.id]; return n })

      await loadMatches()
      onMsg(`✓ ${winner} saved — scores updated!`)
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setSavingMatch(null)
    }
  }

  // Once ALL matches in the round are saved, propagate teams to next round
  async function advanceRound() {
    setAdvancing(true)
    try {
      const freshRes = await supabase.from('bracket_matches').select('*')
        .order('round_order').order('match_number')
      const fresh = freshRes.data || []

      const nextRound = NEXT_ROUND_MAP[activeRound]
      if (nextRound) {
        const updates = []
        const currentRoundMatches = fresh.filter(m => m.round === activeRound)

        for (const match of currentRoundMatches) {
          const winner = match.actual_winner
          if (!winner) continue

          const next = getNextSlot(match.round, match.match_number)
          if (next) {
            const slotKey   = next.slot === 1 ? 'team1' : 'team2'
            const nextMatch = fresh.find(m => m.round === next.round && m.match_number === next.matchNum)
            if (nextMatch) updates.push({ id: nextMatch.id, slot: slotKey, team: winner })
          }

          // SF losers → Third Place
          if (match.round === 'SF') {
            const loser      = match.team1 === winner ? match.team2 : match.team1
            const thirdSlot  = match.match_number === 1 ? 'team1' : 'team2'
            const thirdMatch = fresh.find(m => m.round === 'THIRD')
            if (thirdMatch && loser) updates.push({ id: thirdMatch.id, slot: thirdSlot, team: loser })
          }
        }

        for (const u of updates) {
          const { error } = await supabase.from('bracket_matches').update({ [u.slot]: u.team }).eq('id', u.id)
          if (error) throw error
        }

        await loadMatches()
        setActiveRound(nextRound)
        onMsg(`✓ ${ROUND_LABELS[nextRound]} is ready!`)
      }
    } catch (err) {
      onMsg(`Error: ${err.message}`)
    } finally {
      setAdvancing(false)
    }
  }

  if (loading) return <div className="spinner" />

  if (matches.length === 0) {
    return (
      <div className="admin-section">
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
          No bracket matches yet — go to Bracket Setup first.
        </div>
      </div>
    )
  }

  const byRound = {}
  RESULT_ROUND_ORDER.forEach(r => { byRound[r] = matches.filter(m => m.round === r) })

  const savedCount   = r => (byRound[r] || []).filter(m => m.result_entered).length
  const totalCount   = r => (byRound[r] || []).length
  const isComplete   = r => totalCount(r) > 0 && savedCount(r) === totalCount(r)
  const isAccessible = r => {
    if (r === 'R32') return true
    const pr = PREV_ROUND_MAP[r]
    return !pr || isComplete(pr)
  }

  const activeRounds  = RESULT_ROUND_ORDER.filter(r => totalCount(r) > 0)
  const activeIdx     = activeRounds.indexOf(activeRound)
  const prevRound     = activeIdx > 0 ? activeRounds[activeIdx - 1] : null
  const roundMatches  = byRound[activeRound] || []
  const nextRoundName = NEXT_ROUND_MAP[activeRound]
  const roundComplete = isComplete(activeRound)

  return (
    <div className="admin-results-page">

      {/* Header */}
      <div className="results-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Bracket Results</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            Pick a winner → Save — scores update instantly. When all saved, advance to next round.
          </p>
        </div>
        <button
          className="btn btn-sm"
          style={{ color: '#ef4444', borderColor: '#ef4444', whiteSpace: 'nowrap' }}
          onClick={resetResults}
          disabled={resetting}
        >
          {resetting ? 'Resetting…' : '🗑 Reset All'}
        </button>
      </div>

      {/* Round tabs */}
      <div className="round-tabs">
        {activeRounds.map(r => {
          const accessible = isAccessible(r)
          const complete   = isComplete(r)
          return (
            <button
              key={r}
              className={`round-tab${activeRound === r ? ' active' : ''}${complete ? ' done' : ''}`}
              onClick={() => accessible && setActiveRound(r)}
              disabled={!accessible}
            >
              <span className="rt-label">{ROUND_LABELS[r]}</span>
              <span className="rt-count">{savedCount(r)}/{totalCount(r)}</span>
            </button>
          )
        })}
      </div>

      {/* Match cards */}
      <div className="bracket-matches" style={{ paddingBottom: 120 }}>
        {roundMatches.map(match => (
          <AdminResultCard
            key={match.id}
            match={match}
            pendingWinner={picks[match.id] || null}
            onPick={winner => setPicks(prev => ({ ...prev, [match.id]: winner }))}
            finalScore={match.is_final ? (finalScores[match.id] || { s1: '', s2: '' }) : null}
            onFinalScore={match.is_final
              ? (updater) => setFinalScores(prev => ({ ...prev, [match.id]: typeof updater === 'function' ? updater(prev[match.id] || { s1: '', s2: '' }) : updater }))
              : null}
            onSave={() => saveMatch(match)}
            isSaving={savingMatch === match.id}
          />
        ))}
      </div>

      {/* Round navigation */}
      <div className="bracket-round-nav">
        {prevRound ? (
          <button className="btn btn-outline brn-btn" onClick={() => setActiveRound(prevRound)}>
            ← {ROUND_LABELS[prevRound]}
          </button>
        ) : <div />}
      </div>

      {/* Save bar — progress + advance button when all saved */}
      <div className="bracket-save-bar">
        <div className="bsb-progress">
          {savedCount(activeRound)}/{roundMatches.length} saved
          {roundComplete && <span className="bsb-all-done"> ✓ All saved!</span>}
        </div>
        {roundComplete && nextRoundName ? (
          <button
            className="btn btn-lg btn-full btn-success"
            onClick={advanceRound}
            disabled={advancing}
          >
            {advancing ? 'Initializing…' : `⚡ Advance to ${ROUND_LABELS[nextRoundName]}`}
          </button>
        ) : roundComplete && !nextRoundName ? (
          <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)', padding: '10px 0' }}>
            🏆 Bracket Complete!
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', padding: '6px 0' }}>
            Pick a winner on each match card, then tap Save Result
          </div>
        )}
      </div>
    </div>
  )
}

// ── AdminResultCard ──────────────────────────────────────────────
function AdminResultCard({ match, pendingWinner, onPick, onSave, isSaving, finalScore, onFinalScore }) {
  const { team1, team2, result_entered, actual_winner, is_final } = match
  const displayWinner = result_entered ? actual_winner : pendingWinner
  const bothKnown = !!(team1 && team2)
  const canSave = !result_entered && pendingWinner && bothKnown &&
    (!is_final || (finalScore?.s1 !== '' && finalScore?.s1 != null && finalScore?.s2 !== '' && finalScore?.s2 != null))

  return (
    <div
      className={`bm-card card${result_entered ? ' correct' : ''}`}
      style={pendingWinner && !result_entered ? { borderColor: 'var(--accent)' } : {}}
    >
      <div className="bm-header">
        <span className="bm-pts">Match {match.match_number}</span>
        {result_entered
          ? <span className="bm-result-badge correct">✓ Saved</span>
          : pendingWinner
            ? <span className="bm-result-badge" style={{ color: 'var(--accent)' }}>⭐ {pendingWinner}</span>
            : null}
      </div>

      <div className="bm-teams">
        {team1 ? (
          <button
            className={`tpb${displayWinner === team1 ? (result_entered ? ' winner' : ' picked') : ''}${result_entered && actual_winner !== team1 ? ' loser' : ''}`}
            onClick={() => !result_entered && bothKnown && onPick(team1)}
            disabled={result_entered || !bothKnown}
          >
            <span className="tpb-flag">{TEAM_FLAGS[team1] || '🏳️'}</span>
            <span className="tpb-name">{team1}</span>
            {displayWinner === team1 && <span className="tpb-crown">{result_entered ? '👑' : '⭐'}</span>}
          </button>
        ) : (
          <div className="tpb tpb-tbd">
            <span className="tpb-flag">⏳</span>
            <span className="tpb-name">Previous round not advanced yet</span>
          </div>
        )}

        <span className="bm-vs">VS</span>

        {team2 ? (
          <button
            className={`tpb${displayWinner === team2 ? (result_entered ? ' winner' : ' picked') : ''}${result_entered && actual_winner !== team2 ? ' loser' : ''}`}
            onClick={() => !result_entered && bothKnown && onPick(team2)}
            disabled={result_entered || !bothKnown}
          >
            <span className="tpb-flag">{TEAM_FLAGS[team2] || '🏳️'}</span>
            <span className="tpb-name">{team2}</span>
            {displayWinner === team2 && <span className="tpb-crown">{result_entered ? '👑' : '⭐'}</span>}
          </button>
        ) : (
          <div className="tpb tpb-tbd">
            <span className="tpb-flag">⏳</span>
            <span className="tpb-name">Previous round not advanced yet</span>
          </div>
        )}
      </div>

      {/* Final score inputs */}
      {is_final && finalScore && !result_entered && (
        <div className="tiebreaker">
          <div className="tb-label">🏆 Enter final score:</div>
          <div className="tb-inputs">
            <div className="tb-team">
              <span>{TEAM_FLAGS[team1] || '🏳️'} {team1 || '?'}</span>
              <input type="number" min="0" max="20" className="input tb-input"
                value={finalScore.s1} placeholder="0"
                onChange={e => onFinalScore(prev => ({ ...prev, s1: e.target.value }))} />
            </div>
            <span className="tb-dash">—</span>
            <div className="tb-team">
              <input type="number" min="0" max="20" className="input tb-input"
                value={finalScore.s2} placeholder="0"
                onChange={e => onFinalScore(prev => ({ ...prev, s2: e.target.value }))} />
              <span>{team2 || '?'} {TEAM_FLAGS[team2] || '🏳️'}</span>
            </div>
          </div>
        </div>
      )}

      {is_final && result_entered && match.actual_score1 != null && (
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13, marginTop: 8 }}>
          {team1} {match.actual_score1} – {match.actual_score2} {team2}
        </div>
      )}

      {/* Per-match save button */}
      {canSave && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 12, width: '100%' }}
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : `💾 Save Result`}
        </button>
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
