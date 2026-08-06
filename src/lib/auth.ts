export const USERS: Record<string, string> = {
  saad: 'saad',
  umair: 'umair',
}

/** Profile display names & avatar paths (files in /public/avatars) */
export const USER_PROFILES: Record<
  string,
  { displayName: string; avatar?: string }
> = {
  saad: { displayName: 'Saad' },
  umair: { displayName: 'Umair', avatar: '/avatars/umair.png' },
}

export function getUserProfile(username?: string | null) {
  const user = username?.trim().toLowerCase() ?? ''
  return (
    USER_PROFILES[user] ?? {
      displayName: user ? user.charAt(0).toUpperCase() + user.slice(1) : 'User',
    }
  )
}

export const AUTH_STORAGE_KEY = 'bd-auth-session'

export interface AuthSession {
  username: string
  /** Basic auth token for API calls */
  token: string
}

export function validateLogin(username: string, password: string): boolean {
  const user = username.trim().toLowerCase()
  return USERS[user] === password
}

export function createSession(username: string, password: string): AuthSession {
  const user = username.trim().toLowerCase()
  return {
    username: user,
    token: btoa(`${user}:${password}`),
  }
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed.username || !parsed.token || !USERS[parsed.username]) return null
    return parsed
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
