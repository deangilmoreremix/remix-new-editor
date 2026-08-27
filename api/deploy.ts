import { verifyUser, rateLimit, runCloudflareDeploy, getProjectForDeploy, persistProjectSiteId } from './_shared.js'
import { validateCsrf, CSRF_HEADER } from './csrf.js'

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface VercelRes {
  status: (code: number) => VercelRes
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
}

// SECURITY: Explicit CORS configuration — only allow requests from our domains
const ALLOWED_ORIGINS = [
  'https://www.smartvid.app',
  'https://smartvid.app',
  'https://openthorn.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

function header(req: VercelReq, name: string): string | undefined {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

function setCorsHeaders(req: VercelReq, res: VercelRes): void {
  const origin = header(req, 'origin') || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', `Authorization, Content-Type, ${CSRF_HEADER}`)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400')
}

// Maximum deploy payload size (10MB)
const MAX_DEPLOY_SIZE = 10 * 1024 * 1024

// The CF Pages project name is never trusted from the body — it is looked up from
// the database, scoped to the caller, so a user cannot deploy onto someone else's project.
function parseBody(body: unknown): { projectId?: string; html?: string } {
  if (!body) return {}
  if (typeof body === 'string') {
    // SECURITY: Enforce size limit before parsing
    if (body.length > MAX_DEPLOY_SIZE) {
      throw new Error('Payload too large. Maximum deploy size is 10MB.')
    }
    try { return JSON.parse(body) } catch { return {} }
  }
  return body as Record<string, never>
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res)
    res.status(204).json({})
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  setCorsHeaders(req, res)

  const authorization = header(req, 'authorization')
  const user = await verifyUser(authorization)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // SECURITY: Validate CSRF token on state-changing request
  if (!validateCsrf(req)) {
    res.status(403).json({ error: 'Invalid or missing CSRF token' })
    return
  }

  if (!(await rateLimit(`deploy:${user.id}`, 10, 60_000))) {
    res.status(429).json({ error: 'Too many deploys. Please wait a minute and try again.' })
    return
  }

  const { projectId, html } = parseBody(req.body)
  if (!projectId || !html) {
    res.status(400).json({ error: 'Missing projectId or html' })
    return
  }

  // SECURITY: Validate html is a string and within size limits
  if (typeof html !== 'string') {
    res.status(400).json({ error: 'html must be a string' })
    return
  }
  if (html.length > MAX_DEPLOY_SIZE) {
    res.status(413).json({ error: 'HTML content exceeds 10MB limit' })
    return
  }

  const access = await getProjectForDeploy(authorization, projectId)
  if (!access.ok) {
    res.status(403).json({ error: 'You do not have access to this project.' })
    return
  }

  try {
    const result = await runCloudflareDeploy({ projectId, html, existingSiteId: access.siteId, title: access.title })
    if (result.siteId !== access.siteId) {
      await persistProjectSiteId(authorization, projectId, result.siteId)
    }
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Deploy failed' })
  }
}
