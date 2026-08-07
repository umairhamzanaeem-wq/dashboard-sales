import type { AppState, DailyProgress } from '@/types'
import { createDefaultState } from './defaults'

export function storageKeyForUser(username?: string | null): string {
  const user = username?.trim().toLowerCase()
  return user ? `bd-dashboard-v1:${user}` : 'bd-dashboard-v1'
}

const FACEBOOK_FRIEND_REQUEST_TASK = {
  id: 'c-friend-requests',
  label: 'Find & friend request leads (med spa, dental, etc.)',
  completed: false,
}

function normalizeProgress(progress: DailyProgress): DailyProgress {
  const platforms = { ...progress.platforms }

  // Append new Facebook task if missing — never wipe existing checklist data
  if (platforms.facebook) {
    const list = platforms.facebook.checklist ?? []
    const exists = list.some(
      (item) =>
        item.id === FACEBOOK_FRIEND_REQUEST_TASK.id ||
        item.label.toLowerCase().includes('friend request')
    )
    if (!exists) {
      platforms.facebook = {
        ...platforms.facebook,
        checklist: [...list, { ...FACEBOOK_FRIEND_REQUEST_TASK }],
      }
    }
  }

  return {
    ...progress,
    platforms,
    dayStatus: progress.dayStatus ?? 'not_started',
    dayStartedAt: progress.dayStartedAt ?? null,
    dayFinishedAt: progress.dayFinishedAt ?? null,
  }
}

export function normalizeState(parsed: AppState): AppState {
  return {
    ...parsed,
    dailyProgress: normalizeProgress(parsed.dailyProgress),
    history: parsed.history ?? [],
    revenue: parsed.revenue ?? [],
    notifications: parsed.notifications ?? [],
    updatedAt: parsed.updatedAt ?? Date.now(),
    version: 1,
  }
}

export function loadState(username?: string | null): AppState {
  try {
    const key = storageKeyForUser(username)
    let raw = localStorage.getItem(key)

    // Migrate older shared key once for this user
    if (!raw && username) {
      const legacy = localStorage.getItem('bd-dashboard-v1')
      if (legacy) raw = legacy
    }

    if (!raw) return createDefaultState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.version || !parsed.settings || !parsed.dailyProgress) {
      return createDefaultState()
    }
    return normalizeState(parsed)
  } catch {
    return createDefaultState()
  }
}

export function saveState(state: AppState, username?: string | null): void {
  try {
    const stamped = { ...state, updatedAt: Date.now() }
    localStorage.setItem(storageKeyForUser(username), JSON.stringify(stamped))
  } catch (e) {
    console.error('Failed to save state', e)
  }
}

export function clearState(username?: string | null): void {
  localStorage.removeItem(storageKeyForUser(username))
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function importState(json: string): AppState {
  const parsed = JSON.parse(json) as AppState
  if (!parsed.settings || !parsed.dailyProgress) {
    throw new Error('Invalid backup file')
  }
  const base = createDefaultState()
  return normalizeState({
    ...base,
    ...parsed,
    updatedAt: Date.now(),
  })
}
