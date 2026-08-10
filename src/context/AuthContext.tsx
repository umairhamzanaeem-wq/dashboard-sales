import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  clearLegacyAuthSession,
  setActiveAuthProfile,
  type AuthSession,
  type UserRole,
} from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  fetchProfileForUser,
  signInWithEmailPassword,
  signOutSupabase,
  updateSupabasePassword,
} from '@/lib/supabase-auth'

interface AuthContextValue {
  session: AuthSession | null
  /** @deprecated Prefer session fields — kept for AppContext / Gmail compatibility */
  username: string | null
  email: string | null
  userId: string | null
  displayName: string | null
  role: UserRole | null
  avatar: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** True while restoring Supabase session on boot */
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function profileFromSupabaseSession(
  supabaseSession: Session | null
): Promise<AuthSession | null> {
  if (!supabaseSession?.user?.id) return null
  const result = await fetchProfileForUser(supabaseSession.user.id)
  return result.ok ? result.session : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback((next: AuthSession | null) => {
    setActiveAuthProfile(next)
    setSession(next)
    if (next) clearLegacyAuthSession()
  }, [])

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('[auth] getSession failed', error.message)
      applySession(null)
      return
    }
    const profile = await profileFromSupabaseSession(data.session)
    if (data.session && !profile) {
      console.error('[auth] Authenticated but profile missing')
      applySession(null)
      return
    }
    applySession(profile)
  }, [applySession])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error) {
          console.error('[auth] getSession failed', error.message)
          applySession(null)
          return
        }
        const profile = await profileFromSupabaseSession(data.session)
        if (cancelled) return
        if (data.session && !profile) {
          console.error('[auth] Authenticated but profile missing')
          applySession(null)
          return
        }
        applySession(profile)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    // Avoid async work directly inside onAuthStateChange (can deadlock supabase-js).
    const { data: sub } = supabase.auth.onAuthStateChange((event, supabaseSession) => {
      if (event === 'SIGNED_OUT') {
        applySession(null)
        return
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'INITIAL_SESSION'
      ) {
        window.setTimeout(() => {
          void (async () => {
            const profile = await profileFromSupabaseSession(supabaseSession)
            if (supabaseSession && !profile) {
              applySession(null)
              return
            }
            applySession(profile)
          })()
        }, 0)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [applySession])

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await signInWithEmailPassword(email, password)
      if (!result.ok) return { ok: false, error: result.error }
      applySession(result.session)
      return { ok: true }
    },
    [applySession]
  )

  const logout = useCallback(async () => {
    await signOutSupabase()
    applySession(null)
  }, [applySession])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!session?.email) return { ok: false, error: 'Not signed in' }
      return updateSupabasePassword(session.email, currentPassword, newPassword)
    },
    [session]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      username: session?.username ?? null,
      email: session?.email ?? null,
      userId: session?.id ?? null,
      displayName: session?.displayName ?? null,
      role: session?.role ?? null,
      avatar: session?.avatarUrl ?? null,
      isAuthenticated: !!session,
      isAdmin: session?.role === 'admin',
      loading,
      login,
      logout,
      changePassword,
      refreshSession,
    }),
    [session, loading, login, logout, changePassword, refreshSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
