import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="page-center">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <span className="auth-icon">📧</span>
          <h1>Check your email</h1>
          <p style={{ color: 'var(--text2)', marginTop: 8 }}>
            We sent a password reset link to <strong>{email}</strong>.<br />
            Click the link in the email to set a new password.
          </p>
          <Link to="/login" className="btn btn-outline btn-full" style={{ marginTop: 24 }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-center">
      <div className="auth-card card">
        <div className="auth-header">
          <span className="auth-icon">🔑</span>
          <h1>Reset password</h1>
          <p>Enter your email and we'll send you a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-msg">{error}</div>}

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

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-footer">
          Remember it? <Link to="/login">Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
