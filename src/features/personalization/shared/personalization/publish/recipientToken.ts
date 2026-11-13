/**
 * Recipient tokens (Stage 8). Every personalized link carries a SERVER-ISSUED, high-entropy, unguessable token; the database
 * stores only its SHA-256 hash, so a leaked table cannot be turned back into working links, and a visitor cannot invent or
 * edit a recipient id (the old `?c=<contactId>` was only regex-checked and trusted).
 *
 *   token   24 random bytes = 192 bits, base64url (32 characters)
 *   hash    SHA-256 hex (64 characters), the only thing stored
 *
 * Isomorphic: uses the Web Crypto API (browsers and Node 20+). Pure otherwise.
 */

export const TOKEN_BYTES = 24
export const TOKEN_LENGTH = 32
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/
export const HASH_PATTERN = /^[a-f0-9]{64}$/
export const MAX_LABEL = 80
export const MAX_ISSUE_BATCH = 200
export const MAX_LINKS_PER_VIDEO = 5000
export const MAX_EXPIRY_DAYS = 730

type CryptoLike = { getRandomValues<T extends ArrayBufferView>(a: T): T; subtle: { digest(alg: string, data: BufferSource): Promise<ArrayBuffer> } }
const webCrypto = (): CryptoLike => {
  const c = (globalThis as { crypto?: CryptoLike }).crypto
  if (!c?.subtle || !c.getRandomValues) throw new Error('This environment has no Web Crypto API, so secure tokens cannot be made.')
  return c
}

const toBase64Url = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A fresh token from the platform's cryptographic random source. */
export function generateRecipientToken(random: (n: number) => Uint8Array = (n) => webCrypto().getRandomValues(new Uint8Array(n))): string {
  const bytes = random(TOKEN_BYTES)
  if (bytes.length !== TOKEN_BYTES) throw new Error('The random source returned the wrong number of bytes.')
  return toBase64Url(bytes)
}

export const isRecipientToken = (v: unknown): v is string => typeof v === 'string' && TOKEN_PATTERN.test(v)

/** SHA-256 of the token, hex. The database stores this, never the token. */
export async function hashRecipientToken(token: string): Promise<string> {
  if (!isRecipientToken(token)) throw new Error('Not a recipient token.')
  const d = await webCrypto().subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Rough entropy check used by tests and by the server's sanity gate: all 32 characters should not be a few repeated symbols. */
export function looksRandom(token: string): boolean {
  if (!isRecipientToken(token)) return false
  return new Set(token).size >= 12
}

export interface LabelProblem { index: number; label: string; reason: 'empty' | 'too-long' | 'duplicate' }

/** Validates and de-duplicates the labels (names/identifiers the owner uses for their own list). */
export function planLabels(raw: unknown[]): { labels: string[]; problems: LabelProblem[]; tooMany: boolean } {
  const labels: string[] = []; const problems: LabelProblem[] = []; const seen = new Set<string>()
  raw.forEach((v, index) => {
    const label = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
    if (!label) { problems.push({ index, label: String(v ?? ''), reason: 'empty' }); return }
    if (label.length > MAX_LABEL) { problems.push({ index, label: label.slice(0, 20) + '…', reason: 'too-long' }); return }
    const k = label.toLowerCase()
    if (seen.has(k)) { problems.push({ index, label, reason: 'duplicate' }); return }
    seen.add(k); labels.push(label)
  })
  return { labels, problems, tooMany: labels.length > MAX_ISSUE_BATCH }
}

export const VIDEO_ID = /^[A-Za-z0-9_-]{8,32}$/
export const isVideoId = (v: unknown): v is string => typeof v === 'string' && VIDEO_ID.test(v)

/** The address a recipient opens. `base` is the site origin; the token travels in the query string and nowhere else. */
export function buildRecipientUrl(base: string, videoId: string, token: string): string {
  if (!isVideoId(videoId)) throw new Error('Not a valid video id.')
  if (!isRecipientToken(token)) throw new Error('Not a valid recipient token.')
  const u = new URL(`/watch/${videoId}`, base)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('The site address must be http(s).')
  u.searchParams.set('r', token)
  return u.toString()
}

/** Reads the token from a page's query string; anything that is not a well-formed token is ignored. */
export function recipientFromSearch(search: string): string | null {
  try { const v = new URLSearchParams(search).get('r'); return isRecipientToken(v) ? v : null } catch { return null }
}

export function expiryFromDays(days: number | null | undefined, now = Date.now()): string | null {
  if (days == null) return null
  if (!Number.isFinite(days) || days <= 0) return null
  return new Date(now + Math.min(MAX_EXPIRY_DAYS, Math.round(days)) * 86_400_000).toISOString()
}

/** CSV of label,url for the owner to paste into a mailer. Values that could be read as spreadsheet formulas are neutralised. */
export function linksToCsv(rows: Array<{ label: string; url: string }>): string {
  const esc = (s: string) => { const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return `"${safe.replace(/"/g, '""')}"` }
  return ['label,url', ...rows.map((r) => `${esc(r.label)},${esc(r.url)}`)].join('\n') + '\n'
}
