import { decryptJson, encryptJson } from './crypto'
import { cookieName, getConfig, parseCookies } from './http'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearCookie, setEncryptedCookie } from './http'

export interface GmailTokenBundle {
  username: string
  email: string
  refreshToken: string
  accessToken: string
  expiry: number
}

export function readTokenBundle(req: VercelRequest, username: string): GmailTokenBundle | null {
  const { encryptionKey } = getConfig()
  const cookies = parseCookies(req)
  const raw = cookies[cookieName(username)]
  if (!raw) return null
  try {
    return decryptJson<GmailTokenBundle>(raw, encryptionKey)
  } catch {
    return null
  }
}

export function writeTokenBundle(res: VercelResponse, bundle: GmailTokenBundle) {
  const { encryptionKey } = getConfig()
  const sealed = encryptJson(bundle, encryptionKey)
  setEncryptedCookie(res, cookieName(bundle.username), sealed)
}

export function clearTokenBundle(res: VercelResponse, username: string) {
  clearCookie(res, cookieName(username))
}

export async function exchangeCode(code: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
}> {
  const { clientId, clientSecret, redirectUri } = getConfig()
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

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const { clientId, clientSecret } = getConfig()
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
    const err = new Error(data.error_description || data.error || 'Token refresh failed') as Error & {
      code?: string
    }
    err.code = data.error
    throw err
  }
  return data
}

export async function getGmailAddress(accessToken: string): Promise<string> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to load Gmail profile')
  }
  return data.emailAddress as string
}

export async function ensureAccessToken(
  req: VercelRequest,
  res: VercelResponse,
  username: string
): Promise<GmailTokenBundle> {
  const bundle = readTokenBundle(req, username)
  if (!bundle?.refreshToken) {
    const err = new Error(
      'Please connect your Gmail account in Settings before sending daily notifications.'
    ) as Error & { status?: number }
    err.status = 401
    throw err
  }

  if (bundle.accessToken && bundle.expiry > Date.now() + 60_000) {
    return bundle
  }

  try {
    const refreshed = await refreshAccessToken(bundle.refreshToken)
    const next: GmailTokenBundle = {
      ...bundle,
      accessToken: refreshed.access_token,
      expiry: Date.now() + refreshed.expires_in * 1000,
    }
    writeTokenBundle(res, next)
    return next
  } catch (e) {
    const err = e as Error & { code?: string; status?: number }
    if (err.code === 'invalid_grant') {
      clearTokenBundle(res, username)
      err.message =
        'Gmail access expired or was revoked. Please reconnect Gmail in Settings.'
      err.status = 401
    }
    throw err
  }
}
