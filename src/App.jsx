import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { supabase } from './lib/supabase'
import { startKeepAlive, stopKeepAlive } from './lib/keepAlive'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import Picks from './pages/Picks'
import BracketPicks from './pages/BracketPicks'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import PlayerPicks from './pages/PlayerPicks'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-center"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="page-center"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  // Wait for profile to load before checking admin status — avoids false-pass when profile is still null
  if (!profile) return <div className="page-center"><div className="spinner" /></div>
  if (!profile.is_admin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  useEffect(() => {
    startKeepAlive()

    let hiddenAt = null
    const RELOAD_AFTER_MS = 30 * 60 * 1000 // 30 minutes away → full reload (auth token lasts 1hr)

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        stopKeepAlive()
      } else {
        const awayMs = hiddenAt ? Date.now() - hiddenAt : 0
        hiddenAt = null

        if (awayMs > RELOAD_AFTER_MS) {
          // Been away long enough that state is likely stale — just reload cleanly
          window.location.reload()
          return
        }

        // Short/medium absence — just refresh auth token and resume ping
        // Don't reload — would wipe any unsaved picks the user was working on
        supabase.auth.getSession()
        startKeepAlive()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopKeepAlive()
    }
  }, [])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/picks" element={<Protected><Picks /></Protected>} />
              <Route path="/bracket" element={<Protected><BracketPicks /></Protected>} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              <Route path="/player/:userId" element={<Protected><PlayerPicks /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
