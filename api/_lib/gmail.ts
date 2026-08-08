export async function sendGmailMessage(accessToken: string, to: string, subject: string, bodyText: string) {
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText,
  ].join('\r\n')

  const encoded = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to send Gmail message')
  }
  return data
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function sendDailyStartEmail(input: {
  date: string
  startTime: string
  userName: string
  activities: string[]
}): { subject: string; body: string } {
  const lines = [
    'Daily Work Started',
    '',
    `Date: ${input.date}`,
    `Start Time: ${input.startTime}`,
    `User: ${input.userName}`,
    '',
    "Today's planned activities:",
    ...(input.activities.length
      ? input.activities.map((a, i) => `${i + 1}. ${a}`)
      : ['- No activities listed']),
    '',
    '— Sent automatically from CRM Dashboard',
  ]
  return {
    subject: `Daily Work Started - ${input.date}`,
    body: lines.join('\n'),
  }
}

export function sendDailyPerformanceEmail(input: {
  date: string
  startTime: string
  endTime: string
  totalWorkingTime: string
  userName: string
  performancePercent: number
  productivityScore: number
  instagramBusinesses: number
  instagramDms: number
  instagramReplies: string | number
  instagramInterestedLeads: string | number
  threadsPosts: number
  threadsDms: number
  linkedinConnections: number
  linkedinFollowUps: number
  linkedinComments: number
  facebookComments: number
  facebookDms: number
  facebookPosts: number
  upworkJobsReviewed: number
  upworkProposals: number
  emailOutreach: string | number
  leadsGenerated: number
  meetingsBooked: string | number
  dealsWon: string | number
  revenueGenerated: number
  notes?: string
}): { subject: string; body: string } {
  const lines = [
    'Daily Performance Report',
    '',
    `Date: ${input.date}`,
    `User: ${input.userName}`,
    `Start Time: ${input.startTime}`,
    `End Time: ${input.endTime}`,
    `Total Working Time: ${input.totalWorkingTime}`,
    `Overall Daily Performance: ${input.performancePercent}%`,
    `Productivity Score: ${input.productivityScore}`,
    '',
    '— Instagram —',
    `Businesses found: ${input.instagramBusinesses}`,
    `DMs sent: ${input.instagramDms}`,
    `Replies: ${input.instagramReplies}`,
    `Interested leads: ${input.instagramInterestedLeads}`,
    '',
    '— Threads —',
    `Posts: ${input.threadsPosts}`,
    `DMs: ${input.threadsDms}`,
    '',
    '— LinkedIn —',
    `Connection requests: ${input.linkedinConnections}`,
    `Follow-ups: ${input.linkedinFollowUps}`,
    `Comments: ${input.linkedinComments}`,
    '',
    '— Facebook —',
    `Comments: ${input.facebookComments}`,
    `DMs: ${input.facebookDms}`,
    `Posts: ${input.facebookPosts}`,
    '',
    '— Upwork / Sales —',
    `Jobs reviewed: ${input.upworkJobsReviewed}`,
    `Proposals sent: ${input.upworkProposals}`,
    `Email outreach: ${input.emailOutreach}`,
    `Leads generated: ${input.leadsGenerated}`,
    `Meetings booked: ${input.meetingsBooked}`,
    `Deals won: ${input.dealsWon}`,
    `Revenue generated: $${Number(input.revenueGenerated || 0).toFixed(2)}`,
  ]

  if (input.notes?.trim()) {
    lines.push('', 'Notes:', input.notes.trim())
  }

  lines.push('', '— Sent automatically from CRM Dashboard')

  return {
    subject: `Daily Performance Report - ${input.date}`,
    body: lines.join('\n'),
  }
}
