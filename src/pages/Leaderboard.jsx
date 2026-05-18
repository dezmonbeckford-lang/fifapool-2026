import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import './Leaderboard.css'

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries]   = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    loadLeaderboard()
    // Subscribe to realtime updates
    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, loadLeaderboard)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadLeaderboard() {
    setLoading(true)
    setError('')

    // Safeguard: never spin forever — abort after 10s and show retry
    const controller = new AbortController()
    const safeguard = setTimeout(() => controller.abort(), 10000)

    try {
      const [{ data: profiles, error: pErr }, { data: scores, error: sErr }, { data: settingsData }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, email').abortSignal(controller.signal),
        supabase.from('scores').select('user_id, group_points, bracket_points, total_points').abortSignal(controller.signal),
        supabase.from('settings').select('group_picks_locked').single().abortSignal(controller.signal),
      ])
      if (pErr) throw pErr
      if (sErr) throw sErr

      const scoreMap = {}
      ;(scores || []).forEach(s => { scoreMap[s.user_id] = s })

      const merged = (profiles || []).map(p => ({
        user_id: p.id,
        profiles: { display_name: p.display_name, email: p.email },
        group_points: scoreMap[p.id]?.group_points ?? 0,
        bracket_points: scoreMap[p.id]?.bracket_points ?? 0,
        total_points: scoreMap[p.id]?.total_points ?? 0,
      }))

      merged.sort((a, b) => b.total_points - a.total_points || a.profiles.display_name.localeCompare(b.profiles.display_name))
      setEntries(merged)
      setSettings(settingsData)
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('abort')) {
        setError('Server is waking up — tap retry')
      } else {
        setError('Failed to load leaderboard')
      }
    } finally {
      clearTimeout(safeguard)
      setLoading(false)
    }
  }

  const medals = ['🥇', '🥈', '🥉']

  if (loading) return <div className="page-center"><div className="spinner" /></div>

  if (error && entries.length === 0) {
    return (
      <div className="page-center">
        <div className="card" style={{ textAlign: 'center', padding: 32, maxWidth: 360 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚽</div>
          <p style={{ marginBottom: 20, color: 'var(--text2)' }}>{error}</p>
          <button className="btn btn-primary" onClick={loadLeaderboard}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="leaderboard-page">
      <div className="lb-header">
        <h1>🏆 Leaderboard</h1>
        <p>{entries.length} player{entries.length !== 1 ? 's' : ''} in the pool</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {entries.length === 0 ? (
        <div className="lb-empty card">
          <span>⚽</span>
          <p>No scores yet — the pool is just getting started!</p>
        </div>
      ) : (
        <div className="lb-list">
          {/* Top 3 podium */}
          {entries.length >= 3 && (
            <div className="podium">
              {[entries[1], entries[0], entries[2]].map((entry, i) => {
                const rank = i === 0 ? 2 : i === 1 ? 1 : 3
                return (
                  <div key={entry.user_id} className={`podium-slot rank-${rank}`}>
                    <div className="podium-medal">{medals[rank - 1]}</div>
                    <Link to={`/player/${entry.user_id}`} className="podium-name podium-link">
                      {entry.profiles?.display_name || 'Player'}
                      {entry.user_id === user?.id ? ' (you)' : ''}
                    </Link>
                    <div className="podium-pts">{entry.total_points} pts</div>
                    <div className={`podium-bar rank-${rank}`} />
                  </div>
                )
              })}
            </div>
          )}

          {/* Full table */}
          <div className="lb-table card">
            <div className="lb-table-header">
              <span>#</span>
              <span>Player</span>
              <span className="pts-col">Group</span>
              <span className="pts-col">Bracket</span>
              <span className="pts-col total-col">Total</span>
            </div>
            {entries.map((entry, index) => {
              const isMe = entry.user_id === user?.id
              return (
                <div key={entry.user_id} className={`lb-row${isMe ? ' is-me' : ''}`}>
                  <span className="lb-rank">
                    {index < 3 ? medals[index] : `${index + 1}`}
                  </span>
                  <span className="lb-name">
                    <Link
                      to={`/player/${entry.user_id}`}
                      className="lb-player-link"
                      title={settings?.group_picks_locked ? 'View picks' : 'Picks hidden until locked'}
                    >
                      {entry.profiles?.display_name || 'Player'}
                    </Link>
                    {isMe && <span className="you-tag">you</span>}
                    {settings?.group_picks_locked && <span className="lb-picks-hint">👁</span>}
                  </span>
                  <span className="pts-col">{entry.group_points ?? 0}</span>
                  <span className="pts-col">{entry.bracket_points ?? 0}</span>
                  <span className="pts-col total-col">{entry.total_points ?? 0}</span>
                </div>
              )
            })}
          </div>
          {settings?.group_picks_locked && (
            <div className="lb-picks-tip">👁 Tap a player's name to see their picks</div>
          )}
        </div>
      )}

      <div className="lb-note">
        Leaderboard updates automatically as results are entered.
      </div>
    </div>
  )
}
