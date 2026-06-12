import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { readWithRetry } from '../lib/readWithRetry'
import { getCached, setCached } from '../lib/dataCache'
import { GROUPS, WILDCARD_COUNT } from '../data/groups'
import './Home.css'

const CACHE_KEY = 'home-stats'

export default function Home() {
  const { user } = useAuth()
  const [stats, setStats] = useState(getCached(CACHE_KEY))
  const [myPicksStatus, setMyPicksStatus] = useState(null)
  const [copied, setCopied] = useState(false)
  const mountedRef = useRef(true)

  function handleShare() {
    const url = 'https://fifapool-2026.vercel.app'
    if (navigator.share) {
      navigator.share({ title: 'FifaPool 2026', text: "Join my World Cup prediction pool!", url })
        .catch(err => { if (err?.name !== 'AbortError') throw err }) // ignore user cancel
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
    }
  }

  useEffect(() => {
    mountedRef.current = true
    loadStats()
    return () => { mountedRef.current = false }
  }, [user?.id])

  async function loadStats() {
    try {
      const queries = [
        readWithRetry(sig => supabase.from('scores')
          .select('user_id, total_points, profiles(display_name)')
          .order('total_points', { ascending: false }).limit(3).abortSignal(sig)),
        readWithRetry(sig => supabase.from('settings')
          .select('phase, group_picks_locked, bracket_picks_locked')
          .single().abortSignal(sig)),
        readWithRetry(sig => supabase.from('profiles')
          .select('id', { count: 'exact', head: true }).abortSignal(sig)),
      ]
      if (user?.id) {
        queries.push(readWithRetry(sig => supabase.from('group_picks')
          .select('group_id, winner, runner_up').eq('user_id', user.id).abortSignal(sig)))
        queries.push(readWithRetry(sig => supabase.from('wildcard_picks')
          .select('team', { count: 'exact', head: true }).eq('user_id', user.id).abortSignal(sig)))
      }
      const [scores, settings, countRes, gpRes, wpRes] = await Promise.all(queries)
      if (!mountedRef.current) return

      const fresh = {
        top3: scores?.data || [],
        settings: settings?.data || {},
        playerCount: countRes?.count || 0,
      }
      setStats(fresh)
      setCached(CACHE_KEY, fresh)

      if (user?.id) {
        const completedGroups = (gpRes?.data || []).filter(r => r.winner && r.runner_up).length
        const wildcardCount = wpRes?.count || 0
        setMyPicksStatus({
          groupsDone: completedGroups,
          groupsTotal: GROUPS.length,
          wildcardDone: wildcardCount,
          wildcardTotal: WILDCARD_COUNT,
          allDone: completedGroups === GROUPS.length && wildcardCount === WILDCARD_COUNT,
        })
      }
    } catch { /* non-fatal — home page degrades gracefully */ }
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

        {/* Picks completion notice */}
        {user && myPicksStatus && !groupLocked && (
          myPicksStatus.allDone ? (
            <div className="picks-complete-banner">
              ✅ All picks submitted ({myPicksStatus.groupsDone + myPicksStatus.wildcardDone}/{GROUPS.length + WILDCARD_COUNT})! You can still edit until the first game kicks off.
            </div>
          ) : myPicksStatus.groupsDone > 0 || myPicksStatus.wildcardDone > 0 ? (
            <div className="picks-incomplete-banner">
              ⏳ Picks in progress — {myPicksStatus.groupsDone}/{myPicksStatus.groupsTotal} groups
              {myPicksStatus.wildcardDone > 0 ? `, ${myPicksStatus.wildcardDone}/${myPicksStatus.wildcardTotal} wildcards` : ''}.
              {' '}<Link to="/picks">Finish your picks →</Link>
            </div>
          ) : null
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
            <li><span>3 pts</span> Group pick advances (either slot)</li>
            <li><span>+1 pt</span> Bonus for nailing 1st place exactly</li>
            <li><span>2 pts</span> Wildcard pick advances as wildcard</li>
            <li><span>3 pts</span> Wildcard pick finishes top 2 instead</li>
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

      <button className="share-btn" onClick={handleShare}>
        {copied ? '✅ Link copied!' : '🔗 Share with friends'}
      </button>
    </div>
  )
}
