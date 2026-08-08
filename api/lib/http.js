import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY

  const appUrl = (() => {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
    return 'http://localhost:5173'
  })()

  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${appUrl}/api/gmail/callback`

  const missing = []
  if (!clientId) missing.push('GOOGLE_CLIENT_ID')
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET')
  if (!encryptionKey || encryptionKey.length < 32) missing.push('TOKEN_ENCRYPTION_KEY')

  return {
    clientId: clientId || '',
    clientSecret: clientSecret || '',
    encryptionKey: encryptionKey || '',
    appUrl,
    redirectUri,
    // gmail.send alone cannot call users.getProfile; userinfo.email is required to read the connected address
    scope:
      'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
    missing,
  }
}

export function assertConfig() {
  const config = getConfig()
  if (config.missing.length) {
    const err = new Error(
      `Server misconfigured. Missing env: ${config.missing.join(', ')}. Set these in Vercel → Settings → Environment Variables.`
    )
    err.status = 500
    throw err
  }
  return config
}

export function cookieName(username) {
  return `bd_gmail_${String(username).toLowerCase()}`
}

export function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body || {}
}

export function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const p = part.trim()
    if (!p) continue
    const i = p.indexOf('=')
    if (i === -1) out[p] = ''
    else out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1))
  }
  return out
}

export function setEncryptedCookie(res, name, value, maxAgeSeconds = 60 * 60 * 24 * 180) {
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

export function clearCookie(res, name) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

function keyFromSecret(secret) {
  return createHash('sha256').update(secret).digest()
}

export function encryptJson(payload, secret) {
  const key = keyFromSecret(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptJson(token, secret) {
  const key = keyFromSecret(secret)
  const raw = Buffer.from(token, 'base64url')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const data = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}
