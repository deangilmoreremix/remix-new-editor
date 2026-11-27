/**
 * Local text tooling: deterministic fallbacks plus thin wrappers over the
 * experimental browser AI APIs (Prompt / Translator / Summarizer). Wrappers
 * never download a model silently: callers must pass `allowDownload: true`
 * after the user confirmed, and receive progress events.
 */
import { aiAvailability, type AvailabilityState } from './capabilities'

type G = Record<string, any>

export type RewriteTone = 'professional' | 'conversational' | 'sales' | 'educational' | 'short' | 'long' | 'cta'

export const REWRITE_TONES: { id: RewriteTone; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'conversational', label: 'Conversational' },
  { id: 'sales', label: 'Sales-focused' },
  { id: 'educational', label: 'Educational' },
  { id: 'short', label: 'Short-form' },
  { id: 'long', label: 'Long-form' },
  { id: 'cta', label: 'CTA-focused' },
]

const TONE_INSTRUCTION: Record<RewriteTone, string> = {
  professional: 'Rewrite in a polished, professional tone.',
  conversational: 'Rewrite in a friendly, conversational tone.',
  sales: 'Rewrite to be persuasive and benefit-led, without false claims.',
  educational: 'Rewrite to teach: clear, structured, informative.',
  short: 'Rewrite as a very short punchy social caption (under 150 characters).',
  long: 'Rewrite as a fuller long-form caption with more detail.',
  cta: 'Rewrite so it ends with one clear call to action.',
}

export interface AiRunOptions {
  allowDownload?: boolean
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
  g?: G
}

export class AiUnavailableError extends Error {
  state: AvailabilityState
  constructor(feature: string, state: AvailabilityState) {
    super(
      state === 'downloadable'
        ? `${feature} needs a one-time on-device model download. Confirm the download to continue.`
        : `${feature} is not available in this browser.`,
    )
    this.name = 'AiUnavailableError'
    this.state = state
  }
}

async function gate(feature: string, api: 'prompt' | 'translator' | 'summarizer', o: AiRunOptions, availOpts?: Record<string, any>) {
  const g = o.g ?? (globalThis as G)
  const state = await aiAvailability(api, g, availOpts)
  if (state === 'unavailable') throw new AiUnavailableError(feature, state)
  if ((state === 'downloadable' || state === 'downloading') && !o.allowDownload) throw new AiUnavailableError(feature, 'downloadable')
  return g
}

const monitor = (o: AiRunOptions) => (m: any) => m.addEventListener?.('downloadprogress', (e: any) => o.onProgress?.(Number(e.loaded) || 0))

/** Rewrite with the browser Prompt API. The caller shows the result and requires acceptance. */
export async function rewriteCaption(text: string, tone: RewriteTone, o: AiRunOptions = {}): Promise<string> {
  const g = await gate('Caption rewriting', 'prompt', o)
  const session = await g.LanguageModel.create({
    monitor: monitor(o),
    signal: o.signal,
    initialPrompts: [{ role: 'system', content: 'You rewrite social media captions. Reply with the rewritten caption only. Keep facts, names and links unchanged.' }],
  })
  try {
    return String(await session.prompt(`${TONE_INSTRUCTION[tone]}\n\nCaption:\n${text}`, { signal: o.signal })).trim()
  } finally {
    session.destroy?.()
  }
}

export type SummaryKind = 'caption' | 'bullets' | 'headline'

export async function summarizeText(text: string, kind: SummaryKind, o: AiRunOptions = {}): Promise<string> {
  const g = await gate('Summarization', 'summarizer', o)
  const summarizer = await g.Summarizer.create({
    type: kind === 'bullets' ? 'key-points' : kind === 'headline' ? 'headline' : 'tldr',
    format: 'plain-text',
    length: kind === 'caption' ? 'short' : 'medium',
    monitor: monitor(o),
    signal: o.signal,
  })
  try {
    return String(await summarizer.summarize(text, { signal: o.signal })).trim()
  } finally {
    summarizer.destroy?.()
  }
}

export async function translateText(text: string, sourceLanguage: string, targetLanguage: string, o: AiRunOptions = {}): Promise<string> {
  const g = await gate('Translation', 'translator', o, { sourceLanguage, targetLanguage })
  const translator = await g.Translator.create({ sourceLanguage, targetLanguage, monitor: monitor(o), signal: o.signal })
  try {
    return String(await translator.translate(text, { signal: o.signal })).trim()
  } finally {
    translator.destroy?.()
  }
}

/** Deterministic, offline fallback "short-form": first sentence(s) trimmed to a limit at a word boundary. */
export function shortenLocal(text: string, max = 150): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-–—\s]+$/, '')}…`
}

/** Deterministic bullet summary: the leading words of the first sentences. */
export function bulletsLocal(text: string, maxBullets = 4): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, maxBullets)
    .map((s) => shortenLocal(s, 90))
}
