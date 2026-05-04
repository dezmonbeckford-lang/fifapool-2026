import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="page-center">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <span className="auth-icon">✅</span>
          <h1>Password updated!</h1>
          <p style={{ color: 'var(--text2)', marginTop: 8 }}>Redirecting you to sign in…</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="page-center">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <span className="auth-icon">⏳</span>
          <h1>Verifying link…</h1>
          <p style={{ color: 'var(--text2)', marginTop: 8 }}>
            If this page doesn't load, your reset link may have expired.<br />
            <a href="/forgot-password" style={{ color: 'var(--accent)' }}>Request a new one</a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-center">
      <div className="auth-card card">
        <div className="auth-header">
          <span className="auth-icon">🔐</span>
          <h1>Set new password</h1>
          <p>Choose a strong password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label className="label">New password</label>
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

          <div className="form-group">
            <label className="label">Confirm password</label>
            <input
              type="password"
              className="input"
              placeholder="Same password again"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
