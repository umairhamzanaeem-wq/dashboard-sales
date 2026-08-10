import type { AppState } from '@/types'
import { createDefaultState } from '@/lib/defaults'
import { loadState, normalizeState, saveState } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { todayKey } from '@/lib/utils'
import {
  buildDailyProgressFromCloud,
  epochFromTimestamptz,
  historyFromRow,
  historyToRow,
  isUuid,
  localHasMeaningfulData,
  notificationFromRow,
  PLATFORM_ORDER,
  progressScore,
  revenueFromRow,
  settingsFromCloud,
  strategiesFromSettings,
  toDateString,
  type ChecklistRow,
  type CounterRow,
  type DailySessionRow,
  type HistoryRow,
  type NotificationRow,
  type PlatformStrategyRow,
  type RevenueRow,
  type SessionPlatformRow,
  type TimelineRow,
  type UserSettingsRow,
} from '@/lib/supabase-mappers'

export interface CloudLoadResult {
  state: AppState
  cloudUpdatedAt: number
  source: 'cloud' | 'local-seed' | 'default'
}

function maxUpdatedAt(values: Array<string | null | undefined>): number {
  let max = 0
  for (const v of values) {
    max = Math.max(max, epochFromTimestamptz(v))
  }
  return max
}

async function resolveSessionId(
  userId: string,
  sessionDate: string,
  progress: AppState['dailyProgress']
): Promise<string> {
  const payload = {
    user_id: userId,
    date: sessionDate,
    day_status: progress.dayStatus,
    day_started_at: progress.dayStartedAt,
    day_finished_at: progress.dayFinishedAt,
    daily_notes: progress.dailyNotes ?? '',
    confetti_shown: progress.confettiShown,
    total_time_worked_seconds: progress.totalTimeWorkedSeconds ?? 0,
  }

  const upsertRes = await supabase
    .from('daily_sessions')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select('id')
    .maybeSingle()

  if (upsertRes.error) throw new Error(upsertRes.error.message)
  if (upsertRes.data?.id) return upsertRes.data.id as string

  const existing = await supabase
    .from('daily_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('date', sessionDate)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data?.id) return existing.data.id as string

  throw new Error('Failed to create or load daily session id')
}

async function resolvePlatformIds(
  sessionId: string,
  progress: AppState['dailyProgress']
): Promise<Map<string, string>> {
  const platformPayload = PLATFORM_ORDER.map((platform) => {
    const section = progress.platforms[platform]
    return {
      session_id: sessionId,
      platform,
      name: section?.name ?? platform,
      estimated_minutes: section?.estimatedMinutes ?? 0,
      purpose: section?.purpose ?? null,
      notes: section?.notes ?? '',
      completed: section?.completed ?? false,
    }
  })

  const upsertRes = await supabase
    .from('session_platforms')
    .upsert(platformPayload, { onConflict: 'session_id,platform' })
    .select('id, platform')

  if (upsertRes.error) throw new Error(upsertRes.error.message)

  const map = new Map<string, string>()
  for (const row of upsertRes.data ?? []) {
    map.set(row.platform as string, row.id as string)
  }

  if (map.size < PLATFORM_ORDER.length) {
    const fetchRes = await supabase
      .from('session_platforms')
      .select('id, platform')
      .eq('session_id', sessionId)
    if (fetchRes.error) throw new Error(fetchRes.error.message)
    for (const row of fetchRes.data ?? []) {
      map.set(row.platform as string, row.id as string)
    }
  }

  if (map.size === 0) {
    throw new Error('Failed to resolve session platform ids')
  }

  return map
}

/** Lightweight revision check for focus refetch. */
export async function getCloudRevision(userId: string): Promise<number> {
  const today = todayKey()
  const [settingsRes, sessionRes] = await Promise.all([
    supabase.from('user_settings').select('updated_at').eq('user_id', userId).maybeSingle(),
    supabase
      .from('daily_sessions')
      .select('updated_at')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),
  ])
  return maxUpdatedAt([
    settingsRes.data?.updated_at as string | undefined,
    sessionRes.data?.updated_at as string | undefined,
  ])
}

export async function loadAppStateFromCloud(
  userId: string,
  username: string | null
): Promise<CloudLoadResult> {
  const today = todayKey()
  const local = normalizeState(loadState(username))

  const [
    settingsRes,
    strategiesRes,
    sessionRes,
    historyRes,
    revenueRes,
    notificationsRes,
  ] = await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('platform_strategies')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('daily_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('history_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase
      .from('revenue_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  if (settingsRes.error) throw new Error(settingsRes.error.message)
  if (strategiesRes.error) throw new Error(strategiesRes.error.message)
  if (sessionRes.error) throw new Error(sessionRes.error.message)
  if (historyRes.error) throw new Error(historyRes.error.message)
  if (revenueRes.error) throw new Error(revenueRes.error.message)
  if (notificationsRes.error) throw new Error(notificationsRes.error.message)

  const settingsRow = settingsRes.data as UserSettingsRow | null
  const strategies = (strategiesRes.data ?? []) as PlatformStrategyRow[]
  const session = sessionRes.data as DailySessionRow | null
  const historyRows = (historyRes.data ?? []) as HistoryRow[]
  const revenueRows = (revenueRes.data ?? []) as RevenueRow[]
  const notificationRows = (notificationsRes.data ?? []) as NotificationRow[]

  // Strategies alone (written by a blank first save) are not enough to treat cloud as canonical
  const cloudHasProgressData =
    !!session ||
    historyRows.length > 0 ||
    revenueRows.length > 0 ||
    notificationRows.length > 0 ||
    strategies.length > 0

  if (!cloudHasProgressData) {
    if (localHasMeaningfulData(local)) {
      const seeded = { ...local, updatedAt: local.updatedAt ?? Date.now() }
      const saved = await saveAppStateToCloud(userId, seeded)
      const state = saved.ok ? saved.state : seeded
      saveState(state, username)
      console.info('[sync] Seeded cloud from local device data')
      return {
        state,
        cloudUpdatedAt: state.updatedAt ?? Date.now(),
        source: 'local-seed',
      }
    }
    const fresh = createDefaultState()
    return { state: fresh, cloudUpdatedAt: 0, source: 'default' }
  }

  const settings = settingsFromCloud(settingsRow, strategies)

  let platforms: SessionPlatformRow[] = []
  let checklist: ChecklistRow[] = []
  let counters: CounterRow[] = []
  let timeline: TimelineRow[] = []

  if (session?.id) {
    const platformsRes = await supabase
      .from('session_platforms')
      .select('*')
      .eq('session_id', session.id)
    if (platformsRes.error) throw new Error(platformsRes.error.message)
    platforms = (platformsRes.data ?? []) as SessionPlatformRow[]

    const platformIds = platforms.map((p) => p.id)
    if (platformIds.length > 0) {
      const [checklistRes, countersRes] = await Promise.all([
        supabase.from('session_checklist_items').select('*').in('session_platform_id', platformIds),
        supabase.from('session_counters').select('*').in('session_platform_id', platformIds),
      ])
      if (checklistRes.error) throw new Error(checklistRes.error.message)
      if (countersRes.error) throw new Error(countersRes.error.message)
      checklist = (checklistRes.data ?? []) as ChecklistRow[]
      counters = (countersRes.data ?? []) as CounterRow[]
    }

    const timelineRes = await supabase
      .from('session_timeline_blocks')
      .select('*')
      .eq('session_id', session.id)
    if (timelineRes.error) throw new Error(timelineRes.error.message)
    timeline = (timelineRes.data ?? []) as TimelineRow[]
  }

  const dailyProgress = buildDailyProgressFromCloud({
    session,
    platforms,
    checklist,
    counters,
    timeline,
    settings,
  })

  const cloudUpdatedAt = maxUpdatedAt([
    settingsRow?.updated_at,
    session?.updated_at,
    ...historyRows.map((h) => h.updated_at),
    ...revenueRows.map((r) => r.updated_at),
  ])

  let cloudState = normalizeState({
    settings,
    dailyProgress,
    history: historyRows.map(historyFromRow),
    revenue: revenueRows.map(revenueFromRow),
    notifications: notificationRows.map(notificationFromRow),
    version: 1,
    updatedAt: cloudUpdatedAt || Date.now(),
  })

  const localScore = progressScore(local)
  const cloudScore = progressScore(cloudState)

  // Prefer richer local progress so a blank phone/laptop cannot wipe real work
  if (localScore > cloudScore && localHasMeaningfulData(local)) {
    const seeded = {
      ...local,
      updatedAt: Math.max(local.updatedAt ?? 0, cloudUpdatedAt, Date.now()),
    }
    const saved = await saveAppStateToCloud(userId, seeded)
    const state = saved.ok ? saved.state : seeded
    saveState(state, username)
    console.info('[sync] Local progress ahead of cloud — uploaded local', {
      localScore,
      cloudScore,
    })
    return {
      state,
      cloudUpdatedAt: state.updatedAt ?? Date.now(),
      source: 'local-seed',
    }
  }

  saveState(cloudState, username)
  console.info('[sync] Loaded cloud state', { cloudScore, localScore, date: cloudState.dailyProgress.date })
  return {
    state: cloudState,
    cloudUpdatedAt: cloudState.updatedAt ?? cloudUpdatedAt,
    source: 'cloud',
  }
}

export async function saveAppStateToCloud(
  userId: string,
  state: AppState
): Promise<{ ok: true; state: AppState } | { ok: false; error: string }> {
  try {
    let remapped = false
    const revenue = state.revenue.map((r) => {
      if (isUuid(r.id)) return r
      remapped = true
      return { ...r, id: crypto.randomUUID() }
    })
    const notifications = state.notifications.map((n) => {
      if (isUuid(n.id)) return n
      remapped = true
      return { ...n, id: crypto.randomUUID() }
    })
    const nextState: AppState = remapped
      ? { ...state, revenue, notifications, updatedAt: state.updatedAt ?? Date.now() }
      : { ...state, updatedAt: state.updatedAt ?? Date.now() }

    const settings = nextState.settings
    const settingsPayload = {
      user_id: userId,
      theme: settings.theme,
      notifications_enabled: settings.notificationsEnabled,
      reminder_times: settings.reminderTimes,
      enabled_platforms: settings.enabledPlatforms ?? PLATFORM_ORDER,
      revenue_categories: settings.revenueCategories,
      streak: settings.streak,
      last_completed_date: settings.lastCompletedDate,
      last_streak_at: settings.lastStreakAt ?? null,
      longest_streak: settings.longestStreak,
    }

    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert(settingsPayload, { onConflict: 'user_id' })
    if (settingsError) throw new Error(`user_settings: ${settingsError.message}`)

    const strategyRows = strategiesFromSettings(userId, settings)
    const { error: strategyError } = await supabase.from('platform_strategies').upsert(
      strategyRows.map((row) => ({
        user_id: row.user_id,
        platform: row.platform,
        enabled: row.enabled,
        estimated_minutes: row.estimated_minutes,
        sort_order: row.sort_order,
        targets: row.targets ?? {},
      })),
      { onConflict: 'user_id,platform' }
    )
    if (strategyError) throw new Error(`platform_strategies: ${strategyError.message}`)

    const progress = nextState.dailyProgress
    const sessionDate = toDateString(progress.date) ?? todayKey()
    const sessionId = await resolveSessionId(userId, sessionDate, progress)
    const platformIdByKey = await resolvePlatformIds(sessionId, progress)

    const checklistPayload: Array<{
      session_platform_id: string
      item_key: string
      label: string
      completed: boolean
    }> = []
    const counterPayload: Array<{
      session_platform_id: string
      counter_key: string
      label: string
      target: number
      completed: number
      notes: string | null
    }> = []

    for (const platform of PLATFORM_ORDER) {
      const section = progress.platforms[platform]
      const platformId = platformIdByKey.get(platform)
      if (!section || !platformId) continue
      for (const item of section.checklist) {
        checklistPayload.push({
          session_platform_id: platformId,
          item_key: item.id,
          label: item.label,
          completed: item.completed,
        })
      }
      for (const counter of section.counters) {
        counterPayload.push({
          session_platform_id: platformId,
          counter_key: counter.id,
          label: counter.label,
          target: Math.max(0, counter.target),
          completed: Math.max(0, counter.completed),
          notes: counter.notes ?? null,
        })
      }
    }

    if (checklistPayload.length > 0) {
      const { error } = await supabase
        .from('session_checklist_items')
        .upsert(checklistPayload, { onConflict: 'session_platform_id,item_key' })
      if (error) throw new Error(`checklist: ${error.message}`)
    }

    if (counterPayload.length > 0) {
      const { error } = await supabase
        .from('session_counters')
        .upsert(counterPayload, { onConflict: 'session_platform_id,counter_key' })
      if (error) throw new Error(`counters: ${error.message}`)
    }

    const timelinePayload = progress.timeline.map((block) => ({
      session_id: sessionId,
      platform: block.id,
      name: block.name,
      start_time: block.startTime.length === 5 ? `${block.startTime}:00` : block.startTime,
      estimated_minutes: block.estimatedMinutes,
      status: block.status,
      elapsed_seconds: Math.max(0, block.elapsedSeconds),
      started_at: block.startedAt,
      completed_at: block.completedAt,
    }))

    if (timelinePayload.length > 0) {
      const { error } = await supabase
        .from('session_timeline_blocks')
        .upsert(timelinePayload, { onConflict: 'session_id,platform' })
      if (error) throw new Error(`timeline: ${error.message}`)
    }

    if (nextState.history.length > 0) {
      const historyPayload = nextState.history.map((entry) => historyToRow(userId, entry))
      const { error } = await supabase
        .from('history_entries')
        .upsert(historyPayload, { onConflict: 'user_id,date' })
      if (error) throw new Error(`history: ${error.message}`)
    }

    const revenueIds = revenue.map((r) => r.id)
    if (revenue.length > 0) {
      const revenuePayload = revenue.map((r) => ({
        id: r.id,
        user_id: userId,
        date: r.date,
        platform: r.platform,
        amount: r.amount,
        client: r.client ?? '',
        notes: r.notes ?? '',
        created_at: r.createdAt || new Date().toISOString(),
      }))
      const { error } = await supabase.from('revenue_entries').upsert(revenuePayload, {
        onConflict: 'id',
      })
      if (error) throw new Error(`revenue: ${error.message}`)
    }

    const { data: existingRevenue, error: existingRevenueError } = await supabase
      .from('revenue_entries')
      .select('id')
      .eq('user_id', userId)
    if (existingRevenueError) throw new Error(existingRevenueError.message)
    const keepRevenue = new Set(revenueIds)
    const orphanRevenue = (existingRevenue ?? [])
      .map((r) => r.id as string)
      .filter((id) => !keepRevenue.has(id))
    if (orphanRevenue.length > 0) {
      const { error } = await supabase.from('revenue_entries').delete().in('id', orphanRevenue)
      if (error) throw new Error(error.message)
    }

    const notificationIds = notifications.map((n) => n.id)
    if (notifications.length > 0) {
      const notificationPayload = notifications.map((n) => ({
        id: n.id,
        user_id: userId,
        title: n.title,
        body: n.body ?? '',
        time: n.time ?? '',
        read: n.read,
        type: n.type,
        created_at: n.createdAt || new Date().toISOString(),
      }))
      const { error } = await supabase.from('notifications').upsert(notificationPayload, {
        onConflict: 'id',
      })
      if (error) throw new Error(`notifications: ${error.message}`)
    }

    const { data: existingNotifs, error: existingNotifsError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
    if (existingNotifsError) throw new Error(existingNotifsError.message)
    const keepNotifs = new Set(notificationIds)
    const orphanNotifs = (existingNotifs ?? [])
      .map((n) => n.id as string)
      .filter((id) => !keepNotifs.has(id))
    if (orphanNotifs.length > 0) {
      const { error } = await supabase.from('notifications').delete().in('id', orphanNotifs)
      if (error) throw new Error(error.message)
    }

    console.info('[sync] Saved to cloud', {
      date: sessionDate,
      score: progressScore(nextState),
      counters: counterPayload.filter((c) => c.completed > 0).length,
    })
    return { ok: true, state: nextState }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sync] saveAppStateToCloud failed', message)
    return { ok: false, error: message }
  }
}

/** Fetch cloud state only if newer / richer than local. */
export async function refreshAppStateIfNewer(
  userId: string,
  username: string | null,
  localUpdatedAt: number,
  localState?: AppState
): Promise<AppState | null> {
  const revision = await getCloudRevision(userId)
  const local = localState ?? normalizeState(loadState(username))
  const localScore = progressScore(local)

  // Always pull when cloud revision is newer; also pull when local is blank
  // so a second device picks up work from the first.
  if (revision <= localUpdatedAt && localScore > 0) {
    return null
  }

  const loaded = await loadAppStateFromCloud(userId, username)
  if (progressScore(loaded.state) < localScore) return null
  if (
    (loaded.state.updatedAt ?? 0) <= localUpdatedAt &&
    progressScore(loaded.state) <= localScore
  ) {
    return null
  }
  return loaded.state
}
