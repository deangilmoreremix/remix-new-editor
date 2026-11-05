/**
 * Ownership classification for OpenStreetMap business discovery (Phase 2).
 *
 * Deterministic, offline heuristics only: no network calls. Classification is
 * performed at the ROUTE level (after deduplication) rather than inside the
 * Overpass provider, because the local_multi_location heuristic needs the
 * full batch of names (allNamesInBatch) — something a single-element
 * normalizer cannot see.
 *
 * Every verdict carries human-readable evidence, and a business is never
 * discarded for having no brand evidence: it is classified `independent`.
 */

import type { BusinessDiscoveryRecord, OwnershipType } from './types'

/**
 * Curated list of well-known US national chains & big-box retailers. Stored
 * as display names; they are normalized (lowercase, punctuation stripped)
 * once at module load before matching.
 */
export const NATIONAL_CHAIN_NAMES: readonly string[] = [
  "McDonald's", 'Starbucks', 'Subway', "Dunkin'", 'Chick-fil-A', 'Taco Bell',
  'Burger King', "Wendy's", 'KFC', 'Pizza Hut', "Domino's", 'Popeyes',
  "Jimmy John's", 'Five Guys', 'Chipotle', 'Panera', 'Walmart', 'Target',
  'Home Depot', "Lowe's", 'Best Buy', 'Costco', "Sam's Club", "BJ's", 'CVS',
  'Walgreens', 'Rite Aid', 'Dollar General', 'Dollar Tree', 'Five Below',
  'TJ Maxx', 'Marshalls', 'HomeGoods', 'Ross', 'Burlington', "Kohl's",
  'JCPenney', "Macy's", 'Nordstrom', 'Kroger', 'Publix', 'Winn-Dixie',
  'Albertsons', 'Safeway', 'Whole Foods', "Trader Joe's", 'Sprouts',
  'AutoZone', "O'Reilly", 'Advance Auto Parts', 'NAPA', 'Jiffy Lube',
  'Valvoline', 'Midas', 'Meineke', 'PetSmart', 'Petco', 'Pet Supplies Plus',
  'Office Depot', 'Staples', 'UPS Store', 'FedEx Office', 'H&R Block',
  'Jackson Hewitt', 'Anytime Fitness', 'Planet Fitness', 'Orangetheory',
  'Crunch', 'Crunch Fitness', "Gold's Gym", 'LA Fitness', 'Ulta', 'Sephora',
  'Bath & Body Works', 'Foot Locker', 'GameStop', 'AT&T', 'Verizon',
  'T-Mobile', 'Chase', 'Bank of America', 'Wells Fargo', '7-Eleven',
  'Circle K', 'Wawa', 'Sheetz', 'RaceTrac', 'Shell', 'Chevron', 'Exxon',
  'BP', 'Sunoco', 'Mobil', "Marco's Pizza", 'Little Caesars', "Papa John's",
  "Jersey Mike's", 'Wingstop', 'Smoothie King', 'Tropical Smoothie',
  'Supercuts', 'Great Clips', 'Sport Clips', 'Fantastic Sams', 'Massage Envy',
  'Hand & Stone', 'European Wax Center', 'Regis', 'UPS', 'Molly Maid',
  'Servpro', '1-800-GOT-JUNK', 'College HUNKS',
  // Full-service restaurant & bar chains (common in Florida OSM data).
  'Applebee', 'Applebees', "Chili's", 'TGI Fridays', 'Twin Peaks', 'Hooters',
  'Olive Garden', 'Red Lobster', 'LongHorn Steakhouse', 'Outback Steakhouse',
  'Texas Roadhouse', "Carrabba's", 'Bonefish Grill', "Fleming's",
  "Ruth's Chris", 'Capital Grille', 'Cheesecake Factory', "P.F. Chang's",
  'Benihana', "Denny's", 'IHOP', 'Cracker Barrel', 'Hard Rock Cafe',
  'Bahama Breeze', 'Smokey Bones', 'Miller Ale House', "Miller's Ale House",
  // Brazilian steakhouses & breakfast chains (multi-unit, frequent in
  // South Florida OSM data; caught by the 2026-10 real-search audit when
  // Fogo de Chão Fort Lauderdale was classified independent).
  'Fogo de Chao', 'Fogo de Chão', 'Fogo de Chao Brazilian Steakhouse',
  'Fogo de Chão Brazilian Steakhouse', 'Fogo de Chao Churrascaria',
  'Texas de Brazil', 'Chima', 'First Watch',
  "Keke's Breakfast Cafe", 'Snooze', 'Another Broken Egg',
  // Coffee, dessert & fast-casual chains.
  'Krispy Kreme', 'Baskin-Robbins', 'Cold Stone Creamery', 'Dunkin Donuts',
  "Culver's", 'Whataburger', 'In-N-Out', 'Sonic', 'Jack in the Box', "Arby's",
  "Hardee's", "Carl's Jr", 'Panda Express', 'Papa Murphy', 'Sbarro',
  'Dairy Queen', "Auntie Anne's", "Cinnabon", 'Jamba', 'Jamba Juice',
  'Caribou Coffee', 'Peet', 'Peets Coffee', 'Dutch Bros', 'Biggby Coffee',
  'Pollo Tropical', 'BurgerFi', 'Shake Shack', 'MOD Pizza', 'Blaze Pizza',
  // Beauty, wellness & home-services chains.
  'Drybar', 'Blo Blow Dry Bar', 'Amazing Lash Studio', 'Lash Lounge',
  'Image Studios', 'Sola Salon', 'Elements Massage',
  'Molly Maid', 'Merry Maids', 'Chem-Dry', 'Stanley Steemer', 'Zerorez',
  'Precision Garage Door', 'Benjamin Franklin Plumbing', 'Mister Sparky',
  'One Hour Heating', 'Aire Serv', 'TruGreen', 'Lawn Doctor', 'Mosquito Joe',
  'Budget Blinds', 'Bath Fitter', 'Reborn Cabinets', 'Dreamstyle',
]

/** Lowercase, strip apostrophes/possessives, and collapse punctuation to spaces. */
export function normalizeNameForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Base name for multi-location comparison: drops trailing dash/location
 * qualifiers ("Foo - Fort Lauderdale", "Foo #123", "Foo Store 12") BEFORE
 * punctuation normalization (otherwise the dash suffix would be
 * indistinguishable from a real name token), then normalizes. " of City"
 * suffixes are NOT stripped — the bigbox matcher handles them via prefix
 * tokens, and stripping "of …" would mangle names such as "Bank of America".
 */
export function stripLocationQualifiers(name: string): string {
  const withoutDashSuffix = name.replace(/['’]/g, '').replace(/\s*[-–—]\s*[A-Za-z].*$/, '')
  const withoutUnitSuffix = withoutDashSuffix.replace(
    /\s*(#|No\.?|Number|Unit|Ste\.?|Suite|Store)\s*\d+.*$/i,
    '',
  )
  return normalizeNameForMatching(withoutUnitSuffix)
}

const NATIONAL_CHAIN_TOKEN_SETS: string[][] = NATIONAL_CHAIN_NAMES.map((n) =>
  normalizeNameForMatching(n).split(' ').filter(Boolean),
)

function isLocationQualifierToken(token: string): boolean {
  return token === 'of' || token === 'in' || token === 'at' || /^\d+$/.test(token)
}

/**
 * Match on the FIRST token(s) of the normalized name: "McDonald's of Fort
 * Lauderdale" must classify national_bigbox. A longer name only matches a
 * chain when the remainder is a location qualifier (of/in/at or a unit
 * number), so "Ross Plumbing" stays independent while "Ross of Miami" does not.
 */
function isNationalChain(name: string): boolean {
  const tokens = normalizeNameForMatching(name).split(' ').filter(Boolean)
  if (tokens.length === 0) return false
  for (const chainTokens of NATIONAL_CHAIN_TOKEN_SETS) {
    if (chainTokens.length === 0) continue
    if (tokens.length === chainTokens.length && tokens.join(' ') === chainTokens.join(' ')) {
      return true
    }
    if (
      tokens.length > chainTokens.length &&
      tokens.slice(0, chainTokens.length).join(' ') === chainTokens.join(' ') &&
      isLocationQualifierToken(tokens[chainTokens.length])
    ) {
      return true
    }
  }
  return false
}

export interface ClassifyOwnershipInput {
  name: string
  operator?: string
  brand?: string
  tags?: Record<string, unknown>
  allNamesInBatch?: string[]
}

/**
 * Classify one record. Precedence: national_bigbox → franchise_chain →
 * local_multi_location → independent, with `unknown` reserved for conflicting
 * evidence (e.g. a brand tag that matches neither the name nor the registry).
 */
export function classifyOwnership(
  record: ClassifyOwnershipInput,
): { ownership: OwnershipType; evidence: string[] } {
  const { name, operator, brand, allNamesInBatch } = record
  const evidence: string[] = []

  if (isNationalChain(name)) {
    evidence.push(`name matches a known national chain: "${name}"`)
    return { ownership: 'national_bigbox', evidence }
  }

  if (/\bfranchise\b/i.test(name) || /#\d/.test(name)) {
    evidence.push(`name carries a franchise or multi-unit marker: "${name}"`)
    return { ownership: 'franchise_chain', evidence }
  }

  if (brand && brand.trim()) {
    const normalizedBrand = normalizeNameForMatching(brand)
    if (operator && operator.trim() && normalizedBrand !== normalizeNameForMatching(operator)) {
      evidence.push(`OSM brand tag "${brand}" differs from operator "${operator}"`)
      return { ownership: 'franchise_chain', evidence }
    }
    if (isNationalChain(brand)) {
      evidence.push(`OSM brand tag "${brand}" is a known national chain`)
      return { ownership: 'franchise_chain', evidence }
    }
    if (normalizedBrand === normalizeNameForMatching(name)) {
      evidence.push(`OSM brand tag "${brand}" matches the business name`)
      return { ownership: 'franchise_chain', evidence }
    }
    evidence.push(`OSM brand tag "${brand}" set but the name "${name}" does not match it or the registry`)
    return { ownership: 'unknown', evidence }
  }

  if (operator && operator.trim() && isNationalChain(operator)) {
    evidence.push(`OSM operator "${operator}" matches a known national chain`)
    return { ownership: 'franchise_chain', evidence }
  }

  if (allNamesInBatch && allNamesInBatch.length > 0) {
    const base = stripLocationQualifiers(name)
    if (base) {
      const occurrences = allNamesInBatch.filter((n) => stripLocationQualifiers(n) === base).length
      if (occurrences >= 2) {
        evidence.push(`base name "${base}" appears ${occurrences}x in the batch (multi-location)`)
        return { ownership: 'local_multi_location', evidence }
      }
    }
  }

  evidence.push('no brand, franchise-marker, or multi-location evidence found')
  return { ownership: 'independent', evidence }
}

/**
 * Assign ownership + evidence to every record in a batch. Called at the route
 * level after deduplication so allNamesInBatch covers the whole batch.
 */
export function classifyRecords(records: BusinessDiscoveryRecord[]): BusinessDiscoveryRecord[] {
  const allNamesInBatch = records.map((r) => r.name)
  return records.map((record) => {
    const { ownership, evidence } = classifyOwnership({
      name: record.name,
      operator: record.operator,
      brand: record.brand,
      allNamesInBatch,
    })
    return { ...record, ownership, ownershipEvidence: evidence }
  })
}

/**
 * Excludes ONLY national_bigbox. franchise_chain (local franchisees are legit
 * prospects), local_multi_location, independent, and unknown records are kept.
 * Records without a prior verdict are classified against the full batch.
 */
export function excludeNationalChains(records: BusinessDiscoveryRecord[]): {
  kept: BusinessDiscoveryRecord[]
  excluded: BusinessDiscoveryRecord[]
  unknownRetained: number
} {
  const classified = classifyRecords(records)
  const kept: BusinessDiscoveryRecord[] = []
  const excluded: BusinessDiscoveryRecord[] = []
  for (const record of classified) {
    if (record.ownership === 'national_bigbox') excluded.push(record)
    else kept.push(record)
  }
  const unknownRetained = kept.filter((r) => r.ownership === 'unknown').length
  return { kept, excluded, unknownRetained }
}
