import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Picks from './pages/Picks'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'

// Waits for auth to load, then redirects to /login if not signed in
function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-center"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Admin-only route
function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="page-center"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (profile && !profile.is_admin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/picks" element={<Protected><Picks /></Protected>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
