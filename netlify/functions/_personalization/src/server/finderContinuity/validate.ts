/**
 * Request validation and database-error mapping for the finder-continuity routes (saved searches and
 * "looks wrong" feedback). Pure, so every rule is unit-tested without a server or database.
 */
import { BUSINESS_NICHES } from '../../shared/personalization/businessNiches'

export const FEEDBACK_REASONS = ['is_a_chain', 'wrong_category', 'closed', 'wrong_contact', 'not_local', 'other'] as const
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
// Control characters (including newlines) never belong in a name, location, id or note: reject them BEFORE any
// whitespace normalisation, or a newline would silently turn into a space.
const hasControl = (s: string) => /[\u0000-\u001f\u007f]/.test(s)
const text = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string' || hasControl(v)) return null
  const t = v.trim().replace(/\s+/g, ' ')
  return t.length >= min && t.length <= max ? t : null
}

export interface SavedSearchInput { name: string; niche: string; location: string; radiusMiles: number; includeChains: boolean }

export function validateSavedSearch(body: unknown): Result<SavedSearchInput> {
  if (!isRecord(body)) return { ok: false, error: 'Body must be a JSON object' }
  const name = text(body.name, 1, 80)
  if (!name || hasControl(name)) return { ok: false, error: 'name must be 1-80 characters' }
  const niche = typeof body.niche === 'string' ? body.niche : ''
  if (!BUSINESS_NICHES.some((n) => n.key === niche)) return { ok: false, error: 'Unsupported niche' }
  const location = text(body.location, 1, 120)
  if (!location || hasControl(location)) return { ok: false, error: 'location must be 1-120 characters' }
  const radius = body.radiusMiles === undefined ? 15 : body.radiusMiles
  if (typeof radius !== 'number' || !Number.isInteger(radius) || radius < 1 || radius > 50) return { ok: false, error: 'radiusMiles must be a whole number from 1 to 50' }
  const includeChains = body.includeChains === undefined ? false : body.includeChains
  if (typeof includeChains !== 'boolean') return { ok: false, error: 'includeChains must be true or false' }
  return { ok: true, value: { name, niche, location, radiusMiles: radius, includeChains } }
}

export function validateUuid(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null
}

export interface FeedbackInput { businessId: string; reason: FeedbackReason; note: string | null }

export function validateBusinessId(value: unknown): string | null {
  const id = text(value, 1, 120)
  return id && !hasControl(id) ? id : null
}

export function validateReason(value: unknown): FeedbackReason | null {
  return typeof value === 'string' && (FEEDBACK_REASONS as readonly string[]).includes(value) ? (value as FeedbackReason) : null
}

export function validateFeedback(body: unknown): Result<FeedbackInput> {
  if (!isRecord(body)) return { ok: false, error: 'Body must be a JSON object' }
  const businessId = validateBusinessId(body.businessId)
  if (!businessId) return { ok: false, error: 'businessId is required (max 120 characters)' }
  const reason = validateReason(body.reason)
  if (!reason) return { ok: false, error: `reason must be one of: ${FEEDBACK_REASONS.join(', ')}` }
  let note: string | null = null
  if (body.note !== undefined && body.note !== null && body.note !== '') {
    note = text(body.note, 1, 280)
    if (!note || hasControl(note)) return { ok: false, error: 'note must be 1-280 characters' }
  }
  return { ok: true, value: { businessId, reason, note } }
}

/** Maps a Supabase/Postgres error from the RPCs to an HTTP status and a safe message. */
export function mapRpcError(error: { code?: string; message?: string } | null | undefined): { status: number; code: string; message: string } {
  switch (error?.code) {
    case '54000': return { status: 409, code: 'LIMIT_REACHED', message: 'You have reached the limit. Remove one first.' }
    case '23514': // check_violation
    case '22023': // invalid_parameter_value
    case '23502': return { status: 422, code: 'INVALID_VALUE', message: 'One of the values was not accepted.' }
    case '28000': return { status: 401, code: 'UNAUTHENTICATED', message: 'Sign in to continue.' }
    default: return { status: 502, code: 'DB_FAILED', message: 'Could not reach saved data right now. Try again shortly.' }
  }
}
