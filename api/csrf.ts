// CSRF token endpoint — provides double-submit tokens for mutating requests.
// The client stores this token and sends it back in a custom header on all
// state-changing requests; the server validates it against the signed cookie.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
}
interface VercelRes {
  status: (code: number) => VercelRes
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
}

const CSRF_COOKIE = 'openthorn_csrf'
const CSRF_HEADER = 'x-csrf-token'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getCsrfSecret(): string {
  return process.env.CSRF_SECRET || process.env.KEY_ENCRYPTION_SECRET || 'dev-csrf-secret-change-in-production'
}

function signToken(token: string): string {
  const sig = createHmac('sha256', getCsrfSecret()).update(token).digest('base64url')
  return `${token}.${sig}`
}

function verifyToken(signed: string): boolean {
  const dotIdx = signed.lastIndexOf('.')
  if (dotIdx === -1) return false
  const token = signed.slice(0, dotIdx)
  const sig = signed.slice(dotIdx + 1)
  const expected = createHmac('sha256', getCsrfSecret()).update(token).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

function getCookie(req: VercelReq, name: string): string | undefined {
  const cookies = req.headers.cookie
  if (!cookies) return undefined
  for (const pair of cookies.split(';')) {
    const [k, ...v] = pair.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

/** Issue a new CSRF token and set it as a signed, httpOnly cookie. */
export function handler(req: VercelReq, res: VercelRes): void {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = generateToken()
  const signed = signToken(token)

  res.setHeader('Set-Cookie', [
    `${CSRF_COOKIE}=${signed}; Path=/; SameSite=Strict; Secure; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`,
  ])
  res.status(200).json({ token })
}

/**
 * Validate a CSRF token from the request. Returns true if the token in the
 * X-CSRF-TOKEN header matches the signed cookie. State-changing endpoints
 * should call this before processing.
 */
export function validateCsrf(req: VercelReq): boolean {
  const headerToken = req.headers[CSRF_HEADER]
  if (typeof headerToken !== 'string') return false

  const cookie = getCookie(req, CSRF_COOKIE)
  if (!cookie) return false

  if (!verifyToken(cookie)) return false

  return headerToken === cookie.split('.')[0]
}

export { CSRF_HEADER }
