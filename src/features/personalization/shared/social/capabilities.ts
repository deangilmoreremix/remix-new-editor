/**
 * Feature detection for experimental/optional browser APIs. Every consumer must
 * check this first and show an explicit unavailable state: nothing here is
 * assumed to exist, and none of it may block basic scheduling or MuAPI publishing.
 */
export interface Capabilities {
  indexedDB: boolean
  serviceWorker: boolean
  notifications: boolean
  notificationPermission: 'granted' | 'denied' | 'default' | 'unsupported'
  push: boolean
  clipboardRead: boolean
  clipboardWrite: boolean
  clipboardItem: boolean
  webCodecs: boolean
  webGpu: boolean
  wasm: boolean
  worker: boolean
  offscreenCanvas: boolean
  promptApi: boolean
  translator: boolean
  summarizer: boolean
  webAudio: boolean
  fileSystemAccess: boolean
}

type G = Record<string, any>

export function detectCapabilities(g: G = globalThis as G): Capabilities {
  const nav: G = g.navigator || {}
  const notif = g.Notification
  return {
    indexedDB: !!g.indexedDB,
    serviceWorker: !!nav.serviceWorker,
    notifications: !!notif,
    notificationPermission: notif ? (notif.permission as Capabilities['notificationPermission']) : 'unsupported',
    push: !!g.PushManager && !!nav.serviceWorker,
    clipboardRead: !!nav.clipboard?.read || !!nav.clipboard?.readText,
    clipboardWrite: !!nav.clipboard?.writeText,
    clipboardItem: !!g.ClipboardItem,
    webCodecs: typeof g.VideoEncoder === 'function' && typeof g.VideoDecoder === 'function',
    webGpu: !!nav.gpu,
    wasm: typeof g.WebAssembly === 'object',
    worker: typeof g.Worker === 'function',
    offscreenCanvas: typeof g.OffscreenCanvas === 'function',
    // Chrome ships `LanguageModel`; the older origin-trial shape was `ai.languageModel`.
    promptApi: typeof g.LanguageModel !== 'undefined' || !!g.ai?.languageModel,
    translator: typeof g.Translator !== 'undefined',
    summarizer: typeof g.Summarizer !== 'undefined',
    webAudio: typeof g.AudioContext === 'function' || typeof g.webkitAudioContext === 'function',
    fileSystemAccess: typeof g.showSaveFilePicker === 'function',
  }
}

export type AvailabilityState = 'available' | 'downloadable' | 'downloading' | 'unavailable'

/** Browser AI APIs report availability asynchronously; normalise failures to 'unavailable'. */
export async function aiAvailability(api: 'prompt' | 'translator' | 'summarizer', g: G = globalThis as G, opts?: Record<string, any>): Promise<AvailabilityState> {
  try {
    const target = api === 'prompt' ? g.LanguageModel : api === 'translator' ? g.Translator : g.Summarizer
    if (!target || typeof target.availability !== 'function') return 'unavailable'
    const state = await target.availability(opts)
    return state === 'readily' ? 'available' : state === 'after-download' ? 'downloadable' : state
  } catch {
    return 'unavailable'
  }
}
