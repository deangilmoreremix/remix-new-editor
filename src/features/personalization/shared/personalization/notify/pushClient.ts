/**
 * Browser side of owner notifications (Stage 11). Opt-in: nothing is requested until the owner clicks "Turn on", and the browser's
 * own permission prompt is shown only then. Every outcome is a typed result with a plain message; nothing here throws.
 *
 * The worker lives at /push/sw.js with its own scope, so it never replaces the app's offline-cache worker at /sw.js.
 */
export const PUSH_API = '/api/personalization/push'
export const PUSH_SW_URL = '/push/sw.js'
export const PUSH_SW_SCOPE = '/push/'

export interface PushDevice { label: string | null; createdAt: string; lastSuccessAt: string | null }
export interface PushServerInfo { configured: boolean; publicKey: string | null; devices: PushDevice[]; storage?: 'unavailable' }
export type Unsupported = 'insecure' | 'no-service-worker' | 'no-push' | 'no-notifications'

/** The slice of the browser this module touches, so tests can stand in for it. */
export interface PushEnv {
  isSecureContext?: boolean
  navigator?: { serviceWorker?: ServiceWorkerContainer; userAgent?: string; standalone?: boolean }
  Notification?: { permission: NotificationPermission; requestPermission: () => Promise<NotificationPermission> }
  PushManager?: unknown
  fetchFn?: typeof fetch
}
const envOf = (e?: PushEnv): Required<Pick<PushEnv, 'fetchFn'>> & PushEnv => {
  const g = globalThis as unknown as Record<string, any>
  return { isSecureContext: e?.isSecureContext ?? g.isSecureContext, navigator: e?.navigator ?? g.navigator, Notification: e?.Notification ?? g.Notification, PushManager: e && 'PushManager' in e ? e.PushManager : g.PushManager, fetchFn: e?.fetchFn ?? ((...a: Parameters<typeof fetch>) => (globalThis.fetch as typeof fetch)(...a)) }
}

export function pushSupport(e?: PushEnv): { ok: true } | { ok: false; reason: Unsupported; message: string } {
  const env = envOf(e)
  if (env.isSecureContext === false) return { ok: false, reason: 'insecure', message: 'Notifications need a secure (https) page.' }
  if (!env.navigator?.serviceWorker) return { ok: false, reason: 'no-service-worker', message: 'This browser cannot run the background worker notifications need.' }
  if (!env.PushManager) return { ok: false, reason: 'no-push', message: /iPhone|iPad|iPod/.test(env.navigator?.userAgent ?? '') ? 'On iPhone and iPad, notifications work only after you add this site to your Home Screen (Share, then Add to Home Screen), then open it from there.' : 'This browser does not support push notifications.' }
  if (!env.Notification) return { ok: false, reason: 'no-notifications', message: 'This browser does not support notifications.' }
  return { ok: true }
}

export function urlBase64ToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4); const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
const sameBytes = (a: ArrayBuffer | null | undefined, b: Uint8Array) => { if (!a) return false; const x = new Uint8Array(a); return x.length === b.length && x.every((v, i) => v === b[i]) }

type Json = Record<string, any>
async function call(env: ReturnType<typeof envOf>, method: string, body?: unknown): Promise<{ status: number; json: Json | null } | null> {
  try {
    const res = await env.fetchFn(PUSH_API, { method, credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
    let json: Json | null = null; try { json = await res.json() } catch { json = null }
    return { status: res.status, json }
  } catch { return null }
}

export type ServerResult = { ok: true; info: PushServerInfo } | { ok: false; reason: 'unauthenticated' | 'unavailable'; message: string }
export async function loadServerInfo(e?: PushEnv): Promise<ServerResult> {
  const r = await call(envOf(e), 'GET')
  if (!r) return { ok: false, reason: 'unavailable', message: 'Could not reach the server.' }
  if (r.status === 401 || r.status === 403) return { ok: false, reason: 'unauthenticated', message: 'Sign in to manage notifications.' }
  if (r.status !== 200 || !r.json) return { ok: false, reason: 'unavailable', message: 'Notifications are not available on this server.' }
  const devices = Array.isArray(r.json.devices) ? r.json.devices.map((d: Json) => ({ label: typeof d.label === 'string' ? d.label : null, createdAt: String(d.createdAt ?? ''), lastSuccessAt: typeof d.lastSuccessAt === 'string' ? d.lastSuccessAt : null })) : []
  return { ok: true, info: { configured: r.json.configured === true, publicKey: typeof r.json.publicKey === 'string' ? r.json.publicKey : null, devices, ...(r.json.storage === 'unavailable' ? { storage: 'unavailable' as const } : {}) } }
}

/** What this browser is doing right now (independent of the server): is the permission granted, is there a live subscription? */
export async function localState(e?: PushEnv): Promise<{ permission: NotificationPermission | 'unsupported'; subscribed: boolean }> {
  const env = envOf(e); if (!pushSupport(e).ok) return { permission: 'unsupported', subscribed: false }
  const permission = env.Notification!.permission
  try { const reg = await env.navigator!.serviceWorker!.getRegistration(PUSH_SW_SCOPE); const sub = await reg?.pushManager.getSubscription(); return { permission, subscribed: Boolean(sub) } } catch { return { permission, subscribed: false } }
}

export type EnableResult = { ok: true; devices: number } | { ok: false; reason: 'unsupported' | 'not-configured' | 'denied' | 'dismissed' | 'unauthenticated' | 'rejected' | 'failed'; message: string }
const MESSAGES = {
  denied: 'Notifications are blocked for this site. Allow them in your browser\'s site settings (the lock or tune icon next to the address), then try again.',
  dismissed: 'The permission request was closed without an answer. Press "Turn on" to ask again.',
  'not-configured': 'Notifications are not set up on this server yet.',
  unauthenticated: 'Sign in to turn on notifications.',
  rejected: 'This browser\'s push address was not accepted by the server.',
  failed: 'Could not turn notifications on. Nothing was changed.',
}
/** Must be called from a click: browsers show the permission prompt only in response to one. `publicKey` comes from loadServerInfo. */
export async function enablePush(publicKey: string | null, e?: PushEnv, deviceLabel?: string): Promise<EnableResult> {
  const env = envOf(e); const support = pushSupport(e)
  if (!support.ok) return { ok: false, reason: 'unsupported', message: support.message }
  if (!publicKey) return { ok: false, reason: 'not-configured', message: MESSAGES['not-configured'] }
  // Ask FIRST, before any network call: some browsers (Safari) only honour the prompt in the first moments after the click.
  let permission = env.Notification!.permission
  if (permission === 'default') { try { permission = await env.Notification!.requestPermission() } catch { return { ok: false, reason: 'failed', message: MESSAGES.failed } } }
  if (permission === 'denied') return { ok: false, reason: 'denied', message: MESSAGES.denied }
  if (permission !== 'granted') return { ok: false, reason: 'dismissed', message: MESSAGES.dismissed }
  try {
    const sw = env.navigator!.serviceWorker!
    await sw.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE }); const reg = await sw.ready.then(() => sw.getRegistration(PUSH_SW_SCOPE)); if (!reg) return { ok: false, reason: 'failed', message: MESSAGES.failed }
    const key = urlBase64ToBytes(publicKey)
    let sub = await reg.pushManager.getSubscription()
    // A subscription made for a different server key (keys were rotated) can never receive our pushes: start over.
    if (sub && !sameBytes(sub.options?.applicationServerKey, key)) { await sub.unsubscribe(); sub = null }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource })
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    const r = await call(env, 'POST', { subscription: { endpoint: json.endpoint, keys: json.keys }, deviceLabel })
    if (!r) { return { ok: false, reason: 'failed', message: MESSAGES.failed } }
    if (r.status === 401 || r.status === 403) return { ok: false, reason: 'unauthenticated', message: MESSAGES.unauthenticated }
    if (r.status === 503) return { ok: false, reason: 'not-configured', message: MESSAGES['not-configured'] }
    if (r.status === 400) { await sub.unsubscribe().catch(() => false); return { ok: false, reason: 'rejected', message: MESSAGES.rejected } }
    if (r.status !== 200 || r.json?.ok !== true) return { ok: false, reason: 'failed', message: MESSAGES.failed }
    return { ok: true, devices: Number(r.json.devices) || 1 }
  } catch { return { ok: false, reason: 'failed', message: MESSAGES.failed } }
}

export async function disablePush(e?: PushEnv): Promise<{ ok: boolean; message: string }> {
  const env = envOf(e)
  try {
    const reg = await env.navigator?.serviceWorker?.getRegistration(PUSH_SW_SCOPE); const sub = await reg?.pushManager.getSubscription()
    if (!sub) return { ok: true, message: 'Notifications are already off in this browser.' }
    const r = await call(env, 'DELETE', { endpoint: sub.endpoint }) // tell the server first; the browser side is removed regardless
    await sub.unsubscribe()
    return r && r.status === 200 ? { ok: true, message: 'Notifications are off in this browser.' } : { ok: true, message: 'Notifications are off in this browser. The server could not be told, so it may still try once and then forget it.' }
  } catch { return { ok: false, message: 'Could not turn notifications off.' } }
}

export type TestResult = { ok: true; sent: number; note: string } | { ok: false; message: string }
export async function sendTestPush(e?: PushEnv): Promise<TestResult> {
  const r = await call(envOf(e), 'POST', { test: true })
  if (!r) return { ok: false, message: 'Could not reach the server.' }
  if (r.status === 200 && r.json?.ok === true) return { ok: true, sent: Number(r.json.sent) || 0, note: String(r.json.note ?? '') }
  if (r.status === 401 || r.status === 403) return { ok: false, message: MESSAGES.unauthenticated }
  if (r.status === 429) return { ok: false, message: 'Too many tests. Try again later.' }
  return { ok: false, message: typeof r.json?.message === 'string' ? r.json.message : 'The test could not be sent.' }
}
