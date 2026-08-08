import { json, readBody } from '../lib/http.js'
import { clearTokenBundle } from '../lib/tokens.js'

export default function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
    const body = readBody(req)
    const username = String(body.username || req.query.username || '')
      .trim()
      .toLowerCase()
    if (!username) return json(res, 400, { error: 'username is required' })

    clearTokenBundle(res, username)
    return json(res, 200, { ok: true, connected: false })
  } catch (e) {
    return json(res, e.status || 500, { error: e.message || 'Disconnect failed' })
  }
}
