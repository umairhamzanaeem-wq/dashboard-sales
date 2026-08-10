import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  clearSession,
  createSession,
  loadSession,
  saveSession,
  validateLogin,
  type AuthSession,
} from '@/lib/auth'
import { changeUserPassword, type UserRole } from '@/lib/users'

interface AuthContextValue {
  session: AuthSession | null
  username: string | null
  role: UserRole | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (username: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => { ok: boolean; error?: string }
  refreshSession: () => void
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

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) => {
      if (!session?.username) return { ok: false, error: 'Not signed in' }
      const result = changeUserPassword(session.username, currentPassword, newPassword)
      if (!result.ok) return result
      const next = createSession(session.username, newPassword)
      saveSession(next)
      setSession(next)
      return { ok: true }
    },
    [session]
  )

  const refreshSession = useCallback(() => {
    setSession(loadSession())
  }, [])

  const value = useMemo(
    () => ({
      session,
      username: session?.username ?? null,
      role: session?.role ?? null,
      isAuthenticated: !!session,
      isAdmin: session?.role === 'admin',
      login,
      logout,
      changePassword,
      refreshSession,
    }),
    [session, login, logout, changePassword, refreshSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
