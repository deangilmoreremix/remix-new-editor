/**
 * Turns a business-website research result into client-form content, so that
 * finding a business (Find My Brand URL, or a Local Business search result)
 * pre-loads its details instead of leaving most fields empty.
 *
 * Pure and deterministic: it only reads what the site itself publishes
 * (JSON-LD, Open Graph, contact info, title and description). Nothing is
 * invented; a field with no source stays out of the result.
 */

import type { BusinessResearchResult, ClientProfile } from './types'

/** Client-form fields the business finder may fill on its own. */
export const AUTO_FILL_KEYS = [
  'businessName',
  'industry',
  'location',
  'phone',
  'website',
  'brandDescription',
  'productService',
  'offer',
  'ctaHeadline',
  'callToAction',
] as const

export type AutoFillKey = (typeof AUTO_FILL_KEYS)[number]
export type AutoFilledValues = Partial<Record<AutoFillKey, string>>

type JsonObject = Record<string, unknown>

const GENERIC_TYPES = new Set([
  'thing', 'organization', 'localbusiness', 'website', 'webpage', 'corporation',
  'place', 'brand', 'person', 'imageobject', 'breadcrumblist', 'sitenavigationelement',
  'searchaction', 'collectionpage', 'aboutpage', 'contactpage', 'itempage',
])

const GENERIC_TITLE_SEGMENTS = /^(home|homepage|home page|welcome|official site|official website|index)$/i

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function typesOf(node: JsonObject): string[] {
  const raw = node['@type']
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map(text).filter(Boolean)
}

/** Flattens `@graph` containers so every JSON-LD node can be inspected. */
function flattenJsonLd(items: unknown[]): JsonObject[] {
  const out: JsonObject[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isObject(value)) return
    if (Array.isArray(value['@graph'])) visit(value['@graph'])
    if (value['@type'] || value.name) out.push(value)
    // A page's publisher is often the business itself.
    if (isObject(value.publisher)) visit(value.publisher)
  }
  visit(items)
  return out
}

const NOT_A_BUSINESS_TYPES = new Set([
  'product', 'service', 'offer', 'aggregateoffer', 'review', 'aggregaterating',
  'article', 'blogposting', 'newsarticle', 'event', 'faqpage', 'question', 'videoobject', 'recipe',
])

/** The node that best describes the business itself. */
function findBusinessNode(nodes: JsonObject[]): JsonObject | null {
  const score = (node: JsonObject) => {
    const types = typesOf(node).map((t) => t.toLowerCase())
    let value = 0
    if (types.some((t) => !GENERIC_TYPES.has(t))) value += 3
    if (types.some((t) => t === 'localbusiness' || t === 'organization')) value += 2
    if (node.address) value += 2
    if (node.telephone) value += 1
    if (text(node.name)) value += 1
    if (types.some((t) => ['website', 'webpage', 'breadcrumblist', 'imageobject'].includes(t))) value -= 5
    // Things the business sells or posts are not the business itself.
    // (A node typed as the business itself keeps its score even if it also
    // lists a Service or Product type.)
    const namedAsBusiness = types.some((t) => t === 'localbusiness' || t === 'organization')
    if (!namedAsBusiness && types.some((t) => NOT_A_BUSINESS_TYPES.has(t))) value -= 4
    return value
  }
  const ranked = nodes
    .filter((node) => text(node.name))
    .map((node) => ({ node, value: score(node) }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value)
  return ranked[0]?.node || null
}

/** "RoofingContractor" → "Roofing Contractor". */
function humanizeType(type: string): string {
  return type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function industryOf(node: JsonObject | null): string {
  if (!node) return ''
  const explicit = text(node.industry)
  if (explicit) return explicit
  const specific = typesOf(node).find((t) => !GENERIC_TYPES.has(t.toLowerCase()))
  return specific ? humanizeType(specific) : ''
}

function locationOf(node: JsonObject | null, addresses: string[]): string {
  const address = node?.address
  const nodes = Array.isArray(address) ? address : [address]
  for (const entry of nodes) {
    if (isObject(entry)) {
      const parts = [text(entry.addressLocality), text(entry.addressRegion)].filter(Boolean)
      if (parts.length) return parts.join(', ')
    } else if (text(entry)) {
      return text(entry).slice(0, 120)
    }
  }
  return text(addresses[0]).slice(0, 120)
}

function offerNodes(node: JsonObject | null): JsonObject[] {
  if (!node) return []
  const out: JsonObject[] = []
  const add = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(add)
    else if (isObject(value)) out.push(value)
  }
  add(node.makesOffer)
  add(node.offers)
  // A page may publish one catalog or several, and a catalog may list
  // sub-catalogs (a few levels at most). A catalog lists ListItems whose
  // offer sits under `item`.
  const visitCatalog = (catalog: unknown, depth: number): void => {
    if (!isObject(catalog) || depth > 3) return
    const entries = Array.isArray(catalog.itemListElement) ? catalog.itemListElement : [catalog.itemListElement]
    for (const entry of entries) {
      const item = isObject(entry) && isObject(entry.item) ? entry.item : entry
      if (isObject(item) && typesOf(item).some((type) => type.toLowerCase() === 'offercatalog')) visitCatalog(item, depth + 1)
      else add(item)
    }
  }
  const catalogs = Array.isArray(node.hasOfferCatalog) ? node.hasOfferCatalog : [node.hasOfferCatalog]
  for (const catalog of catalogs) visitCatalog(catalog, 0)
  return out
}

function offeredName(offer: JsonObject): string {
  const item = offer.itemOffered
  if (isObject(item) && text(item.name)) return text(item.name)
  return text(offer.name)
}

function productServiceOf(node: JsonObject | null): string {
  if (!node) return ''
  const names = offerNodes(node).map(offeredName).filter(Boolean)
  const serviceType = node.serviceType
  const extra = (Array.isArray(serviceType) ? serviceType : [serviceType]).map(text).filter(Boolean)
  const unique = Array.from(new Set([...names, ...extra]))
  return unique.slice(0, 3).join(', ')
}

function priceLabel(offer: JsonObject): string {
  const price = text(offer.price)
  if (!price) return ''
  const currency = text(offer.priceCurrency).toUpperCase()
  const symbol = currency === 'USD' || !currency ? '$' : `${currency} `
  return `${symbol}${price}`
}

function offerOf(node: JsonObject | null): string {
  for (const offer of offerNodes(node)) {
    const name = offeredName(offer)
    const price = priceLabel(offer)
    if (name && price) return `${name} from ${price}`
    const description = text(offer.description)
    if (description) return description.slice(0, 120)
  }
  return ''
}

/** Splits "Joe's Roofing | Tampa's Trusted Roofers – Home" into meaningful parts. */
function titleSegments(title: string): string[] {
  return title
    .split(/\s+[|–—\-:•·]\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !GENERIC_TITLE_SEGMENTS.test(part))
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** True when one text is the other with extra words ("Sunset Realty" vs "Sunset Realty Group"). */
function namesMatch(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/[^a-z0-9]/g, '')
  const y = b.toLowerCase().replace(/[^a-z0-9]/g, '')
  return Boolean(x && y) && (x.includes(y) || y.includes(x))
}

/**
 * Everything the research says about the business, keyed by client-form field.
 * Only non-empty values are returned.
 */
export function businessContentFromResearch(research: BusinessResearchResult): AutoFilledValues {
  const nodes = flattenJsonLd(Array.isArray(research.jsonLd) ? research.jsonLd : [])
  const business = findBusinessNode(nodes)
  const og = research.openGraph || {}
  const contact = research.contactInfo || { phones: [], emails: [], addresses: [] }
  const website = text(research.canonicalUrl) || text(research.finalUrl)
  const segments = titleSegments(text(research.title) || text(og.title))

  const businessName = text(business?.name) || text(og.site_name) || segments[0] || ''
  const phone = text(business?.telephone) || text(contact.phones?.[0])
  const tagline = segments.find((segment) => !namesMatch(segment, businessName)) || ''
  const domain = hostnameOf(website)

  const values: AutoFilledValues = {
    businessName,
    industry: industryOf(business),
    location: locationOf(business, contact.addresses || []),
    phone,
    website,
    brandDescription: text(business?.description) || text(research.description) || text(og.description),
    productService: productServiceOf(business),
    offer: offerOf(business),
    ctaHeadline: tagline.slice(0, 80),
    callToAction: phone ? `Call ${phone}` : domain ? `Visit ${domain}` : '',
  }

  const out: AutoFilledValues = {}
  for (const key of AUTO_FILL_KEYS) {
    const value = values[key]
    if (value) out[key] = value
  }
  return out
}

/**
 * Merge auto-filled values into the client form.
 *
 * A field is filled when it is empty, still holds the hostname placeholder the
 * URL-only path starts with, or still holds a value this finder filled earlier
 * (`previous`; never for the website, which keeps the URL the business was
 * found by). Anything the user typed is left alone.
 * Returns the next form and the record of values that were auto-filled.
 */
export function mergeAutoFilledContent(
  form: Partial<ClientProfile>,
  incoming: AutoFilledValues,
  previous: AutoFilledValues,
  options: { placeholderName?: string } = {},
): { form: Partial<ClientProfile>; autoFilled: AutoFilledValues } {
  const next: Partial<ClientProfile> = { ...form }
  const autoFilled: AutoFilledValues = { ...previous }
  for (const key of AUTO_FILL_KEYS) {
    const value = incoming[key]
    if (!value) continue
    const current = text(next[key])
    // The website the business was found by is kept as-is; research only
    // supplies one when the field is empty.
    const replaceable = !current
      || (key !== 'website' && current === previous[key])
      || (key === 'businessName' && options.placeholderName && current === options.placeholderName)
    if (!replaceable) continue
    next[key] = value
    autoFilled[key] = value
  }
  return { form: next, autoFilled }
}

/**
 * Remove values this finder filled (and the user has not edited) — used when
 * a different business is picked, so content never mixes between businesses.
 */
export function clearAutoFilledContent(
  form: Partial<ClientProfile>,
  previous: AutoFilledValues,
): Partial<ClientProfile> {
  const next: Partial<ClientProfile> = { ...form }
  for (const key of AUTO_FILL_KEYS) {
    if (previous[key] && text(next[key]) === previous[key]) next[key] = ''
  }
  return next
}

/** Keys whose current value is still the auto-filled one (for "from website" tags). */
export function autoFilledKeysOf(form: Partial<ClientProfile>, autoFilled: AutoFilledValues): Set<AutoFillKey> {
  const keys = new Set<AutoFillKey>()
  for (const key of AUTO_FILL_KEYS) {
    if (autoFilled[key] && text(form[key]) === autoFilled[key]) keys.add(key)
  }
  return keys
}
