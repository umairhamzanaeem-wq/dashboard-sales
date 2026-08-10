import { getUserAccount, type UserRole } from '@/lib/users'

export type { UserRole }

/** @deprecated Local registry fallback — not used for new Supabase logins */
export const USERS: Record<string, string> = {
  admin: 'admin',
  saad: 'saad',
  umair: 'umair',
}

/** @deprecated Legacy localStorage session key — AuthContext no longer writes this */
export const AUTH_STORAGE_KEY = 'bd-auth-session'

/** Authenticated app user (Supabase Auth + public.profiles) */
export interface AuthSession {
  id: string
  email: string
  username: string
  displayName: string
  role: UserRole
  avatarUrl: string | null
}

/** @deprecated Legacy local session shape */
export interface LegacyAuthSession {
  username: string
  token: string
  role: UserRole
}

export interface UserProfileView {
  displayName: string
  avatar?: string
  role: UserRole
}

/** Synced from AuthContext for getUserProfile() helpers */
let activeAuthProfile: AuthSession | null = null

export function setActiveAuthProfile(profile: AuthSession | null) {
  activeAuthProfile = profile
}

export function getActiveAuthProfile(): AuthSession | null {
  return activeAuthProfile
}

/**
 * Display helper for avatars / sidebar.
 * Prefers the live Supabase Auth profile; falls back to local users registry.
 */
export function getUserProfile(username?: string | null): UserProfileView {
  const user = username?.trim().toLowerCase() ?? ''

  if (activeAuthProfile && (!user || user === activeAuthProfile.username.toLowerCase())) {
    return {
      displayName: activeAuthProfile.displayName,
      avatar: activeAuthProfile.avatarUrl ?? undefined,
      role: activeAuthProfile.role,
    }
  }

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
    role: 'user',
  }
}

/** @deprecated Use Supabase Auth */
export function validateLogin(_username: string, _password: string): boolean {
  console.warn('[auth] validateLogin is deprecated; use Supabase Auth')
  return false
}

/** @deprecated */
export function createSession(_username: string, _password: string): LegacyAuthSession {
  throw new Error('createSession is deprecated; use Supabase Auth')
}

/** @deprecated Legacy localStorage session reader */
export function loadSession(): LegacyAuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LegacyAuthSession
  } catch {
    return null
  }
}

/** @deprecated */
export function saveSession(_session: LegacyAuthSession): void {
  console.warn('[auth] saveSession is deprecated; Supabase manages the session')
}

export function clearLegacyAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** @deprecated */
export function clearSession(): void {
  clearLegacyAuthSession()
}
