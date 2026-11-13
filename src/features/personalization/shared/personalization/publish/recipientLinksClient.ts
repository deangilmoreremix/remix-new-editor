/**
 * Browser client for /api/personalization/recipient-links (Stage 8). The same-origin session (Clerk cookie) authenticates;
 * the server takes the user from it. Never throws: every outcome is a typed result with a message the owner can act on.
 */
import { VIDEO_ID, isVideoId, planLabels, MAX_ISSUE_BATCH } from './recipientToken'

export const RECIPIENT_LINKS_API = '/api/personalization/recipient-links'

export interface RecipientLink {
  id: string; label: string; createdAt: string; expiresAt: string | null; revokedAt: string | null
  status: 'live' | 'revoked' | 'expired'
  views: number; plays: number; completes: number; ctaClicks: number; leads: number; lastSeen: string | null
}
export interface IssuedLink { id: string; label: string; token: string; url: string }

export type LinksFailure = 'unauthenticated' | 'unavailable' | 'not-found' | 'limit' | 'duplicate' | 'invalid' | 'rate-limited' | 'error'
export type LinksResult<T> = { ok: true; data: T } | { ok: false; reason: LinksFailure; message: string }

const MESSAGES: Record<LinksFailure, string> = {
  unauthenticated: 'Sign in to create personal links.',
  unavailable: 'Personal links are not available on this server yet.',
  'not-found': 'That video was not found in your account. Publish it first, and check the address.',
  limit: 'You have reached the limit of links for this video. Revoke some first.',
  duplicate: 'A live link already exists for one of these names. Revoke it first, or use a different name.',
  invalid: 'Those names could not be used. Names must be 1–80 characters and different from each other.',
  'rate-limited': 'Too many requests. Wait a minute and try again.',
  error: 'Something went wrong on the server. Nothing was changed.',
}
const fail = <T,>(reason: LinksFailure, message?: string): LinksResult<T> => ({ ok: false, reason, message: message ?? MESSAGES[reason] })

async function call(fetchFn: typeof fetch, url: string, init: RequestInit): Promise<{ status: number; json: Record<string, any> | null } | null> {
  try {
    const res = await fetchFn(url, { credentials: 'same-origin', ...init })
    let json: Record<string, any> | null = null
    try { json = await res.json() } catch { json = null }
    return { status: res.status, json }
  } catch { return null }
}

function reasonFor(status: number, code: unknown): LinksFailure {
  if (status === 401 || status === 403) return 'unauthenticated'
  if (status === 404) return code === 'NOT_FOUND' ? 'not-found' : 'unavailable'
  if (status === 405) return 'unavailable'
  if (status === 409) return code === 'DUPLICATE_LABEL' ? 'duplicate' : 'limit'
  if (status === 429) return 'rate-limited'
  if (status === 400 || status === 413) return 'invalid'
  return 'error'
}

/** Pulls a video id out of a pasted watch address or a bare id. */
export function parseVideoId(input: string): string | null {
  const s = String(input ?? '').trim()
  if (isVideoId(s)) return s
  try { const m = new URL(s).pathname.match(/\/(?:watch|embed)\/([A-Za-z0-9_-]{8,32})(?:[/?#]|$)/); return m && VIDEO_ID.test(m[1]) ? m[1] : null } catch { return null }
}

export async function listRecipientLinks(videoId: string, fetchFn: typeof fetch = fetch): Promise<LinksResult<RecipientLink[]>> {
  if (!isVideoId(videoId)) return fail('invalid', 'That is not a valid video address.')
  const r = await call(fetchFn, `${RECIPIENT_LINKS_API}?videoId=${encodeURIComponent(videoId)}`, { method: 'GET' })
  if (!r) return fail('unavailable')
  if (r.status !== 200) return fail(reasonFor(r.status, r.json?.error))
  if (!r.json || r.json.ok !== true || !Array.isArray(r.json.links)) return fail('unavailable')
  return { ok: true, data: r.json.links as RecipientLink[] }
}

export async function issueRecipientLinks(videoId: string, labels: string[], opts: { expiresInDays?: number | null } = {}, fetchFn: typeof fetch = fetch): Promise<LinksResult<IssuedLink[]>> {
  if (!isVideoId(videoId)) return fail('invalid', 'That is not a valid video address.')
  const plan = planLabels(labels)
  if (plan.labels.length === 0) return fail('invalid', 'Add at least one name.')
  if (plan.problems.length) return fail('invalid', `Fix these first: ${plan.problems.map((p) => `"${p.label}" (${p.reason === 'duplicate' ? 'repeated' : p.reason === 'empty' ? 'empty' : 'too long'})`).join(', ')}.`)
  if (plan.tooMany) return fail('invalid', `At most ${MAX_ISSUE_BATCH} links at a time.`)
  const r = await call(fetchFn, RECIPIENT_LINKS_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, labels: plan.labels, ...(opts.expiresInDays ? { expiresInDays: opts.expiresInDays } : {}) }) })
  if (!r) return fail('unavailable')
  if (r.status !== 200) return fail(reasonFor(r.status, r.json?.error), r.json?.message && r.status === 409 ? String(r.json.message) : undefined)
  const links = r.json?.links
  if (!r.json || r.json.ok !== true || !Array.isArray(links) || links.length !== plan.labels.length) return fail('error')
  return { ok: true, data: links as IssuedLink[] }
}

export async function revokeRecipientLink(id: string, fetchFn: typeof fetch = fetch): Promise<LinksResult<true>> {
  const r = await call(fetchFn, `${RECIPIENT_LINKS_API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r) return fail('unavailable')
  if (r.status === 404) return fail('not-found', 'That link was not found (it may already be revoked).')
  if (r.status !== 200) return fail(reasonFor(r.status, r.json?.error))
  return { ok: true, data: true }
}
