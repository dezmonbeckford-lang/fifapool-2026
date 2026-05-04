import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import './Navbar.css'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const loc = useLocation()

  const navItems = [
    { to: '/', label: '🏆', title: 'Home' },
    { to: '/leaderboard', label: '📊', title: 'Leaderboard' },
    ...(user ? [{ to: '/picks', label: '⚽', title: 'My Picks' }] : []),
    ...(user ? [{ to: '/bracket', label: '🏅', title: 'Bracket' }] : []),
    ...(profile?.is_admin ? [{ to: '/admin', label: '🔧', title: 'Admin' }] : []),
  ]

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">⚽</span>
          <span className="brand-text">FifaPool<span className="brand-year"> 2026</span></span>
        </Link>

        <nav className="navbar-links hide-mobile">
          <Link to="/leaderboard" className={loc.pathname === '/leaderboard' ? 'active' : ''}>Leaderboard</Link>
          {user && <Link to="/picks" className={loc.pathname === '/picks' ? 'active' : ''}>My Picks</Link>}
          {user && <Link to="/bracket" className={loc.pathname === '/bracket' ? 'active' : ''}>Bracket</Link>}
          {profile?.is_admin && <Link to="/admin" className={loc.pathname.startsWith('/admin') ? 'active' : ''}>Admin</Link>}
        </nav>

        <div className="navbar-actions">
          {user ? (
            <div className="navbar-user">
              <span className="user-name">{profile?.display_name ?? user.email.split('@')[0]}</span>
              <button className="btn btn-outline btn-sm" onClick={signOut}>Sign out</button>
            </div>
          ) : (
            <div className="navbar-auth">
              <Link to="/login" className="btn btn-outline btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Join pool</Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`mobile-nav-item${loc.pathname === item.to ? ' active' : ''}`}
            title={item.title}
          >
            <span className="mobile-nav-icon">{item.label}</span>
            <span className="mobile-nav-label">{item.title}</span>
          </Link>
        ))}
        {!user && (
          <Link to="/login" className={`mobile-nav-item${loc.pathname === '/login' ? ' active' : ''}`}>
            <span className="mobile-nav-icon">👤</span>
            <span className="mobile-nav-label">Sign in</span>
          </Link>
        )}
      </nav>
    </header>
  )
}
