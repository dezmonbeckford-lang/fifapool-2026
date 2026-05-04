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

    // Safety net: never hang forever
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (e) {
        console.error('Auth init error:', e)
        if (mounted) setLoading(false)
      } finally {
        clearTimeout(failsafe)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          if (event === 'SIGNED_IN') {
            const meta = session.user.user_metadata
            await ensureProfile(session.user.id, session.user.email, meta?.display_name)
          }
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(failsafe)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      setProfile(data ?? null)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
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

  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.session && data.user) {
      await ensureProfile(data.user.id, email, displayName)
    } else if (data.user) {
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
