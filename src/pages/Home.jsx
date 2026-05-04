import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import './Home.css'

export default function Home() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const [{ data: scores }, { data: settings }] = await Promise.all([
      supabase.from('scores').select('user_id, total_points, profiles(display_name)').order('total_points', { ascending: false }).limit(3),
      supabase.from('settings').select('phase, group_picks_locked, bracket_picks_locked, bracket_unlock_at').single(),
    ])
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
    setStats({ top3: scores || [], settings: settings || {}, playerCount: count || 0 })
  }

  const phase = stats?.settings?.phase ?? 1
  const groupLocked = stats?.settings?.group_picks_locked
  const bracketLocked = stats?.settings?.bracket_picks_locked

  return (
    <div className="home">
      <div className="hero">
        <div className="hero-badge">World Cup 2026</div>
        <h1 className="hero-title">⚽ FifaPool</h1>
        <p className="hero-sub">Compete with your crew. Predict the tournament. Climb the board.</p>

        {/* Live status pill */}
        {stats && (
          <div className="status-pills">
            <span className={`status-pill ${groupLocked ? 'locked' : 'open'}`}>
              {groupLocked ? '🔒 Group Picks Locked' : '✅ Group Picks Open'}
            </span>
            {phase >= 2 && (
              <span className={`status-pill ${bracketLocked ? 'locked' : 'open'}`}>
                {bracketLocked ? '🔒 Bracket Locked' : '✅ Bracket Open'}
              </span>
            )}
            <span className="status-pill neutral">
              👥 {stats.playerCount} player{stats.playerCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {!user ? (
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Join the Pool</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Sign In</Link>
          </div>
        ) : (
          <div className="hero-actions">
            <Link to="/picks" className="btn btn-primary btn-lg">My Picks →</Link>
            {phase >= 2 && <Link to="/bracket" className="btn btn-outline btn-lg">Bracket →</Link>}
            <Link to="/leaderboard" className="btn btn-outline btn-lg">Leaderboard</Link>
          </div>
        )}
      </div>

      {/* Mini leaderboard */}
      {stats?.top3?.length > 0 && (
        <div className="home-leaders card">
          <div className="home-leaders-title">🏆 Top Players</div>
          {stats.top3.map((entry, i) => {
            const medals = ['🥇', '🥈', '🥉']
            return (
              <div key={entry.user_id} className="home-leader-row">
                <span className="hl-medal">{medals[i]}</span>
                <span className="hl-name">{entry.profiles?.display_name || 'Player'}</span>
                <span className="hl-pts">{entry.total_points} pts</span>
              </div>
            )
          })}
          <Link to="/leaderboard" className="home-leaders-link">Full leaderboard →</Link>
        </div>
      )}

      <div className="home-phases">
        <div className="phase-card card">
          <div className="phase-icon">🏟️</div>
          <h3>Phase 1 — Group Stage</h3>
          <p>Pick the top 2 teams from all 12 groups, plus 8 Wildcard Picks for extra points.</p>
          <ul className="points-list">
            <li><span>3 pts</span> Pick a team in top 2</li>
            <li><span>+2 pts</span> Nailed them as 1st specifically</li>
            <li><span>3 pts</span> Runner-up correct</li>
            <li><span>2 pts</span> Each correct Wildcard Pick</li>
          </ul>
        </div>

        <div className="phase-card card">
          <div className="phase-icon">🏆</div>
          <h3>Phase 2 — Bracket</h3>
          <p>Pick the winner of every knockout match from Round of 32 to the Final.</p>
          <ul className="points-list">
            <li><span>5 pts</span> Round of 32</li>
            <li><span>8 pts</span> Round of 16</li>
            <li><span>11 pts</span> Quarterfinals</li>
            <li><span>14 pts</span> Semifinals</li>
            <li><span>17 pts</span> Final</li>
            <li><span>25 pts</span> Champion bonus</li>
          </ul>
        </div>
      </div>

      <div className="home-cta card">
        <span className="cta-emoji">📱</span>
        <div>
          <h4>Add to home screen</h4>
          <p>Works like a real app on your phone. Tap Share → Add to Home Screen in Safari.</p>
        </div>
      </div>
    </div>
  )
}
