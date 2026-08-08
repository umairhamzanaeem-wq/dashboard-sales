import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json } from '../_lib/http'
import { readTokenBundle } from '../_lib/tokens'

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
    const username = String(req.query.username || '').trim().toLowerCase()
    if (!username) return json(res, 400, { error: 'username is required' })

    const bundle = readTokenBundle(req, username)
    if (!bundle) {
      return json(res, 200, { connected: false, email: null })
    }
    return json(res, 200, { connected: true, email: bundle.email })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Status check failed'
    return json(res, 500, { error: message })
  }
}
