/**
 * Business website enrichment — techniques reimplemented in TypeScript, INSPIRED BY Scrapling
 * (https://github.com/D4Vinci/Scrapling). This code does not use the Scrapling library.
 *
 * Every extracted detail carries its provenance. Nothing is ever inferred or invented: a value
 * exists only if it was literally present on (or decodable from) a fetched page.
 */
export type EvidenceMethod =
  | 'mailto' | 'tel' | 'json-ld' | 'microdata' | 'opengraph' | 'obfuscated-decoded' | 'page-text' | 'footer-link' | 'sameAs'

export interface Evidence<T = string> {
  value: T
  /** The page the value was read from. */
  sourceUrl: string
  /** 0..1 — how much this method/context deserves to be trusted. Not a probability. */
  confidence: number
  method: EvidenceMethod
}

export type SocialNetwork = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'x' | 'pinterest'

export interface BusinessEnrichment {
  website: string
  emails: Evidence[]
  phones: Evidence[]
  addresses: Evidence[]
  contactNames: Evidence[]
  socials: Partial<Record<SocialNetwork, Evidence>>
  /** Pages actually fetched (after robots filtering). */
  pagesVisited: string[]
  /** Pages we deliberately did not fetch, with the reason. */
  pagesSkipped: Array<{ url: string; reason: 'robots' | 'cap' | 'blocked' | 'error' }>
  robots: { checked: boolean; status: 'allow-all' | 'rules' | 'disallow-all' | 'unavailable' }
  jsRendered: boolean
  notes: string[]
}
