/**
 * Kit hand-off (follow-up to Stage 9/10). Kit saves broadcasts as drafts and only its owner schedules or sends them, from Kit's own
 * screen, so this module produces what the owner IMPORTS: a subscriber CSV with each recipient's personal link and GIF, and the outreach
 * email as Kit-ready HTML using Kit's Liquid tags. It never talks to Kit and holds no key.
 *
 * Kit requires the unsubscribe link and the postal address in every email; they are Kit's own tags here, so Kit's unsubscribe and
 * suppression apply to anything sent from Kit (this app's own suppression list is applied BEFORE the CSV is made: suppressed and invalid
 * addresses are left out and counted).
 */
import { toCsv, isValidEmail, type Recipient } from '../bulk/csv'
import { hashAddress } from './unsubscribe'
import { renderEmail } from './renderEmail'
import { mergeEmail, type OutreachEmail } from './emailModel'

export const KIT_FIELDS = [{ key: 'smartvideo_link', label: 'SMARTVIDEO_LINK' }, { key: 'smartvideo_gif', label: 'SMARTVIDEO_GIF' }] as const
export const KIT_HEADERS = ['email', 'first_name', 'company', ...KIT_FIELDS.map((f) => f.key)]

export interface KitRow { email: string; firstName: string; company: string; link: string; gif: string }
export interface KitPlan { rows: KitRow[]; skipped: Array<{ id: string; reason: 'no-email' | 'invalid-email' | 'suppressed' | 'no-link' }>; csv: string }

/** Who goes in the Kit import: valid address, a personal link made, and not on this app's suppression list. */
export async function planKitImport(recipients: Recipient[], opts: { links: Record<string, string>; gifs?: Record<string, string>; suppressedHashes?: Iterable<string> }): Promise<KitPlan> {
  const sup = new Set(opts.suppressedHashes ?? []); const rows: KitRow[] = []; const skipped: KitPlan['skipped'] = []
  for (const r of recipients) {
    if (!r.email) { skipped.push({ id: r.id, reason: 'no-email' }); continue }
    if (!isValidEmail(r.email)) { skipped.push({ id: r.id, reason: 'invalid-email' }); continue }
    if (sup.has(await hashAddress(r.email))) { skipped.push({ id: r.id, reason: 'suppressed' }); continue }
    const link = opts.links[r.id]; if (!link) { skipped.push({ id: r.id, reason: 'no-link' }); continue }
    rows.push({ email: r.email, firstName: r.values.firstName ?? '', company: r.company, link, gif: opts.gifs?.[r.id] ?? '' })
  }
  const csv = toCsv([KIT_HEADERS, ...rows.map((x) => [x.email, x.firstName, x.company, x.link, x.gif])])
  return { rows, skipped, csv }
}

const PH = { link: 'https://kit-handoff.invalid/personal-link', gif: 'https://kit-handoff.invalid/personal.gif', unsub: 'https://kit-handoff.invalid/unsubscribe', first: 'KITHANDOFFFIRSTNAME', company: 'KITHANDOFFCOMPANY', address: 'KITHANDOFFADDRESS' }
/** The email as HTML for Kit's broadcast editor: per-recipient parts become Kit Liquid tags; unsubscribe and address are Kit's. */
export async function kitEmailHtml(email: OutreachEmail): Promise<{ html: string; subject: string; checks: Awaited<ReturnType<typeof renderEmail>>['checks'] }> {
  const base: OutreachEmail = { ...email, videoUrl: PH.link, unsubscribeUrl: PH.unsub, sender: { ...email.sender, postalAddress: PH.address },
    ...(email.cta ? { cta: { ...email.cta, url: PH.link } } : {}), ...(email.hero ? { hero: { ...email.hero, url: PH.gif, href: PH.link } } : {}) }
  const merged = mergeEmail(base, { firstName: PH.first, company: PH.company })
  const r = await renderEmail(merged)
  const liquid = (s: string) => s.split(PH.first).join('{{ subscriber.first_name | default: "there" }}').split(PH.company).join('{{ subscriber.company }}')
  const html = liquid(r.html.split(PH.link).join('{{ subscriber.smartvideo_link }}').split(PH.gif).join('{{ subscriber.smartvideo_gif }}').split(PH.unsub).join('{{ unsubscribe_url }}').split(PH.address).join('{{ address }}'))
  return { html, subject: liquid(merged.subject), checks: r.checks.filter((c) => c.id !== 'postal-address' && c.id !== 'unsubscribe-missing') }
}
