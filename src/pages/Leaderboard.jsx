import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './Leaderboard.css'

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    try {
      const { data, error: err } = await supabase
        .from('scores')
        .select('*, profiles(display_name, email)')
        .order('total_points', { ascending: false })
      if (err) throw err
      setEntries(data || [])
    } catch (err) {
      setError('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const medals = ['🥇', '🥈', '🥉']

  if (loading) return <div className="page-center"><div className="spinner" /></div>

  return (
    <div className="leaderboard-page">
      <div className="lb-header">
        <h1>🏆 Leaderboard</h1>
        <p>{entries.length} player{entries.length !== 1 ? 's' : ''} competing</p>
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
                    <div className="podium-name">
                      {entry.profiles?.display_name || 'Player'}
                      {entry.user_id === user?.id ? ' (you)' : ''}
                    </div>
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
                    {entry.profiles?.display_name || 'Player'}
                    {isMe && <span className="you-tag">you</span>}
                  </span>
                  <span className="pts-col">{entry.group_points ?? 0}</span>
                  <span className="pts-col">{entry.bracket_points ?? 0}</span>
                  <span className="pts-col total-col">{entry.total_points ?? 0}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="lb-note">
        Leaderboard updates automatically as results are entered.
      </div>
    </div>
  )
}
