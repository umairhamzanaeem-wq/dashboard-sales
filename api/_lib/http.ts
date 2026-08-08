import type { VercelRequest, VercelResponse } from '@vercel/node'

export function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY

  const appUrl = (() => {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
    return 'http://localhost:5173'
  })()

  const redirectUri = process.env.GMAIL_REDIRECT_URI || `${appUrl}/api/gmail/callback`

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
  }
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters')
  }

  return {
    clientId,
    clientSecret,
    encryptionKey,
    appUrl,
    redirectUri,
    scope: 'https://www.googleapis.com/auth/gmail.send',
  }
}

export function cookieName(username: string) {
  return `bd_gmail_${username.toLowerCase()}`
}

export function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  return res.send(JSON.stringify(body))
}

export function readBody<T = Record<string, unknown>>(req: VercelRequest): T {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T
    } catch {
      return {} as T
    }
  }
  return (req.body || {}) as T
}

export function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie || ''
  return Object.fromEntries(
    header
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf('=')
        if (i === -1) return [p, '']
        return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]
      })
  )
}

export function setEncryptedCookie(
  res: VercelResponse,
  name: string,
  value: string,
  maxAgeSeconds = 60 * 60 * 24 * 180
) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearCookie(res: VercelResponse, name: string) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}
