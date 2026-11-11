/**
 * Structured server-side logging for personalization API routes.
 *
 * Logs include:
 * - route
 * - stage
 * - provider (optional)
 * - httpStatus
 * - safeErrorCode
 * - safeMessage
 * - correlationId
 *
 * Never logs:
 * - API keys
 * - tokens
 * - authorization headers
 * - private user data
 */

export interface PersonalizationLogEntry {
  route: string
  stage: string
  provider?: string
  httpStatus: number
  safeErrorCode?: string
  safeMessage?: string
  correlationId: string
  durationMs?: number
}

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /AIza[a-zA-Z0-9_-]{35}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/g,
  /password['":\s]+[^'"}\]]+/gi,
  /secret['":\s]+[^'"}\]]+/gi,
  /token['":\s]+[^'"}\]]+/gi,
]

export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    let safe = value
    for (const pattern of SENSITIVE_PATTERNS) {
      safe = safe.replace(pattern, '[REDACTED]')
    }
    return safe
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item))
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      // Redact known sensitive keys entirely
      if (/^(authorization|x-api-key|apiKey|secret|password|token|privateKey)$/i.test(key)) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = sanitizeForLog(val)
      }
    }
    return sanitized
  }
  return value
}

export function logPersonalization(entry: PersonalizationLogEntry): void {
  const log: Record<string, unknown> = {
    route: entry.route,
    stage: entry.stage,
    httpStatus: entry.httpStatus,
    correlationId: entry.correlationId,
  }
  if (entry.provider) log.provider = entry.provider
  if (entry.safeErrorCode) log.safeErrorCode = entry.safeErrorCode
  if (entry.safeMessage) log.safeMessage = entry.safeMessage
  if (entry.durationMs !== undefined) log.durationMs = entry.durationMs

  const level = entry.httpStatus >= 500 ? 'error' : entry.httpStatus >= 400 ? 'warn' : 'info'
  console[level](JSON.stringify(sanitizeForLog(log)))
}

export function createCorrelationId(req: Request): string {
  const incoming = req.headers.get('x-request-id') || req.headers.get('x-correlation-id')
  if (incoming) return incoming
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
