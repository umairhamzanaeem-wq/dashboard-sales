import {
  getUserAccount,
  loadUsersRegistry,
  validateUserCredentials,
  type UserRole,
} from '@/lib/users'

/** @deprecated Prefer users registry — kept for extension fallback reads */
export const USERS: Record<string, string> = {
  admin: 'admin',
  saad: 'saad',
  umair: 'umair',
}

export const AUTH_STORAGE_KEY = 'bd-auth-session'

export interface AuthSession {
  username: string
  /** Basic auth token for API calls */
  token: string
  role: UserRole
}

export function getUserProfile(username?: string | null) {
  const user = username?.trim().toLowerCase() ?? ''
  const account = user ? getUserAccount(user) : null
  if (account) {
    return {
      displayName: account.displayName,
      avatar: account.avatar,
      role: account.role,
    }
  }
  return {
    displayName: user ? user.charAt(0).toUpperCase() + user.slice(1) : 'User',
    role: 'user' as UserRole,
  }
}

export function validateLogin(username: string, password: string): boolean {
  // Ensure registry is seeded
  loadUsersRegistry()
  return !!validateUserCredentials(username, password)
}

export function createSession(username: string, password: string): AuthSession {
  const user = username.trim().toLowerCase()
  const account = validateUserCredentials(user, password)
  return {
    username: user,
    token: btoa(`${user}:${password}`),
    role: account?.role ?? 'user',
  }
}

export function loadSession(): AuthSession | null {
  try {
    loadUsersRegistry()
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed.username || !parsed.token) return null
    const account = getUserAccount(parsed.username)
    if (!account) return null
    // Keep role fresh from registry
    return {
      username: parsed.username,
      token: parsed.token,
      role: account.role,
    }
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
