/**
 * Deterministic hashtag tooling (keyword extraction + curated niche pools).
 * No live trend data is used or implied: pools are static starting points.
 */
const STOP = new Set(('a an the and or but if then so of to in on at by for with from as is are was were be been being it its this that these those i you he she we they my your our their me us them ' +
  'not no yes do does did done have has had will would can could should may might just very really more most much many some any all about into over under up down out off again than too also how what when where why who which while get got make made like new now one two ' +
  'video post watch check link bio today here there').split(' '))

export const NICHE_POOLS: Record<string, string[]> = {
  business: ['entrepreneur', 'smallbusiness', 'marketing', 'growth', 'startup', 'leadership'],
  fitness: ['fitness', 'workout', 'gym', 'health', 'motivation', 'training'],
  food: ['foodie', 'recipe', 'homecooking', 'delicious', 'cooking', 'yum'],
  travel: ['travel', 'wanderlust', 'explore', 'adventure', 'vacation', 'traveltips'],
  tech: ['tech', 'ai', 'innovation', 'software', 'productivity', 'future'],
  beauty: ['beauty', 'skincare', 'makeup', 'selfcare', 'glow', 'routine'],
  education: ['learning', 'education', 'tips', 'howto', 'knowledge', 'study'],
  creator: ['contentcreator', 'creator', 'videoediting', 'reels', 'shorts', 'storytelling'],
  realestate: ['realestate', 'homes', 'property', 'investing', 'newlisting', 'dreamhome'],
  fashion: ['fashion', 'style', 'ootd', 'outfit', 'trends', 'lookbook'],
}

export function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase()
}

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    const n = normalizeTag(t)
    if (n && !seen.has(n)) { seen.add(n); out.push(n) }
  }
  return out
}

/** Frequency-ranked keywords (unigrams) from free text; hashtags already in the text rank first. */
export function extractKeywords(text: string, limit = 10): string[] {
  const inText = (text.match(/#[\p{L}\p{N}_]+/gu) || []).map(normalizeTag)
  const counts = new Map<string, number>()
  for (const w of text.replace(/#[\p{L}\p{N}_]+/gu, ' ').toLowerCase().match(/[\p{L}\p{N}']+/gu) || []) {
    const word = w.replace(/'s$/, '')
    if (word.length < 4 || STOP.has(word) || /^\d+$/.test(word)) continue
    counts.set(word, (counts.get(word) || 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([w]) => w)
  return dedupeTags([...inText, ...ranked]).slice(0, limit)
}

export function detectNiche(text: string): string | null {
  const t = text.toLowerCase()
  let best: string | null = null
  let score = 0
  for (const [niche, pool] of Object.entries(NICHE_POOLS)) {
    const s = pool.filter((p) => t.includes(p)).length + (t.includes(niche) ? 2 : 0)
    if (s > score) { score = s; best = niche }
  }
  return best
}

export interface SuggestOptions { niche?: string | null; existing?: string[]; limit?: number }

export function suggestHashtags(text: string, { niche, existing = [], limit = 12 }: SuggestOptions = {}): string[] {
  const have = new Set(dedupeTags(existing))
  const pick = niche ?? detectNiche(text)
  const candidates = dedupeTags([...extractKeywords(text, 8), ...(pick ? NICHE_POOLS[pick] || [] : [])])
  return candidates.filter((t) => !have.has(t)).slice(0, limit)
}

export interface HashtagGroup { id: string; name: string; tags: string[] }

export function formatHashtags(tags: string[]): string {
  return dedupeTags(tags).map((t) => `#${t}`).join(' ')
}

/** Insert tags at the end of a caption without duplicating ones already present. */
export function appendHashtags(caption: string, tags: string[]): string {
  const present = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(normalizeTag))
  const add = dedupeTags(tags).filter((t) => !present.has(t))
  if (!add.length) return caption
  return `${caption.replace(/\s+$/, '')}${caption.trim() ? '\n\n' : ''}${formatHashtags(add)}`
}
