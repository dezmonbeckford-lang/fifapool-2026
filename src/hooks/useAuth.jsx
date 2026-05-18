import { useState, useEffect, useContext, createContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null, profile: null, loading: true,
  signUp: async () => {}, signIn: async () => {}, signOut: async () => {}, refreshProfile: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Read the cached session synchronously from localStorage — no network needed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)  // unblock the app immediately
      if (session?.user) fetchProfile(session.user.id)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Watch for sign-in / sign-out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        const u = session?.user ?? null
        setUser(u)
        setLoading(false)
        if (u) {
          if (event === 'SIGNED_IN') {
            await ensureProfile(u.id, u.email, u.user_metadata?.display_name)
          }
          fetchProfile(u.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }

    async function fetchProfile(userId) {
      // Retry up to 3 times — handles Supabase cold starts that hang
      for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), 8000)
        try {
          const { data, error } = await supabase
            .from('profiles').select('*').eq('id', userId).single()
            .abortSignal(controller.signal)
          clearTimeout(tid)
          if (error) throw error
          if (mounted) setProfile(data ?? null)
          return
        } catch (err) {
          clearTimeout(tid)
          const isAbort = err?.name === 'AbortError' || err?.message?.toLowerCase().includes('abort')
          if (isAbort && attempt < 2) continue   // retry on timeout
          if (mounted) setProfile(null)
          return
        }
      }
    }

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
  }, [])

  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user && !data.session) {
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

  async function refreshProfile() {
    if (!user) return
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 8000)
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        .abortSignal(controller.signal)
      setProfile(data ?? null)
    } catch { /* non-fatal */ } finally {
      clearTimeout(tid)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
