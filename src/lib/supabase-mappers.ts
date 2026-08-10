import type {
  AppNotification,
  AppSettings,
  AppState,
  DailyProgress,
  DailyTargets,
  DayStatus,
  HistoryEntry,
  Platform,
  PlatformSection,
  RevenueEntry,
  RevenuePlatform,
  ThemeMode,
  TimelineBlock,
  TimelineSettings,
  TimelineStatus,
} from '@/types'
import {
  createDailyProgress,
  createDefaultSettings,
  DEFAULT_TARGETS,
  DEFAULT_TIMELINE,
} from '@/lib/defaults'

export const PLATFORM_ORDER: Platform[] = [
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}

export function ensureUuid(id: string): string {
  return isUuid(id) ? id : crypto.randomUUID()
}

export function toDateString(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 10)
}

export function toTimeHm(value: string | null | undefined, fallback = '09:00'): string {
  if (!value) return fallback
  // Postgres time may arrive as HH:MM:SS or HH:MM
  const m = String(value).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return fallback
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

export function epochFromTimestamptz(value: string | null | undefined): number {
  if (!value) return 0
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : 0
}

export interface UserSettingsRow {
  user_id: string
  theme: string
  notifications_enabled: boolean
  reminder_times: Record<string, string> | null
  enabled_platforms: string[] | null
  revenue_categories: string[] | null
  streak: number
  last_completed_date: string | null
  last_streak_at: string | null
  longest_streak: number
  updated_at?: string
}

export interface PlatformStrategyRow {
  id?: string
  user_id: string
  platform: string
  enabled: boolean
  estimated_minutes: number
  sort_order: number
  targets: Record<string, number> | null
  updated_at?: string
}

export interface DailySessionRow {
  id: string
  user_id: string
  date: string
  day_status: DayStatus
  day_started_at: string | null
  day_finished_at: string | null
  daily_notes: string
  confetti_shown: boolean
  total_time_worked_seconds: number
  updated_at?: string
}

export interface SessionPlatformRow {
  id: string
  session_id: string
  platform: string
  name: string
  estimated_minutes: number
  purpose: string | null
  notes: string
  completed: boolean
}

export interface ChecklistRow {
  session_platform_id: string
  item_key: string
  label: string
  completed: boolean
}

export interface CounterRow {
  session_platform_id: string
  counter_key: string
  label: string
  target: number
  completed: number
  notes: string | null
}

export interface TimelineRow {
  session_id: string
  platform: string
  name: string
  start_time: string
  estimated_minutes: number
  status: TimelineStatus
  elapsed_seconds: number
  started_at: string | null
  completed_at: string | null
}

export interface HistoryRow {
  date: string
  completion_percent: number
  tasks_completed: number
  tasks_total: number
  connections: number
  follow_ups: number
  facebook_metrics: { comments?: number; dms?: number } | null
  upwork_metrics: { jobsReviewed?: number; proposalsSent?: number } | null
  revenue_total: number | string
  notes: string
  time_worked_seconds: number
  productivity_score: number
  day_started_at: string | null
  day_finished_at: string | null
  day_status: DayStatus | null
  updated_at?: string
}

export interface RevenueRow {
  id: string
  date: string
  platform: string
  amount: number | string
  client: string
  notes: string
  created_at: string
  updated_at?: string
}

export interface NotificationRow {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  type: AppNotification['type']
  created_at: string
}

export function targetsFromStrategies(
  strategies: PlatformStrategyRow[],
  base: DailyTargets = DEFAULT_TARGETS
): DailyTargets {
  const next: DailyTargets = structuredClone(base)
  const asMap = next as unknown as Record<string, Record<string, number>>
  for (const row of strategies) {
    if (!(row.platform in asMap)) continue
    const bucket = { ...asMap[row.platform] }
    const targets = row.targets ?? {}
    for (const [key, value] of Object.entries(targets)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        bucket[key] = value
      }
    }
    asMap[row.platform] = bucket
  }
  return next
}

export function timelineFromStrategies(
  strategies: PlatformStrategyRow[],
  reminderTimes: Record<Platform, string>
): TimelineSettings {
  const enabled = [...strategies]
    .filter((s) => s.enabled)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (enabled.length === 0) {
    return structuredClone(DEFAULT_TIMELINE)
  }

  return {
    blocks: enabled.map((s) => {
      const fallback = DEFAULT_TIMELINE.blocks.find((b) => b.id === s.platform)
      const platform = s.platform as Platform
      return {
        id: platform,
        name: fallback?.name ?? s.platform,
        startTime: reminderTimes[platform] ?? fallback?.startTime ?? '09:00',
        estimatedMinutes: s.estimated_minutes || fallback?.estimatedMinutes || 30,
      }
    }),
  }
}

export function settingsFromCloud(
  row: UserSettingsRow | null,
  strategies: PlatformStrategyRow[]
): AppSettings {
  const defaults = createDefaultSettings()
  if (!row && strategies.length === 0) return defaults

  const reminderTimes = {
    ...defaults.reminderTimes,
    ...((row?.reminder_times as Partial<Record<Platform, string>>) ?? {}),
  } as Record<Platform, string>

  const dailyTargets = targetsFromStrategies(strategies, defaults.dailyTargets)
  const timeline = timelineFromStrategies(strategies, reminderTimes)

  const enabledFromSettings = Array.isArray(row?.enabled_platforms)
    ? (row!.enabled_platforms as Platform[])
    : null
  const enabledFromStrategies =
    strategies.length > 0
      ? strategies.filter((s) => s.enabled).map((s) => s.platform as Platform)
      : null

  return {
    theme: (row?.theme as ThemeMode) || defaults.theme,
    notificationsEnabled: row?.notifications_enabled ?? defaults.notificationsEnabled,
    reminderTimes,
    dailyTargets,
    timeline,
    enabledPlatforms: enabledFromSettings?.length
      ? enabledFromSettings
      : enabledFromStrategies ?? defaults.enabledPlatforms,
    revenueCategories: (row?.revenue_categories as RevenuePlatform[])?.length
      ? (row!.revenue_categories as RevenuePlatform[])
      : defaults.revenueCategories,
    streak: row?.streak ?? 0,
    lastCompletedDate: toDateString(row?.last_completed_date),
    lastStreakAt: row?.last_streak_at ?? null,
    longestStreak: row?.longest_streak ?? 0,
  }
}

export function historyFromRow(row: HistoryRow): HistoryEntry {
  const fb = row.facebook_metrics ?? {}
  const up = row.upwork_metrics ?? {}
  return {
    date: toDateString(row.date) ?? row.date,
    completionPercent: row.completion_percent,
    tasksCompleted: row.tasks_completed,
    tasksTotal: row.tasks_total,
    connections: row.connections,
    followUps: row.follow_ups,
    facebookComments: fb.comments ?? 0,
    facebookDms: fb.dms ?? 0,
    jobsReviewed: up.jobsReviewed ?? 0,
    proposalsSent: up.proposalsSent ?? 0,
    revenue: Number(row.revenue_total) || 0,
    notes: row.notes ?? '',
    totalTimeWorkedSeconds: row.time_worked_seconds ?? 0,
    productivityScore: row.productivity_score ?? 0,
    dayStartedAt: row.day_started_at,
    dayFinishedAt: row.day_finished_at,
    dayStatus: row.day_status ?? undefined,
  }
}

export function historyToRow(userId: string, entry: HistoryEntry) {
  return {
    user_id: userId,
    date: entry.date,
    completion_percent: entry.completionPercent,
    tasks_completed: entry.tasksCompleted,
    tasks_total: entry.tasksTotal,
    connections: entry.connections,
    follow_ups: entry.followUps,
    facebook_metrics: {
      comments: entry.facebookComments,
      dms: entry.facebookDms,
    },
    upwork_metrics: {
      jobsReviewed: entry.jobsReviewed,
      proposalsSent: entry.proposalsSent,
    },
    revenue_total: entry.revenue,
    notes: entry.notes ?? '',
    time_worked_seconds: entry.totalTimeWorkedSeconds ?? 0,
    productivity_score: entry.productivityScore ?? 0,
    day_started_at: entry.dayStartedAt ?? null,
    day_finished_at: entry.dayFinishedAt ?? null,
    day_status: entry.dayStatus ?? null,
  }
}

export function revenueFromRow(row: RevenueRow): RevenueEntry {
  return {
    id: row.id,
    date: toDateString(row.date) ?? row.date,
    platform: row.platform as RevenuePlatform,
    amount: Number(row.amount) || 0,
    client: row.client ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
  }
}

export function notificationFromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? '',
    time: row.time ?? '',
    read: !!row.read,
    type: row.type,
    createdAt: row.created_at,
  }
}

export function buildDailyProgressFromCloud(args: {
  session: DailySessionRow | null
  platforms: SessionPlatformRow[]
  checklist: ChecklistRow[]
  counters: CounterRow[]
  timeline: TimelineRow[]
  settings: AppSettings
}): DailyProgress {
  const { session, platforms, checklist, counters, timeline, settings } = args
  if (!session) {
    return createDailyProgress(settings.dailyTargets, settings.timeline)
  }

  const base = createDailyProgress(
    settings.dailyTargets,
    settings.timeline,
    toDateString(session.date) ?? session.date
  )

  const platformMap = { ...base.platforms } as Record<Platform, PlatformSection>
  for (const row of platforms) {
    const platform = row.platform as Platform
    const existing = platformMap[platform] ?? base.platforms[platform]
    if (!existing) continue
    const items = checklist
      .filter((c) => c.session_platform_id === row.id)
      .map((c) => ({
        id: c.item_key,
        label: c.label,
        completed: c.completed,
      }))
    const counterItems = counters
      .filter((c) => c.session_platform_id === row.id)
      .map((c) => ({
        id: c.counter_key,
        label: c.label,
        target: c.target,
        completed: c.completed,
        notes: c.notes ?? undefined,
      }))

    platformMap[platform] = {
      ...existing,
      id: platform,
      name: row.name || existing.name,
      estimatedMinutes: row.estimated_minutes ?? existing.estimatedMinutes,
      purpose: row.purpose ?? existing.purpose,
      notes: row.notes ?? '',
      completed: row.completed,
      checklist: items.length > 0 ? items : existing.checklist,
      counters: counterItems.length > 0 ? counterItems : existing.counters,
    }
  }

  const timelineBlocks: TimelineBlock[] =
    timeline.length > 0
      ? timeline.map((t) => ({
          id: t.platform as Platform,
          name: t.name,
          startTime: toTimeHm(t.start_time),
          estimatedMinutes: t.estimated_minutes,
          status: t.status,
          elapsedSeconds: t.elapsed_seconds,
          startedAt: t.started_at,
          completedAt: t.completed_at,
        }))
      : base.timeline

  return {
    date: toDateString(session.date) ?? session.date,
    dayStatus: session.day_status,
    dayStartedAt: session.day_started_at,
    dayFinishedAt: session.day_finished_at,
    platforms: platformMap,
    timeline: timelineBlocks,
    dailyNotes: session.daily_notes ?? '',
    confettiShown: session.confetti_shown,
    totalTimeWorkedSeconds: session.total_time_worked_seconds ?? 0,
  }
}

export function strategiesFromSettings(userId: string, settings: AppSettings): PlatformStrategyRow[] {
  const enabled = new Set(
    settings.enabledPlatforms?.length
      ? settings.enabledPlatforms
      : PLATFORM_ORDER
  )
  const targetsMap = settings.dailyTargets as unknown as Record<string, Record<string, number>>

  return PLATFORM_ORDER.map((platform, index) => {
    const block = settings.timeline.blocks.find((b) => b.id === platform)
    const bucket = targetsMap[platform] ?? {}
    return {
      user_id: userId,
      platform,
      enabled: enabled.has(platform),
      estimated_minutes: block?.estimatedMinutes ?? DEFAULT_TIMELINE.blocks.find((b) => b.id === platform)?.estimatedMinutes ?? 30,
      sort_order: index,
      targets: { ...bucket },
    }
  })
}

/** True when local state looks like real user work (not a blank default). */
export function localHasMeaningfulData(state: {
  history: HistoryEntry[]
  revenue: RevenueEntry[]
  dailyProgress: DailyProgress
  notifications: AppNotification[]
}): boolean {
  if (state.history.length > 0) return true
  if (state.revenue.length > 0) return true
  if (state.notifications.length > 0) return true
  if (state.dailyProgress.dayStatus !== 'not_started') return true
  if (state.dailyProgress.dailyNotes?.trim()) return true
  if (state.dailyProgress.totalTimeWorkedSeconds > 0) return true
  for (const section of Object.values(state.dailyProgress.platforms)) {
    if (section.completed) return true
    if (section.notes?.trim()) return true
    if (section.checklist.some((c) => c.completed)) return true
    if (section.counters.some((c) => c.completed > 0)) return true
  }
  if (state.dailyProgress.timeline.some((t) => t.status !== 'pending' || t.elapsedSeconds > 0)) {
    return true
  }
  return false
}

/** Higher = more real progress (used to avoid blank devices wiping cloud). */
export function progressScore(state: {
  history: HistoryEntry[]
  revenue: RevenueEntry[]
  dailyProgress: DailyProgress
}): number {
  let score = 0
  score += state.history.length * 100
  score += state.revenue.length * 50
  if (state.dailyProgress.dayStatus === 'in_progress') score += 5
  if (state.dailyProgress.dayStatus === 'paused') score += 5
  if (state.dailyProgress.dayStatus === 'finished') score += 20
  score += Math.min(state.dailyProgress.totalTimeWorkedSeconds, 5000)
  for (const section of Object.values(state.dailyProgress.platforms)) {
    score += section.counters.reduce((sum, c) => sum + c.completed, 0) * 3
    score += section.checklist.filter((c) => c.completed).length * 2
    if (section.notes?.trim()) score += 1
  }
  return score
}

const DAY_STATUS_RANK: Record<string, number> = {
  not_started: 0,
  in_progress: 1,
  paused: 1,
  finished: 2,
}

/**
 * Merge two AppStates for the same account, keeping the maximum progress
 * so a blank device / empty cloud pull cannot wipe real outreach work.
 */
export function mergeStatesByMaxProgress(a: AppState, b: AppState): AppState {
  const scoreA = progressScore(a)
  const scoreB = progressScore(b)
  const primary = scoreA >= scoreB ? a : b
  const secondary = scoreA >= scoreB ? b : a

  // Prefer same-date daily progress with max counters; otherwise keep primary day
  // and archive secondary day into history if it has work.
  let dailyProgress = primary.dailyProgress
  let history = [...(primary.history ?? [])]

  if (a.dailyProgress.date === b.dailyProgress.date) {
    dailyProgress = mergeDailyProgressMax(a.dailyProgress, b.dailyProgress)
  } else {
    const other = secondary.dailyProgress
    if (localHasMeaningfulData({ ...secondary, dailyProgress: other, history: [], revenue: [], notifications: [] })) {
      const exists = history.some((h) => h.date === other.date)
      if (!exists) {
        const tasksCompleted = (Object.values(other.platforms) as PlatformSection[]).reduce((sum, p) => {
          return (
            sum +
            p.checklist.filter((c) => c.completed).length +
            p.counters.reduce((s, c) => s + Math.min(c.completed, c.target || c.completed), 0)
          )
        }, 0)
        history = [
          {
            date: other.date,
            completionPercent: 0,
            tasksCompleted,
            tasksTotal: 0,
            connections: other.platforms.linkedin_saad?.counters.find((c) => c.id === 'connections')?.completed ?? 0,
            followUps: other.platforms.linkedin_saad?.counters.find((c) => c.id === 'followups')?.completed ?? 0,
            facebookComments: other.platforms.facebook?.counters.find((c) => c.id === 'comments')?.completed ?? 0,
            facebookDms: other.platforms.facebook?.counters.find((c) => c.id === 'dms')?.completed ?? 0,
            jobsReviewed: other.platforms.upwork?.counters.find((c) => c.id === 'jobs_reviewed')?.completed ?? 0,
            proposalsSent: other.platforms.upwork?.counters.find((c) => c.id === 'proposals')?.completed ?? 0,
            revenue: 0,
            notes: other.dailyNotes ?? '',
            totalTimeWorkedSeconds: other.totalTimeWorkedSeconds ?? 0,
            productivityScore: 0,
            dayStartedAt: other.dayStartedAt,
            dayFinishedAt: other.dayFinishedAt,
            dayStatus: other.dayStatus,
          },
          ...history,
        ]
      }
    }
  }

  // History: keep higher-completion entry per date
  const historyMap = new Map<string, HistoryEntry>()
  for (const entry of [...(a.history ?? []), ...(b.history ?? []), ...history]) {
    const prev = historyMap.get(entry.date)
    if (!prev || (entry.completionPercent ?? 0) >= (prev.completionPercent ?? 0)) {
      if (
        !prev ||
        (entry.tasksCompleted ?? 0) + (entry.connections ?? 0) + (entry.followUps ?? 0) >=
          (prev.tasksCompleted ?? 0) + (prev.connections ?? 0) + (prev.followUps ?? 0)
      ) {
        historyMap.set(entry.date, entry)
      }
    }
  }

  // Revenue / notifications: union by id
  const revenueMap = new Map<string, (typeof a.revenue)[0]>()
  for (const r of [...(a.revenue ?? []), ...(b.revenue ?? [])]) revenueMap.set(r.id, r)
  const notifMap = new Map<string, (typeof a.notifications)[0]>()
  for (const n of [...(a.notifications ?? []), ...(b.notifications ?? [])]) notifMap.set(n.id, n)

  return {
    ...primary,
    settings: primary.settings,
    dailyProgress,
    history: [...historyMap.values()].sort((x, y) => (x.date < y.date ? 1 : -1)),
    revenue: [...revenueMap.values()],
    notifications: [...notifMap.values()],
    updatedAt: Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0, Date.now()),
    version: 1,
  }
}

export function mergeDailyProgressMax(a: DailyProgress, b: DailyProgress): DailyProgress {
  const platforms = { ...a.platforms }
  for (const id of PLATFORM_ORDER) {
    const left = a.platforms[id]
    const right = b.platforms[id]
    if (!left && !right) continue
    if (!left) {
      platforms[id] = right
      continue
    }
    if (!right) {
      platforms[id] = left
      continue
    }
    const counterMap = new Map<string, (typeof left.counters)[0]>()
    for (const c of [...left.counters, ...right.counters]) {
      const prev = counterMap.get(c.id)
      if (!prev) {
        counterMap.set(c.id, { ...c })
        continue
      }
      counterMap.set(c.id, {
        ...prev,
        label: prev.label || c.label,
        completed: Math.max(prev.completed, c.completed),
        target: Math.max(prev.target, c.target),
        notes: (prev.notes?.length ?? 0) >= (c.notes?.length ?? 0) ? prev.notes : c.notes,
      })
    }
    const checkMap = new Map<string, (typeof left.checklist)[0]>()
    for (const item of [...left.checklist, ...right.checklist]) {
      const prev = checkMap.get(item.id)
      checkMap.set(item.id, {
        ...item,
        completed: !!(prev?.completed || item.completed),
        label: item.label || prev?.label || item.id,
      })
    }
    platforms[id] = {
      ...left,
      name: left.name || right.name,
      notes: (left.notes?.length ?? 0) >= (right.notes?.length ?? 0) ? left.notes : right.notes,
      completed: left.completed || right.completed,
      counters: [...counterMap.values()],
      checklist: [...checkMap.values()],
    }
  }

  const status =
    (DAY_STATUS_RANK[a.dayStatus] ?? 0) >= (DAY_STATUS_RANK[b.dayStatus] ?? 0)
      ? a.dayStatus
      : b.dayStatus

  const timeline =
    a.timeline.reduce((s, t) => s + t.elapsedSeconds, 0) >=
    b.timeline.reduce((s, t) => s + t.elapsedSeconds, 0)
      ? a.timeline
      : b.timeline

  return {
    date: a.date,
    dayStatus: status,
    dayStartedAt: a.dayStartedAt || b.dayStartedAt,
    dayFinishedAt: a.dayFinishedAt || b.dayFinishedAt,
    platforms,
    timeline,
    dailyNotes:
      (a.dailyNotes?.length ?? 0) >= (b.dailyNotes?.length ?? 0) ? a.dailyNotes : b.dailyNotes,
    confettiShown: a.confettiShown || b.confettiShown,
    totalTimeWorkedSeconds: Math.max(a.totalTimeWorkedSeconds ?? 0, b.totalTimeWorkedSeconds ?? 0),
  }
}
