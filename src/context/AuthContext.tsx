import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  clearSession,
  createSession,
  loadSession,
  saveSession,
  validateLogin,
  type AuthSession,
} from '@/lib/auth'

interface AuthContextValue {
  session: AuthSession | null
  username: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())

  const login = useCallback((username: string, password: string) => {
    if (!validateLogin(username, password)) {
      return { ok: false, error: 'Invalid username or password' }
    }
    const next = createSession(username, password)
    saveSession(next)
    setSession(next)
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      username: session?.username ?? null,
      isAuthenticated: !!session,
      login,
      logout,
    }),
    [session, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
