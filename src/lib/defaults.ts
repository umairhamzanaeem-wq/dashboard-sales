import type {
  AppSettings,
  AppState,
  DailyProgress,
  DailyTargets,
  Platform,
  PlatformSection,
  TimelineBlock,
  TimelineSettings,
} from '@/types'
import { todayKey } from './utils'

export const STORAGE_KEY = 'bd-dashboard-v1'

export const DEFAULT_TARGETS: DailyTargets = {
  linkedin_saad: { connections: 30, followUps: 10, comments: 5 },
  linkedin_umair: { connections: 30, followUps: 10, comments: 5 },
  facebook: { comments: 20, dms: 10, posts: 1 },
  threads: { posts: 1, dms: 10 },
  instagram: { businesses: 15, dms: 15 },
  upwork: { jobsReviewed: 30, proposals: 5 },
}

export const DEFAULT_TIMELINE: TimelineSettings = {
  blocks: [
    { id: 'fiverr', name: 'Fiverr', startTime: '21:00', estimatedMinutes: 20 },
    { id: 'linkedin_saad', name: 'LinkedIn (Saad)', startTime: '21:20', estimatedMinutes: 80 },
    { id: 'linkedin_umair', name: 'LinkedIn (Umair)', startTime: '22:40', estimatedMinutes: 80 },
    { id: 'facebook', name: 'Facebook', startTime: '00:00', estimatedMinutes: 60 },
    { id: 'threads', name: 'Threads', startTime: '01:00', estimatedMinutes: 25 },
    { id: 'instagram', name: 'Instagram', startTime: '01:25', estimatedMinutes: 40 },
    { id: 'upwork', name: 'Upwork', startTime: '02:05', estimatedMinutes: 75 },
    { id: 'review', name: 'Daily Review & Planning', startTime: '03:20', estimatedMinutes: 45 },
  ],
}

export const SCHEDULE_MESSAGES: Record<Platform, string> = {
  fiverr: 'Time to check Fiverr.',
  linkedin_saad: 'Start LinkedIn (Saad).',
  linkedin_umair: 'Switch to LinkedIn (Umair).',
  facebook: 'Facebook Outreach Time.',
  threads: 'Post on Threads & reply to DMs.',
  instagram: 'Instagram lead outreach time.',
  upwork: 'Search Upwork Jobs.',
  review: "Finish today's review.",
}

export const PLATFORM_LOGOS: Partial<Record<Platform, string>> = {
  fiverr: '/platforms/fiverr.png',
  linkedin_saad: '/platforms/linkedin.png',
  linkedin_umair: '/platforms/linkedin.png',
  facebook: '/platforms/facebook.png',
  threads: '/platforms/threads.png',
  instagram: '/platforms/instagram.png',
  upwork: '/platforms/upwork.png',
}

function makeChecklist(items: string[]) {
  return items.map((label, i) => ({
    id: `c-${i}`,
    label,
    completed: false,
  }))
}

export function createThreadsSection(targets: DailyTargets): PlatformSection {
  return {
    id: 'threads',
    name: 'Threads',
    estimatedMinutes: 25,
    purpose: 'Post once daily and stay active in DMs / replies.',
    checklist: makeChecklist([
      'Publish today’s Threads post',
      'Reply to DMs & messages',
    ]),
    counters: [
      { id: 'posts', label: 'Daily Posts', target: targets.threads?.posts ?? 1, completed: 0 },
      { id: 'dms', label: 'DMs / Replies', target: targets.threads?.dms ?? 10, completed: 0 },
    ],
    notes: '',
    completed: false,
  }
}

export function createInstagramSection(targets: DailyTargets): PlatformSection {
  return {
    id: 'instagram',
    name: 'Instagram',
    estimatedMinutes: 40,
    purpose:
      'Find businesses (gym, med spa, law firms, HVAC, real estate, dental, healthcare) and DM them.',
    checklist: makeChecklist([
      'Find gyms',
      'Find med spas',
      'Find law firms',
      'Find HVAC businesses',
      'Find real estate businesses',
      'Find dental practices',
      'Find healthcare businesses',
      'Send DMs to leads',
    ]),
    counters: [
      {
        id: 'businesses',
        label: 'Businesses Found',
        target: targets.instagram?.businesses ?? 15,
        completed: 0,
      },
      { id: 'dms', label: 'DMs Sent', target: targets.instagram?.dms ?? 15, completed: 0 },
    ],
    notes: '',
    completed: false,
  }
}

export function createPlatformSections(targets: DailyTargets): Record<Platform, PlatformSection> {
  const t: DailyTargets = {
    ...DEFAULT_TARGETS,
    ...targets,
    threads: { ...DEFAULT_TARGETS.threads, ...targets.threads },
    instagram: { ...DEFAULT_TARGETS.instagram, ...targets.instagram },
  }

  return {
    fiverr: {
      id: 'fiverr',
      name: 'Fiverr',
      estimatedMinutes: 20,
      checklist: makeChecklist([
        'Check Analytics',
        'Review Impressions',
        'Review Clicks',
        'Reply to Buyer Messages',
        'Review Gig Performance',
        'Optimize Gig if Required',
      ]),
      counters: [],
      notes: '',
      completed: false,
    },
    linkedin_saad: {
      id: 'linkedin_saad',
      name: 'LinkedIn (Saad)',
      estimatedMinutes: 80,
      checklist: makeChecklist(['Reply to every unread message']),
      counters: [
        { id: 'connections', label: 'Connection Requests', target: t.linkedin_saad.connections, completed: 0 },
        { id: 'followups', label: 'Follow-up Messages', target: t.linkedin_saad.followUps, completed: 0 },
        { id: 'comments', label: 'Meaningful Comments', target: t.linkedin_saad.comments, completed: 0 },
      ],
      notes: '',
      completed: false,
    },
    linkedin_umair: {
      id: 'linkedin_umair',
      name: 'LinkedIn (Umair)',
      estimatedMinutes: 80,
      checklist: makeChecklist(['Reply to every unread message']),
      counters: [
        { id: 'connections', label: 'Connection Requests', target: t.linkedin_umair.connections, completed: 0 },
        { id: 'followups', label: 'Follow-up Messages', target: t.linkedin_umair.followUps, completed: 0 },
        { id: 'comments', label: 'Meaningful Comments', target: t.linkedin_umair.comments, completed: 0 },
      ],
      notes: '',
      completed: false,
    },
    facebook: {
      id: 'facebook',
      name: 'Facebook',
      estimatedMinutes: 60,
      purpose:
        'Generate leads by engaging inside AI, Automation, n8n, GoHighLevel, SaaS, CRM, Marketing and Business related Facebook Groups.',
      checklist: makeChecklist([
        'Search Groups',
        'Comment on Posts',
        'Send Personalized DMs',
        "Publish Today's Post",
        'Find & friend request leads (med spa, dental, etc.)',
      ]),
      counters: [
        { id: 'comments', label: 'Meaningful Comments', target: t.facebook.comments, completed: 0 },
        { id: 'dms', label: 'Personalized DMs', target: t.facebook.dms, completed: 0 },
        { id: 'posts', label: 'Valuable Posts', target: t.facebook.posts, completed: 0 },
      ],
      notes: '',
      completed: false,
    },
    threads: createThreadsSection(t),
    instagram: createInstagramSection(t),
    upwork: {
      id: 'upwork',
      name: 'Upwork',
      estimatedMinutes: 75,
      purpose: 'Review latest jobs. Only apply to high-quality opportunities.',
      checklist: makeChecklist([
        'Search New Jobs',
        'Review Job Details',
        'Shortlist Jobs',
        'Submit Personalized Proposal',
        'Reply to Invitations',
      ]),
      counters: [
        { id: 'jobs_reviewed', label: 'Jobs Reviewed', target: t.upwork.jobsReviewed, completed: 0 },
        { id: 'jobs_shortlisted', label: 'Jobs Shortlisted', target: 6, completed: 0 },
        { id: 'proposals', label: 'Personalized Proposals', target: t.upwork.proposals, completed: 0 },
        { id: 'invitations', label: 'Invitations Replied', target: 3, completed: 0 },
      ],
      notes: '',
      completed: false,
    },
    review: {
      id: 'review',
      name: 'Daily Review & Planning',
      estimatedMinutes: 45,
      checklist: makeChecklist([
        "Review today's KPIs",
        'Log revenue if any',
        "Plan tomorrow's priorities",
        'Update notes',
      ]),
      counters: [],
      notes: '',
      completed: false,
    },
  }
}

export function createTimeline(settings: TimelineSettings): TimelineBlock[] {
  return settings.blocks.map((b) => ({
    id: b.id,
    name: b.name,
    startTime: b.startTime,
    estimatedMinutes: b.estimatedMinutes,
    status: 'pending' as const,
    elapsedSeconds: 0,
    startedAt: null,
    completedAt: null,
  }))
}

export function createDailyProgress(targets: DailyTargets, timeline: TimelineSettings, date?: string): DailyProgress {
  return {
    date: date ?? todayKey(),
    dayStatus: 'not_started',
    dayStartedAt: null,
    dayFinishedAt: null,
    platforms: createPlatformSections(targets),
    timeline: createTimeline(timeline),
    dailyNotes: '',
    confettiShown: false,
    totalTimeWorkedSeconds: 0,
  }
}

export function createDefaultSettings(): AppSettings {
  return {
    theme: 'ignite-dark',
    notificationsEnabled: true,
    reminderTimes: {
      fiverr: '21:00',
      linkedin_saad: '21:20',
      linkedin_umair: '22:40',
      facebook: '00:00',
      threads: '01:00',
      instagram: '01:25',
      upwork: '02:05',
      review: '03:20',
    },
    dailyTargets: { ...DEFAULT_TARGETS },
    timeline: structuredClone(DEFAULT_TIMELINE),
    revenueCategories: ['Fiverr', 'Upwork', 'Direct Clients', 'Agency', 'Referral'],
    streak: 0,
    lastCompletedDate: null,
    longestStreak: 0,
  }
}

export function createDefaultState(): AppState {
  const settings = createDefaultSettings()
  return {
    settings,
    dailyProgress: createDailyProgress(settings.dailyTargets, settings.timeline),
    history: [],
    revenue: [],
    notifications: [],
    version: 1,
    updatedAt: Date.now(),
  }
}
