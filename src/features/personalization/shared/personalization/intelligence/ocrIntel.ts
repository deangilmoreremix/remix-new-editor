/** OCR output handling. Text read from pictures is a SUGGESTION: prices, offers and claims always need confirmation. */
import { isPromotionalClaim } from './textIntel'

export type OcrKind = 'price' | 'phone' | 'url' | 'claim' | 'text'
export interface OcrLine { text: string; kind: OcrKind; needsConfirm: boolean; confidence: number }

const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?/i
const PRICE = /[$€£]\s?\d|\b\d+(?:[.,]\d{2})\s?(?:usd|eur|gbp)?\b.*[$€£]|\b\d+\s?(?:usd|eur|gbp)\b/i

export function classifyOcrLines(lines: { text: string; confidence?: number }[], minConfidence = 55): OcrLine[] {
  return lines
    .map((l) => ({ text: l.text.replace(/\s+/g, ' ').trim(), confidence: l.confidence ?? 0 }))
    .filter((l) => l.text.length >= 3 && l.confidence >= minConfidence && /[\p{L}\p{N}]/u.test(l.text))
    .map((l) => {
      const kind: OcrKind = PRICE.test(l.text) ? 'price' : PHONE.test(l.text) ? 'phone' : isPromotionalClaim(l.text) ? 'claim' : URL_RE.test(l.text) && !/\s/.test(l.text) ? 'url' : 'text'
      return { ...l, kind, needsConfirm: kind === 'price' || kind === 'claim' }
    })
}

export interface OcrResult { lines: OcrLine[] }

/** Runs Tesseract in the browser (lazy; the engine and English data download on first use, after consent). */
export async function ocrImage(url: string, opts: { signal?: AbortSignal; onProgress?: (p: number) => void } = {}): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, { logger: (m: { status?: string; progress?: number }) => { if (m.status === 'recognizing text' && typeof m.progress === 'number') opts.onProgress?.(m.progress) } })
  const abort = () => { void worker.terminate() }
  opts.signal?.addEventListener('abort', abort)
  try {
    if (opts.signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    const { data } = await worker.recognize(url)
    if (opts.signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    const lines = (data.lines ?? []).map((l: { text: string; confidence: number }) => ({ text: l.text, confidence: l.confidence }))
    return { lines: classifyOcrLines(lines) }
  } finally {
    opts.signal?.removeEventListener('abort', abort)
    void worker.terminate().catch(() => undefined)
  }
}
