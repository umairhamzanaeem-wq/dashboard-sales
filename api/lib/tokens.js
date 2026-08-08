import {
  getConfig,
  cookieName,
  clearCookie,
  decryptJson,
  encryptJson,
  parseCookies,
  setEncryptedCookie,
  assertConfig,
} from './http.js'

export function readTokenBundle(req, username) {
  const config = getConfig()
  if (config.missing.length) return null
  const cookies = parseCookies(req)
  const raw = cookies[cookieName(username)]
  if (!raw) return null
  try {
    return decryptJson(raw, config.encryptionKey)
  } catch {
    return null
  }
}

export function writeTokenBundle(res, bundle) {
  const { encryptionKey } = assertConfig()
  const sealed = encryptJson(bundle, encryptionKey)
  setEncryptedCookie(res, cookieName(bundle.username), sealed)
}

export function clearTokenBundle(res, username) {
  clearCookie(res, cookieName(username))
}

export async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = assertConfig()
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'OAuth token exchange failed')
  }
  return data
}

export async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = assertConfig()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Token refresh failed')
    err.code = data.error
    throw err
  }
  return data
}

export async function getGmailAddress(accessToken) {
  // users.me/profile requires gmail.readonly/metadata/etc — NOT gmail.send.
  // Resolve the connected address via userinfo.email instead.
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === 'string' ? data.error : null) ||
      'Failed to load Google user email'
    const err = new Error(msg)
    err.status = res.status
    err.step = 'getGmailAddress'
    throw err
  }
  if (!data.email) {
    const err = new Error(
      'Google did not return an email. Reconnect Gmail and grant the email permission.'
    )
    err.step = 'getGmailAddress'
    throw err
  }
  return data.email
}

export async function ensureAccessToken(req, res, username) {
  const bundle = readTokenBundle(req, username)
  if (!bundle?.refreshToken) {
    const err = new Error(
      'Please connect your Gmail account in Settings before sending daily notifications.'
    )
    err.status = 401
    throw err
  }

  if (bundle.accessToken && bundle.expiry > Date.now() + 60_000) {
    return bundle
  }

  try {
    const refreshed = await refreshAccessToken(bundle.refreshToken)
    const next = {
      ...bundle,
      accessToken: refreshed.access_token,
      expiry: Date.now() + refreshed.expires_in * 1000,
    }
    writeTokenBundle(res, next)
    return next
  } catch (e) {
    if (e.code === 'invalid_grant') {
      clearTokenBundle(res, username)
      e.message = 'Gmail access expired or was revoked. Please reconnect Gmail in Settings.'
      e.status = 401
    }
    throw e
  }
}
