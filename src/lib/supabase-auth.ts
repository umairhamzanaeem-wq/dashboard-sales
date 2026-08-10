import {
  clearLegacyAuthSession,
  setActiveAuthProfile,
  type AuthSession,
  type UserRole,
} from '@/lib/auth'
import { getUserAccount } from '@/lib/users'
import { supabase } from '@/lib/supabase'

export type { AuthSession, UserRole }

export interface ProfileRow {
  id: string
  username: string
  display_name: string
  role: string
  avatar_url: string | null
}

function normalizeRole(role: string | null | undefined): UserRole {
  return role === 'admin' ? 'admin' : 'user'
}

export type ProfileFetchResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string; kind: 'auth' | 'not_found' | 'network' | 'other' }

function isNetworkish(message: string | undefined): boolean {
  const msg = (message ?? '').toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetcherror') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  )
}

export async function fetchProfileForUser(userId: string): Promise<ProfileFetchResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user || authData.user.id !== userId) {
    if (authError && isNetworkish(authError.message)) {
      return { ok: false, error: 'Network error. Check your connection and try again.', kind: 'network' }
    }
    return {
      ok: false,
      error: authError?.message || 'Authentication failed',
      kind: 'auth',
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, role, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[auth] Failed to load profile', error.message)
    if (isNetworkish(error.message)) {
      return { ok: false, error: 'Network error. Check your connection and try again.', kind: 'network' }
    }
    return { ok: false, error: `Could not load profile: ${error.message}`, kind: 'other' }
  }
  if (!data) {
    return {
      ok: false,
      error: 'Profile not found. Contact an administrator.',
      kind: 'not_found',
    }
  }

  const row = data as ProfileRow
  return {
    ok: true,
    session: {
      id: row.id,
      email: authData.user.email ?? '',
      username: row.username,
      displayName: row.display_name,
      role: normalizeRole(row.role),
      avatarUrl: row.avatar_url,
    },
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> {
  const trimmed = email.trim()
  if (!trimmed || !password) {
    return { ok: false, error: 'Email and password are required' }
  }

  let data
  try {
    const result = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    data = result.data
    if (result.error) {
      const msg = result.error.message?.toLowerCase() ?? ''
      if (isNetworkish(result.error.message)) {
        return { ok: false, error: 'Network error. Check your connection and try again.' }
      }
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        return { ok: false, error: 'Invalid email or password' }
      }
      if (msg.includes('email not confirmed')) {
        return { ok: false, error: 'Please confirm your email before signing in' }
      }
      return { ok: false, error: result.error.message || 'Authentication failed' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (isNetworkish(message)) {
      return { ok: false, error: 'Network error. Check your connection and try again.' }
    }
    return { ok: false, error: message || 'Authentication failed' }
  }

  const userId = data.user?.id
  if (!userId) {
    return { ok: false, error: 'User not found' }
  }

  const profile = await fetchProfileForUser(userId)
  if (!profile.ok) {
    await supabase.auth.signOut()
    return { ok: false, error: profile.error }
  }

  clearLegacyAuthSession()
  setActiveAuthProfile(profile.session)
  return { ok: true, session: profile.session }
}

export async function signOutSupabase(): Promise<void> {
  setActiveAuthProfile(null)
  clearLegacyAuthSession()
  await supabase.auth.signOut()
}

export async function updateSupabasePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters' }
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (reauthError) {
    return { ok: false, error: 'Current password is incorrect' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    return { ok: false, error: error.message || 'Failed to update password' }
  }
  return { ok: true }
}

/** @deprecated Prefer AuthContext profile — registry lookup for local Admin tools */
export function legacyLocalProfile(username: string | null | undefined) {
  if (!username) return null
  return getUserAccount(username)
}
