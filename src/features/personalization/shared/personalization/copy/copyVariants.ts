/**
 * Free copy suggestions: deterministic templates built only from what the customer already entered. No model,
 * no network. It never invents an offer, price, discount, award or claim (the form promises that), so every
 * phrase is structural: the name, the kind of business, the place, the contact line.
 */
export interface CopyInput {
  businessName?: string
  industry?: string
  location?: string
  phone?: string
  website?: string
}

export interface CopySuggestions {
  headlines: string[]
  taglines: string[]
  ctas: string[]
  subjects: string[]
}

const MAX_HEADLINE = 60
const MAX_TAGLINE = 70
const MAX_CTA = 32
const MAX_SUBJECT = 70

const clean = (v: string | undefined): string => (v ?? '').replace(/\s+/g, ' ').trim()

/** "Tampa, FL, USA" -> "Tampa". */
export function cityOf(location: string | undefined): string {
  return clean(location).split(',')[0].trim()
}

/** "https://www.joes.com/about" -> "joes.com"; anything that is not a hostname -> "". */
export function displayDomain(website: string | undefined): string {
  const raw = clean(website)
  if (!raw) return ''
  try {
    const host = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, '')
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host) ? host : ''
  } catch { return '' }
}

function lower(industry: string): string {
  // Keep acronyms ("HVAC") as typed; lowercase ordinary words so "Plumber" reads inside a sentence.
  return industry.split(' ').map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase())).join(' ')
}

function finish(list: (string | null)[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    if (!item) continue
    const t = clean(item)
    if (!t || t.length > max) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function suggestCopy(input: CopyInput): CopySuggestions {
  const name = clean(input.businessName)
  const kind = lower(clean(input.industry))
  const city = cityOf(input.location)
  const domain = displayDomain(input.website)
  const phone = clean(input.phone)

  const headlines = finish([
    name || null,
    name ? `Meet ${name}` : null,
    name ? `Welcome to ${name}` : null,
    name && kind && city ? `${name}: ${kind} in ${city}` : null,
    kind && city ? `${kind[0].toUpperCase()}${kind.slice(1)} in ${city}` : null,
  ], MAX_HEADLINE)

  const taglines = finish([
    kind && city ? `${kind[0].toUpperCase()}${kind.slice(1)} in ${city}` : null,
    city ? `Based in ${city}` : null,
    kind ? `Your local ${kind}` : null,
  ], MAX_TAGLINE)

  const ctas = finish([
    domain ? `Visit ${domain}` : null,
    phone ? `Call ${phone}` : null,
    name ? `Contact ${name}` : null,
    'Get in touch',
    'Learn more',
  ], MAX_CTA)

  const subjects = finish([
    name ? `A short video for ${name}` : null,
    name ? `An idea for ${name}` : null,
    name && city ? `${name} in ${city}: a quick video` : null,
  ], MAX_SUBJECT)

  return { headlines: headlines.slice(0, 3), taglines: taglines.slice(0, 3), ctas: ctas.slice(0, 3), subjects: subjects.slice(0, 3) }
}
