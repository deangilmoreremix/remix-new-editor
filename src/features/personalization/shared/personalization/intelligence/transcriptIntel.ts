/** Transcript tools: keyword extraction, search-to-time, chapter and highlight suggestions. Suggestions only. */

export interface Cue { text: string; startMs: number; endMs: number }

const STOP = new Set('a an and are as at be but by for from has have he her his i in is it its me my of on or our she so than that the their them they this to us was we were what when which who will with you your about all also any can do does not more most just into out up how if there then these those over very than been being'.split(' '))

export function extractKeywords(text: string, max = 8): string[] {
  const freq = new Map<string, number>()
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}'\s-]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  // Two-word phrases that repeat are stronger keywords than the single words inside them.
  for (let i = 0; i < words.length - 1; i++) {
    const p = `${words[i]} ${words[i + 1]}`
    freq.set(p, (freq.get(p) ?? 0) + (freq.has(p) ? 1 : 0.0001))
  }
  return [...freq.entries()].filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([w]) => w)
}

export function searchTranscript(cues: Cue[], query: string): Cue[] {
  const q = query.trim().toLowerCase()
  return q ? cues.filter((c) => c.text.toLowerCase().includes(q)) : []
}

export interface Chapter { startMs: number; endMs: number; title: string }

/** Splits at long pauses and at ~`targetSec`, titling each by its strongest keywords. The customer confirms before use. */
export function suggestChapters(cues: Cue[], opts: { targetSec?: number; pauseMs?: number } = {}): Chapter[] {
  const { targetSec = 20, pauseMs = 1200 } = opts
  if (!cues.length) return []
  const groups: Cue[][] = [[]]
  for (const c of cues) {
    const g = groups[groups.length - 1]!
    const prev = g[g.length - 1]
    const start = g[0]?.startMs ?? c.startMs
    if (prev && ((c.startMs - prev.endMs >= pauseMs && c.endMs - start >= targetSec * 500) || c.endMs - start >= targetSec * 1000 * 1.5)) groups.push([c])
    else g.push(c)
  }
  return groups.filter((g) => g.length).map((g) => ({
    startMs: g[0]!.startMs, endMs: g[g.length - 1]!.endMs,
    title: (extractKeywords(g.map((c) => c.text).join(' '), 2).join(' · ') || 'Chapter').replace(/^./, (m) => m.toUpperCase()),
  }))
}

export interface Highlight { startMs: number; endMs: number; reason: string; score: number }

/** Candidate moments from speech density, keywords and scene cuts. Ranked suggestions; no virality claim. */
export function suggestHighlights(cues: Cue[], opts: { keywords?: string[]; cutTimesSec?: number[]; max?: number } = {}): Highlight[] {
  const kws = (opts.keywords ?? []).map((k) => k.toLowerCase())
  const cuts = opts.cutTimesSec ?? []
  const out = cues.map((c) => {
    const dur = Math.max(0.5, (c.endMs - c.startMs) / 1000)
    const words = c.text.trim().split(/\s+/).filter(Boolean).length
    const density = Math.min(1, words / dur / 4)
    const kw = kws.filter((k) => c.text.toLowerCase().includes(k)).length
    const nearCut = cuts.some((t) => Math.abs(t * 1000 - c.startMs) < 600)
    const score = density * 0.4 + Math.min(1, kw / 2) * 0.45 + (nearCut ? 0.15 : 0)
    const reasons = [kw ? 'mentions a key topic' : '', density > 0.6 ? 'dense speech' : '', nearCut ? 'starts at a scene change' : ''].filter(Boolean)
    return { startMs: c.startMs, endMs: c.endMs, reason: reasons.join(', ') || 'speech', score }
  })
  return out.filter((h) => h.score > 0.3).sort((a, b) => b.score - a.score).slice(0, opts.max ?? 5).sort((a, b) => a.startMs - b.startMs)
}
