/**
 * Resilient selector matching. Technique reimplemented from Scrapling's Selector.find_similar and
 * adaptive relocation scoring (`__calculate_similarity_score`): when a primary selector breaks,
 * pick the element that best resembles a remembered fingerprint (tag, text, attributes, class/id,
 * parent, siblings) — and only accept it above a threshold. Re-implemented over Cheerio; not the
 * Scrapling library.
 */
import type { CheerioAPI } from 'cheerio'

export interface ElementFingerprint {
  tag: string
  text: string
  attrs: Record<string, string>
  parentTag: string
  siblingTags: string[]
}

/** Gestalt-style ratio (2*matches/total) using longest-common-substring recursion, like difflib. */
export function textRatio(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const matches = (x: string, y: string): number => {
    if (!x || !y) return 0
    let best = 0, bi = 0, bj = 0
    const prev = new Array<number>(y.length + 1).fill(0)
    for (let i = 1; i <= x.length; i++) {
      let diag = 0
      for (let j = 1; j <= y.length; j++) {
        const tmp = prev[j]
        prev[j] = x[i - 1] === y[j - 1] ? diag + 1 : 0
        if (prev[j] > best) { best = prev[j]; bi = i; bj = j }
        diag = tmp
      }
    }
    if (!best) return 0
    return best + matches(x.slice(0, bi - best), y.slice(0, bj - best)) + matches(x.slice(bi), y.slice(bj))
  }
  return (2 * matches(a, b)) / (a.length + b.length)
}

export function fingerprintOf($: CheerioAPI, el: any): ElementFingerprint {
  const $el = $(el)
  const parent = $el.parent()
  return {
    tag: String(el.tagName ?? el.name ?? '').toLowerCase(),
    text: $el.text().replace(/\s+/g, ' ').trim().slice(0, 200),
    attrs: { ...(el.attribs ?? {}) },
    parentTag: String(parent.get(0)?.tagName ?? '').toLowerCase(),
    siblingTags: $el.siblings().toArray().map((s: any) => String(s.tagName ?? '').toLowerCase()).slice(0, 8),
  }
}

/** 0..100, same dimensions and spirit as Scrapling's score. */
export function similarityScore(a: ElementFingerprint, b: ElementFingerprint): number {
  const parts: number[] = []
  parts.push(a.tag === b.tag ? 1 : 0)
  parts.push(textRatio(a.text, b.text))
  const ka = Object.keys(a.attrs), kb = Object.keys(b.attrs)
  const attrSim = ka.length || kb.length
    ? textRatio(JSON.stringify(Object.entries(a.attrs).sort()), JSON.stringify(Object.entries(b.attrs).sort()))
    : 1
  parts.push(attrSim)
  for (const k of ['class', 'id']) if (a.attrs[k] || b.attrs[k]) parts.push(textRatio(a.attrs[k] ?? '', b.attrs[k] ?? ''))
  // href/src are compared on their path-less tail so a moved host does not zero the score
  for (const k of ['href', 'src']) if (a.attrs[k] || b.attrs[k]) parts.push(textRatio((a.attrs[k] ?? '').split('/').pop() ?? '', (b.attrs[k] ?? '').split('/').pop() ?? ''))
  parts.push(a.parentTag === b.parentTag ? 1 : 0)
  parts.push(textRatio(a.siblingTags.join(','), b.siblingTags.join(',')))
  return Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 10000) / 100
}

export interface SelectResult { element: any | null; matchedBy: 'selector' | 'similar' | 'none'; score: number }

/**
 * Tries each selector in order; if none matches and a remembered fingerprint is given, falls back
 * to the most similar element of the same tag (score ≥ threshold). Never returns a weak guess.
 */
export function selectResilient(
  $: CheerioAPI, selectors: string[], opts: { fingerprint?: ElementFingerprint; threshold?: number; scope?: string } = {},
): SelectResult {
  for (const sel of selectors) {
    try { const hit = $(sel).get(0); if (hit) return { element: hit, matchedBy: 'selector', score: 100 } } catch { /* invalid selector: next */ }
  }
  if (opts.fingerprint) {
    const threshold = opts.threshold ?? 60
    let best: { el: any; score: number } | null = null
    $(opts.scope ?? opts.fingerprint.tag).each((_, el) => {
      const score = similarityScore(opts.fingerprint!, fingerprintOf($, el))
      if (!best || score > best.score) best = { el, score }
    })
    const b = best as { el: any; score: number } | null
    if (b && b.score >= threshold) return { element: b.el, matchedBy: 'similar', score: b.score }
  }
  return { element: null, matchedBy: 'none', score: 0 }
}

/** Scrapling `find_similar`: elements sharing tag + parent/grandparent tag with attribute similarity ≥ threshold. */
export function findSimilar($: CheerioAPI, anchor: any, threshold = 0.2, ignoreAttrs = ['href', 'src']): any[] {
  const depth = (e: any) => { let d = 0; for (let p = e.parent; p; p = p.parent) d++; return d }
  const tag = String(anchor.tagName ?? anchor.name ?? '').toLowerCase()
  const pTag = String(anchor.parent?.tagName ?? '').toLowerCase()
  const gTag = String(anchor.parent?.parent?.tagName ?? '').toLowerCase()
  const d0 = depth(anchor)
  const norm = (e: any) => JSON.stringify(Object.entries(e.attribs ?? {}).filter(([k]) => !ignoreAttrs.includes(k)).sort())
  const base = norm(anchor)
  const out: any[] = []
  $(tag).each((_, el: any) => {
    if (el === anchor) return
    if (depth(el) !== d0) return
    if (String(el.parent?.tagName ?? '').toLowerCase() !== pTag) return
    if (String(el.parent?.parent?.tagName ?? '').toLowerCase() !== gTag) return
    if (textRatio(base, norm(el)) >= threshold) out.push(el)
  })
  return out
}
