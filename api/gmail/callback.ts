import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getConfig, json } from '../_lib/http'
import {
  exchangeCode,
  getGmailAddress,
  writeTokenBundle,
} from '../_lib/tokens'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { appUrl } = getConfig()
    const error = String(req.query.error || '')
    if (error) {
      res.statusCode = 302
      res.setHeader('Location', `${appUrl}/settings?gmail=error&reason=${encodeURIComponent(error)}`)
      return res.end()
    }

    const code = String(req.query.code || '')
    const stateRaw = String(req.query.state || '')
    if (!code || !stateRaw) {
      return json(res, 400, { error: 'Missing OAuth code or state' })
    }

    let username = ''
    try {
      const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8')) as {
        username?: string
      }
      username = String(state.username || '').toLowerCase()
    } catch {
      return json(res, 400, { error: 'Invalid OAuth state' })
    }

    if (!username) return json(res, 400, { error: 'Invalid username in OAuth state' })

    const tokens = await exchangeCode(code)
    if (!tokens.refresh_token) {
      res.statusCode = 302
      res.setHeader(
        'Location',
        `${appUrl}/settings?gmail=error&reason=${encodeURIComponent('No refresh token returned. Disconnect previous access and try again.')}`
      )
      return res.end()
    }

    const email = await getGmailAddress(tokens.access_token)
    writeTokenBundle(res, {
      username,
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiry: Date.now() + tokens.expires_in * 1000,
    })

    res.statusCode = 302
    res.setHeader('Location', `${appUrl}/settings?gmail=connected`)
    return res.end()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'OAuth callback failed'
    try {
      const { appUrl } = getConfig()
      res.statusCode = 302
      res.setHeader('Location', `${appUrl}/settings?gmail=error&reason=${encodeURIComponent(message)}`)
      return res.end()
    } catch {
      return json(res, 500, { error: message })
    }
  }
}
