import type { AppState, DailyProgress } from '@/types'
import { STORAGE_KEY, createDefaultState } from './defaults'

function normalizeProgress(progress: DailyProgress): DailyProgress {
  return {
    ...progress,
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
    updatedAt: parsed.updatedAt ?? 0,
    version: 1,
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save state', e)
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
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

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export async function fetchRemoteState(token: string): Promise<{
  state: AppState | null
  status: SyncStatus
  message?: string
}> {
  try {
    const res = await fetch('/api/state', {
      headers: { Authorization: `Basic ${token}` },
    })
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}))
      return { state: null, status: 'offline', message: body.hint || body.error }
    }
    if (res.status === 401) {
      return { state: null, status: 'error', message: 'Unauthorized' }
    }
    if (!res.ok) {
      return { state: null, status: 'error', message: 'Failed to load cloud data' }
    }
    const data = await res.json()
    if (!data) return { state: null, status: 'synced' }
    return { state: normalizeState(data as AppState), status: 'synced' }
  } catch {
    return { state: null, status: 'offline', message: 'Network error — using this device only' }
  }
}

export async function pushRemoteState(token: string, state: AppState): Promise<SyncStatus> {
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
    })
    if (res.status === 503) return 'offline'
    if (!res.ok) return 'error'
    return 'synced'
  } catch {
    return 'offline'
  }
}

/** Prefer the newer state by updatedAt; if equal, prefer remote history length. */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const localTs = local.updatedAt ?? 0
  const remoteTs = remote.updatedAt ?? 0
  if (remoteTs > localTs) return normalizeState(remote)
  if (localTs > remoteTs) return normalizeState(local)
  // Same timestamp — keep whichever has more history
  if ((remote.history?.length ?? 0) > (local.history?.length ?? 0)) {
    return normalizeState(remote)
  }
  return normalizeState(local)
}
