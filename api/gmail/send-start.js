import { json, readBody } from '../lib/http.js'
import { ensureAccessToken } from '../lib/tokens.js'
import { sendDailyStartEmail, sendGmailMessage } from '../lib/gmail.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

    const body = readBody(req)
    const username = String(body.username || '').trim().toLowerCase()
    if (!username) return json(res, 400, { error: 'username is required' })

    const bundle = await ensureAccessToken(req, res, username)
    const emailPayload = sendDailyStartEmail({
      date: body.date || new Date().toISOString().slice(0, 10),
      startTime: body.startTime || new Date().toLocaleTimeString(),
      userName: body.userName || username,
      activities: Array.isArray(body.activities) ? body.activities : [],
    })

    await sendGmailMessage(bundle.accessToken, bundle.email, emailPayload.subject, emailPayload.body)

    return json(res, 200, {
      ok: true,
      message: 'Start Day Email Sent',
      to: bundle.email,
    })
  } catch (e) {
    return json(res, e.status || 500, {
      error: e.message || 'Failed to send start day email',
      code: 'GMAIL_SEND_START_FAILED',
    })
  }
}
