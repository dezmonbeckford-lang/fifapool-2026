import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { GROUPS, TEAM_FLAGS } from '../data/groups'
import { ROUND_LABELS } from '../data/scoring'
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
    const { data } = await supabase.from('settings').select('*').single()
    setSettings(data || {
      phase: 1,
      group_picks_locked: false,
      bracket_picks_locked: false,
    })
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 1, ...settings })
    setMsg(error ? `Error: ${error.message}` : '✓ Settings saved')
    setSaving(false)
  }

  if (loading || !profile?.is_admin) {
    return <div className="page-center"><div className="spinner" /></div>
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🔧 Admin Panel</h1>
        <p>FifaPool 2026 Management</p>
      </div>

      <div className="admin-tabs">
        {[['settings', '⚙️ Settings'], ['groups', '🏟️ Group Results'], ['bracket', '🏆 Bracket Results']].map(([id, label]) => (
          <button
            key={id}
            className={`admin-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
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
          <h2>Phase & Lock Settings</h2>

          <div className="setting-row">
            <div>
              <div className="setting-label">Current Phase</div>
              <div className="setting-desc">Controls which phase is active for users</div>
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
              <div className="setting-desc">Prevent users from changing group stage picks</div>
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
              <div className="setting-desc">Prevent users from changing bracket picks</div>
            </div>
            <button
              className={`toggle-btn${settings.bracket_picks_locked ? ' on' : ''}`}
              onClick={() => setSettings(s => ({ ...s, bracket_picks_locked: !s.bracket_picks_locked }))}
            >
              {settings.bracket_picks_locked ? '🔒 Locked' : '🔓 Open'}
            </button>
          </div>

          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}

      {tab === 'groups' && <GroupResultsTab onMsg={setMsg} />}
      {tab === 'bracket' && <BracketResultsTab onMsg={setMsg} />}
    </div>
  )
}

function GroupResultsTab({ onMsg }) {
  const [results, setResults] = useState({}) // { A: { winner: '', runnerUp: '' } }
  const [wildcardAdvancers, setWildcardAdvancers] = useState([]) // 8 teams
  const [existing, setExisting] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadExisting() }, [])

  async function loadExisting() {
    const { data } = await supabase.from('group_results').select('*')
    const r = {}
    if (data) data.forEach(row => { r[row.group_id] = { winner: row.winner, runnerUp: row.runner_up } })
    setExisting(r)
    setResults(r)

    const { data: wa } = await supabase.from('wildcard_advancers').select('team')
    if (wa) setWildcardAdvancers(wa.map(r => r.team))
    setLoading(false)
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
      // Save group results
      const rows = Object.entries(results)
        .filter(([, v]) => v.winner && v.runnerUp)
        .map(([groupId, v]) => ({
          group_id: groupId,
          winner: v.winner,
          runner_up: v.runnerUp,
        }))

      if (rows.length > 0) {
        const { error } = await supabase
          .from('group_results')
          .upsert(rows, { onConflict: 'group_id' })
        if (error) throw error
      }

      // Save wildcard advancers
      await supabase.from('wildcard_advancers').delete().neq('id', 0)
      if (wildcardAdvancers.length > 0) {
        await supabase.from('wildcard_advancers').insert(wildcardAdvancers.map(team => ({ team })))
      }

      // Score all users
      const { error: scoreErr } = await supabase.rpc('calculate_group_scores')
      if (scoreErr) throw scoreErr

      onMsg('✓ Group results saved and all scores updated!')
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
        <p>Enter the final 1st and 2nd place for each group, then select the 8 best 3rd-place advancers.</p>
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
                <select
                  className="input"
                  value={r.winner}
                  onChange={e => setResults(prev => ({
                    ...prev,
                    [group.id]: { ...r, winner: e.target.value }
                  }))}
                >
                  <option value="">— select —</option>
                  {group.teams.map(team => (
                    <option key={team} value={team}>{TEAM_FLAGS[team]} {team}</option>
                  ))}
                </select>
              </div>

              <div className="admin-group-row">
                <label className="label">🥈 Runner-up</label>
                <select
                  className="input"
                  value={r.runnerUp}
                  onChange={e => setResults(prev => ({
                    ...prev,
                    [group.id]: { ...r, runnerUp: e.target.value }
                  }))}
                >
                  <option value="">— select —</option>
                  {group.teams.map(team => (
                    <option key={team} value={team}>{TEAM_FLAGS[team]} {team}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="wildcard-advancers card">
        <h3>8 Best 3rd-Place Advancers ({wildcardAdvancers.length}/8)</h3>
        <p className="admin-sub">Select exactly 8 teams that advance as the best 3rd-place finishers. These are compared against users' Wildcard Picks.</p>
        <div className="wa-grid">
          {allTeams.filter(t => !pickedAsGroupAdvancer.has(t)).map(team => {
            const on = wildcardAdvancers.includes(team)
            return (
              <button
                key={team}
                className={`wa-btn${on ? ' on' : ''}`}
                onClick={() => toggleWildcardAdvancer(team)}
                disabled={!on && wildcardAdvancers.length >= 8}
              >
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

function BracketResultsTab({ onMsg }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    const { data } = await supabase
      .from('bracket_matches')
      .select('*')
      .order('round_order', { ascending: true })
      .order('match_number', { ascending: true })
    setMatches(data || [])
    setLoading(false)
  }

  async function saveResult(matchId, winner) {
    setSaving(matchId)
    try {
      const { error } = await supabase
        .from('bracket_matches')
        .update({ actual_winner: winner, result_entered: true })
        .eq('id', matchId)
      if (error) throw error

      // Score this match
      const { error: scoreErr } = await supabase.rpc('score_bracket_match', { match_id: matchId })
      if (scoreErr) throw scoreErr

      onMsg(`✓ Result saved and scores updated!`)
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

  const roundOrder = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Bracket Results</h2>
        <p>Enter match winners one at a time. Scores update instantly.</p>
      </div>

      {matches.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
          Bracket matches will appear here once the group stage is complete and the bracket is generated.
        </div>
      )}

      {roundOrder.map(round => {
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
                <MatchResultRow
                  key={match.id}
                  match={match}
                  onSave={saveResult}
                  isSaving={saving === match.id}
                />
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
        <div className="match-result-done">
          ✓ Winner: <strong>{TEAM_FLAGS[match.actual_winner]} {match.actual_winner}</strong>
        </div>
      ) : (
        <div className="match-result-input">
          <select
            className="input"
            value={selected}
            onChange={e => setSelected(e.target.value)}
            disabled={!match.team1 || !match.team2}
          >
            <option value="">— select winner —</option>
            {match.team1 && <option value={match.team1}>{TEAM_FLAGS[match.team1]} {match.team1}</option>}
            {match.team2 && <option value={match.team2}>{TEAM_FLAGS[match.team2]} {match.team2}</option>}
          </select>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onSave(match.id, selected)}
            disabled={!selected || isSaving}
          >
            {isSaving ? '…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
