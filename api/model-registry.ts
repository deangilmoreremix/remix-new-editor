/**
 * Model Registry API
 *
 * GET /api/model-registry
 *
 * Returns enabled models for the frontend.
 * Supports filtering by studio and category.
 */

import {
  verifyUser,
  rateLimit,
  setCorsHeaders,
  handlePreflight,
} from '../_shared.js'

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
}
interface VercelRes {
  status: (code: number) => VercelRes
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[] | number) => void
}

function header(req: VercelReq, name: string): string | undefined {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (handlePreflight(req, res)) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  setCorsHeaders(req, res)

  // Optional auth — public read for landing, auth for dashboard
  const user = await verifyUser(header(req, 'authorization'))

  if (!(await rateLimit(`model-registry:${user?.id || 'anon'}`, 100, 60_000))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  try {
    const { getModelRegistry } = await import('../../src/lib/ai/ModelRegistry.ts')

    const registry = getModelRegistry()
    const studio = typeof req.query?.studio === 'string' ? req.query.studio : undefined
    const category = typeof req.query?.category === 'string' ? req.query.category : undefined
    const enabled = req.query?.enabled !== 'false'

    const filters: Record<string, unknown> = { enabled }
    if (studio) filters.studios = [studio]
    if (category) filters.category = category

    const models = await registry.listModels(filters)

    res.status(200).json({ models })
  } catch (err) {
    console.error('[api/model-registry] Error:', err)
    res.status(500).json({ error: 'Failed to load model registry' })
  }
}
