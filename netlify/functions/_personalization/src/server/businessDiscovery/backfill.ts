/**
 * Business Finder backfill: keep widening the search until at least `target` qualifying
 * (non-big-box, de-duplicated) local businesses are found — or the limits are exhausted.
 *
 * Pure and provider-agnostic: the caller injects `search` (the real Overpass/Nominatim race in the
 * route, a stub in tests) and `qualify` (the existing classify + chain-exclusion rules). Nothing here
 * invents a business: every record comes from `search`, and the result says honestly how many exist.
 *
 * Stages widen the radius (15 → 25 → 35 → 50 mi) and then re-run the SAME radius ladder with related
 * niches ("synonyms") so a plumber search can also surface electricians/HVAC only when the plain niche
 * runs dry. Geographic fallback is the Nominatim text search the search stage already performs.
 */
import type { BusinessDiscoveryRecord } from './types'

export const BACKFILL_TARGET = 30
export const RADIUS_LADDER_MILES = [15, 25, 35, 50] as const

/**
 * Related niches to try after the plain niche is exhausted (keys of NICHE_MAPPINGS). Only genuinely
 * adjacent businesses are listed: a niche with no honest neighbour (restaurants, home contractors,
 * real estate, pet services, ecommerce) has none, because padding the list with unrelated businesses
 * would hit the count at the cost of relevance — the result is reported as short instead.
 */
export const NICHE_SYNONYMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'beauty': ['wellness-fitness'] as const,
  'wellness-fitness': ['beauty', 'sports-outdoors'] as const,
  'healthcare-medical': ['wellness-fitness'] as const,
  'professional-services': ['finance', 'general-business'] as const,
  'finance': ['professional-services'] as const,
  'automotive': ['auto-detailing'] as const,
  'auto-detailing': ['automotive'] as const,
  'sports-outdoors': ['wellness-fitness'] as const,
})

export interface BackfillStage {
  index: number
  radiusMiles: number
  niche: string
  /** `primary` = the requested niche; `synonym` = a related niche. */
  kind: 'primary' | 'synonym'
}

/** The ordered stages for a request: the radius ladder from the requested radius up, then synonym ladders. */
export function planBackfillStages(niche: string, requestedRadius: number, maxRadius = 50): BackfillStage[] {
  const radii = Array.from(new Set([
    Math.min(Math.max(1, Math.round(requestedRadius)), maxRadius),
    ...RADIUS_LADDER_MILES.filter((r) => r > requestedRadius && r <= maxRadius),
  ])).sort((a, b) => a - b)
  const stages: BackfillStage[] = []
  for (const radiusMiles of radii) stages.push({ index: stages.length, radiusMiles, niche, kind: 'primary' })
  for (const synonym of NICHE_SYNONYMS[niche] ?? []) {
    // synonyms start at the widest radius already tried so they only add NEW businesses
    stages.push({ index: stages.length, radiusMiles: radii[radii.length - 1], niche: synonym, kind: 'synonym' })
  }
  return stages
}

// ── Deduplication ──────────────────────────────────────────────────────────

export function normalizeDomain(url: string | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase()
    return host.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/**
 * Hosts where many unrelated businesses live under one domain (site builders, link hubs, social pages).
 * A shared domain proves nothing there, so identity uses host + path instead (`sites.google.com/view/alpha`).
 */
const SHARED_HOSTS = /(^|\.)(sites\.google\.com|google\.com|business\.site|wixsite\.com|weebly\.com|squarespace\.com|godaddysites\.com|wordpress\.com|blogspot\.com|webs\.com|jimdosite\.com|carrd\.co|linktr\.ee|facebook\.com|instagram\.com|yelp\.com|yellowpages\.com|tripadvisor\.com|mapquest\.com|linkedin\.com)$/

/** Identity key for a website: the domain, or host + path for shared hosts. Null when there is no usable site. */
export function websiteIdentity(url: string | undefined): string | null {
  const domain = normalizeDomain(url)
  if (!domain) return null
  if (!SHARED_HOSTS.test(domain)) return domain
  try {
    const path = new URL(/^https?:\/\//i.test(url!) ? url! : `https://${url}`).pathname.replace(/\/+$/, '').toLowerCase()
    return path ? `${domain}${path}` : null // a bare shared-host homepage identifies no one business
  } catch { return null }
}

const NAME_NOISE = /\b(llc|inc|incorporated|co|company|corp|corporation|ltd|the)\b/g
export function normalizeBusinessName(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(NAME_NOISE, ' ').replace(/\s+/g, ' ').trim()
}
function normalizeAddress(r: BusinessDiscoveryRecord): string {
  return [r.address, r.city, r.postalCode].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
function phoneDigits(p: string | undefined): string | null {
  const d = (p ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

/** Every identity key a record can be matched on. Two records sharing ANY key are the same business. */
export function identityKeys(r: BusinessDiscoveryRecord): string[] {
  const keys: string[] = []
  if (r.osmType && r.osmId) keys.push(`osm:${r.osmType}/${r.osmId}`)
  const site = websiteIdentity(r.website)
  if (site) keys.push(`domain:${site}`)
  const phone = phoneDigits(r.phone)
  if (phone) keys.push(`phone:${phone}`)
  const name = normalizeBusinessName(r.name)
  const addr = normalizeAddress(r)
  if (name && addr) keys.push(`na:${name}|${addr}`)
  if (name) keys.push(`nc:${name}|${(r.city ?? '').toLowerCase().trim()}|${(r.region ?? '').toLowerCase().trim()}`)
  return keys
}

function richness(r: BusinessDiscoveryRecord): number {
  return [r.address, r.phone, r.website, r.email, r.openingHours, r.facebook, r.instagram].filter(Boolean).length + (r.latitude != null ? 1 : 0)
}

/** Merge duplicates across stages (union-find over identity keys); the richest record wins, gaps are filled from the others. */
export function mergeDuplicates(records: BusinessDiscoveryRecord[]): BusinessDiscoveryRecord[] {
  const keyOwner = new Map<string, number>()
  const groups: BusinessDiscoveryRecord[][] = []
  const groupOf: number[] = []
  const resolve = (g: number): number => { while (groupOf[g] !== g) g = groupOf[g]; return g }
  for (const rec of records) {
    const keys = identityKeys(rec)
    const hits = Array.from(new Set(keys.map((k) => keyOwner.get(k)).filter((g): g is number => g !== undefined).map(resolve)))
    let g: number
    if (hits.length === 0) { g = groups.length; groups.push([]); groupOf.push(g) } else {
      g = hits[0]
      for (const other of hits.slice(1)) { groups[g].push(...groups[other]); groups[other] = []; groupOf[other] = g }
    }
    groups[g].push(rec)
    for (const k of keys) keyOwner.set(k, g)
  }
  return groups.filter((g) => g.length > 0).map((g) => {
    const best = [...g].sort((a, b) => richness(b) - richness(a))[0]
    const merged = { ...best }
    for (const other of g) for (const [k, v] of Object.entries(other)) {
      const field = k as keyof BusinessDiscoveryRecord
      if ((merged[field] === undefined || merged[field] === '') && v !== undefined && v !== '') (merged as Record<string, unknown>)[field] = v
    }
    return merged
  })
}

// ── The loop ───────────────────────────────────────────────────────────────

export interface BackfillStageReport {
  index: number
  radiusMiles: number
  niche: string
  kind: 'primary' | 'synonym'
  returned: number
  newUnique: number
  qualifyingAfter: number
  error?: string
}

export interface BackfillResult {
  /** Qualifying businesses after merge + chain exclusion (uncapped; the caller caps for display). */
  qualifying: BusinessDiscoveryRecord[]
  target: number
  found: number
  /** True when `found < target` because every stage ran (or none could) — not because we stopped early. */
  exhausted: boolean
  stoppedBy: 'target' | 'stages' | 'budget'
  stages: BackfillStageReport[]
}

export interface BackfillOptions {
  target?: number
  stages: BackfillStage[]
  /** Records already fetched by the first (normal) search, treated as stage 0 input. */
  seed?: BusinessDiscoveryRecord[]
  /** Skip stages before this index (continuation call). */
  startStage?: number
  search: (stage: BackfillStage) => Promise<BusinessDiscoveryRecord[]>
  /** The existing classify + big-box exclusion rules: returns only qualifying records. */
  qualify: (records: BusinessDiscoveryRecord[]) => BusinessDiscoveryRecord[]
  /** Returns true when there is not enough time left to start another stage. */
  outOfTime?: () => boolean
}

export async function runBackfill(opts: BackfillOptions): Promise<BackfillResult> {
  const target = opts.target ?? BACKFILL_TARGET
  let pool = mergeDuplicates(opts.seed ?? [])
  let qualifying = opts.qualify(pool)
  const reports: BackfillStageReport[] = []
  let stoppedBy: BackfillResult['stoppedBy'] = qualifying.length >= target ? 'target' : 'stages'

  if (qualifying.length < target) {
    for (const stage of opts.stages.slice(opts.startStage ?? 0)) {
      if (opts.outOfTime?.()) { stoppedBy = 'budget'; break }
      let fetched: BusinessDiscoveryRecord[] = []
      let error: string | undefined
      try { fetched = await opts.search(stage) } catch (e) { error = e instanceof Error ? e.message : 'stage failed' }
      const before = pool.length
      pool = mergeDuplicates([...pool, ...fetched])
      qualifying = opts.qualify(pool)
      reports.push({ ...stage, returned: fetched.length, newUnique: pool.length - before, qualifyingAfter: qualifying.length, ...(error ? { error } : {}) })
      if (qualifying.length >= target) { stoppedBy = 'target'; break }
      stoppedBy = 'stages'
    }
  }
  const found = qualifying.length
  return { qualifying, target, found, exhausted: found < target && stoppedBy === 'stages', stoppedBy, stages: reports }
}
