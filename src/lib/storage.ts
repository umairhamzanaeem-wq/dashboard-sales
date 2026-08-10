import type { AppState, DailyProgress, Platform, TimelineBlock } from '@/types'
import {
  createDefaultState,
  createPlatformSections,
  DEFAULT_TARGETS,
  DEFAULT_TIMELINE,
} from './defaults'
import { normalizeTheme } from './theme'

export function storageKeyForUser(username?: string | null): string {
  const user = username?.trim().toLowerCase()
  return user ? `bd-dashboard-v1:${user}` : 'bd-dashboard-v1'
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
    const key = storageKeyForUser(username)
    localStorage.setItem(key, JSON.stringify(stamped))

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
