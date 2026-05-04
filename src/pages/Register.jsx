import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import './Auth.css'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const data = await signUp(email, password, displayName)
      // If session is null, email confirmation is required
      if (data.session) {
        navigate('/')
      } else {
        setConfirmSent(true)
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (confirmSent) {
    return (
      <div className="page-center">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <span className="auth-icon">📧</span>
          <h1>Check your email</h1>
          <p style={{ color: 'var(--text2)', marginTop: 8 }}>
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account, then sign in.
          </p>
          <Link to="/login" className="btn btn-primary btn-full" style={{ marginTop: 24 }}>
            Go to sign in →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-center">
      <div className="auth-card card">
        <div className="auth-header">
          <span className="auth-icon">🏆</span>
          <h1>Join the pool</h1>
          <p>Create your account and start predicting</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label className="label">Display name</label>
            <input
              type="text"
              className="input"
              placeholder="Your name (shown on leaderboard)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              maxLength={30}
            />
          </div>

          <div className="form-group">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="At least 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
