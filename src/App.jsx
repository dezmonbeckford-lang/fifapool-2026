import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Picks from './pages/Picks'
import BracketPicks from './pages/BracketPicks'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'

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
  if (profile && !profile.is_admin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
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
            <Route path="/picks" element={<Protected><Picks /></Protected>} />
            <Route path="/bracket" element={<Protected><BracketPicks /></Protected>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}
