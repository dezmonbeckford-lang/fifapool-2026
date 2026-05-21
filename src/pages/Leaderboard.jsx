import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { readWithRetry } from '../lib/readWithRetry'
import { useLoadGuard } from '../lib/useLoadGuard.jsx'
import { getCached, setCached } from '../lib/dataCache'
import './Leaderboard.css'

const CACHE_KEY = 'leaderboard'

export default function Leaderboard() {
  const { user } = useAuth()
  const cached = getCached(CACHE_KEY)
  const [entries, setEntries]   = useState(cached?.entries || [])
  const [settings, setSettings] = useState(cached?.settings || null)
  const [loading, setLoading]   = useState(!cached)
  const [error, setError]       = useState('')
  const mountedRef  = useRef(true)
  const hasEntries  = useRef(cached?.entries?.length > 0)

  useEffect(() => {
    mountedRef.current = true
    loadLeaderboard()

    // Subscribe to score changes
    let channel = subscribe()

    // When user returns to the tab, reload data and reconnect the subscription
    // (connections die when the browser is backgrounded)
    function onVisible() {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        loadLeaderboard()
        supabase.removeChannel(channel)
        channel = subscribe()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }

    function subscribe() {
      return supabase
        .channel(`leaderboard-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' },
          () => { if (mountedRef.current) loadLeaderboard() })
        .subscribe()
    }
  }, [])

  async function loadLeaderboard() {
    if (!getCached(CACHE_KEY) && mountedRef.current) setLoading(true)
    if (mountedRef.current) setError('')
    try {
      const [profilesRes, scoresRes, settingsRes] = await Promise.all([
        readWithRetry(sig => supabase.from('profiles').select('id, display_name').abortSignal(sig)),
        readWithRetry(sig => supabase.from('scores').select('user_id, group_points, bracket_points, total_points').abortSignal(sig)),
        readWithRetry(sig => supabase.from('settings').select('group_picks_locked, bracket_picks_locked, phase').single().abortSignal(sig)),
      ])

      if (!mountedRef.current) return  // unmounted while fetching — bail out

      if (profilesRes?.error) throw profilesRes.error
      if (scoresRes?.error)   throw scoresRes.error

      const profiles = profilesRes?.data || []
      const scores   = scoresRes?.data  || []
      const settingsData = settingsRes?.data || null

      const scoreMap = {}
      scores.forEach(s => { scoreMap[s.user_id] = s })

      const merged = profiles.map(p => ({
        user_id: p.id,
        profiles: { display_name: p.display_name },
        group_points:   scoreMap[p.id]?.group_points   ?? 0,
        bracket_points: scoreMap[p.id]?.bracket_points ?? 0,
        total_points:   scoreMap[p.id]?.total_points   ?? 0,
      }))
      merged.sort((a, b) => b.total_points - a.total_points || (a.profiles.display_name || '').localeCompare(b.profiles.display_name || ''))

      setEntries(merged)
      setSettings(settingsData)
      hasEntries.current = merged.length > 0
      setCached(CACHE_KEY, { entries: merged, settings: settingsData })
    } catch {
      if (mountedRef.current && !hasEntries.current) setError('Failed to load leaderboard')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const medals = ['🥇', '🥈', '🥉']

  const { guardEl } = useLoadGuard(loading, loadLeaderboard)
  if (loading) return guardEl

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
                      title={
                        settings?.bracket_picks_locked ? 'View full picks' :
                        settings?.group_picks_locked   ? 'View group picks' :
                        'Picks hidden until group stage locks'
                      }
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
          {settings?.group_picks_locked ? (
            <div className="lb-picks-tip">👁 Tap a player's name to see their picks</div>
          ) : (
            <div className="lb-picks-tip" style={{ opacity: 0.6 }}>🔒 Picks hidden until group stage deadline</div>
          )}
        </div>
      )}

      <div className="lb-note">
        Leaderboard updates automatically as results are entered.
      </div>
    </div>
  )
}
