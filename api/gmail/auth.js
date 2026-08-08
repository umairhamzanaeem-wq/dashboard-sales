import { assertConfig, json } from '../lib/http.js'

export default function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })

    const username = String(req.query.username || '').trim().toLowerCase()
    if (!username) return json(res, 400, { error: 'username is required' })

    const { clientId, redirectUri, scope } = assertConfig()
    const state = Buffer.from(JSON.stringify({ username, nonce: Date.now() })).toString('base64url')

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('include_granted_scopes', 'true')
    authUrl.searchParams.set('state', state)

    res.statusCode = 302
    res.setHeader('Location', authUrl.toString())
    res.end()
  } catch (e) {
    return json(res, e.status || 500, { error: e.message || 'OAuth init failed' })
  }
}
