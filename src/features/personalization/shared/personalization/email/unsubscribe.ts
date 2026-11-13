/**
 * Unsubscribe tokens, suppression helpers and list-unsubscribe headers (Stage 9). Pure and isomorphic (Web Crypto).
 *
 * An unsubscribe link carries a SIGNED token: base64url(JSON {o: owner id, h: sha256 of the normalised address, t: issued-at seconds})
 * + "." + base64url(HMAC-SHA256(secret, payload)). The server verifies the signature before recording anything, so nobody can
 * unsubscribe (or, by editing a token, subscribe) someone else's address, and the address itself is not in the link.
 */

export const TOKEN_MAX_AGE_DAYS = 730

type CryptoLike = { subtle: SubtleCrypto }
const cr = (): CryptoLike => { const c = (globalThis as { crypto?: CryptoLike }).crypto; if (!c?.subtle) throw new Error('No Web Crypto API available.'); return c }
const enc = new TextEncoder()
const b64u = (bytes: Uint8Array): string => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
const fromB64u = (s: string): Uint8Array => { const p = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4); const bin = atob(p); return Uint8Array.from(bin, (c) => c.charCodeAt(0)) }

/** Lower-case, trimmed. (Plus-addressing and dots are NOT collapsed: they can be different mailboxes.) */
export const normalizeAddress = (email: string): string => String(email ?? '').trim().toLowerCase()

export async function hashAddress(email: string): Promise<string> {
  const d = await cr().subtle.digest('SHA-256', enc.encode(normalizeAddress(email)))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await cr().subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await cr().subtle.sign('HMAC', key, enc.encode(data)))
}

/** Constant-time comparison (no early exit on the first differing byte). */
export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export interface UnsubscribePayload { o: string; h: string; t: number }

export async function signUnsubscribe(secret: string, p: { owner: string; hash: string; issuedAt?: number }): Promise<string> {
  if (!secret || secret.length < 16) throw new Error('The unsubscribe secret is missing or too short.')
  if (!p.owner || !/^[a-f0-9]{64}$/.test(p.hash)) throw new Error('Invalid unsubscribe payload.')
  const body = b64u(enc.encode(JSON.stringify({ o: p.owner, h: p.hash, t: p.issuedAt ?? Math.floor(Date.now() / 1000) } satisfies UnsubscribePayload)))
  return `${body}.${b64u(await hmac(secret, body))}`
}

export type VerifyResult = { ok: true; owner: string; hash: string; issuedAt: number } | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'unconfigured' }

export async function verifyUnsubscribe(secret: string, token: unknown, now = Date.now()): Promise<VerifyResult> {
  if (!secret || secret.length < 16) return { ok: false, reason: 'unconfigured' }
  if (typeof token !== 'string' || token.length > 600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return { ok: false, reason: 'malformed' }
  const [body, sig] = token.split('.')
  let given: Uint8Array
  try { given = fromB64u(sig) } catch { return { ok: false, reason: 'malformed' } }
  if (!safeEqual(given, await hmac(secret, body))) return { ok: false, reason: 'bad-signature' }
  let p: UnsubscribePayload
  try { p = JSON.parse(new TextDecoder().decode(fromB64u(body))) } catch { return { ok: false, reason: 'malformed' } }
  if (!p || typeof p.o !== 'string' || !p.o || typeof p.h !== 'string' || !/^[a-f0-9]{64}$/.test(p.h) || !Number.isFinite(p.t)) return { ok: false, reason: 'malformed' }
  if (now / 1000 - p.t > TOKEN_MAX_AGE_DAYS * 86400 || p.t > now / 1000 + 300) return { ok: false, reason: 'expired' }
  return { ok: true, owner: p.o, hash: p.h, issuedAt: p.t }
}

export function unsubscribeUrl(base: string, token: string): string {
  const u = new URL('/api/outreach-unsubscribe', base)
  u.searchParams.set('t', token)
  return u.toString()
}

/** RFC 2369 + RFC 8058 one-click headers. Gmail and Yahoo require them for bulk senders. */
export function listUnsubscribeHeaders(url: string, mailto?: string): Record<string, string> {
  const parts = [`<${url}>`]
  if (mailto) parts.push(`<mailto:${mailto}?subject=unsubscribe>`)
  return { 'List-Unsubscribe': parts.join(', '), 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}

export interface RecipientInput { email: string; values?: Record<string, string> }
export interface RecipientPlan<T extends RecipientInput = RecipientInput> {
  allowed: Array<T & { hash: string }>
  suppressed: Array<T & { hash: string }>
  invalid: Array<{ email: string; reason: string }>
  duplicates: string[]
}

/** Splits a list into who may be emailed and who may not: invalid addresses, duplicates, and anyone on the suppression list. */
export async function planRecipients<T extends RecipientInput>(list: T[], suppressedHashes: Iterable<string>, isValid: (e: string) => boolean): Promise<RecipientPlan<T>> {
  const sup = new Set(suppressedHashes)
  const seen = new Set<string>()
  const plan: RecipientPlan<T> = { allowed: [], suppressed: [], invalid: [], duplicates: [] }
  for (const r of list) {
    const email = normalizeAddress(r.email)
    if (!isValid(email)) { plan.invalid.push({ email: String(r.email ?? '').slice(0, 80), reason: 'not a valid email address' }); continue }
    const hash = await hashAddress(email)
    if (seen.has(hash)) { plan.duplicates.push(email); continue }
    seen.add(hash)
    ;(sup.has(hash) ? plan.suppressed : plan.allowed).push({ ...r, email, hash })
  }
  return plan
}
