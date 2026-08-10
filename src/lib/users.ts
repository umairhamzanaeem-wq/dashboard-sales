import type { DailyTargets, Platform, TimelineSettings } from '@/types'
import { DEFAULT_TARGETS, DEFAULT_TIMELINE, createDefaultState, createPlatformSections } from '@/lib/defaults'
import { loadState, normalizeState, saveState, storageKeyForUser } from '@/lib/storage'

export const USERS_REGISTRY_KEY = 'bd-users-registry-v1'

export type UserRole = 'admin' | 'user'

/** Per-platform outreach knobs the admin can set */
export interface StrategyFieldDef {
  /** Key on DailyTargets[platform] */
  key: string
  label: string
  defaultValue: number
}

export interface PlatformStrategy {
  id: Platform
  enabled: boolean
  estimatedMinutes: number
  /** Counter targets keyed by DailyTargets field name */
  targets: Record<string, number>
}

export interface OutreachStrategy {
  /** Ordered platform list (drag-and-drop order) */
  platforms: PlatformStrategy[]
}

export interface UserAccount {
  username: string
  password: string
  displayName: string
  role: UserRole
  avatar?: string
  strategy: OutreachStrategy
  createdAt: string
  updatedAt: string
}

export interface UsersRegistry {
  version: number
  users: UserAccount[]
}

export const ALL_STRATEGY_PLATFORMS: Platform[] = [
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

export const PLATFORM_LABELS: Record<Platform, string> = {
  fiverr: 'Fiverr',
  linkedin_saad: 'LinkedIn (Saad)',
  linkedin_umair: 'LinkedIn (Umair)',
  facebook: 'Facebook',
  threads: 'Threads',
  x: 'X Outreach',
  whatsapp: 'WhatsApp Outreach',
  instagram: 'Instagram',
  upwork: 'Upwork',
  review: 'Daily Review',
}

export const STRATEGY_FIELDS: Partial<Record<Platform, StrategyFieldDef[]>> = {
  linkedin_saad: [
    { key: 'connections', label: 'Connections', defaultValue: 30 },
    { key: 'followUps', label: 'Follow-ups', defaultValue: 10 },
    { key: 'comments', label: 'Comments', defaultValue: 5 },
  ],
  linkedin_umair: [
    { key: 'connections', label: 'Connections', defaultValue: 30 },
    { key: 'followUps', label: 'Follow-ups', defaultValue: 10 },
    { key: 'comments', label: 'Comments', defaultValue: 5 },
  ],
  facebook: [
    { key: 'comments', label: 'Comments', defaultValue: 20 },
    { key: 'dms', label: 'DMs', defaultValue: 10 },
    { key: 'posts', label: 'Posts', defaultValue: 1 },
  ],
  threads: [
    { key: 'posts', label: 'Posts', defaultValue: 1 },
    { key: 'dms', label: 'DMs / Replies', defaultValue: 10 },
  ],
  x: [
    { key: 'comments', label: 'Posts Commented', defaultValue: 10 },
    { key: 'outreach', label: 'People Reached Out', defaultValue: 10 },
  ],
  whatsapp: [{ key: 'messages', label: 'Messages Sent', defaultValue: 50 }],
  instagram: [
    { key: 'businesses', label: 'Businesses Found', defaultValue: 15 },
    { key: 'dms', label: 'DMs Sent', defaultValue: 15 },
  ],
  upwork: [
    { key: 'jobsReviewed', label: 'Jobs Reviewed', defaultValue: 30 },
    { key: 'proposals', label: 'Proposals', defaultValue: 5 },
  ],
}

const DEFAULT_MINUTES: Record<Platform, number> = {
  fiverr: 20,
  linkedin_saad: 80,
  linkedin_umair: 80,
  facebook: 60,
  threads: 25,
  x: 30,
  whatsapp: 40,
  instagram: 40,
  upwork: 75,
  review: 45,
}

export function createDefaultStrategy(): OutreachStrategy {
  return {
    platforms: ALL_STRATEGY_PLATFORMS.map((id) => {
      const fields = STRATEGY_FIELDS[id] ?? []
      const targets: Record<string, number> = {}
      for (const f of fields) targets[f.key] = f.defaultValue
      return {
        id,
        enabled: true,
        estimatedMinutes: DEFAULT_MINUTES[id],
        targets,
      }
    }),
  }
}

function seedRegistry(): UsersRegistry {
  const now = new Date().toISOString()
  return {
    version: 1,
    users: [
      {
        username: 'admin',
        password: 'admin',
        displayName: 'Admin',
        role: 'admin',
        strategy: createDefaultStrategy(),
        createdAt: now,
        updatedAt: now,
      },
      {
        username: 'saad',
        password: 'saad',
        displayName: 'Saad',
        role: 'user',
        strategy: createDefaultStrategy(),
        createdAt: now,
        updatedAt: now,
      },
      {
        username: 'umair',
        password: 'umair',
        displayName: 'Umair',
        role: 'user',
        avatar: '/avatars/umair.png',
        strategy: createDefaultStrategy(),
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

function broadcastRegistry(registry: UsersRegistry) {
  try {
    window.dispatchEvent(
      new CustomEvent('bd-users-updated', { detail: { registry } })
    )
    window.postMessage(
      { source: 'bd-dashboard', type: 'BD_USERS_UPDATED', registry },
      '*'
    )
  } catch {
    /* ignore */
  }
}

export function loadUsersRegistry(): UsersRegistry {
  try {
    const raw = localStorage.getItem(USERS_REGISTRY_KEY)
    if (!raw) {
      const seeded = seedRegistry()
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(seeded))
      broadcastRegistry(seeded)
      return seeded
    }
    const parsed = JSON.parse(raw) as UsersRegistry
    if (!parsed?.users?.length) {
      const seeded = seedRegistry()
      saveUsersRegistry(seeded)
      return seeded
    }
    // Ensure admin always exists
    if (!parsed.users.some((u) => u.role === 'admin')) {
      const now = new Date().toISOString()
      parsed.users.unshift({
        username: 'admin',
        password: 'admin',
        displayName: 'Admin',
        role: 'admin',
        strategy: createDefaultStrategy(),
        createdAt: now,
        updatedAt: now,
      })
      saveUsersRegistry(parsed)
    }
    return parsed
  } catch {
    const seeded = seedRegistry()
    saveUsersRegistry(seeded)
    return seeded
  }
}

export function saveUsersRegistry(registry: UsersRegistry): void {
  localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(registry))
  broadcastRegistry(registry)
}

export function listUsers(): UserAccount[] {
  return loadUsersRegistry().users
}

export function getUserAccount(username: string): UserAccount | null {
  const user = username.trim().toLowerCase()
  return loadUsersRegistry().users.find((u) => u.username === user) ?? null
}

export function validateUserCredentials(username: string, password: string): UserAccount | null {
  const account = getUserAccount(username)
  if (!account) return null
  if (account.password !== password) return null
  return account
}

export function createUserAccount(input: {
  username: string
  password: string
  displayName: string
  strategy?: OutreachStrategy
}): { ok: true; user: UserAccount } | { ok: false; error: string } {
  const username = input.username.trim().toLowerCase()
  if (!/^[a-z0-9._-]{2,32}$/.test(username)) {
    return { ok: false, error: 'Username must be 2–32 chars (letters, numbers, . _ -)' }
  }
  if (username === 'admin') {
    return { ok: false, error: 'Username "admin" is reserved' }
  }
  if (!input.password || input.password.length < 3) {
    return { ok: false, error: 'Password must be at least 3 characters' }
  }
  const registry = loadUsersRegistry()
  if (registry.users.some((u) => u.username === username)) {
    return { ok: false, error: 'Username already exists' }
  }
  const now = new Date().toISOString()
  const user: UserAccount = {
    username,
    password: input.password,
    displayName: input.displayName.trim() || username.charAt(0).toUpperCase() + username.slice(1),
    role: 'user',
    strategy: input.strategy ?? createDefaultStrategy(),
    createdAt: now,
    updatedAt: now,
  }
  registry.users.push(user)
  saveUsersRegistry(registry)
  applyStrategyToUserState(username, user.strategy)
  return { ok: true, user }
}

export function updateUserAccount(
  username: string,
  patch: Partial<Pick<UserAccount, 'displayName' | 'password' | 'avatar' | 'strategy'>>
): { ok: true; user: UserAccount } | { ok: false; error: string } {
  const registry = loadUsersRegistry()
  const idx = registry.users.findIndex((u) => u.username === username.trim().toLowerCase())
  if (idx < 0) return { ok: false, error: 'User not found' }
  const current = registry.users[idx]
  if (patch.password !== undefined && patch.password.length < 3) {
    return { ok: false, error: 'Password must be at least 3 characters' }
  }
  const next: UserAccount = {
    ...current,
    displayName: patch.displayName?.trim() || current.displayName,
    password: patch.password ?? current.password,
    avatar: patch.avatar !== undefined ? patch.avatar : current.avatar,
    strategy: patch.strategy ?? current.strategy,
    updatedAt: new Date().toISOString(),
  }
  registry.users[idx] = next
  saveUsersRegistry(registry)
  if (patch.strategy) {
    applyStrategyToUserState(next.username, next.strategy)
  }
  return { ok: true, user: next }
}

export function changeUserPassword(
  username: string,
  currentPassword: string,
  newPassword: string
): { ok: true } | { ok: false; error: string } {
  const account = getUserAccount(username)
  if (!account) return { ok: false, error: 'User not found' }
  if (account.password !== currentPassword) {
    return { ok: false, error: 'Current password is incorrect' }
  }
  if (newPassword.length < 3) {
    return { ok: false, error: 'New password must be at least 3 characters' }
  }
  return updateUserAccount(username, { password: newPassword }).ok
    ? { ok: true }
    : { ok: false, error: 'Failed to update password' }
}

export function deleteUserAccount(username: string): { ok: true } | { ok: false; error: string } {
  const user = username.trim().toLowerCase()
  if (user === 'admin') return { ok: false, error: 'Cannot delete the admin account' }
  const registry = loadUsersRegistry()
  const account = registry.users.find((u) => u.username === user)
  if (!account) return { ok: false, error: 'User not found' }
  if (account.role === 'admin') return { ok: false, error: 'Cannot delete an admin account' }
  registry.users = registry.users.filter((u) => u.username !== user)
  saveUsersRegistry(registry)
  try {
    localStorage.removeItem(storageKeyForUser(user))
  } catch {
    /* ignore */
  }
  return { ok: true }
}

export function strategyToDailyTargets(strategy: OutreachStrategy): DailyTargets {
  const targets: DailyTargets = structuredClone(DEFAULT_TARGETS)
  const asMap = targets as unknown as Record<string, Record<string, number>>
  for (const p of strategy.platforms) {
    if (!p.enabled) continue
    const fields = STRATEGY_FIELDS[p.id]
    if (!fields) continue
    const bucket = { ...asMap[p.id] }
    for (const f of fields) {
      bucket[f.key] = Number(p.targets[f.key] ?? f.defaultValue)
    }
    asMap[p.id] = bucket
  }
  return targets
}

export function strategyToTimeline(strategy: OutreachStrategy): TimelineSettings {
  const enabled = strategy.platforms.filter((p) => p.enabled)
  let cursorMinutes = 21 * 60 // 21:00 base like defaults
  const blocks = enabled.map((p) => {
    const hours = Math.floor(cursorMinutes / 60) % 24
    const mins = cursorMinutes % 60
    const startTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    const estimatedMinutes = Math.max(5, p.estimatedMinutes || DEFAULT_MINUTES[p.id])
    cursorMinutes += estimatedMinutes
    return {
      id: p.id,
      name: PLATFORM_LABELS[p.id],
      startTime,
      estimatedMinutes,
    }
  })
  return { blocks }
}

export function strategyEnabledPlatforms(strategy: OutreachStrategy): Platform[] {
  return strategy.platforms.filter((p) => p.enabled).map((p) => p.id)
}

/** Write strategy into the user's dashboard localStorage state */
export function applyStrategyToUserState(username: string, strategy: OutreachStrategy): void {
  const user = username.trim().toLowerCase()
  const dailyTargets = strategyToDailyTargets(strategy)
  const timeline = strategyToTimeline(strategy)
  const enabledPlatforms = strategyEnabledPlatforms(strategy)
  const reminderTimes = Object.fromEntries(
    ALL_STRATEGY_PLATFORMS.map((id) => {
      const block = timeline.blocks.find((b) => b.id === id)
      return [id, block?.startTime ?? DEFAULT_TIMELINE.blocks.find((b) => b.id === id)?.startTime ?? '09:00']
    })
  ) as Record<Platform, string>

  let state = loadState(user)
  if (!state?.dailyProgress) {
    state = createDefaultState()
  }
  state = normalizeState(state)

  const platforms = createPlatformSections(dailyTargets)
  // Preserve today's completion counts where counter ids match
  const prev = state.dailyProgress.platforms
  for (const id of ALL_STRATEGY_PLATFORMS) {
    if (!prev[id] || !platforms[id]) continue
    platforms[id] = {
      ...platforms[id],
      notes: prev[id].notes,
      completed: prev[id].completed,
      checklist: platforms[id].checklist.map((item, i) => ({
        ...item,
        completed: prev[id].checklist[i]?.completed ?? false,
      })),
      counters: platforms[id].counters.map((c) => {
        const old = prev[id].counters.find((x) => x.id === c.id)
        return old ? { ...c, completed: old.completed } : c
      }),
    }
  }

  state = {
    ...state,
    settings: {
      ...state.settings,
      dailyTargets,
      timeline,
      reminderTimes,
      enabledPlatforms,
    },
    dailyProgress: {
      ...state.dailyProgress,
      platforms,
      timeline: timeline.blocks.map((b) => {
        const existing = state.dailyProgress.timeline.find((t) => t.id === b.id)
        return {
          id: b.id,
          name: b.name,
          startTime: b.startTime,
          estimatedMinutes: b.estimatedMinutes,
          status: existing?.status ?? ('pending' as const),
          elapsedSeconds: existing?.elapsedSeconds ?? 0,
          startedAt: existing?.startedAt ?? null,
          completedAt: existing?.completedAt ?? null,
        }
      }),
    },
  }

  saveState(normalizeState(state), user)
}

export function moveStrategyPlatform(
  strategy: OutreachStrategy,
  fromIndex: number,
  toIndex: number
): OutreachStrategy {
  const platforms = [...strategy.platforms]
  if (fromIndex < 0 || fromIndex >= platforms.length) return strategy
  if (toIndex < 0 || toIndex >= platforms.length) return strategy
  const [item] = platforms.splice(fromIndex, 1)
  platforms.splice(toIndex, 0, item)
  return { platforms }
}
