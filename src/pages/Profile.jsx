import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { saveWithRetry } from '../lib/saveWithRetry'
import './Auth.css'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    const name = displayName.trim()
    if (!name) { setError('Display name cannot be empty'); return }
    if (name.length > 30) { setError('Max 30 characters'); return }
    setError('')
    setSaveStatus('')
    setSaving(true)

    try {
      await saveWithRetry(
        async (signal) => {
          const { error: err } = await supabase
            .from('profiles')
            .update({ display_name: name })
            .eq('id', user.id)
            .abortSignal(signal)
          if (err) throw err
        },
        { onRetry: () => setSaveStatus('Server warming up, retrying…') }
      )

      await refreshProfile()
      setSaveStatus('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update. Try again.')
    } finally {
      setSaving(false)
      setSaveStatus('')
    }
  }

  return (
    <div className="page-center">
      <div className="auth-card card">
        <div className="auth-header">
          <span className="auth-icon">👤</span>
          <h1>My Profile</h1>
          <p>{user?.email}</p>
        </div>

        <form onSubmit={handleSave} className="auth-form">
          {error && <div className="error-msg">{error}</div>}
          {saved && <div className="success-msg">✓ Name updated everywhere!</div>}

          <div className="form-group">
            <label className="label">Display name</label>
            <input
              type="text"
              className="input"
              placeholder="Your name on the leaderboard"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setSaved(false) }}
              maxLength={30}
              required
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: 4 }}>
              {displayName.length}/30 · shown on the leaderboard and to all players
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={saving || displayName.trim() === profile?.display_name}
          >
            {saving ? (saveStatus || 'Updating…') : 'Update name'}
          </button>
        </form>
      </div>
    </div>
  )
}
