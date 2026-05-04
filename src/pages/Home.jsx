import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import './Home.css'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="home">
      <div className="hero">
        <div className="hero-badge">World Cup 2026</div>
        <h1 className="hero-title">⚽ FifaPool</h1>
        <p className="hero-sub">Compete with your crew. Predict the tournament. Climb the board.</p>
        {!user ? (
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Join the Pool</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Sign In</Link>
          </div>
        ) : (
          <div className="hero-actions">
            <Link to="/picks" className="btn btn-primary btn-lg">My Picks →</Link>
            <Link to="/leaderboard" className="btn btn-outline btn-lg">Leaderboard</Link>
          </div>
        )}
      </div>

      <div className="home-phases">
        <div className="phase-card card">
          <div className="phase-icon">🏟️</div>
          <h3>Phase 1 — Group Stage</h3>
          <p>Pick the top 2 teams from all 12 groups, plus 8 Wildcard Picks for extra points.</p>
          <ul className="points-list">
            <li><span>3 pts</span> Group winner correct</li>
            <li><span>+2 pts</span> Nailed them as winner specifically</li>
            <li><span>3 pts</span> Runner-up correct</li>
            <li><span>2 pts</span> Each correct Wildcard Pick</li>
          </ul>
        </div>

        <div className="phase-card card">
          <div className="phase-icon">🏆</div>
          <h3>Phase 2 — Bracket</h3>
          <p>Pick the winner of every single knockout match from the Round of 32 to the Final.</p>
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
