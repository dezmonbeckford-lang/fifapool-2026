import { useState, useEffect, useContext, createContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null, profile: null, loading: true,
  signUp: async () => {}, signIn: async () => {}, signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // If Supabase never responds, unblock the UI after 5s
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    // onAuthStateChange fires immediately with INITIAL_SESSION —
    // no need for a separate getSession() call
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        clearTimeout(failsafe)

        const u = session?.user ?? null
        setUser(u)

        if (u) {
          try {
            if (event === 'SIGNED_IN') {
              // create profile row if first time
              const meta = u.user_metadata
              await ensureProfile(u.id, u.email, meta?.display_name)
            }
            const { data } = await supabase
              .from('profiles').select('*').eq('id', u.id).single()
            if (mounted) setProfile(data ?? null)
          } catch {
            if (mounted) setProfile(null)
          }
        } else {
          setProfile(null)
        }

        if (mounted) setLoading(false)
      }
    )

    return () => {
      mounted = false
      clearTimeout(failsafe)
      subscription.unsubscribe()
    }
  }, [])

  async function ensureProfile(userId, email, displayName) {
    try {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('id', userId).single()
      if (!existing) {
        await supabase.from('profiles').insert({
          id: userId,
          display_name: displayName || email.split('@')[0],
          email,
          is_admin: false,
        })
      }
    } catch { /* non-fatal */ }
  }

  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user && !data.session) {
      // email confirmation required — store display name for later
      await supabase.auth.updateUser({ data: { display_name: displayName } })
    }
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
