import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readBody } from '../_lib/http'
import { clearTokenBundle } from '../_lib/tokens'

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
    const body = readBody<{ username?: string }>(req)
    const username = String(body.username || req.query.username || '')
      .trim()
      .toLowerCase()
    if (!username) return json(res, 400, { error: 'username is required' })

    clearTokenBundle(res, username)
    return json(res, 200, { ok: true, connected: false })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Disconnect failed'
    return json(res, 500, { error: message })
  }
}
