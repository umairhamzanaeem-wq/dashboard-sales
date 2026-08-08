import { assertConfig, json } from '../lib/http.js'
import { exchangeCode, getGmailAddress, writeTokenBundle } from '../lib/tokens.js'

export default async function handler(req, res) {
  try {
    const { appUrl } = assertConfig()
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
      const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'))
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
        `${appUrl}/settings?gmail=error&reason=${encodeURIComponent('No refresh token returned. Disconnect previous Google access and try again.')}`
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
    try {
      const { appUrl } = assertConfig()
      res.statusCode = 302
      res.setHeader(
        'Location',
        `${appUrl}/settings?gmail=error&reason=${encodeURIComponent(e.message || 'OAuth callback failed')}`
      )
      return res.end()
    } catch {
      return json(res, 500, { error: e.message || 'OAuth callback failed' })
    }
  }
}
