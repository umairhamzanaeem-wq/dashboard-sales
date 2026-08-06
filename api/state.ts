import { Redis } from '@upstash/redis'

const USERS: Record<string, string> = {
  saad: 'saad',
  umair: 'umair',
}

const STATE_KEY = 'bd-dashboard:shared-state'

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isAuthorized(request: Request): boolean {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Basic ')) return false
  try {
    const decoded = atob(header.slice(6))
    const sep = decoded.indexOf(':')
    if (sep < 0) return false
    const user = decoded.slice(0, sep).toLowerCase()
    const pass = decoded.slice(sep + 1)
    return USERS[user] === pass
  } catch {
    return false
  }
}

function redisMissingResponse() {
  return new Response(
    JSON.stringify({
      error: 'Cloud sync not configured',
      hint: 'In Vercel: Storage → Create Upstash Redis → Connect to this project → Redeploy.',
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized()
  const redis = getRedis()
  if (!redis) return redisMissingResponse()

  try {
    const data = await redis.get(STATE_KEY)
    return new Response(JSON.stringify(data ?? null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('GET /api/state', err)
    return redisMissingResponse()
  }
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) return unauthorized()
  const redis = getRedis()
  if (!redis) return redisMissingResponse()

  try {
    const body = await request.json()
    await redis.set(STATE_KEY, body)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('PUT /api/state', err)
    return new Response(JSON.stringify({ error: 'Failed to save' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
