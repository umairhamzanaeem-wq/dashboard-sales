import { assertConfig, json } from '../lib/http.js'
import { exchangeCode, getGmailAddress, writeTokenBundle } from '../lib/tokens.js'

function logStep(step, detail = {}) {
  // Never log secrets, codes, tokens, or full query strings
  console.log(
    JSON.stringify({
      source: 'gmail-oauth-callback',
      step,
      ...detail,
      ts: new Date().toISOString(),
    })
  )
}

export default async function handler(req, res) {
  let step = 'init'
  try {
    step = 'assertConfig'
    const { appUrl, redirectUri } = assertConfig()
    logStep('config_ok', { appUrl, redirectUri })

    const error = String(req.query.error || '')
    if (error) {
      step = 'google_query_error'
      logStep(step, { googleError: error, googleErrorDescription: String(req.query.error_description || '') })
      res.statusCode = 302
      res.setHeader('Location', `${appUrl}/settings?gmail=error&reason=${encodeURIComponent(error)}`)
      return res.end()
    }

    const code = String(req.query.code || '')
    const stateRaw = String(req.query.state || '')
    if (!code || !stateRaw) {
      step = 'missing_code_or_state'
      logStep(step, { hasCode: Boolean(code), hasState: Boolean(stateRaw) })
      return json(res, 400, { error: 'Missing OAuth code or state', step })
    }

    let username = ''
    try {
      step = 'parse_state'
      const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'))
      username = String(state.username || '').toLowerCase()
    } catch {
      step = 'invalid_state'
      logStep(step)
      return json(res, 400, { error: 'Invalid OAuth state', step })
    }

    if (!username) {
      step = 'missing_username'
      logStep(step)
      return json(res, 400, { error: 'Invalid username in OAuth state', step })
    }
    logStep('state_ok', { username })

    step = 'exchange_code'
    const tokens = await exchangeCode(code)
    logStep('exchange_ok', {
      hasAccessToken: Boolean(tokens.access_token),
      hasRefreshToken: Boolean(tokens.refresh_token),
      expiresIn: tokens.expires_in || null,
      scope: tokens.scope || null,
    })

    if (!tokens.refresh_token) {
      step = 'missing_refresh_token'
      logStep(step)
      res.statusCode = 302
      res.setHeader(
        'Location',
        `${appUrl}/settings?gmail=error&reason=${encodeURIComponent('No refresh token returned. Disconnect previous Google access and try again.')}`
      )
      return res.end()
    }

    step = 'fetch_email'
    const email = await getGmailAddress(tokens.access_token)
    logStep('email_ok', { emailDomain: String(email).split('@')[1] || null })

    step = 'store_tokens'
    writeTokenBundle(res, {
      username,
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiry: Date.now() + tokens.expires_in * 1000,
    })
    logStep('store_ok', { username })

    step = 'redirect_success'
    res.statusCode = 302
    res.setHeader('Location', `${appUrl}/settings?gmail=connected`)
    return res.end()
  } catch (e) {
    logStep('error', {
      step,
      message: e?.message || 'OAuth callback failed',
      status: e?.status || null,
      code: e?.code || null,
    })
    try {
      const { appUrl } = assertConfig()
      res.statusCode = 302
      res.setHeader(
        'Location',
        `${appUrl}/settings?gmail=error&reason=${encodeURIComponent(e.message || 'OAuth callback failed')}&step=${encodeURIComponent(step)}`
      )
      return res.end()
    } catch (configErr) {
      return json(res, 500, {
        error: e.message || 'OAuth callback failed',
        step,
        configError: configErr.message || 'config unavailable',
      })
    }
  }
}
