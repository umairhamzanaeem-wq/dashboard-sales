import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

export function encryptJson(payload: unknown, secret: string): string {
  const key = keyFromSecret(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptJson<T>(token: string, secret: string): T {
  const key = keyFromSecret(secret)
  const raw = Buffer.from(token, 'base64url')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const data = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as T
}
