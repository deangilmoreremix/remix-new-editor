/**
 * Outreach email model (Stage 9): the content of one personalized email, its validation, safe merge-field substitution, the plain-text
 * version and the compliance / deliverability checks. Pure: no React, no network, no clock.
 *
 * Rules enforced here (not left to the template):
 *   - every URL is http(s); `javascript:`, `data:` and the like are refused (an email is a phishing surface)
 *   - every image has alt text (many clients block images by default)
 *   - the footer must carry a sender identity, a postal address and an unsubscribe link (CAN-SPAM / GDPR expectations)
 *   - merge fields are substituted as TEXT (escaped by the renderer), never as markup
 */

export interface EmailImage { url: string; alt: string; width?: number; href?: string }
export interface EmailCta { label: string; url: string }
export interface EmailSender { name: string; address: string; postalAddress: string }

export interface OutreachEmail {
  subject: string
  /** The grey preview line most inboxes show after the subject. */
  preheader: string
  greeting: string
  /** Paragraphs of plain text (merge fields allowed). */
  body: string[]
  /** The personalized GIF (or thumbnail) that links to the video. Clients that do not animate show its first frame. */
  hero?: EmailImage
  cta?: EmailCta
  signoff: string
  sender: EmailSender
  /** Where "unsubscribe" goes (the one-click page). Filled by the server per recipient. */
  unsubscribeUrl: string
  /** A "view in browser" / video page link. */
  videoUrl?: string
}

export const MAX_SUBJECT = 100
export const MAX_PREHEADER = 140
export const MAX_BODY_PARAGRAPHS = 12
export const MAX_PARAGRAPH = 1200
export const MERGE_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]{0,31})\s*\}\}/g

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').slice(0, max) : '')

export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || /[\s<>"]/.test(value)) return false
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}
export const isEmailAddress = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && /^[^\s@<>"',;:()\[\]\\]+@[^\s@<>"',;:()\[\]\\]+\.[^\s@<>"',;:()\[\]\\]{2,}$/.test(v)

const normImage = (raw: unknown): EmailImage | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (!isSafeUrl(r.url)) return undefined
  return { url: r.url, alt: str(r.alt, 200), ...(finite(r.width) ? { width: Math.round(Math.min(640, Math.max(100, r.width))) } : {}), ...(isSafeUrl(r.href) ? { href: r.href } : {}) }
}

export function normalizeEmail(raw: unknown): OutreachEmail {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const cta = r.cta && typeof r.cta === 'object' && isSafeUrl(r.cta.url) && str(r.cta.label, 60).trim() ? { label: str(r.cta.label, 60).trim(), url: r.cta.url } : undefined
  const hero = normImage(r.hero)
  return {
    subject: str(r.subject, MAX_SUBJECT).replace(/\n/g, ' ').trim(),
    preheader: str(r.preheader, MAX_PREHEADER).replace(/\n/g, ' ').trim(),
    greeting: str(r.greeting, 120).replace(/\n/g, ' ').trim(),
    body: (Array.isArray(r.body) ? r.body : []).map((p: unknown) => str(p, MAX_PARAGRAPH).trim()).filter(Boolean).slice(0, MAX_BODY_PARAGRAPHS),
    ...(hero ? { hero } : {}), ...(cta ? { cta } : {}),
    signoff: str(r.signoff, 200).replace(/\n/g, ' ').trim(),
    sender: { name: str(r.sender?.name, 100).trim(), address: str(r.sender?.address, 254).trim(), postalAddress: str(r.sender?.postalAddress, 300).replace(/\n/g, ', ').trim() },
    unsubscribeUrl: isSafeUrl(r.unsubscribeUrl) ? r.unsubscribeUrl : '',
    ...(isSafeUrl(r.videoUrl) ? { videoUrl: r.videoUrl } : {}),
  }
}

/** Substitutes {{field}} with the recipient's value as TEXT. Unknown fields are left visible so the owner notices; nothing is evaluated. */
export function mergeFields(text: string, values: Record<string, string | undefined>): string {
  return text.replace(MERGE_PATTERN, (whole, key: string) => { const v = values[key]; return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : whole })
}
export function unfilledFields(email: OutreachEmail): string[] {
  const all = [email.subject, email.preheader, email.greeting, email.signoff, ...email.body, email.cta?.label ?? '', email.hero?.alt ?? ''].join('\n')
  return [...new Set([...all.matchAll(MERGE_PATTERN)].map((m) => m[1]))]
}
export function mergeEmail(email: OutreachEmail, values: Record<string, string | undefined>): OutreachEmail {
  const m = (s: string) => mergeFields(s, values)
  return { ...email, subject: m(email.subject), preheader: m(email.preheader), greeting: m(email.greeting), signoff: m(email.signoff), body: email.body.map(m), ...(email.cta ? { cta: { ...email.cta, label: m(email.cta.label) } } : {}), ...(email.hero ? { hero: { ...email.hero, alt: m(email.hero.alt) } } : {}) }
}

/** The plain-text alternative: readable, no markup, links written out, unsubscribe included. */
export function toPlainText(email: OutreachEmail): string {
  const parts: string[] = []
  if (email.greeting) parts.push(email.greeting)
  parts.push(...email.body)
  if (email.hero?.alt) parts.push(`[${email.hero.alt}]`)
  if (email.videoUrl) parts.push(`Watch your video: ${email.videoUrl}`)
  if (email.cta) parts.push(`${email.cta.label}: ${email.cta.url}`)
  if (email.signoff) parts.push(email.signoff)
  parts.push('--', [email.sender.name, email.sender.address, email.sender.postalAddress].filter(Boolean).join('\n'), email.unsubscribeUrl ? `Unsubscribe: ${email.unsubscribeUrl}` : '')
  return parts.filter((p) => p !== '').join('\n\n').replace(/\n\n--\n\n/, '\n\n-- \n') + '\n'
}

export type CheckLevel = 'error' | 'warn'
export interface EmailCheck { id: string; level: CheckLevel; message: string }

const SPAMMY = /\b(free money|act now|100% free|click here|guaranteed|winner|no obligation|risk[- ]free|buy now|!!!+)\b/i

/** What stops an email being sent (errors) and what hurts deliverability (warnings). */
export function checkEmail(email: OutreachEmail): EmailCheck[] {
  const out: EmailCheck[] = []
  const add = (id: string, level: CheckLevel, message: string) => out.push({ id, level, message })
  if (!email.subject) add('subject-missing', 'error', 'Add a subject line.')
  else {
    if (email.subject.length > 70) add('subject-long', 'warn', `The subject is ${email.subject.length} characters; inboxes cut it off after about 60–70.`)
    if (email.subject === email.subject.toUpperCase() && /[A-Z]{6,}/.test(email.subject)) add('subject-caps', 'warn', 'An ALL-CAPS subject looks like spam.')
    if (SPAMMY.test(email.subject)) add('subject-spammy', 'warn', 'The subject contains words that spam filters watch for.')
  }
  if (!email.preheader) add('preheader-missing', 'warn', 'Add a preview line: without one, inboxes show the first words of the email.')
  if (email.body.length === 0) add('body-missing', 'error', 'The email has no text. Many filters block emails that are only an image.')
  if (SPAMMY.test(email.body.join(' '))) add('body-spammy', 'warn', 'The text contains words that spam filters watch for.')
  if (!isEmailAddress(email.sender.address)) add('sender-address', 'error', 'Add a valid sender email address.')
  if (!email.sender.name) add('sender-name', 'error', 'Add the sender name (who the email is from).')
  if (!email.sender.postalAddress) add('postal-address', 'error', 'Add a postal address for the footer. Commercial email laws (CAN-SPAM, GDPR practice) expect it.')
  if (!email.unsubscribeUrl) add('unsubscribe-missing', 'error', 'There is no unsubscribe link. Every outreach email needs one.')
  if (email.hero && !email.hero.alt.trim()) add('hero-alt', 'error', 'Describe the picture (alt text): many inboxes block images until the reader allows them.')
  if (email.hero && !email.hero.href && !email.videoUrl) add('hero-link', 'warn', 'The picture does not link anywhere. Link it to the video page.')
  if (!email.cta && !email.videoUrl) add('no-link', 'warn', 'The email has no link to the video or a call to action.')
  if (email.cta && email.cta.label.length > 40) add('cta-long', 'warn', 'Keep the button text short (under 40 characters).')
  for (const f of unfilledFields(email)) add(`unfilled-${f}`, 'warn', `The field {{${f}}} has no value yet. It is filled in per recipient when the email is made.`)
  return out
}
export const hasBlockingProblems = (checks: EmailCheck[]) => checks.some((c) => c.level === 'error')

export function defaultEmail(sender: Partial<EmailSender> = {}, links: { videoUrl?: string; heroUrl?: string; unsubscribeUrl?: string } = {}): OutreachEmail {
  return normalizeEmail({
    subject: '{{firstName}}, a quick video for {{company}}',
    preheader: 'I recorded a short personal video about {{company}}.',
    greeting: 'Hi {{firstName}},',
    body: ['I made a short video for {{company}} and thought you might like to see it.', 'It takes about a minute. If it is useful, reply to this email and tell me what you think.'],
    hero: links.heroUrl ? { url: links.heroUrl, alt: 'A short personal video for {{company}}', width: 480, ...(links.videoUrl ? { href: links.videoUrl } : {}) } : undefined,
    cta: links.videoUrl ? { label: 'Watch your video', url: links.videoUrl } : undefined,
    signoff: 'Thanks,\n' + (sender.name ?? ''),
    sender: { name: '', address: '', postalAddress: '', ...sender },
    unsubscribeUrl: links.unsubscribeUrl ?? '', videoUrl: links.videoUrl,
  })
}
