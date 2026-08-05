import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { CounterMetric, ChecklistItem, PlatformSection, DailyProgress, Platform } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h} hr`
  return `${h} hr ${m} min`
}

export function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function percent(completed: number, target: number): number {
  if (target <= 0) return completed > 0 ? 100 : 0
  return clamp(Math.round((completed / target) * 100), 0, 100)
}

export function sectionProgress(section: PlatformSection): {
  completed: number
  total: number
  percent: number
  remaining: number
} {
  const checklistDone = section.checklist.filter((c) => c.completed).length
  const checklistTotal = section.checklist.length

  const counterDone = section.counters.reduce((sum, c) => sum + Math.min(c.completed, c.target), 0)
  const counterTotal = section.counters.reduce((sum, c) => sum + c.target, 0)

  // Weight checklist items equally with counter units for overall
  const total = checklistTotal + counterTotal
  const completed = checklistDone + counterDone
  const pct = total === 0 ? (section.completed ? 100 : 0) : percent(completed, total)

  return {
    completed,
    total,
    percent: section.completed ? 100 : pct,
    remaining: Math.max(0, total - completed),
  }
}

export function overallProgress(progress: DailyProgress): {
  percent: number
  tasksCompleted: number
  tasksTotal: number
  remaining: number
} {
  const platforms = Object.values(progress.platforms)
  let tasksCompleted = 0
  let tasksTotal = 0

  for (const p of platforms) {
    const s = sectionProgress(p)
    tasksCompleted += s.completed
    tasksTotal += s.total
  }

  // Also factor timeline completion
  const timelineDone = progress.timeline.filter((t) => t.status === 'completed').length
  const timelineTotal = progress.timeline.length
  tasksCompleted += timelineDone
  tasksTotal += timelineTotal

  return {
    percent: percent(tasksCompleted, tasksTotal),
    tasksCompleted,
    tasksTotal,
    remaining: Math.max(0, tasksTotal - tasksCompleted),
  }
}

export function productivityScore(progress: DailyProgress): number {
  const { percent: pct } = overallProgress(progress)
  const timelineBonus =
    (progress.timeline.filter((t) => t.status === 'completed').length / Math.max(1, progress.timeline.length)) * 10
  return clamp(Math.round(pct * 0.9 + timelineBonus), 0, 100)
}

export function sumCounters(platforms: Record<Platform, PlatformSection>, ids: string[]): number {
  let sum = 0
  for (const p of Object.values(platforms)) {
    for (const c of p.counters) {
      if (ids.includes(c.id)) sum += c.completed
    }
  }
  return sum
}

export function getMetric(
  platforms: Record<Platform, PlatformSection>,
  platform: Platform,
  counterId: string
): CounterMetric | undefined {
  return platforms[platform]?.counters.find((c) => c.id === counterId)
}

export function isChecklistDone(items: ChecklistItem[]): boolean {
  return items.length > 0 && items.every((i) => i.completed)
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function currentTimeString(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function platformColor(platform: string): string {
  const map: Record<string, string> = {
    fiverr: '#22c55e',
    linkedin_saad: '#3b82f6',
    linkedin_umair: '#06b6d4',
    facebook: '#a855f7',
    upwork: '#14b8a6',
    review: '#f59e0b',
    Fiverr: '#22c55e',
    Upwork: '#14b8a6',
    'Direct Clients': '#3b82f6',
    Agency: '#a855f7',
    Referral: '#f97316',
  }
  return map[platform] ?? '#71717a'
}
