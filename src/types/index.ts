export type Platform =
  | 'fiverr'
  | 'linkedin_saad'
  | 'linkedin_umair'
  | 'facebook'
  | 'threads'
  | 'x'
  | 'whatsapp'
  | 'instagram'
  | 'upwork'
  | 'review'

export type TimelineStatus = 'pending' | 'active' | 'paused' | 'completed' | 'skipped'

export type RevenuePlatform = 'Fiverr' | 'Upwork' | 'Direct Clients' | 'Agency' | 'Referral'

export type ThemeMode = 'ignite-dark' | 'ignite-light' | 'classic-dark' | 'classic-light'

export interface ChecklistItem {
  id: string
  label: string
  completed: boolean
}

export interface CounterMetric {
  id: string
  label: string
  target: number
  completed: number
  notes?: string
}

export interface PlatformSection {
  id: Platform
  name: string
  estimatedMinutes: number
  purpose?: string
  checklist: ChecklistItem[]
  counters: CounterMetric[]
  notes: string
  completed: boolean
}

export interface TimelineBlock {
  id: Platform
  name: string
  startTime: string // HH:mm
  estimatedMinutes: number
  status: TimelineStatus
  elapsedSeconds: number
  startedAt: string | null
  completedAt: string | null
}

export type DayStatus = 'not_started' | 'in_progress' | 'paused' | 'finished'

export interface DailyProgress {
  date: string // YYYY-MM-DD
  dayStatus: DayStatus
  dayStartedAt: string | null
  dayFinishedAt: string | null
  platforms: Record<Platform, PlatformSection>
  timeline: TimelineBlock[]
  dailyNotes: string
  confettiShown: boolean
  totalTimeWorkedSeconds: number
}

export interface DailyTargets {
  linkedin_saad: {
    connections: number
    followUps: number
    comments: number
  }
  linkedin_umair: {
    connections: number
    followUps: number
    comments: number
  }
  facebook: {
    comments: number
    dms: number
    posts: number
  }
  threads: {
    posts: number
    dms: number
  }
  x: {
    comments: number
    outreach: number
  }
  whatsapp: {
    messages: number
  }
  instagram: {
    businesses: number
    dms: number
  }
  upwork: {
    jobsReviewed: number
    proposals: number
  }
}

export interface TimelineSettings {
  blocks: Array<{
    id: Platform
    name: string
    startTime: string
    estimatedMinutes: number
  }>
}

export interface RevenueEntry {
  id: string
  date: string
  platform: RevenuePlatform
  amount: number
  client: string
  notes: string
  createdAt: string
}

export interface HistoryEntry {
  date: string
  completionPercent: number
  tasksCompleted: number
  tasksTotal: number
  connections: number
  followUps: number
  facebookComments: number
  facebookDms: number
  jobsReviewed: number
  proposalsSent: number
  revenue: number
  notes: string
  totalTimeWorkedSeconds: number
  productivityScore: number
  dayStartedAt?: string | null
  dayFinishedAt?: string | null
  dayStatus?: DayStatus
}

export interface AppNotification {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  createdAt: string
  type: 'schedule' | 'reminder' | 'achievement' | 'info'
}

export interface AppSettings {
  theme: ThemeMode
  notificationsEnabled: boolean
  reminderTimes: Record<Platform, string>
  dailyTargets: DailyTargets
  timeline: TimelineSettings
  revenueCategories: RevenuePlatform[]
  streak: number
  lastCompletedDate: string | null
  longestStreak: number
}

export interface AppState {
  settings: AppSettings
  dailyProgress: DailyProgress
  history: HistoryEntry[]
  revenue: RevenueEntry[]
  notifications: AppNotification[]
  version: number
  /** Epoch ms — used for cross-device sync conflict resolution */
  updatedAt?: number
}

export interface SearchResult {
  id: string
  type: 'revenue' | 'history' | 'task' | 'timeline' | 'settings'
  title: string
  subtitle: string
  path: string
}
