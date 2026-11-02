/**
 * Shared MuAPI upload adapter — the single client-side entry point for every
 * "put bytes somewhere MuAPI can read them" operation.
 *
 * Why this module exists
 * ----------------------
 * Three thin wrappers used to hand-roll the same multipart POST against
 * MuAPI's upload endpoint (`src/lib/muapi.js`, `src/shared/api/muapiImage.ts`,
 * `src/shared/api/vfx.ts`), each with its own copy of the limits, its own
 * error strings and its own idea of what the resulting URL means. This adapter
 * is the one place that knows:
 *
 *   1. the size + MIME contract — delegated to `./uploadConfig` so there is
 *      exactly one allowlist in the repo;
 *   2. that every browser call goes through the same-origin
 *      `/api/v1/upload_file` route, which is the only holder of the upstream
 *      `x-api-key` (no server-side fallback key exists anywhere in this repo);
 *   3. that a MuAPI upload URL is TEMPORARY — it expires after one hour — so
 *      it must never be recorded as an asset's permanent identifier;
 *   4. that the permanent identifier is the durable-storage reference, and
 *      that re-uploading the durable original is the way to obtain a fresh
 *      MuAPI URL once the cached one has expired.
 *
 * Deliberate constraints enforced here:
 *   - No `process.env` / `Deno.env` read of any kind. This module is imported
 *     by browser bundles and is scanned by the BYOK source guard.
 *   - The multipart `Content-Type` is NEVER set by hand: the client must
 *     generate the boundary, otherwise the route cannot parse the form.
 *   - Nothing is logged and no upstream body is retained. Errors surface as
 *     structured objects the caller renders, so neither identifiers nor key
 *     material can reach a console or a response.
 */

import {
  getUploadLimit,
  isAllowedUploadMimeType,
  normalizeImageMimeType,
  type UploadCategory,
} from './uploadConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one sanctioned browser hop. The route holds the upstream key, applies
 * the entitlement check and the size/MIME contract, and re-issues the call to
 * `https://api.muapi.ai/api/v1/upload_file`.
 */
export const MUAPI_UPLOAD_ROUTE = '/api/v1/upload_file'

/**
 * Direct upstream URL, used ONLY when there is no same-origin route to proxy
 * through (SSR, or the Electron `file://` renderer). It requires an explicit,
 * caller-owned BYOK key; this module never supplies one and never falls back
 * to any server-side key.
 */
export const MUAPI_DIRECT_UPLOAD_URL = 'https://api.muapi.ai/api/v1/upload_file'

/** MuAPI upload URLs expire one hour after they are issued. */
export const MUAPI_URL_LIFETIME_MS = 60 * 60 * 1000

/**
 * Shave a minute off the documented lifetime so a URL that is about to die is
 * never handed to a caller as if it were usable. Caching therefore stays
 * strictly *within* the verified usable lifetime.
 */
export const MUAPI_URL_SAFETY_MARGIN_MS = 60 * 1000

/** Bounded retry budget for a single adapter upload call. */
export const MUAPI_MAX_UPLOAD_ATTEMPTS = 3

/** Ceiling on the delay inserted between two adapter attempts. */
export const MUAPI_RETRY_BASE_DELAY_MS = 500

/**
 * Largest file whose bytes may cross the serverless request hop.
 *
 * Netlify Functions — which is what `@netlify/plugin-nextjs` runs Next.js API
 * routes on — cap a buffered function request payload at 6 MB, and binary
 * bodies are Base64-encoded on the way in, which costs ~30%, for an effective
 * ~4.5 MB ceiling on a video upload. Anything larger takes the durable-first
 * path below: the bytes go straight to authorized storage and the server
 * re-uploads from there, so only a JSON asset id crosses the function.
 */
export const MUAPI_BROWSER_HOP_MAX_BYTES = 4.5 * 1024 * 1024

/** Durable bucket for MuAPI-bound originals. */
export const MUAPI_DURABLE_BUCKET = 'personalization-assets'

// ─────────────────────────────────────────────────────────────────────────────
// Error classification
// ─────────────────────────────────────────────────────────────────────────────

export type MuAPIUploadErrorClass =
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'unsupported_format'
  | 'over_limit'
  | 'network_error'
  | 'timeout'
  | 'rate_limited'
  | 'provider_error'
  | 'invalid_response'
  | 'expired_url'
  | 'reupload_failed'
  | 'workspace_denied'
  | 'storage_unavailable'

/**
 * One distinct, human-readable message per class.
 *
 * `missing_api_key` deliberately reuses the repo-wide MuAPI wording so the
 * Settings prompt is identical on every surface. Keep this string in sync with
 * `MUAPI_KEY_MISSING_ERROR` in `src/shared/api/vfx.ts`.
 */
const UPLOAD_ERROR_MESSAGES: Record<MuAPIUploadErrorClass, string> = {
  missing_api_key: 'Add your MuAPI API key in Settings to use this feature.',
  invalid_api_key: 'MuAPI rejected that API key. Re-enter it in Settings and try again.',
  insufficient_credits:
    'Your MuAPI credit balance is too low for this upload. Top up your MuAPI account and try again.',
  unsupported_format:
    'That file format is not supported. Use JPG, PNG or WebP images, MP4, MOV or WebM video, or a ZIP, PDF or JSON file.',
  over_limit:
    'That file is too large. Images, audio and other files max out at 10 MB; video maxes out at 50 MB.',
  network_error: 'The upload was interrupted. Check your connection and try again.',
  timeout: 'The upload took too long and timed out. Try again, ideally with a smaller file.',
  rate_limited: 'Too many uploads in a row. Wait a few seconds and try again.',
  provider_error: 'MuAPI could not finish the upload right now. Please try again in a moment.',
  invalid_response: 'MuAPI did not return a usable file link. Please try again.',
  expired_url: 'This media link expired after an hour. Re-uploading the original now.',
  reupload_failed: 'We could not refresh this media link. Re-upload the original file to continue.',
  workspace_denied: 'That media belongs to a different workspace, so it cannot be used here.',
  storage_unavailable:
    'Durable storage is not configured, so this file cannot be saved for later re-use.',
}

const UPLOAD_ERROR_TITLES: Record<MuAPIUploadErrorClass, string> = {
  missing_api_key: 'API key needed',
  invalid_api_key: 'API key rejected',
  insufficient_credits: 'Not enough MuAPI credit',
  unsupported_format: 'Unsupported file format',
  over_limit: 'File too large',
  network_error: 'Connection interrupted',
  timeout: 'Upload timed out',
  rate_limited: 'Too many requests',
  provider_error: 'Upload failed',
  invalid_response: 'Upload failed',
  expired_url: 'Media link expired',
  reupload_failed: 'Could not refresh media link',
  workspace_denied: 'Not your workspace',
  storage_unavailable: 'Storage unavailable',
}

/**
 * Classes where another attempt can plausibly succeed — and therefore the
 * classes this adapter will retry automatically, within its bounded budget.
 * Everything else fails fast so the user is never left waiting on a retry
 * loop that cannot help (a bad key, a rejected format, an empty balance).
 */
const RETRYABLE_CLASSES = new Set<MuAPIUploadErrorClass>([
  'network_error',
  'rate_limited',
  'provider_error',
])

export interface MuAPIUploadErrorInfo {
  /** Stable machine-readable class. */
  class: MuAPIUploadErrorClass
  /** Short headline for a toast. */
  title: string
  /** Full user-facing sentence. */
  message: string
  /** Whether a retry can plausibly succeed. */
  retryable: boolean
  /** Upstream HTTP status when one was observed. */
  status?: number
}

/** Error carrying its own classification, so callers can re-map it losslessly. */
export class MuAPIUploadError extends Error {
  readonly class: MuAPIUploadErrorClass
  readonly status?: number
  readonly retryable: boolean

  constructor(errorClass: MuAPIUploadErrorClass, status?: number) {
    super(UPLOAD_ERROR_MESSAGES[errorClass])
    this.name = 'MuAPIUploadError'
    this.class = errorClass
    this.status = status
    this.retryable = RETRYABLE_CLASSES.has(errorClass)
  }
}

export function createMuAPIUploadError(
  errorClass: MuAPIUploadErrorClass,
  status?: number,
): MuAPIUploadError {
  return new MuAPIUploadError(errorClass, status)
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['message', 'error', 'detail', 'reason', 'code']) {
      if (typeof record[key] === 'string') return String(record[key])
    }
  }
  return value === undefined || value === null ? '' : String(value)
}

function asStatus(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['status', 'statusCode', 'httpStatus']) {
      if (typeof record[key] === 'number' && Number.isFinite(record[key])) {
        return record[key] as number
      }
    }
  }
  return undefined
}

/** An already-classified failure, carried by class rather than by message. */
function asErrorClass(value: unknown): MuAPIUploadErrorClass | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['class', 'uploadErrorClass']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate in UPLOAD_ERROR_MESSAGES) {
      return candidate as MuAPIUploadErrorClass
    }
  }
  return null
}

function toInfo(errorClass: MuAPIUploadErrorClass, status?: number): MuAPIUploadErrorInfo {
  return {
    class: errorClass,
    title: UPLOAD_ERROR_TITLES[errorClass],
    message: UPLOAD_ERROR_MESSAGES[errorClass],
    retryable: RETRYABLE_CLASSES.has(errorClass),
    status,
  }
}

/**
 * Classify an arbitrary failure into exactly one user-facing error.
 *
 * The rules are ordered narrow → broad so every class stays reachable, and
 * every rule's pattern is written against this module's own messages so a
 * plain `Error` round-trips back to the same class.
 */
export function handleMuAPIUploadError(error: unknown): MuAPIUploadErrorInfo {
  if (error instanceof MuAPIUploadError) {
    return toInfo(error.class, error.status)
  }

  // A failure that already carries its own classification (a wrapped adapter
  // error, or a normalised error from another entry point) is passed through
  // untouched rather than re-guessed from its text.
  const declaredClass = asErrorClass(error)
  if (declaredClass) return toInfo(declaredClass, asStatus(error))

  const message = asText(error)
  const status = asStatus(error)
  const text = message.toLowerCase()
  const isAuthStatus = status === 401 || status === 403

  // 1. Missing key — the actionable one. Also matches the repo-wide wording.
  if (
    status === undefined ||
    isAuthStatus
  ) {
    if (
      /add\s+your\s+muapi\s+api\s*key|api\s*key\s+(is\s+)?(missing|required|not\s+(set|provided))|missing\s+(api\s*)?key|no\s+(api\s*)?key/i.test(
        text,
      )
    ) {
      return toInfo('missing_api_key', status)
    }
  }

  // 2. Rejected key.
  if (
    isAuthStatus ||
    /rejected|invalid\s+(api\s*)?key|authentication\s+failed|unauthorized/i.test(text)
  ) {
    return toInfo('invalid_api_key', status)
  }

  // 3. Billing. Checked before rate limiting so a 402 is never read as a 429.
  if (
    status === 402 ||
    /insufficient|not\s+enough|out\s+of\s+credit|no\s+credits?\s+left|credit\s+balance|quota|payment\s+required/i.test(
      text,
    )
  ) {
    return toInfo('insufficient_credits', status)
  }

  // 4. Throttling.
  if (status === 429 || /too\s+many|rate\s*limit|throttl/i.test(text)) {
    return toInfo('rate_limited', status)
  }

  // 5. Size.
  if (
    status === 413 ||
    /file\s+too\s+large|too\s+large|payload\s+too\s+large|exceeds?\s+(the\s+)?(maximum|limit|size)|max(imum)?\s*[:=]?\s*\d+\s*mb/i.test(
      text,
    )
  ) {
    return toInfo('over_limit', status)
  }

  // 6. Format.
  if (
    /invalid\s+file\s+type|unsupported\s+(file\s*)?(type|format)|file\s+type\s+not\s+allowed|not\s+(a\s+)?supported\s+format|format\s+is\s+not\s+supported|not\s+an?\s+allowed|not\s+supported/i.test(
      text,
    )
  ) {
    return toInfo('unsupported_format', status)
  }

  // 7. Timeout.
  if (
    /timed\s*out|timeout|aborted|abort/i.test(text) ||
    (error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError')
  ) {
    return toInfo('timeout', status)
  }

  // 8. Transport.
  if (
    /network|failed\s+to\s+fetch|fetch\s+failed|connection|interrupted|econn|enotfound|offline|socket\s+hang\s+up|load\s+failed/i.test(
      text,
    )
  ) {
    return toInfo('network_error', status)
  }

  // 9. Malformed provider reply.
  if (
    /no\s+url|missing\s+url|url\s+missing|invalid\s+url|not\s+a\s+valid\s+url|failed\s+to\s+parse|did\s+not\s+return|usable\s+file\s+link/i.test(
      text,
    )
  ) {
    return toInfo('invalid_response', status)
  }

  // 10. Expired temporary URL.
  if (/expired|expiry|lifetime/i.test(text)) {
    return toInfo('expired_url', status)
  }

  // 11. Failed re-upload.
  if (/re-?upload|could\s+not\s+refresh/i.test(text)) {
    return toInfo('reupload_failed', status)
  }

  // 12. Authorization scope.
  if (
    /workspace|not\s+authoriz|forbidden|cross-?tenant|different\s+(workspace|account|user)|ownership/i.test(
      text,
    )
  ) {
    return toInfo('workspace_denied', status)
  }

  // 13. Durable storage.
  if (/durable|storage|bucket/i.test(text)) {
    return toInfo('storage_unavailable', status)
  }

  // 14./15. Anything upstream that reached us, or anything unrecognised.
  return toInfo('provider_error', status)
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export interface MuAPIValidationSuccess {
  ok: true
  category: UploadCategory
  mimeType: string
  name: string
  size: number
  maxBytes: number
}

export interface MuAPIValidationFailure {
  ok: false
  message: string
  errorClass: MuAPIUploadErrorClass
}

export type MuAPIValidationResult = MuAPIValidationSuccess | MuAPIValidationFailure

function categoryForMimeType(mimeType: string): UploadCategory | null {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/zip' || mimeType === 'application/pdf' || mimeType === 'application/json') {
    return 'other'
  }
  return null
}

function limitForCategory(category: UploadCategory): number {
  // Videos get the 50 MB MuAPI budget; images, audio and the documented
  // ".zip .pdf .json" others all get 10 MB.
  return category === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024
}

/**
 * Validate a file against the single shared upload contract before any byte
 * leaves the browser: the MIME allowlist, the per-category size ceiling, and
 * the presence of a usable Blob.
 */
export function validateMuAPIUpload(file: unknown): MuAPIValidationResult {
  const candidate = file as Partial<File> | null | undefined

  if (!candidate || typeof candidate !== 'object') {
    return {
      ok: false,
      message: UPLOAD_ERROR_MESSAGES.unsupported_format,
      errorClass: 'unsupported_format',
    }
  }

  const rawType = typeof candidate.type === 'string' ? candidate.type : ''
  const mimeType = normalizeImageMimeType(rawType.toLowerCase().split(';')[0].trim())
  const name = typeof candidate.name === 'string' && candidate.name ? candidate.name : 'file'
  const size = typeof candidate.size === 'number' ? candidate.size : NaN

  if (!mimeType) {
    return {
      ok: false,
      message: `"${name}" does not declare a file type, so it cannot be uploaded.`,
      errorClass: 'unsupported_format',
    }
  }

  const category = categoryForMimeType(mimeType)
  if (!category || !isAllowedUploadMimeType({ type: mimeType } as File)) {
    return {
      ok: false,
      message: UPLOAD_ERROR_MESSAGES.unsupported_format,
      errorClass: 'unsupported_format',
    }
  }

  if (!Number.isFinite(size) || size <= 0) {
    return {
      ok: false,
      message: `"${name}" is empty, so there is nothing to upload.`,
      errorClass: 'unsupported_format',
    }
  }

  const maxBytes = limitForCategory(category)
  if (size > maxBytes) {
    return {
      ok: false,
      message: UPLOAD_ERROR_MESSAGES.over_limit,
      errorClass: 'over_limit',
    }
  }

  return { ok: true, category, mimeType, name, size, maxBytes }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth context
// ─────────────────────────────────────────────────────────────────────────────

export interface MuAPIAuthContext {
  /**
   * The caller's AUTHORIZED workspace, derived from the signed-in identity —
   * never from a client-supplied record id. Every durable read and write is
   * scoped to it and the server re-derives it from the session, so a spoofed
   * value cannot reach another workspace's media.
   */
  workspaceId: string
  /** Optional MuAPI-owned asset id; required for durable persistence + resolve. */
  assetId?: string | null
  /** Caller-owned BYOK key. This module never reads, derives or stores one. */
  apiKey?: string | null
  /** Override for tests / non-browser hosts. Must be a full URL. */
  uploadEndpoint?: string
  /** Injectable fetch boundary (tests). */
  fetchImpl?: typeof fetch
  /** Injectable durable store (tests / non-Supabase deployments). */
  durableStore?: MuAPIDurableStore | null
  /** Injectable clock (tests). */
  now?: () => number
  /** Injectable MuAPI URL cache (tests). */
  urlCache?: MuAPIURLCache
}

interface ResolvedAuthContext {
  workspaceId: string
  assetId: string | null
  apiKey: string | null
  endpoint: string
  fetchImpl: typeof fetch
  durableStore: MuAPIDurableStore | null
  now: () => number
  urlCache: MuAPIURLCache
}

function assertWorkspaceId(workspaceId: unknown): string {
  if (typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    throw createMuAPIUploadError('workspace_denied')
  }
  return workspaceId.trim()
}

/** One path segment: no separators, no traversal, bounded length. */
function assertAssetId(assetId: unknown): string {
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    throw createMuAPIUploadError('workspace_denied')
  }
  const trimmed = assetId.trim()
  // A separator or traversal sequence in an id is exactly how a caller would
  // try to reach outside its own workspace prefix.
  if (/[\/\\]|\.\./.test(trimmed)) {
    throw createMuAPIUploadError('workspace_denied')
  }
  return trimmed
}

function resolveEndpoint(auth: MuAPIAuthContext): string {
  if (typeof auth.uploadEndpoint === 'string' && auth.uploadEndpoint.trim() !== '') {
    return auth.uploadEndpoint.trim()
  }
  if (typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol)) {
    return MUAPI_UPLOAD_ROUTE
  }
  return MUAPI_DIRECT_UPLOAD_URL
}

let defaultDurableStore: MuAPIDurableStore | null | undefined

async function getDefaultDurableStore(): Promise<MuAPIDurableStore | null> {
  if (defaultDurableStore !== undefined) return defaultDurableStore
  try {
    // Lazy on purpose: `./supabase` constructs a client at module scope from
    // NEXT_PUBLIC_* env vars, so importing it eagerly would break every
    // server-side and test consumer of this adapter.
    const mod = await import('./supabase')
    const storage = (mod.supabase as unknown as { storage: SupabaseStorageClient }).storage
    defaultDurableStore = createSupabaseDurableStore(storage)
  } catch {
    defaultDurableStore = null
  }
  return defaultDurableStore
}

function resolveAuth(auth: MuAPIAuthContext): ResolvedAuthContext {
  if (!auth || typeof auth !== 'object') {
    throw createMuAPIUploadError('workspace_denied')
  }
  const apiKey =
    typeof auth.apiKey === 'string' && auth.apiKey.trim() !== '' ? auth.apiKey.trim() : null
  return {
    workspaceId: assertWorkspaceId(auth.workspaceId),
    assetId:
      typeof auth.assetId === 'string' && auth.assetId.trim() !== '' ? auth.assetId.trim() : null,
    apiKey,
    endpoint: resolveEndpoint(auth),
    fetchImpl: auth.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args)),
    durableStore: auth.durableStore === undefined ? null : auth.durableStore,
    now: auth.now ?? (() => Date.now()),
    urlCache: auth.urlCache ?? sharedUrlCache,
  }
}

async function resolveDurableStore(
  context: ResolvedAuthContext,
): Promise<MuAPIDurableStore | null> {
  if (context.durableStore !== null) return context.durableStore
  return getDefaultDurableStore()
}

// ─────────────────────────────────────────────────────────────────────────────
// Durable storage
// ─────────────────────────────────────────────────────────────────────────────

export interface MuAPIDurableOriginal {
  blob: Blob
  name: string
  type: string
}

export interface MuAPIDurableRecord {
  workspaceId: string
  assetId: string
  /** Durable reference (Supabase object path). The permanent identifier. */
  durableRef: string
  /** Public URL of the durable object, when the bucket is public. */
  durableUrl: string | null
  name: string
  type: string
  size: number
}

export interface MuAPIDurablePutInput {
  workspaceId: string
  assetId: string
  blob: Blob
  name: string
  type: string
}

/**
 * The durable side of the adapter: `put` writes the ORIGINAL bytes, `open`
 * reads them back for a re-upload. Injected in tests, lazily defaulted to
 * Supabase Storage in the browser.
 */
export interface MuAPIDurableStore {
  put(input: MuAPIDurablePutInput): Promise<MuAPIDurableRecord>
  open(workspaceId: string, durableRef: string): Promise<MuAPIDurableOriginal | null>
}

/** One path segment: no separators, no traversal, bounded length. */
function sanitizeSegment(value: string, fallback = 'x'): string {
  const cleaned = String(value)
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 96)
  return cleaned || fallback
}

export function muapiDurableObjectPath(workspaceId: string, assetId: string, name: string): string {
  return `${sanitizeSegment(workspaceId)}/${sanitizeSegment(assetId)}/${sanitizeSegment(name || 'file', 'file')}`
}

interface SupabaseStorageBucket {
  upload(
    path: string,
    body: Blob,
    options?: { upsert?: boolean; contentType?: string },
  ): Promise<{ error: { message?: string } | null }>
  download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }>
  getPublicUrl(path: string): { data: { publicUrl: string } }
}

interface SupabaseStorageClient {
  from(bucket: string): SupabaseStorageBucket
}

/**
 * Default durable store: direct browser → Supabase Storage, so no serverless
 * request payload limit sits between the user and their own file. The object
 * path is derived from the AUTHORIZED workspace + asset id, which is what
 * makes a cross-workspace read structurally impossible rather than merely
 * filtered after the fact.
 */
export function createSupabaseDurableStore(
  client: SupabaseStorageClient,
  bucket: string = MUAPI_DURABLE_BUCKET,
): MuAPIDurableStore {
  return {
    async put({ workspaceId, assetId, blob, name, type }) {
      const durableRef = muapiDurableObjectPath(workspaceId, assetId, name)
      const { error } = await client.from(bucket).upload(durableRef, blob, {
        upsert: true,
        contentType: type || 'application/octet-stream',
      })
      if (error) throw createMuAPIUploadError('storage_unavailable')
      const { data } = client.from(bucket).getPublicUrl(durableRef)
      return {
        workspaceId,
        assetId,
        durableRef,
        durableUrl: data?.publicUrl ?? null,
        name,
        type,
        size: blob.size,
      }
    },

    async open(workspaceId, durableRef) {
      const objectPath = `${sanitizeSegment(workspaceId)}/${String(durableRef)}`
      const { data, error } = await client.from(bucket).download(objectPath)
      if (error || !data) return null
      return {
        blob: data,
        name: String(durableRef).split('/').pop() || 'file',
        type: data.type || 'application/octet-stream',
      }
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MuAPI URL cache (bounded to the verified usable lifetime)
// ─────────────────────────────────────────────────────────────────────────────

export interface MuAPIURLCacheEntry {
  url: string
  durableRef: string
  uploadedAt: number
  expiresAt: number
}

export interface MuAPIURLCache {
  read(key: string): MuAPIURLCacheEntry | null
  write(key: string, entry: MuAPIURLCacheEntry): void
  delete(key: string): void
}

export function muapiUrlCacheKey(workspaceId: string, assetId: string): string {
  return `${workspaceId}::${assetId}`
}

const MEMORY_CACHE_LIMIT = 256

function createMemoryUrlCache(): MuAPIURLCache {
  const memory = new Map<string, MuAPIURLCacheEntry>()
  return {
    read(key) {
      return memory.get(key) ?? null
    },
    write(key, entry) {
      // Bound the cache so a long session cannot grow it without limit.
      if (memory.size >= MEMORY_CACHE_LIMIT && !memory.has(key)) {
        const oldest = memory.keys().next().value
        if (oldest !== undefined) memory.delete(oldest)
      }
      memory.set(key, entry)
    },
    delete(key) {
      memory.delete(key)
    },
  }
}

const memoryUrlCache = createMemoryUrlCache()
const URL_CACHE_STORAGE_KEY = 'muapi_upload_url_cache_v1'

function readPersistedCache(): Record<string, MuAPIURLCacheEntry> {
  try {
    const raw = window.localStorage.getItem(URL_CACHE_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePersistedCache(cache: Record<string, MuAPIURLCacheEntry>): void {
  try {
    window.localStorage.setItem(URL_CACHE_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // A full or unavailable localStorage is not an upload failure: the
    // in-memory copy still serves this session.
  }
}

/** Process-wide in-memory cache, mirrored into localStorage when available. */
const sharedUrlCache: MuAPIURLCache = {
  read(key) {
    const fromMemory = memoryUrlCache.read(key)
    if (fromMemory) return fromMemory
    return readPersistedCache()[key] ?? null
  },
  write(key, entry) {
    memoryUrlCache.write(key, entry)
    const persisted = readPersistedCache()
    persisted[key] = entry
    writePersistedCache(persisted)
  },
  delete(key) {
    memoryUrlCache.delete(key)
    const persisted = readPersistedCache()
    delete persisted[key]
    writePersistedCache(persisted)
  },
}

/** True when a cached MuAPI URL must not be trusted any more. */
export function isMuAPIUrlExpired(
  entry: Pick<MuAPIURLCacheEntry, 'url' | 'uploadedAt' | 'expiresAt'> | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!entry || typeof entry.url !== 'string' || entry.url === '') return true
  // A recorded expiry wins; a zero/absent one is not an expiry, so fall
  // through to the issued-at timestamp rather than treating 0 as "already
  // dead" (which would make every legacy entry look permanently expired).
  if (typeof entry.expiresAt === 'number' && Number.isFinite(entry.expiresAt) && entry.expiresAt > 0) {
    return now >= entry.expiresAt
  }
  if (typeof entry.uploadedAt === 'number' && Number.isFinite(entry.uploadedAt) && entry.uploadedAt > 0) {
    return now - entry.uploadedAt >= MUAPI_URL_LIFETIME_MS - MUAPI_URL_SAFETY_MARGIN_MS
  }
  // No usable timestamp at all: never assume validity.
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP plumbing
// ─────────────────────────────────────────────────────────────────────────────

export interface MuAPIUploadResult {
  /** Ephemeral MuAPI URL. NEVER a permanent identifier. */
  url: string
  name: string
  size: number
  type: string
  uploadedAt: number
  expiresAt: number
  /** Where the fresh URL came from. */
  source: 'bytes' | 'durable'
  /** Permanent identifier, when the original was persisted durably. */
  durableRef?: string
  /** Durable public URL, when the original was persisted durably. */
  durableUrl?: string
  /** Attempts actually issued for this call (always bounded). */
  attempts: number
}

export interface MuAPIMediaInput {
  assetId: string
  /** The permanent identifier: durable storage, never the provider URL. */
  durableRef: string
  /** Ephemeral MuAPI URL, guaranteed fresh at the moment it is returned. */
  url: string
  source: 'cache' | 'fresh'
  uploadedAt: number
  expiresAt: number
}

function multipartHeaders(context: ResolvedAuthContext): Record<string, string> | undefined {
  // The boundary MUST come from the client. Setting Content-Type here would
  // drop it and the route could no longer parse the form.
  return context.apiKey ? { 'x-api-key': context.apiKey } : undefined
}

function jsonHeaders(context: ResolvedAuthContext): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (context.apiKey) headers['x-api-key'] = context.apiKey
  return headers
}

/**
 * Parse the MuAPI URL out of the response shapes the route passes through.
 * Only absolute http(s) URLs count, so a malformed or empty reply is a hard
 * failure rather than a silently-broken asset.
 */
export function extractMuAPIUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const data = (record.data ?? null) as Record<string, unknown> | null
  for (const candidate of [record.url, record.file_url, data?.url, data?.file_url]) {
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate
  }
  return null
}

interface RouteResponseShape {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

function responseToError(status: number): MuAPIUploadError {
  return createMuAPIUploadError(handleMuAPIUploadError({ status }).class, status)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function readRouteResponse(response: RouteResponseShape): Promise<MuAPIUploadResult> {
  if (response.ok) {
    const payload = await response.json()
    const url = extractMuAPIUrl(payload)
    if (!url) throw createMuAPIUploadError('invalid_response')
    const record = (payload ?? {}) as Record<string, unknown>
    const durableRef =
      typeof record.durableRef === 'string'
        ? record.durableRef
        : typeof record.durable_ref === 'string'
          ? record.durable_ref
          : undefined
    const durableUrl =
      typeof record.durableUrl === 'string'
        ? record.durableUrl
        : typeof record.durable_url === 'string'
          ? record.durable_url
          : undefined
    return {
      url,
      name: typeof record.name === 'string' ? record.name : 'file',
      size: Number(record.size ?? 0),
      type: typeof record.type === 'string' ? record.type : 'application/octet-stream',
      uploadedAt: Number(record.uploadedAt ?? record.uploaded_at ?? Date.now()),
      expiresAt: Number(record.expiresAt ?? record.expires_at ?? 0),
      source: record.source === 'durable' ? 'durable' : 'bytes',
      durableRef,
      durableUrl,
      attempts: 1,
    }
  }

  // The upstream body is used only to classify, and is never retained: it can
  // carry identifiers that must not escape into a log or a response.
  let bodyText = ''
  try {
    bodyText = await response.text()
  } catch {
    bodyText = ''
  }
  const classified = handleMuAPIUploadError({ status: response.status, message: bodyText })
  throw createMuAPIUploadError(classified.class, response.status)
}

const INFLIGHT_UPLOADS = new Map<string, Promise<MuAPIUploadResult>>()
const INFLIGHT_RESOLVES = new Map<string, Promise<MuAPIMediaInput>>()

/**
 * Idempotency guard: two concurrent callers asking for the very same upload
 * share one in-flight promise, so the bytes cross the wire exactly once.
 */
function dedupe<T>(registry: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
  const existing = registry.get(key)
  if (existing) return existing
  const promise = run()
  registry.set(key, promise)
  const settle = () => {
    if (registry.get(key) === promise) registry.delete(key)
  }
  promise.then(settle, settle)
  return promise
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

async function uploadBytesToMuAPI(
  file: Blob & { name?: string },
  auth: MuAPIAuthContext,
  expectedCategory: UploadCategory,
): Promise<MuAPIUploadResult> {
  const context = resolveAuth(auth)
  const validation = validateMuAPIUpload(file)
  if (!validation.ok) throw createMuAPIUploadError(validation.errorClass)
  if (validation.category !== expectedCategory) {
    throw createMuAPIUploadError('unsupported_format')
  }

  const durableAssetId = context.assetId ? assertAssetId(context.assetId) : null
  const dedupeKey = [
    context.workspaceId,
    validation.category,
    validation.mimeType,
    validation.size,
    validation.name,
    durableAssetId ?? '',
  ].join('::')

  return dedupe(INFLIGHT_UPLOADS, dedupeKey, () =>
    runBoundedUpload(context, file, validation, durableAssetId),
  )
}

async function runBoundedUpload(
  context: ResolvedAuthContext,
  file: Blob & { name?: string },
  validation: MuAPIValidationSuccess,
  durableAssetId: string | null,
): Promise<MuAPIUploadResult> {
  // A file larger than the serverless request budget never crosses the
  // browser→function hop. Its original goes to durable storage first and the
  // route re-uploads from there, so all the function sees is an asset id.
  if (durableAssetId && validation.size > MUAPI_BROWSER_HOP_MAX_BYTES) {
    const durableStore = await resolveDurableStore(context)
    if (durableStore) {
      const record = await durableStore.put({
        workspaceId: context.workspaceId,
        assetId: durableAssetId,
        blob: file,
        name: validation.name,
        type: validation.mimeType,
      })
      const fresh = await postDurableAssetId(context, durableAssetId, MUAPI_MAX_UPLOAD_ATTEMPTS)
      return { ...fresh, durableRef: record.durableRef, attempts: fresh.attempts + 1 }
    }
  }

  let lastError: MuAPIUploadError | null = null
  let attempts = 0
  let durableUrl: string | undefined

  // Whenever an asset id is in play the ORIGINAL is written to durable storage
  // first, so the asset's permanent identifier exists before MuAPI is asked
  // for anything. A file larger than the serverless request budget then stays
  // in storage entirely: only an asset id crosses the browser→function hop.
  let durableRef: string | undefined
  if (durableAssetId) {
    const durableStore = await resolveDurableStore(context)
    if (durableStore) {
      const record = await durableStore.put({
        workspaceId: context.workspaceId,
        assetId: durableAssetId,
        blob: file,
        name: validation.name,
        type: validation.mimeType,
      })
      durableRef = record.durableRef
      durableUrl = record.durableUrl ?? undefined
      attempts += 1

      if (validation.size > MUAPI_BROWSER_HOP_MAX_BYTES) {
        const fresh = await postDurableAssetId(context, durableAssetId, MUAPI_MAX_UPLOAD_ATTEMPTS)
        return {
          ...fresh,
          durableRef,
          durableUrl,
          attempts: attempts + fresh.attempts,
        }
      }
    }
  }

  for (let attempt = 0; attempt < MUAPI_MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    attempts = attempt + 1
    if (attempt > 0) {
      await sleep(Math.min(MUAPI_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), 4_000))
    }
    try {
      const formData = new FormData()
      formData.append('file', file, validation.name)
      if (durableAssetId) formData.append('durable_asset_id', durableAssetId)

      const response = await context.fetchImpl(context.endpoint, {
        method: 'POST',
        // NOTE: no Content-Type — the client generates the multipart boundary.
        headers: multipartHeaders(context),
        body: formData,
        credentials: 'same-origin',
      })

      const result = await readRouteResponse(response as unknown as RouteResponseShape)
      return {
        ...result,
        durableRef: result.durableRef ?? durableRef,
        durableUrl: result.durableUrl ?? durableUrl,
        attempts,
      }
    } catch (error) {
      if (error instanceof MuAPIUploadError) {
        lastError = error
        if (!error.retryable) throw error
        continue
      }
      // Transport failure: classify, then bound-and-retry only when retrying
      // can plausibly help.
      const classified = handleMuAPIUploadError(error)
      if (!classified.retryable) throw createMuAPIUploadError(classified.class, classified.status)
      lastError = createMuAPIUploadError(classified.class, classified.status)
    }
  }

  throw lastError ?? createMuAPIUploadError('provider_error')
}

/** Ask the server to re-upload the durable original: tiny request, tiny reply. */
async function postDurableAssetId(
  context: ResolvedAuthContext,
  assetId: string,
  maxAttempts: number,
): Promise<MuAPIUploadResult> {
  let lastError: MuAPIUploadError | null = null
  let attempts = 0

  for (let attempt = 0; attempt < Math.max(1, maxAttempts); attempt += 1) {
    attempts = attempt + 1
    if (attempt > 0) {
      await sleep(Math.min(MUAPI_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), 4_000))
    }
    try {
      const response = await context.fetchImpl(`${context.endpoint}?durable=resolve`, {
        method: 'POST',
        headers: jsonHeaders(context),
        body: JSON.stringify({ durable_asset_id: assetId }),
        credentials: 'same-origin',
      })
      const result = await readRouteResponse(response as unknown as RouteResponseShape)
      return { ...result, attempts }
    } catch (error) {
      if (error instanceof MuAPIUploadError) {
        lastError = error
        if (!error.retryable) throw error
        continue
      }
      throw createMuAPIUploadError(
        handleMuAPIUploadError(error).class,
        handleMuAPIUploadError(error).status,
      )
    }
  }

  throw lastError ?? createMuAPIUploadError('reupload_failed')
}

/** Read a durable record back from the server. Never trusts a client-supplied id. */
async function fetchDurableRecord(
  context: ResolvedAuthContext,
  assetId: string,
): Promise<{ durableRef: string; durableUrl: string | null; name: string; type: string; size: number } | null> {
  const response = await context.fetchImpl(
    `${context.endpoint}?durable_asset_id=${encodeURIComponent(assetId)}`,
    {
      method: 'GET',
      headers: context.apiKey ? { 'x-api-key': context.apiKey } : undefined,
      credentials: 'same-origin',
    },
  )
  const routeResponse = response as unknown as RouteResponseShape
  // A 403/404 here means the asset is not in THIS workspace: either it does
  // not exist, or it belongs to somebody else. Both are refused identically.
  if (routeResponse.status === 404 || routeResponse.status === 403) return null
  if (!routeResponse.ok) throw responseToError(routeResponse.status)

  const payload = (await routeResponse.json()) as Record<string, unknown>
  const durableRef =
    typeof payload.durableRef === 'string'
      ? payload.durableRef
      : typeof payload.durable_ref === 'string'
        ? payload.durable_ref
        : null
  if (!durableRef) throw createMuAPIUploadError('storage_unavailable')

  return {
    durableRef,
    durableUrl: typeof payload.durableUrl === 'string' ? payload.durableUrl : null,
    name: typeof payload.name === 'string' ? payload.name : 'file',
    type: typeof payload.type === 'string' ? payload.type : 'application/octet-stream',
    size: Number(payload.size ?? 0),
  }
}

/**
 * Upload an image to MuAPI through the shared route.
 *
 * `authContext.assetId` additionally persists the original to durable storage
 * (required for the large-file path, optional otherwise) so the permanent
 * identifier for the asset is the durable reference, not this URL.
 */
export async function uploadImageToMuAPI(
  file: Blob & { name?: string },
  authContext: MuAPIAuthContext,
): Promise<MuAPIUploadResult> {
  return uploadBytesToMuAPI(file, authContext, 'image')
}

/**
 * Upload a video to MuAPI through the shared route.
 *
 * Files larger than the serverless request budget are routed durable-first:
 * the bytes go straight to authorized storage and the server re-uploads from
 * there, so a 50 MB video is never pushed through a Netlify Function body.
 */
export async function uploadVideoToMuAPI(
  file: Blob & { name?: string },
  authContext: MuAPIAuthContext,
): Promise<MuAPIUploadResult> {
  return uploadBytesToMuAPI(file, authContext, 'video')
}

/**
 * Resolve a usable MuAPI media input for an asset.
 *
 * Contract:
 *   1. The workspace is the caller's AUTHORIZED workspace; the server re-derives
 *      it from the session, so another workspace's asset is invisible → denied.
 *   2. A cached MuAPI URL is used only while it is provably inside its verified
 *      usable lifetime. It is never assumed valid.
 *   3. On a miss, an expiry, or a failed use, the DURABLE ORIGINAL is loaded
 *      from authorized storage and re-uploaded to obtain a FRESH MuAPI URL.
 *   4. The permanent identifier returned is always the durable reference.
 */
export async function resolveMuAPIMediaInput(
  assetId: string,
  authContext: MuAPIAuthContext,
): Promise<MuAPIMediaInput> {
  const context = resolveAuth(authContext)
  const safeAssetId = assertAssetId(assetId)
  // Bind the id to the resolved context so the two can never disagree, and so
  // an unauthorized or malformed id is refused before any storage access.
  context.assetId = safeAssetId

  const cacheKey = muapiUrlCacheKey(context.workspaceId, safeAssetId)
  const cached = context.urlCache.read(cacheKey)
  if (cached && !isMuAPIUrlExpired(cached, context.now())) {
    return {
      assetId: safeAssetId,
      durableRef: cached.durableRef,
      url: cached.url,
      source: 'cache',
      uploadedAt: cached.uploadedAt,
      expiresAt: cached.expiresAt,
    }
  }

  return dedupe(INFLIGHT_RESOLVES, cacheKey, () =>
    refreshMuAPIMediaInput(context, safeAssetId, cacheKey),
  )
}

async function refreshMuAPIMediaInput(
  context: ResolvedAuthContext,
  assetId: string,
  cacheKey: string,
): Promise<MuAPIMediaInput> {
  const record = await fetchDurableRecord(context, assetId)
  if (!record) throw createMuAPIUploadError('workspace_denied')

  const uploadedAt = context.now()
  let fresh: MuAPIUploadResult
  try {
    fresh = await postDurableAssetId(context, assetId, MUAPI_MAX_UPLOAD_ATTEMPTS)
  } catch (error) {
    // A failed re-upload is its own class: the URL is gone and we could not
    // get a new one, which the user has to act on.
    const classified = handleMuAPIUploadError(error)
    throw classified.class === 'provider_error'
      ? createMuAPIUploadError('reupload_failed', classified.status)
      : error instanceof MuAPIUploadError
        ? error
        : createMuAPIUploadError(classified.class, classified.status)
  }

  // Cache only inside the verified usable lifetime.
  const expiresAt = uploadedAt + MUAPI_URL_LIFETIME_MS - MUAPI_URL_SAFETY_MARGIN_MS
  context.urlCache.write(cacheKey, {
    url: fresh.url,
    durableRef: record.durableRef,
    uploadedAt,
    expiresAt,
  })

  return {
    assetId,
    durableRef: record.durableRef,
    url: fresh.url,
    source: 'fresh',
    uploadedAt,
    expiresAt,
  }
}

/**
 * Drop a cached MuAPI URL so the next resolve re-uploads the durable original.
 * Call this after a probe or a provider use has failed — that is the signal
 * that the URL is no longer good even though its clock has not run out.
 */
export function invalidateMuAPIMediaInput(assetId: string, authContext: MuAPIAuthContext): void {
  try {
    const context = resolveAuth(authContext)
    const safeAssetId = assertAssetId(assetId)
    context.urlCache.delete(muapiUrlCacheKey(context.workspaceId, safeAssetId))
  } catch {
    // Invalidation is best-effort and must never mask the caller's error.
  }
}

/**
 * Persist the ORIGINAL bytes to durable storage and return the durable
 * reference — the asset's permanent identifier.
 *
 * This is the fix for the defect where the MuAPI temporary URL was written
 * into the asset record as if it were permanent: it expires after an hour, at
 * which point the stored identifier points at nothing.
 */
export async function persistMuAPIAssetOriginal(input: {
  file: Blob & { name?: string }
  assetId: string
  authContext: MuAPIAuthContext
}): Promise<MuAPIDurableRecord> {
  const context = resolveAuth(input.authContext)
  const safeAssetId = assertAssetId(input.assetId)
  const validation = validateMuAPIUpload(input.file)
  if (!validation.ok) throw createMuAPIUploadError(validation.errorClass)

  const durableStore = await resolveDurableStore(context)
  if (!durableStore) throw createMuAPIUploadError('storage_unavailable')

  return durableStore.put({
    workspaceId: context.workspaceId,
    assetId: safeAssetId,
    blob: input.file,
    name: validation.name,
    type: validation.mimeType,
  })
}

export { getUploadLimit, isAllowedUploadMimeType }
