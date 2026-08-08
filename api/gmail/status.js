import { json } from '../lib/http.js'
import { readTokenBundle } from '../lib/tokens.js'

export default function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
    const username = String(req.query.username || '').trim().toLowerCase()
    if (!username) return json(res, 400, { error: 'username is required' })

    const bundle = readTokenBundle(req, username)
    if (!bundle) return json(res, 200, { connected: false, email: null })
    return json(res, 200, { connected: true, email: bundle.email })
  } catch (e) {
    return json(res, e.status || 500, { error: e.message || 'Status check failed' })
  }
}
