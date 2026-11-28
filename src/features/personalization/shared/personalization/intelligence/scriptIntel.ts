/**
 * Fact-based writing helpers. These are TEMPLATES over details the customer already entered, not a language model:
 * they never invent offers, prices, deadlines or guarantees, and every output says where it came from.
 */
export interface Facts { businessName?: string; industry?: string; location?: string; phone?: string; website?: string; offer?: string; cta?: string }

export type Tone = 'friendly' | 'professional' | 'energetic'
export interface ScriptOptions { purpose: 'intro' | 'outreach' | 'promo'; tone: Tone; seconds: number; audience?: string }

const OPEN: Record<Tone, string> = { friendly: 'Hi there!', professional: 'Hello,', energetic: 'Hey!' }

export function buildScript(f: Facts, o: ScriptOptions): { text: string; words: number; source: 'template' } {
  const name = f.businessName?.trim()
  const where = f.location?.split(',')[0]?.trim()
  const parts: string[] = [OPEN[o.tone]]
  if (name) parts.push(`This is ${name}${f.industry ? `, your ${f.industry.toLowerCase()}` : ''}${where ? ` in ${where}` : ''}.`)
  if (o.audience) parts.push(`We work with ${o.audience}.`)
  if (f.offer && o.purpose !== 'intro') parts.push(`${f.offer.replace(/[.!]+$/, '')}.`)
  const cta = f.cta?.trim() || (f.website ? `Visit ${f.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}` : f.phone ? `Call ${f.phone}` : '')
  if (cta) parts.push(`${cta.replace(/[.!]+$/, '')}.`)
  // ~2.5 spoken words per second; drop sentences from the middle until it fits, keeping the opener and the call to action.
  const budget = Math.max(8, Math.round(o.seconds * 2.5))
  const words = (s: string[]) => s.join(' ').split(/\s+/).filter(Boolean).length
  while (words(parts) > budget && parts.length > 2) parts.splice(parts.length - 2, 1)
  const text = parts.join(' ')
  return { text, words: words(parts), source: 'template' }
}

export function describeVideo(f: Facts, transcript?: string): { text: string; source: 'template' } {
  const name = f.businessName?.trim() || 'this business'
  const first = transcript?.trim().split(/(?<=[.!?])\s+/)[0]
  const base = `A short video from ${name}${f.location ? ` in ${f.location.split(',')[0]!.trim()}` : ''}.`
  const lines = [base, first && first.length < 160 ? first : '', f.website ? `Learn more: ${f.website}` : ''].filter(Boolean)
  return { text: lines.join(' '), source: 'template' }
}

/** Best-fit call-to-action ideas from the contact details present. Never adds an offer. */
export function ctaIdeas(f: Facts): string[] {
  const out: string[] = []
  const ind = (f.industry ?? '').toLowerCase()
  if (f.website) out.push(/shop|store|retail|boutique|product/.test(ind) ? 'View Products' : 'Visit Our Website')
  if (f.phone) out.push(/salon|spa|clinic|dental|barber|medical|doctor/.test(ind) ? 'Book an Appointment' : 'Call Us Today')
  if (f.website && /contractor|repair|plumb|electric|roof|clean|landscap|consult|agency|law/.test(ind)) out.push('Request a Quote')
  return [...new Set(out)]
}
