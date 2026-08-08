import { format, parseISO } from 'date-fns'
import type { DailyProgress, AppState, Platform } from '@/types'
import { getMetric, overallProgress, productivityScore } from '@/lib/utils'

export interface GmailStatus {
  connected: boolean
  email: string | null
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      (data as { error?: string }).error ||
        'Please connect your Gmail account in Settings before sending daily notifications.'
    ) as Error & { status?: number; code?: string }
    err.status = res.status
    err.code = (data as { code?: string }).code
    throw err
  }
  return data
}

export function gmailAuthUrl(username: string) {
  return `/api/gmail/auth?username=${encodeURIComponent(username)}`
}

export async function fetchGmailStatus(username: string): Promise<GmailStatus> {
  const res = await fetch(`/api/gmail/status?username=${encodeURIComponent(username)}`, {
    credentials: 'include',
  })
  return parseJson(res) as Promise<GmailStatus>
}

export async function disconnectGmail(username: string) {
  const res = await fetch('/api/gmail/disconnect', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  return parseJson(res)
}

function metric(progress: DailyProgress, platform: Platform, id: string) {
  return getMetric(progress.platforms, platform, id)?.completed ?? 0
}

export function buildPlannedActivities(progress: DailyProgress): string[] {
  const activities: string[] = []
  const order: Platform[] = [
    'fiverr',
    'linkedin_saad',
    'linkedin_umair',
    'facebook',
    'threads',
    'instagram',
    'upwork',
    'review',
  ]

  for (const id of order) {
    const section = progress.platforms[id]
    if (!section) continue
    const counterBits = section.counters
      .map((c) => `${c.label} (target ${c.target})`)
      .join(', ')
    const taskBits = section.checklist.map((c) => c.label).join(', ')
    const detail = [counterBits, taskBits].filter(Boolean).join(' · ')
    activities.push(detail ? `${section.name}: ${detail}` : section.name)

    if (id === 'instagram') {
      activities.push(
        'Instagram outreach: gym, med spa, law firms, HVAC, real estate, dental, healthcare + DMs'
      )
    }
    if (id === 'threads') {
      activities.push('Threads: one post daily and DM / replies')
    }
  }
  return activities
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return iso
  }
}

export async function sendDailyStartEmailRequest(input: {
  username: string
  userName: string
  progress: DailyProgress
}) {
  const res = await fetch('/api/gmail/send-start', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: input.username,
      userName: input.userName,
      date: input.progress.date,
      startTime: fmtTime(input.progress.dayStartedAt),
      activities: buildPlannedActivities(input.progress),
    }),
  })
  return parseJson(res) as Promise<{ ok: boolean; message: string; to?: string }>
}

export async function sendDailyPerformanceEmailRequest(input: {
  username: string
  userName: string
  state: AppState
  progress: DailyProgress
}) {
  const { progress, state } = input
  const ov = overallProgress(progress)
  const dayRevenue = state.revenue
    .filter((r) => r.date === progress.date)
    .reduce((s, r) => s + r.amount, 0)

  const instagramBusinesses = metric(progress, 'instagram', 'businesses')
  const instagramDms = metric(progress, 'instagram', 'dms')
  const leadsGenerated =
    instagramBusinesses +
    metric(progress, 'facebook', 'dms') +
    metric(progress, 'linkedin_saad', 'connections') +
    metric(progress, 'linkedin_umair', 'connections')

  const res = await fetch('/api/gmail/send-performance', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: input.username,
      userName: input.userName,
      date: progress.date,
      startTime: fmtTime(progress.dayStartedAt),
      endTime: fmtTime(progress.dayFinishedAt),
      totalWorkingTimeSeconds: progress.totalTimeWorkedSeconds,
      performancePercent: ov.percent,
      productivityScore: productivityScore(progress),
      instagramBusinesses,
      instagramDms,
      instagramReplies: 'Not tracked',
      instagramInterestedLeads: 'Not tracked',
      threadsPosts: metric(progress, 'threads', 'posts'),
      threadsDms: metric(progress, 'threads', 'dms'),
      linkedinConnections:
        metric(progress, 'linkedin_saad', 'connections') +
        metric(progress, 'linkedin_umair', 'connections'),
      linkedinFollowUps:
        metric(progress, 'linkedin_saad', 'followups') +
        metric(progress, 'linkedin_umair', 'followups'),
      linkedinComments:
        metric(progress, 'linkedin_saad', 'comments') +
        metric(progress, 'linkedin_umair', 'comments'),
      facebookComments: metric(progress, 'facebook', 'comments'),
      facebookDms: metric(progress, 'facebook', 'dms'),
      facebookPosts: metric(progress, 'facebook', 'posts'),
      upworkJobsReviewed: metric(progress, 'upwork', 'jobs_reviewed'),
      upworkProposals: metric(progress, 'upwork', 'proposals'),
      emailOutreach: 'Not tracked',
      leadsGenerated,
      meetingsBooked: 'Not tracked',
      dealsWon: 'Not tracked',
      revenueGenerated: dayRevenue,
      notes: progress.dailyNotes,
    }),
  })
  return parseJson(res) as Promise<{ ok: boolean; message: string; to?: string }>
}
