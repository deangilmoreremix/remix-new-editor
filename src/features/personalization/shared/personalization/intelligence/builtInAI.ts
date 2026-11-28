/**
 * The browser's own on-device language model (Chrome's Prompt API), when it exists. No model is shipped by this app, nothing
 * is sent to a server, and a download the browser needs is only started after the customer agrees. Output is checked against
 * the customer's facts: any line with a number, price or promise that is not in those facts is thrown away.
 */
import type { Facts } from './scriptIntel'

type Session = { prompt: (t: string, o?: { signal?: AbortSignal }) => Promise<string>; destroy?: () => void }
type LM = { availability: (o?: object) => Promise<string>; create: (o?: object) => Promise<Session> }
const lm = (): LM | undefined => (globalThis as { LanguageModel?: LM }).LanguageModel

export type BuiltInStatus = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'

export async function builtInAIStatus(): Promise<BuiltInStatus> {
  const m = lm()
  if (!m) return 'unsupported'
  try {
    const a = await m.availability({ expectedOutputs: [{ type: 'text', languages: ['en'] }] })
    return a === 'available' || a === 'downloadable' || a === 'downloading' ? a : 'unavailable'
  } catch { return 'unavailable' }
}

export type CopyKind = 'headline' | 'cta' | 'tagline'

export function buildCopyPrompt(kind: CopyKind, f: Facts): string {
  const facts = [['Business', f.businessName], ['Kind of business', f.industry], ['Place', f.location], ['Website', f.website], ['Phone', f.phone], ['Existing offer', f.offer]]
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')
  const what = { headline: 'short video headlines (max 8 words each)', cta: 'short calls to action (max 5 words each)', tagline: 'short taglines (max 10 words each)' }[kind]
  return `Write 4 ${what} for this business, one per line, no numbering or quotes.\nUse ONLY these facts. Do not mention prices, discounts, numbers, guarantees, awards or claims that are not listed.\n${facts}`
}

const RISKY = /\b(free|guarantee[sd]?|sale|discount|deal|save|off|best|#1|no\.?\s?1|award|cheapest|lowest|limited time|today only)\b/i

/** Keeps only plain lines that add no figure or promise beyond the facts. */
export function groundedOnly(lines: string[], f: Facts): { kept: string[]; rejected: number } {
  const known = Object.values(f).filter(Boolean).join(' ').toLowerCase()
  const kept: string[] = []
  for (const raw of lines) {
    const l = raw.replace(/^[\s\-*•\d.)]+/, '').replace(/^["“']+|["”']+$/g, '').trim()
    if (l.length < 3 || l.length > 90) continue
    const digits = l.match(/\d[\d.,]*/g) ?? []
    const badNumber = digits.some((d) => !known.includes(d))
    const riskyWord = RISKY.exec(l)
    const badClaim = riskyWord && !known.includes(riskyWord[0]!.toLowerCase())
    if (badNumber || badClaim || /[$€£%]/.test(l) && !/[$€£%]/.test(known)) continue
    if (!kept.includes(l)) kept.push(l)
  }
  return { kept: kept.slice(0, 4), rejected: Math.max(0, lines.filter((x) => x.trim()).length - kept.length) }
}

export async function generateCopyOnDevice(kind: CopyKind, f: Facts, opts: { signal?: AbortSignal; onProgress?: (p: number) => void } = {}): Promise<{ lines: string[]; rejected: number }> {
  const m = lm()
  if (!m) throw new Error('This browser has no built-in on-device AI.')
  const session = await m.create({
    expectedOutputs: [{ type: 'text', languages: ['en'] }], signal: opts.signal,
    monitor: (mon: { addEventListener: (n: string, cb: (e: { loaded: number }) => void) => void }) => mon.addEventListener('downloadprogress', (e) => opts.onProgress?.(e.loaded)),
  })
  try {
    const out = await session.prompt(buildCopyPrompt(kind, f), { signal: opts.signal })
    const { kept, rejected } = groundedOnly(out.split('\n'), f)
    return { lines: kept, rejected }
  } finally { session.destroy?.() }
}
