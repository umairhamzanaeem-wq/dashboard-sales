import { json, readBody } from '../lib/http.js'
import { ensureAccessToken } from '../lib/tokens.js'
import { formatDuration, sendDailyPerformanceEmail, sendGmailMessage } from '../lib/gmail.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

    const body = readBody(req)
    const username = String(body.username || '').trim().toLowerCase()
    if (!username) return json(res, 400, { error: 'username is required' })

    const bundle = await ensureAccessToken(req, res, username)
    const emailPayload = sendDailyPerformanceEmail({
      date: body.date || new Date().toISOString().slice(0, 10),
      startTime: body.startTime || '—',
      endTime: body.endTime || '—',
      totalWorkingTime: formatDuration(body.totalWorkingTimeSeconds || 0),
      userName: body.userName || username,
      performancePercent: body.performancePercent ?? 0,
      productivityScore: body.productivityScore ?? 0,
      instagramBusinesses: body.instagramBusinesses ?? 0,
      instagramDms: body.instagramDms ?? 0,
      instagramReplies: body.instagramReplies ?? 'Not tracked',
      instagramInterestedLeads: body.instagramInterestedLeads ?? 'Not tracked',
      threadsPosts: body.threadsPosts ?? 0,
      threadsDms: body.threadsDms ?? 0,
      linkedinConnections: body.linkedinConnections ?? 0,
      linkedinFollowUps: body.linkedinFollowUps ?? 0,
      linkedinComments: body.linkedinComments ?? 0,
      facebookComments: body.facebookComments ?? 0,
      facebookDms: body.facebookDms ?? 0,
      facebookPosts: body.facebookPosts ?? 0,
      upworkJobsReviewed: body.upworkJobsReviewed ?? 0,
      upworkProposals: body.upworkProposals ?? 0,
      emailOutreach: body.emailOutreach ?? 'Not tracked',
      leadsGenerated: body.leadsGenerated ?? 0,
      meetingsBooked: body.meetingsBooked ?? 'Not tracked',
      dealsWon: body.dealsWon ?? 'Not tracked',
      revenueGenerated: body.revenueGenerated ?? 0,
      notes: body.notes,
    })

    await sendGmailMessage(bundle.accessToken, bundle.email, emailPayload.subject, emailPayload.body)

    return json(res, 200, {
      ok: true,
      message: 'Daily Performance Report Sent',
      to: bundle.email,
    })
  } catch (e) {
    return json(res, e.status || 500, {
      error: e.message || 'Failed to send performance email',
      code: 'GMAIL_SEND_PERFORMANCE_FAILED',
    })
  }
}
