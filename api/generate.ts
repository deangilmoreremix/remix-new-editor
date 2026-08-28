/**
 * Universal Generation Endpoint
 *
 * POST /api/generate
 *
 * Frontend submits a known model ID/name.
 * Backend validates, estimates cost, checks credits, submits to provider,
 * stores job, and returns job ID.
 *
 * Never exposes MuAPI API key to the browser.
 */

import {
  verifyUser,
  rateLimit,
  hasServiceRoleKey,
  setCorsHeaders,
  handlePreflight,
} from '../_shared.js'

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
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

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {}
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { return {} }
  }
  return body as Record<string, unknown>
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  setCorsHeaders(req, res)

  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!(await rateLimit(`generate:${user.id}`, 10, 60_000))) {
    res.status(429).json({ error: 'Too many generation requests. Please wait a minute.' })
    return
  }

  if (!hasServiceRoleKey()) {
    res.status(503).json({ error: 'Generation service not configured' })
    return
  }

  const body = parseBody(req.body)
  const provider = typeof body.provider === 'string' ? body.provider : ''
  const model = typeof body.model === 'string' ? body.model : ''
  const inputs = (body.inputs && typeof body.inputs === 'object') ? body.inputs : {}

  if (!provider || !model) {
    res.status(400).json({ error: 'Missing provider or model' })
    return
  }

  try {
    // Lazy import to avoid loading on non-generation requests
    const { getModelRegistry } = await import('../../src/lib/ai/ModelRegistry.ts')
    const { getGenerationGateway } = await import('../../src/lib/ai/GenerationGateway.ts')
    const { MuapiAdapter } = await import('../../src/lib/ai/MuapiAdapter.ts')

    const registry = getModelRegistry()
    const gateway = getGenerationGateway()

    // Validate model exists and is enabled
    const modelDef = await registry.getModel(provider, model)
    if (!modelDef) {
      res.status(404).json({ error: `Model not found: ${model}` })
      return
    }

    if (!modelDef.enabled) {
      res.status(403).json({ error: `Model is not enabled: ${model}` })
      return
    }

    // Validate inputs against schema
    if (modelDef.inputSchema) {
      const schema = modelDef.inputSchema as Record<string, unknown>
      const required = Array.isArray(schema.required) ? schema.required : []
      for (const field of required) {
        if (!(field in inputs) || inputs[field] === null || inputs[field] === undefined) {
          res.status(400).json({ error: `Missing required field: ${field}` })
          return
        }
      }
    }

    // Submit generation
    const result = await gateway.submitGeneration(
      { provider, model, inputs },
      { user } as any
    )

    res.status(200).json({
      requestId: result.requestId,
      status: result.status,
    })
  } catch (err) {
    console.error('[api/generate] Error:', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Generation failed',
    })
  }
}
