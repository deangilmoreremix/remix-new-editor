/**
 * Lead Finder → bulk personalization. A saved Lead Finder lead (a business found on the map, with the owner's stage and notes) becomes a
 * `Recipient` exactly like a spreadsheet row does, so the existing batch, personal-link, private-video and email-package code runs on it
 * unchanged: one tracked link per lead, with views, clicks, leads and alerts attributed to that business.
 *
 * Pure and dependency-free (no fetch, no storage). Never throws: a lead it cannot use is reported, not fatal. An unusable email or website
 * is dropped from that lead (the lead is still used) because Lead Finder data comes from public map data and is often incomplete.
 */
import type { BusinessDiscoveryRecord } from '../types'
import { CSV_LIMITS, cleanCell, fnv, isValidEmail, normalizeWebsite, type ImportIssue, type ImportResult, type Recipient } from './csv'

/** The part of a saved lead this module reads (what GET /api/personalization/leads returns for each lead). */
export interface SavedLead {
  id: string
  business?: Partial<BusinessDiscoveryRecord> | null
  stage?: string | null
  starred?: boolean | null
  niche?: string | null
  location?: string | null
}

const text = (v: unknown, max = 200): string => (typeof v === 'string' ? cleanCell(v).slice(0, max) : '')
const hostOf = (site: string): string => { try { return new URL(site).hostname.replace(/^www\./, '') } catch { return '' } }

export function leadsToRecipients(leads: SavedLead[]): ImportResult {
  const issues: ImportIssue[] = []; const recipients: Recipient[] = []; const seen = new Map<string, number>()
  let duplicates = 0
  const list = (Array.isArray(leads) ? leads : []).slice(0, CSV_LIMITS.maxRows)
  if (Array.isArray(leads) && leads.length > list.length) issues.push({ row: list.length + 1, level: 'error', code: 'row-limit', message: `Leads after ${CSV_LIMITS.maxRows} are not used.` })
  list.forEach((lead, idx) => {
    const row = idx + 1
    const b = (lead && typeof lead === 'object' && lead.business && typeof lead.business === 'object' ? lead.business : {}) as Partial<BusinessDiscoveryRecord>
    const leadId = text(lead?.id, 64); const company = text(b.name, 120)
    if (!leadId || !company) { issues.push({ row, level: 'error', code: 'no-identity', message: 'Skipped: this lead has no business name.' }); return }
    let email = text(b.email, 254).toLowerCase()
    if (email && !isValidEmail(email)) { issues.push({ row, level: 'warn', code: 'bad-email', message: `${company}: "${email.slice(0, 40)}" is not a valid email address, so no email is used for this lead.` }); email = '' }
    let website = text(b.website, 300)
    if (website) {
      const site = normalizeWebsite(website)
      if (site === null) { issues.push({ row, level: 'warn', code: 'bad-website', message: `${company}: "${website.slice(0, 40)}" is not a usable web address, so no website is used for this lead.` }); website = '' } else website = site
    }
    const keys = [`i:${leadId}`, email ? `e:${email}` : `c:${company.toLowerCase()}|${hostOf(website)}`]
    const prior = keys.map((k) => seen.get(k)).find((v) => v !== undefined)
    if (prior !== undefined) { duplicates += 1; issues.push({ row, level: 'error', code: 'duplicate', message: `Skipped: ${company} is the same lead, email address or company as lead ${prior}.` }); return }
    for (const k of keys) seen.set(k, row)
    const city = text(b.city, 80); const region = text(b.region, 80)
    const location = text(lead.location, 120) || [city, region].filter(Boolean).join(', ') || text(b.address, 160)
    const core = { name: '', company, email, website, phone: text(b.phone, 40), location }
    const values: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...core, category: text(b.category, 80) || text(lead.niche, 80), niche: text(lead.niche, 80), city, region, address: text(b.address, 160) })) if (v) values[k] = v
    recipients.push({ id: `lf-${fnv(leadId)}`, row, ...core, values })
  })
  const skipped = issues.filter((i) => i.level === 'error').length
  return { recipients, issues, counts: { rows: Array.isArray(leads) ? leads.length : 0, accepted: recipients.length, skipped, duplicates } }
}

/** Leads in the chosen stage (or every stage) and, optionally, only the ones the owner starred. */
export function filterLeads(leads: SavedLead[], opts: { stage?: string; starredOnly?: boolean } = {}): SavedLead[] {
  return (leads ?? []).filter((l) => (!opts.stage || l?.stage === opts.stage) && (!opts.starredOnly || l?.starred === true))
}
