import {
  verifyUser, rateLimit, hasEncryptionSecret, hasServiceRoleKey, normalizeCloudflareInput,
  validateCloudflareCredentials, saveCloudflareCredentials, deleteCloudflareCredentials, getCloudflareStatus,
} from './_shared.js'

interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface Res {
  status: (code: number) => Res
  json: (body: unknown) => void
}

function header(req: Req, name: string): string | undefined {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

function parseBody(body: unknown): { accountId?: unknown; token?: unknown } {
  if (!body) return {}
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { return {} }
  }
  return body as Record<string, unknown>
}

/**
 * The caller's own Cloudflare account, used by Deploy.
 *   GET    -> { configured, connected, accountId, tokenLast4 }   (never the token)
 *   POST   { accountId, token } -> validates against Cloudflare, stores the token encrypted
 *   DELETE -> disconnect
 */
export default async function handler(req: Req, res: Res): Promise<void> {
  const method = req.method || 'GET'
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const configured = hasEncryptionSecret() && hasServiceRoleKey()
  if (!configured) {
    if (method === 'GET') {
      res.status(200).json({ configured: false, connected: false, accountId: null, tokenLast4: null })
      return
    }
    res.status(503).json({ error: 'cloudflare_not_configured', message: "Publishing isn't set up on this site yet." })
    return
  }

  try {
    if (method === 'GET') {
      res.status(200).json({ configured: true, ...(await getCloudflareStatus(user.id)) })
      return
    }

    if (!(await rateLimit(`cloudflare:${user.id}`, 10, 60_000))) {
      res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' })
      return
    }

    if (method === 'DELETE') {
      await deleteCloudflareCredentials(user.id)
      res.status(200).json({ configured: true, connected: false, accountId: null, tokenLast4: null })
      return
    }

    const { accountId, token } = parseBody(req.body)
    const creds = normalizeCloudflareInput(accountId, token)
    if (!creds) {
      res.status(400).json({
        error: 'invalid_credentials',
        message: 'Enter your 32-character Cloudflare Account ID and an API token.',
      })
      return
    }
    try {
      await validateCloudflareCredentials(creds)
    } catch (err) {
      res.status(400).json({ error: 'cloudflare_rejected', message: err instanceof Error ? err.message : 'Cloudflare rejected these credentials.' })
      return
    }
    await saveCloudflareCredentials(user.id, creds)
    res.status(200).json({ configured: true, ...(await getCloudflareStatus(user.id)) })
  } catch {
    res.status(500).json({ error: 'Could not save your Cloudflare connection. Please try again.' })
  }
}
