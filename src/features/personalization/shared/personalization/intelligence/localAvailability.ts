/**
 * What this device could run locally, checked WITHOUT downloading anything. The deterministic tools in this folder
 * work everywhere; this only describes the optional on-device model features so the UI can be honest about them.
 */
export interface LocalAvailability {
  webgpu: boolean
  /** Approximate device memory in GB when the browser reports it, else null. */
  memoryGb: number | null
  translator: boolean
  promptApi: boolean
  /** Short, plain reason when on-device language models are not offered here. */
  note: string
}

export function checkLocalAvailability(g: Record<string, unknown> = globalThis as Record<string, unknown>): LocalAvailability {
  const nav = (g.navigator ?? {}) as { gpu?: unknown; deviceMemory?: number }
  const webgpu = Boolean(nav.gpu)
  const translator = typeof g.Translator !== 'undefined' || typeof (g.translation as { createTranslator?: unknown } | undefined)?.createTranslator === 'function'
  const promptApi = typeof g.LanguageModel !== 'undefined'
  const memoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
  const note = promptApi || translator ? 'This browser has built-in on-device language features.'
    : 'This browser has no built-in on-device language model. Suggestions use fact-based templates instead; nothing is sent to a paid service.'
  return { webgpu, memoryGb, translator, promptApi, note }
}

/** Translates with the browser's own on-device Translator, or returns null when unavailable (never a paid fallback). */
export async function translateOnDevice(text: string, from: string, to: string): Promise<string | null> {
  const T = (globalThis as { Translator?: { availability: (o: object) => Promise<string>; create: (o: object) => Promise<{ translate: (t: string) => Promise<string> }> } }).Translator
  if (!T) return null
  try {
    const opts = { sourceLanguage: from, targetLanguage: to }
    if ((await T.availability(opts)) === 'unavailable') return null
    return await (await T.create(opts)).translate(text)
  } catch { return null }
}
