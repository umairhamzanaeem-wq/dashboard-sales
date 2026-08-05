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

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.version || !parsed.settings || !parsed.dailyProgress) {
      return createDefaultState()
    }
    return {
      ...parsed,
      dailyProgress: normalizeProgress(parsed.dailyProgress),
      history: parsed.history ?? [],
      revenue: parsed.revenue ?? [],
      notifications: parsed.notifications ?? [],
    }
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
  return {
    ...base,
    ...parsed,
    dailyProgress: normalizeProgress(parsed.dailyProgress),
    history: parsed.history ?? [],
    revenue: parsed.revenue ?? [],
    notifications: parsed.notifications ?? [],
    version: 1,
  }
}
