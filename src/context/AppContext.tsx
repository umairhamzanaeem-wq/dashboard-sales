import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import confetti from 'canvas-confetti'
import type {
  AppNotification,
  AppSettings,
  AppState,
  DailyProgress,
  HistoryEntry,
  Platform,
  RevenueEntry,
  TimelineStatus,
} from '@/types'
import { createDailyProgress, createDefaultState, SCHEDULE_MESSAGES } from '@/lib/defaults'
import { loadState, saveState, clearState, importState, normalizeState } from '@/lib/storage'
import {
  loadAppStateFromCloud,
  refreshAppStateIfNewer,
  saveAppStateToCloud,
} from '@/lib/supabase-app-state'
import { localHasMeaningfulData, progressScore } from '@/lib/supabase-mappers'
import { applyTheme, themeAccent } from '@/lib/theme'
import { useAuth } from '@/context/AuthContext'
import {
  generateId,
  overallProgress,
  productivityScore,
  sectionProgress,
  todayKey,
  currentTimeString,
  sumCounters,
  getMetric,
} from '@/lib/utils'

const STREAK_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Streak counts when the user Starts Day within 24 hours of their previous streak Start Day.
 * Same calendar day only counts once.
 */
function bumpStreakOnStartDay(settings: AppSettings, startedAt = new Date()): AppSettings {
  const today = todayKey()
  if (settings.lastCompletedDate === today) {
    return settings
  }

  const lastAtMs = (() => {
    if (settings.lastStreakAt) {
      const t = Date.parse(settings.lastStreakAt)
      if (Number.isFinite(t)) return t
    }
    // Migrate older saves that only stored a calendar date
    if (settings.lastCompletedDate) {
      const t = Date.parse(`${settings.lastCompletedDate}T12:00:00`)
      if (Number.isFinite(t)) return t
    }
    return null
  })()

  const within24h =
    lastAtMs != null && startedAt.getTime() - lastAtMs <= STREAK_WINDOW_MS && startedAt.getTime() >= lastAtMs

  const streak = within24h && settings.streak > 0 ? settings.streak + 1 : 1

  return {
    ...settings,
    streak,
    lastCompletedDate: today,
    lastStreakAt: startedAt.toISOString(),
    longestStreak: Math.max(settings.longestStreak ?? 0, streak),
  }
}

type Action =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'RESET' }
  | { type: 'IMPORT'; state: AppState }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'TOGGLE_CHECKLIST'; platform: Platform; itemId: string }
  | { type: 'UPDATE_COUNTER'; platform: Platform; counterId: string; delta: number }
  | { type: 'SET_COUNTER'; platform: Platform; counterId: string; value: number }
  | { type: 'SET_NOTES'; platform: Platform; notes: string }
  | { type: 'SET_DAILY_NOTES'; notes: string }
  | { type: 'MARK_PLATFORM_COMPLETE'; platform: Platform; completed: boolean }
  | { type: 'TIMELINE_ACTION'; id: Platform; action: 'start' | 'pause' | 'complete' | 'skip' | 'tick' }
  | { type: 'ADD_REVENUE'; entry: Omit<RevenueEntry, 'id' | 'createdAt'> }
  | { type: 'UPDATE_REVENUE'; id: string; entry: Partial<RevenueEntry> }
  | { type: 'DELETE_REVENUE'; id: string }
  | { type: 'ADD_NOTIFICATION'; notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'> }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'SAVE_DAY_TO_HISTORY' }
  | { type: 'ENSURE_TODAY' }
  | { type: 'START_DAY' }
  | { type: 'PAUSE_DAY' }
  | { type: 'FINISH_DAY' }
  | { type: 'RESUME_DAY' }
  | { type: 'START_NEW_DAY' }
  | { type: 'SET_CONFETTI_SHOWN' }
  | { type: 'UPDATE_STREAK' }

function ensureSectionComplete(progress: DailyProgress, platform: Platform): DailyProgress {
  const section = progress.platforms[platform]
  const { percent } = sectionProgress(section)
  const completed = percent >= 100
  if (section.completed === completed) return progress
  return {
    ...progress,
    platforms: {
      ...progress.platforms,
      [platform]: { ...section, completed },
    },
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
    case 'IMPORT':
      return action.state
    case 'RESET':
      return createDefaultState()
    case 'ENSURE_TODAY': {
      const today = todayKey()
      if (state.dailyProgress.date === today) {
        // Migrate older saves missing dayStatus
        if (!state.dailyProgress.dayStatus) {
          return {
            ...state,
            dailyProgress: {
              ...state.dailyProgress,
              dayStatus: 'not_started',
              dayStartedAt: null,
              dayFinishedAt: null,
            },
          }
        }
        return state
      }
      // Calendar rolled over — archive previous day if it had work or was finished
      const prev = state.dailyProgress
      const ov = overallProgress(prev)
      let history = state.history
      const shouldArchive =
        prev.dayStatus === 'finished' ||
        prev.dayStatus === 'in_progress' ||
        prev.dayStatus === 'paused' ||
        ov.tasksCompleted > 0
      if (shouldArchive) {
        const entry = {
          ...buildHistoryEntry(prev, state),
          dayStatus: prev.dayStatus ?? 'finished',
          dayFinishedAt: prev.dayFinishedAt ?? new Date().toISOString(),
        }
        history = [entry, ...history.filter((h) => h.date !== prev.date)]
      }
      return {
        ...state,
        history,
        dailyProgress: createDailyProgress(state.settings.dailyTargets, state.settings.timeline, today),
      }
    }
    case 'START_DAY': {
      const today = todayKey()
      const current = state.dailyProgress
      // Already working or paused today — use resume / continue instead
      if (
        current.date === today &&
        (current.dayStatus === 'in_progress' || current.dayStatus === 'paused')
      ) {
        return state
      }
      // Finished today — Start New Day handles a fresh session
      if (current.date === today && current.dayStatus === 'finished') {
        return state
      }
      // Fresh start for today (or leftover from another date)
      let history = state.history
      if (current.date !== today) {
        const ov = overallProgress(current)
        if (
          current.dayStatus === 'in_progress' ||
          current.dayStatus === 'paused' ||
          current.dayStatus === 'finished' ||
          ov.tasksCompleted > 0
        ) {
          history = [
            {
              ...buildHistoryEntry(current, state),
              dayFinishedAt: current.dayFinishedAt ?? new Date().toISOString(),
            },
            ...history.filter((h) => h.date !== current.date),
          ]
        }
      }
      const fresh =
        current.date === today && current.dayStatus === 'not_started'
          ? current
          : createDailyProgress(state.settings.dailyTargets, state.settings.timeline, today)
      const startedAt = new Date()
      return {
        ...state,
        history,
        settings: bumpStreakOnStartDay(state.settings, startedAt),
        dailyProgress: {
          ...fresh,
          dayStatus: 'in_progress',
          dayStartedAt: startedAt.toISOString(),
          dayFinishedAt: null,
        },
      }
    }
    case 'PAUSE_DAY': {
      if (state.dailyProgress.dayStatus !== 'in_progress') return state
      return {
        ...state,
        dailyProgress: {
          ...state.dailyProgress,
          dayStatus: 'paused',
          timeline: state.dailyProgress.timeline.map((b) =>
            b.status === 'active' ? { ...b, status: 'paused' as const } : b
          ),
        },
        notifications: [
          {
            id: generateId(),
            title: 'Day Paused',
            body: 'Your session is paused. Resume when you are ready to continue.',
            time: currentTimeString(),
            createdAt: new Date().toISOString(),
            read: false,
            type: 'info' as const,
          },
          ...state.notifications,
        ].slice(0, 50),
      }
    }
    case 'FINISH_DAY': {
      if (
        state.dailyProgress.dayStatus !== 'in_progress' &&
        state.dailyProgress.dayStatus !== 'paused'
      ) {
        return state
      }
      const finishedAt = new Date().toISOString()
      const progress = {
        ...state.dailyProgress,
        dayStatus: 'finished' as const,
        dayFinishedAt: finishedAt,
        timeline: state.dailyProgress.timeline.map((b) =>
          b.status === 'active' ? { ...b, status: 'paused' as const } : b
        ),
      }
      const entry = {
        ...buildHistoryEntry(progress, state),
        dayStartedAt: progress.dayStartedAt,
        dayFinishedAt: finishedAt,
        dayStatus: 'finished' as const,
      }
      const history = [entry, ...state.history.filter((h) => h.date !== entry.date)]

      const ov = overallProgress(progress)

      return {
        ...state,
        history,
        dailyProgress: progress,
        notifications: [
          {
            id: generateId(),
            title: 'Day Finished',
            body: `Saved to History · ${ov.percent}% complete · Score ${productivityScore(progress)}`,
            time: currentTimeString(),
            createdAt: finishedAt,
            read: false,
            type: 'achievement' as const,
          },
          ...state.notifications,
        ].slice(0, 50),
      }
    }
    case 'RESUME_DAY': {
      if (state.dailyProgress.dayStatus !== 'paused') return state
      if (state.dailyProgress.date !== todayKey()) return state
      return {
        ...state,
        dailyProgress: {
          ...state.dailyProgress,
          dayStatus: 'in_progress',
        },
      }
    }
    case 'START_NEW_DAY': {
      if (state.dailyProgress.dayStatus !== 'finished') return state
      const today = todayKey()
      const current = state.dailyProgress
      // Finished day is already in history; start a fresh session for today
      const fresh = createDailyProgress(
        state.settings.dailyTargets,
        state.settings.timeline,
        today
      )
      // Keep finished entry if same calendar date (e.g. second shift)
      let history = state.history
      if (current.date === today) {
        const entry = {
          ...buildHistoryEntry(current, state),
          dayStartedAt: current.dayStartedAt,
          dayFinishedAt: current.dayFinishedAt,
          dayStatus: 'finished' as const,
        }
        history = [entry, ...history.filter((h) => h.date !== entry.date)]
      }
      return {
        ...state,
        history,
        settings: bumpStreakOnStartDay(state.settings, new Date()),
        dailyProgress: {
          ...fresh,
          dayStatus: 'in_progress',
          dayStartedAt: new Date().toISOString(),
          dayFinishedAt: null,
        },
      }
    }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'TOGGLE_CHECKLIST': {
      let progress = { ...state.dailyProgress }
      const section = progress.platforms[action.platform]
      const checklist = section.checklist.map((item) =>
        item.id === action.itemId ? { ...item, completed: !item.completed } : item
      )
      progress = {
        ...progress,
        platforms: {
          ...progress.platforms,
          [action.platform]: { ...section, checklist },
        },
      }
      progress = ensureSectionComplete(progress, action.platform)
      return { ...state, dailyProgress: progress }
    }
    case 'UPDATE_COUNTER': {
      let progress = { ...state.dailyProgress }
      const section = progress.platforms[action.platform]
      const counters = section.counters.map((c) =>
        c.id === action.counterId
          ? { ...c, completed: Math.max(0, c.completed + action.delta) }
          : c
      )
      progress = {
        ...progress,
        platforms: {
          ...progress.platforms,
          [action.platform]: { ...section, counters },
        },
      }
      progress = ensureSectionComplete(progress, action.platform)
      return { ...state, dailyProgress: progress }
    }
    case 'SET_COUNTER': {
      let progress = { ...state.dailyProgress }
      const section = progress.platforms[action.platform]
      const counters = section.counters.map((c) =>
        c.id === action.counterId ? { ...c, completed: Math.max(0, action.value) } : c
      )
      progress = {
        ...progress,
        platforms: {
          ...progress.platforms,
          [action.platform]: { ...section, counters },
        },
      }
      progress = ensureSectionComplete(progress, action.platform)
      return { ...state, dailyProgress: progress }
    }
    case 'SET_NOTES': {
      const section = state.dailyProgress.platforms[action.platform]
      return {
        ...state,
        dailyProgress: {
          ...state.dailyProgress,
          platforms: {
            ...state.dailyProgress.platforms,
            [action.platform]: { ...section, notes: action.notes },
          },
        },
      }
    }
    case 'SET_DAILY_NOTES':
      return { ...state, dailyProgress: { ...state.dailyProgress, dailyNotes: action.notes } }
    case 'MARK_PLATFORM_COMPLETE': {
      const section = state.dailyProgress.platforms[action.platform]
      return {
        ...state,
        dailyProgress: {
          ...state.dailyProgress,
          platforms: {
            ...state.dailyProgress.platforms,
            [action.platform]: { ...section, completed: action.completed },
          },
        },
      }
    }
    case 'TIMELINE_ACTION': {
      const timeline = state.dailyProgress.timeline.map((block) => {
        if (block.id !== action.id) {
          // Pause other active blocks when starting a new one
          if (action.action === 'start' && block.status === 'active') {
            return { ...block, status: 'paused' as TimelineStatus }
          }
          return block
        }
        switch (action.action) {
          case 'start':
            return { ...block, status: 'active' as TimelineStatus, startedAt: block.startedAt ?? new Date().toISOString() }
          case 'pause':
            return { ...block, status: 'paused' as TimelineStatus }
          case 'complete':
            return {
              ...block,
              status: 'completed' as TimelineStatus,
              completedAt: new Date().toISOString(),
            }
          case 'skip':
            return { ...block, status: 'skipped' as TimelineStatus }
          case 'tick':
            if (block.status !== 'active') return block
            return { ...block, elapsedSeconds: block.elapsedSeconds + 1 }
          default:
            return block
        }
      })

      let totalTime = state.dailyProgress.totalTimeWorkedSeconds
      if (action.action === 'tick') {
        const active = state.dailyProgress.timeline.find((t) => t.id === action.id && t.status === 'active')
        if (active) totalTime += 1
      }

      return {
        ...state,
        dailyProgress: { ...state.dailyProgress, timeline, totalTimeWorkedSeconds: totalTime },
      }
    }
    case 'ADD_REVENUE':
      return {
        ...state,
        revenue: [
          {
            ...action.entry,
            id: generateId(),
            createdAt: new Date().toISOString(),
          },
          ...state.revenue,
        ],
      }
    case 'UPDATE_REVENUE':
      return {
        ...state,
        revenue: state.revenue.map((r) => (r.id === action.id ? { ...r, ...action.entry } : r)),
      }
    case 'DELETE_REVENUE':
      return { ...state, revenue: state.revenue.filter((r) => r.id !== action.id) }
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [
          {
            ...action.notification,
            id: generateId(),
            createdAt: new Date().toISOString(),
            read: false,
          },
          ...state.notifications,
        ].slice(0, 50),
      }
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n
        ),
      }
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      }
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] }
    case 'SAVE_DAY_TO_HISTORY': {
      const entry = buildHistoryEntry(state.dailyProgress, state)
      const history = [entry, ...state.history.filter((h) => h.date !== entry.date)]
      return { ...state, history }
    }
    case 'SET_CONFETTI_SHOWN':
      return { ...state, dailyProgress: { ...state.dailyProgress, confettiShown: true } }
    case 'UPDATE_STREAK': {
      // Streak is owned by Start Day (24h window). Keep action as a no-op for compatibility.
      return state
    }
    default:
      return state
  }
}

function rootReducer(state: AppState, action: Action): AppState {
  if (action.type === 'HYDRATE' || action.type === 'IMPORT') {
    return action.state
  }
  const next = reducer(state, action)
  if (next === state) return state
  if (action.type === 'TIMELINE_ACTION' && action.action === 'tick') {
    // Don't bump updatedAt every second — keeps sync quieter; local save still happens
    return next
  }
  return { ...next, updatedAt: Date.now() }
}

function buildHistoryEntry(progress: DailyProgress, state: AppState): HistoryEntry {
  const ov = overallProgress(progress)
  const dayRevenue = state.revenue
    .filter((r) => r.date === progress.date)
    .reduce((s, r) => s + r.amount, 0)

  return {
    date: progress.date,
    completionPercent: ov.percent,
    tasksCompleted: ov.tasksCompleted,
    tasksTotal: ov.tasksTotal,
    connections:
      (getMetric(progress.platforms, 'linkedin_saad', 'connections')?.completed ?? 0) +
      (getMetric(progress.platforms, 'linkedin_umair', 'connections')?.completed ?? 0),
    followUps:
      (getMetric(progress.platforms, 'linkedin_saad', 'followups')?.completed ?? 0) +
      (getMetric(progress.platforms, 'linkedin_umair', 'followups')?.completed ?? 0),
    facebookComments: getMetric(progress.platforms, 'facebook', 'comments')?.completed ?? 0,
    facebookDms: getMetric(progress.platforms, 'facebook', 'dms')?.completed ?? 0,
    jobsReviewed: getMetric(progress.platforms, 'upwork', 'jobs_reviewed')?.completed ?? 0,
    proposalsSent: getMetric(progress.platforms, 'upwork', 'proposals')?.completed ?? 0,
    revenue: dayRevenue,
    notes: progress.dailyNotes,
    totalTimeWorkedSeconds: progress.totalTimeWorkedSeconds,
    productivityScore: productivityScore(progress),
    dayStartedAt: progress.dayStartedAt,
    dayFinishedAt: progress.dayFinishedAt,
    dayStatus: progress.dayStatus,
  }
}

interface AppContextValue {
  state: AppState
  progress: DailyProgress
  settings: AppSettings
  overall: ReturnType<typeof overallProgress>
  score: number
  dispatch: React.Dispatch<Action>
  toggleChecklist: (platform: Platform, itemId: string) => void
  updateCounter: (platform: Platform, counterId: string, delta: number) => void
  setCounter: (platform: Platform, counterId: string, value: number) => void
  setNotes: (platform: Platform, notes: string) => void
  timelineAction: (id: Platform, action: 'start' | 'pause' | 'complete' | 'skip') => void
  addRevenue: (entry: Omit<RevenueEntry, 'id' | 'createdAt'>) => void
  updateRevenue: (id: string, entry: Partial<RevenueEntry>) => void
  deleteRevenue: (id: string) => void
  updateSettings: (settings: Partial<AppSettings>) => void
  resetDashboard: () => void
  importDashboard: (json: string) => void
  saveToday: () => void
  startDay: () => void
  pauseDay: () => void
  finishDay: () => void
  resumeDay: () => void
  startNewDay: () => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  notifications: AppNotification[]
  unreadCount: number
  todayStats: {
    connections: number
    followUps: number
    facebookComments: number
    facebookDms: number
    jobsReviewed: number
    proposalsSent: number
    monthlyRevenue: number
    unreadMessages: number
  }
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const username = session?.username ?? null
  const userId = session?.id ?? null
  const [state, dispatch] = useReducer(rootReducer, undefined, () => loadState(username))
  const hydrated = useRef(false)
  const cloudReady = useRef(false)
  const savingCloud = useRef(false)
  const cloudDirty = useRef(false)
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notifiedSlots = useRef<Set<string>>(new Set())
  const updatedAtRef = useRef(0)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
    updatedAtRef.current = state.updatedAt ?? 0
  }, [state])

  const flushCloud = useCallback(async () => {
    if (!userId || !cloudReady.current || !hydrated.current) return
    if (savingCloud.current) {
      cloudDirty.current = true
      return
    }

    const snapshot = stateRef.current
    // Don't let a blank device publish an empty day over real cloud data
    if (!localHasMeaningfulData(snapshot) && progressScore(snapshot) === 0) {
      return
    }

    savingCloud.current = true
    cloudDirty.current = false
    try {
      const result = await saveAppStateToCloud(userId, snapshot)
      if (!result.ok) {
        console.error('[sync] Cloud save failed:', result.error)
        cloudDirty.current = true
        return
      }
      const remapped =
        result.state.revenue.some((r, i) => r.id !== snapshot.revenue[i]?.id) ||
        result.state.notifications.some((n, i) => n.id !== snapshot.notifications[i]?.id)
      if (remapped) {
        hydrated.current = false
        dispatch({ type: 'HYDRATE', state: normalizeState(result.state) })
        hydrated.current = true
        saveState(result.state, username)
      }
    } finally {
      savingCloud.current = false
      if (cloudDirty.current) {
        cloudDirty.current = false
        void flushCloud()
      }
    }
  }, [userId, username])

  // Load from Supabase when the authenticated user is available / changes
  useEffect(() => {
    if (!userId) {
      cloudReady.current = false
      hydrated.current = true
      dispatch({ type: 'ENSURE_TODAY' })
      return
    }

    let cancelled = false
    hydrated.current = false
    cloudReady.current = false

    ;(async () => {
      try {
        const loaded = await loadAppStateFromCloud(userId, username)
        if (cancelled) return
        dispatch({ type: 'HYDRATE', state: normalizeState(loaded.state) })
        dispatch({ type: 'ENSURE_TODAY' })
      } catch (err) {
        console.error('[sync] Failed to load cloud state', err)
        if (cancelled) return
        dispatch({ type: 'HYDRATE', state: normalizeState(loadState(username)) })
        dispatch({ type: 'ENSURE_TODAY' })
      } finally {
        if (!cancelled) {
          hydrated.current = true
          cloudReady.current = true
          // Push whatever we ended with (covers local-seed path + post-ENSURE_TODAY)
          window.setTimeout(() => {
            void flushCloud()
          }, 100)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, username, flushCloud])

  // Persist locally immediately; debounce cloud writes
  useEffect(() => {
    if (!hydrated.current) return
    saveState(state, username)

    if (!userId || !cloudReady.current) return

    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current)
    cloudSaveTimer.current = setTimeout(() => {
      void flushCloud()
    }, 250)

    return () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current)
    }
  }, [state, username, userId, flushCloud])

  // Periodic flush + flush when leaving the tab (phone switches / laptop sleep)
  useEffect(() => {
    if (!userId) return

    const intervalId = setInterval(() => {
      void flushCloud()
    }, 5000)

    const onHide = () => {
      void flushCloud()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide()
    })

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('pagehide', onHide)
    }
  }, [userId, flushCloud])

  // Pull newer cloud data when returning to the tab
  useEffect(() => {
    if (!userId) return

    const pullIfNewer = () => {
      void (async () => {
        try {
          // Flush local first so we don't lose in-flight clicks
          await flushCloud()
          const newer = await refreshAppStateIfNewer(
            userId,
            username,
            updatedAtRef.current,
            stateRef.current
          )
          if (!newer) return
          hydrated.current = false
          cloudReady.current = false
          dispatch({ type: 'HYDRATE', state: normalizeState(newer) })
          dispatch({ type: 'ENSURE_TODAY' })
          hydrated.current = true
          cloudReady.current = true
        } catch (err) {
          console.error('[sync] Focus refresh failed', err)
        }
      })()
    }

    const onFocus = () => pullIfNewer()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pullIfNewer()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [userId, username, flushCloud])

  // Live sync from browser extension (popup updates while dashboard is open)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || data.source !== 'bd-extension' || data.type !== 'BD_STATE_PUSH') return
      if (username && data.username && data.username !== username) return
      const incoming = data.state as AppState | undefined
      if (!incoming?.dailyProgress || !incoming?.settings) return
      const remoteTs = incoming.updatedAt ?? 0
      if (remoteTs <= updatedAtRef.current) return
      dispatch({ type: 'HYDRATE', state: normalizeState(incoming) })
      dispatch({ type: 'ENSURE_TODAY' })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [username])

  // Theme
  useEffect(() => {
    applyTheme(state.settings.theme)
  }, [state.settings.theme])

  // Timeline tick
  useEffect(() => {
    const active = state.dailyProgress.timeline.find((t) => t.status === 'active')
    if (!active) return
    const id = setInterval(() => {
      dispatch({ type: 'TIMELINE_ACTION', id: active.id, action: 'tick' })
    }, 1000)
    return () => clearInterval(id)
  }, [state.dailyProgress.timeline])

  // Confetti + streak on 100%
  const overall = useMemo(() => overallProgress(state.dailyProgress), [state.dailyProgress])
  useEffect(() => {
    if (overall.percent >= 100 && !state.dailyProgress.confettiShown) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: (() => {
          const a = themeAccent(state.settings.theme)
          return [a.primary, a.secondary, a.success, a.warning]
        })(),
      })
      dispatch({ type: 'SET_CONFETTI_SHOWN' })
      dispatch({ type: 'SAVE_DAY_TO_HISTORY' })
      dispatch({
        type: 'ADD_NOTIFICATION',
        notification: {
          title: '🎉 Day Complete!',
          body: 'You completed every business development activity today. Keep the streak alive!',
          time: currentTimeString(),
          type: 'achievement',
        },
      })
    }
  }, [overall.percent, state.dailyProgress.confettiShown])

  // Schedule notifications
  useEffect(() => {
    if (!state.settings.notificationsEnabled) return
    const check = () => {
      const now = currentTimeString()
      const today = todayKey()
      Object.entries(state.settings.reminderTimes).forEach(([platform, time]) => {
        const key = `${today}-${platform}-${time}`
        if (now === time && !notifiedSlots.current.has(key)) {
          notifiedSlots.current.add(key)
          const body = SCHEDULE_MESSAGES[platform as Platform]
          dispatch({
            type: 'ADD_NOTIFICATION',
            notification: {
              title: 'Schedule Reminder',
              body,
              time: now,
              type: 'schedule',
            },
          })
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('BD Dashboard', { body, icon: '/logo.png' })
          }
        }
      })
    }
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [state.settings.notificationsEnabled, state.settings.reminderTimes])

  // Incomplete task reminders (every hour at :00)
  useEffect(() => {
    if (!state.settings.notificationsEnabled) return
    const id = setInterval(() => {
      const d = new Date()
      if (d.getMinutes() !== 0) return
      const ov = overallProgress(state.dailyProgress)
      if (
        state.dailyProgress.dayStatus === 'in_progress' &&
        ov.remaining > 0 &&
        ov.percent < 100
      ) {
        const key = `incomplete-${todayKey()}-${d.getHours()}`
        if (notifiedSlots.current.has(key)) return
        notifiedSlots.current.add(key)
        dispatch({
          type: 'ADD_NOTIFICATION',
          notification: {
            title: 'Incomplete Tasks',
            body: `${ov.remaining} tasks remaining · ${ov.percent}% complete today`,
            time: currentTimeString(),
            type: 'reminder',
          },
        })
      }
    }, 30000)
    return () => clearInterval(id)
  }, [state.settings.notificationsEnabled, state.dailyProgress])

  const todayStats = useMemo(() => {
    const p = state.dailyProgress.platforms
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthlyRevenue = state.revenue
      .filter((r) => r.date.startsWith(monthPrefix))
      .reduce((s, r) => s + r.amount, 0)

    return {
      connections:
        (getMetric(p, 'linkedin_saad', 'connections')?.completed ?? 0) +
        (getMetric(p, 'linkedin_umair', 'connections')?.completed ?? 0),
      followUps:
        (getMetric(p, 'linkedin_saad', 'followups')?.completed ?? 0) +
        (getMetric(p, 'linkedin_umair', 'followups')?.completed ?? 0),
      facebookComments: getMetric(p, 'facebook', 'comments')?.completed ?? 0,
      facebookDms: getMetric(p, 'facebook', 'dms')?.completed ?? 0,
      jobsReviewed: getMetric(p, 'upwork', 'jobs_reviewed')?.completed ?? 0,
      proposalsSent: getMetric(p, 'upwork', 'proposals')?.completed ?? 0,
      monthlyRevenue,
      unreadMessages: 0,
    }
  }, [state.dailyProgress, state.revenue])

  const value: AppContextValue = {
    state,
    progress: state.dailyProgress,
    settings: state.settings,
    overall,
    score: productivityScore(state.dailyProgress),
    dispatch,
    toggleChecklist: useCallback(
      (platform, itemId) => dispatch({ type: 'TOGGLE_CHECKLIST', platform, itemId }),
      []
    ),
    updateCounter: useCallback(
      (platform, counterId, delta) => dispatch({ type: 'UPDATE_COUNTER', platform, counterId, delta }),
      []
    ),
    setCounter: useCallback(
      (platform, counterId, value) => dispatch({ type: 'SET_COUNTER', platform, counterId, value }),
      []
    ),
    setNotes: useCallback(
      (platform, notes) => dispatch({ type: 'SET_NOTES', platform, notes }),
      []
    ),
    timelineAction: useCallback(
      (id, action) => dispatch({ type: 'TIMELINE_ACTION', id, action }),
      []
    ),
    addRevenue: useCallback(
      (entry) => dispatch({ type: 'ADD_REVENUE', entry }),
      []
    ),
    updateRevenue: useCallback(
      (id, entry) => dispatch({ type: 'UPDATE_REVENUE', id, entry }),
      []
    ),
    deleteRevenue: useCallback((id) => dispatch({ type: 'DELETE_REVENUE', id }), []),
    updateSettings: useCallback(
      (settings) => dispatch({ type: 'UPDATE_SETTINGS', settings }),
      []
    ),
    resetDashboard: useCallback(() => {
      clearState(username)
      dispatch({ type: 'RESET' })
    }, [username]),
    importDashboard: useCallback((json: string) => {
      const imported = importState(json)
      dispatch({ type: 'IMPORT', state: imported })
    }, []),
    saveToday: useCallback(() => dispatch({ type: 'SAVE_DAY_TO_HISTORY' }), []),
    startDay: useCallback(() => dispatch({ type: 'START_DAY' }), []),
    pauseDay: useCallback(() => dispatch({ type: 'PAUSE_DAY' }), []),
    finishDay: useCallback(() => dispatch({ type: 'FINISH_DAY' }), []),
    resumeDay: useCallback(() => dispatch({ type: 'RESUME_DAY' }), []),
    startNewDay: useCallback(() => dispatch({ type: 'START_NEW_DAY' }), []),
    markNotificationRead: useCallback(
      (id) => dispatch({ type: 'MARK_NOTIFICATION_READ', id }),
      []
    ),
    markAllNotificationsRead: useCallback(
      () => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' }),
      []
    ),
    clearNotifications: useCallback(() => dispatch({ type: 'CLEAR_NOTIFICATIONS' }), []),
    notifications: state.notifications,
    unreadCount: state.notifications.filter((n) => !n.read).length,
    todayStats,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// silence unused import warning
void sumCounters
