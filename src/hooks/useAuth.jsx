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
      // Retry up to 5 times with increasing delays — handles cold Supabase starts
      // that happen right after a user clicks an email confirmation link.
      // Each attempt has its own 10s timeout so a sleeping DB doesn't stall forever.
      const delays = [0, 2000, 4000, 6000, 9000]
      for (let i = 0; i < delays.length; i++) {
        if (delays[i]) await new Promise(r => setTimeout(r, delays[i]))
        if (!mounted) return
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), 10000)
        try {
          const { data: existing } = await supabase
            .from('profiles').select('id').eq('id', userId).single()
            .abortSignal(controller.signal)
          clearTimeout(tid)
          if (!existing) {
            const ctrl2 = new AbortController()
            const tid2 = setTimeout(() => ctrl2.abort(), 10000)
            const { error: insErr } = await supabase.from('profiles').insert({
              id: userId,
              display_name: displayName || email?.split('@')[0] || 'Player',
              email: email || '',
              is_admin: false,
            }).abortSignal(ctrl2.signal)
            clearTimeout(tid2)
            if (insErr) throw insErr
          }
          return  // success — stop retrying
        } catch {
          clearTimeout(tid)
          // silent — will retry or gracefully give up on last attempt
        }
      }
    }
  }, [])

  async function signUp(email, password, displayName) {
    // Redirect to /login after email confirmation — it's a lightweight page
    // with no DB calls, so the server cold-start doesn't cause a crash there
    const redirectTo = `${window.location.origin}/login?confirmed=1`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { display_name: displayName },
      },
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    // scope: 'local' clears the session from this device immediately without
    // needing a successful server round-trip — fixes sign out on slow connections
    // and for accounts that were deleted from the DB
    await supabase.auth.signOut({ scope: 'local' })
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
