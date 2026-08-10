import type { AppState, DailyProgress, Platform, TimelineBlock } from '@/types'
import {
  createDefaultState,
  createPlatformSections,
  DEFAULT_TARGETS,
  DEFAULT_TIMELINE,
} from './defaults'
import { normalizeTheme } from './theme'
import { todayKey } from './utils'
import { localHasMeaningfulData, mergeStatesByMaxProgress, progressScore } from './supabase-mappers'

const UMAIR_STREAK_FIX_KEY = 'bd-umair-streak-4-v1'
const SNAPSHOT_PREFIX = 'bd-dashboard-snap-v1:'

export function storageKeyForUser(username?: string | null): string {
  const user = username?.trim().toLowerCase()
  return user ? `bd-dashboard-v1:${user}` : 'bd-dashboard-v1'
}

function snapshotKeyForUser(username?: string | null): string {
  const user = username?.trim().toLowerCase() || 'anon'
  return `${SNAPSHOT_PREFIX}${user}`
}

const FACEBOOK_FRIEND_REQUEST_TASK = {
  id: 'c-friend-requests',
  label: 'Find & friend request leads (med spa, dental, etc.)',
  completed: false,
}

const PLATFORM_ORDER: Platform[] = [
  'fiverr',
  'linkedin_saad',
  'linkedin_umair',
  'facebook',
  'threads',
  'x',
  'whatsapp',
  'instagram',
  'upwork',
  'review',
]

function insertMissingTimelineBlocks(timeline: TimelineBlock[]): TimelineBlock[] {
  const existing = new Set(timeline.map((t) => t.id))
  const missing = DEFAULT_TIMELINE.blocks.filter((b) => !existing.has(b.id))
  if (missing.length === 0) return timeline

  const next = [...timeline]
  for (const block of missing) {
    const entry: TimelineBlock = {
      id: block.id,
      name: block.name,
      startTime: block.startTime,
      estimatedMinutes: block.estimatedMinutes,
      status: 'pending',
      elapsedSeconds: 0,
      startedAt: null,
      completedAt: null,
    }
    const orderIdx = PLATFORM_ORDER.indexOf(block.id)
    let insertAt = next.length
    for (let i = 0; i < next.length; i++) {
      const curOrder = PLATFORM_ORDER.indexOf(next[i].id)
      if (curOrder > orderIdx) {
        insertAt = i
        break
      }
    }
    next.splice(insertAt, 0, entry)
  }
  return next
}

function normalizeProgress(
  progress: DailyProgress,
  targets = DEFAULT_TARGETS
): DailyProgress {
  const mergedTargets = {
    ...DEFAULT_TARGETS,
    ...targets,
    threads: { ...DEFAULT_TARGETS.threads, ...targets.threads },
    x: { ...DEFAULT_TARGETS.x, ...targets.x },
    whatsapp: { ...DEFAULT_TARGETS.whatsapp, ...targets.whatsapp },
    instagram: { ...DEFAULT_TARGETS.instagram, ...targets.instagram },
  }
  const defaults = createPlatformSections(mergedTargets)
  const platforms = { ...progress.platforms }

  for (const id of PLATFORM_ORDER) {
    if (!platforms[id]) {
      platforms[id] = defaults[id]
    }
  }

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
    timeline: insertMissingTimelineBlocks(progress.timeline ?? []),
    dayStatus: progress.dayStatus ?? 'not_started',
    dayStartedAt: progress.dayStartedAt ?? null,
    dayFinishedAt: progress.dayFinishedAt ?? null,
  }
}

export function normalizeState(parsed: AppState): AppState {
  const defaults = createDefaultState()
  const settings = {
    ...defaults.settings,
    ...parsed.settings,
    theme: normalizeTheme(parsed.settings?.theme),
    dailyTargets: {
      ...DEFAULT_TARGETS,
      ...parsed.settings?.dailyTargets,
      threads: {
        ...DEFAULT_TARGETS.threads,
        ...parsed.settings?.dailyTargets?.threads,
      },
      x: {
        ...DEFAULT_TARGETS.x,
        ...parsed.settings?.dailyTargets?.x,
      },
      whatsapp: {
        ...DEFAULT_TARGETS.whatsapp,
        ...parsed.settings?.dailyTargets?.whatsapp,
      },
      instagram: {
        ...DEFAULT_TARGETS.instagram,
        ...parsed.settings?.dailyTargets?.instagram,
      },
    },
    reminderTimes: {
      ...defaults.settings.reminderTimes,
      ...parsed.settings?.reminderTimes,
    },
    enabledPlatforms: parsed.settings?.enabledPlatforms ?? defaults.settings.enabledPlatforms,
    timeline: {
      blocks: (() => {
        const existing = parsed.settings?.timeline?.blocks ?? []
        const ids = new Set(existing.map((b) => b.id))
        const enabled = parsed.settings?.enabledPlatforms
        const missing = DEFAULT_TIMELINE.blocks.filter((b) => {
          if (enabled && enabled.length > 0 && !enabled.includes(b.id)) return false
          return !ids.has(b.id)
        })
        if (missing.length === 0) return existing
        const next = [...existing]
        for (const block of missing) {
          const orderIdx = PLATFORM_ORDER.indexOf(block.id)
          let insertAt = next.length
          for (let i = 0; i < next.length; i++) {
            if (PLATFORM_ORDER.indexOf(next[i].id) > orderIdx) {
              insertAt = i
              break
            }
          }
          next.splice(insertAt, 0, { ...block })
        }
        return enabled && enabled.length > 0
          ? next.filter((b) => enabled.includes(b.id))
          : next
      })(),
    },
  }

  return {
    ...parsed,
    settings,
    dailyProgress: normalizeProgress(parsed.dailyProgress, settings.dailyTargets),
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

    let state = raw
      ? (() => {
          const parsed = JSON.parse(raw) as AppState
          if (!parsed.version || !parsed.settings || !parsed.dailyProgress) {
            return createDefaultState()
          }
          return normalizeState(parsed)
        })()
      : createDefaultState()

    // One-time: Umair worked 4 days — set streak to 4
    const user = username?.trim().toLowerCase()
    if (user === 'umair' && !localStorage.getItem(UMAIR_STREAK_FIX_KEY)) {
      const today = todayKey()
      state = {
        ...state,
        settings: {
          ...state.settings,
          streak: Math.max(state.settings.streak ?? 0, 4),
          longestStreak: Math.max(state.settings.longestStreak ?? 0, 4),
          lastCompletedDate: today,
          lastStreakAt: new Date().toISOString(),
        },
      }
      localStorage.setItem(UMAIR_STREAK_FIX_KEY, '1')
      try {
        localStorage.setItem(key, JSON.stringify({ ...state, updatedAt: Date.now() }))
      } catch {
        /* ignore */
      }
    }

    return state
  } catch {
    return createDefaultState()
  }
}

export function saveState(state: AppState, username?: string | null): void {
  try {
    const stamped = { ...state, updatedAt: Date.now() }
    const key = storageKeyForUser(username)
    localStorage.setItem(key, JSON.stringify(stamped))
    pushLocalSnapshot(stamped, username)

    // Notify Chrome extension content script (if installed)
    window.dispatchEvent(
      new CustomEvent('bd-dashboard-save', {
        detail: { key, username: username ?? null, state: stamped },
      })
    )
    window.postMessage(
      { source: 'bd-dashboard', type: 'BD_STATE_SAVED', key, username: username ?? null, state: stamped },
      '*'
    )
  } catch (e) {
    console.error('Failed to save state', e)
  }
}

/** Keep last N meaningful snapshots so a bad sync can be recovered. */
export function pushLocalSnapshot(state: AppState, username?: string | null): void {
  try {
    if (!localHasMeaningfulData(state)) return
    const key = snapshotKeyForUser(username)
    const raw = localStorage.getItem(key)
    const list: AppState[] = raw ? (JSON.parse(raw) as AppState[]) : []
    const next = [state, ...list.filter((s) => (s.updatedAt ?? 0) !== (state.updatedAt ?? 0))].slice(0, 12)
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

/** Best local recovery candidate: current key, legacy keys, and snapshots. */
export function recoverBestLocalState(username?: string | null): AppState | null {
  const candidates: AppState[] = []

  const tryParse = (raw: string | null) => {
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as AppState
      if (parsed?.settings && parsed?.dailyProgress) {
        candidates.push(normalizeState(parsed))
      }
    } catch {
      /* ignore */
    }
  }

  tryParse(localStorage.getItem(storageKeyForUser(username)))
  tryParse(localStorage.getItem('bd-dashboard-v1'))
  // Legacy usernames before Supabase email-derived username
  for (const legacy of ['umair', 'admin', 'saad']) {
    tryParse(localStorage.getItem(storageKeyForUser(legacy)))
  }

  try {
    const snapRaw = localStorage.getItem(snapshotKeyForUser(username))
    if (snapRaw) {
      const list = JSON.parse(snapRaw) as AppState[]
      for (const item of list) {
        if (item?.settings && item?.dailyProgress) candidates.push(normalizeState(item))
      }
    }
    // Also scan other snapshot keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(SNAPSHOT_PREFIX)) continue
      const list = JSON.parse(localStorage.getItem(k) || '[]') as AppState[]
      for (const item of list) {
        if (item?.settings && item?.dailyProgress) candidates.push(normalizeState(item))
      }
    }
  } catch {
    /* ignore */
  }

  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) =>
    progressScore(cur) > progressScore(best) ? cur : best
  )
}

/** Merge current with any recoverable local copies. */
export function mergeWithLocalRecovery(state: AppState, username?: string | null): AppState {
  const recovered = recoverBestLocalState(username)
  if (!recovered) return state
  if (progressScore(recovered) <= progressScore(state)) return state
  return mergeStatesByMaxProgress(state, recovered)
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
