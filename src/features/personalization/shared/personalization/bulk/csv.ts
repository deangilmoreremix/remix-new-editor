/**
 * CSV import for bulk personalization (Stage 10). Pure and dependency-free.
 *
 *   parseCsv      RFC 4180 (quotes, doubled quotes, newlines inside quotes, CRLF, BOM), delimiter sniffed (, ; tab). Never throws:
 *                 anything odd is reported in `problems`.
 *   suggestMapping / buildRecipients
 *                 columns → recipient fields; every row is validated, cleaned, de-duplicated. A bad row is excluded WITH a reason that
 *                 names its row number; nothing is silently dropped.
 *   toCsv         writes a CSV that is safe to open in a spreadsheet (cells starting with = + - @ are neutralised: "CSV injection").
 */

export const CSV_LIMITS = { maxBytes: 5_000_000, maxRows: 5000, maxCols: 60, maxCell: 500 } as const

export interface ParsedCsv { header: string[]; rows: string[][]; delimiter: string; problems: string[] }

const BOM = /^\uFEFF/
// Control characters and the bidirectional overrides that make text read differently from how it is stored.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‎‏‪-‮⁦-⁩]/g
export const cleanCell = (v: string): string => v.replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim()

function sniffDelimiter(firstLine: string): string {
  let best = ','; let bestCount = 0
  for (const d of [',', ';', '\t']) {
    let inQ = false; let n = 0
    for (const ch of firstLine) { if (ch === '"') inQ = !inQ; else if (ch === d && !inQ) n += 1 }
    if (n > bestCount) { best = d; bestCount = n }
  }
  return best
}

export function parseCsv(input: string): ParsedCsv {
  const problems: string[] = []
  let text = String(input ?? '')
  if (text.length > CSV_LIMITS.maxBytes) { problems.push(`The file is larger than ${(CSV_LIMITS.maxBytes / 1e6).toFixed(0)} MB; only the start was read.`); text = text.slice(0, CSV_LIMITS.maxBytes) }
  text = text.replace(BOM, '')
  const delimiter = sniffDelimiter(text.split(/\r\n|\n|\r/, 1)[0] ?? '')
  const all: string[][] = []
  let row: string[] = []; let cell = ''; let inQ = false; let wasQuoted = false
  const endCell = () => { row.push(cell); cell = ''; wasQuoted = false }
  const endRow = () => { endCell(); if (row.length > 1 || row[0].trim() !== '' || wasQuoted) all.push(row); row = [] }
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 1 } else inQ = false } else cell += ch
    } else if (ch === '"' && cell === '') { inQ = true; wasQuoted = true }
    else if (ch === delimiter) endCell()
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i += 1; endRow() }
    else cell += ch
    if (all.length > CSV_LIMITS.maxRows + 1) { problems.push(`More than ${CSV_LIMITS.maxRows} rows: only the first ${CSV_LIMITS.maxRows} were read.`); row = []; cell = ''; break }
  }
  if (inQ) problems.push('A quoted value was never closed, so the end of the file was read as one value. Check for a stray quote mark.')
  if (cell !== '' || row.length > 0 || wasQuoted) endRow()
  if (all.length === 0) return { header: [], rows: [], delimiter, problems: [...problems, 'The file has no rows.'] }

  const width = Math.min(all[0].length, CSV_LIMITS.maxCols) // the header defines the columns
  if (all[0].length > CSV_LIMITS.maxCols) problems.push(`Only the first ${CSV_LIMITS.maxCols} columns are used.`)
  const seen = new Map<string, number>()
  const header = all[0].slice(0, width).map((h, i) => {
    const base = cleanCell(h) || `column${i + 1}`
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1; seen.set(base.toLowerCase(), n)
    if (n > 1) problems.push(`The column name "${base}" appears more than once; the repeat is called "${base}_${n}".`)
    return n > 1 ? `${base}_${n}` : base
  })
  const rows = all.slice(1, CSV_LIMITS.maxRows + 1).map((r) => { const o = r.slice(0, width); while (o.length < width) o.push(''); return o })
  const ragged = all.slice(1).filter((r) => r.length !== all[0].length).length
  if (ragged) problems.push(`${ragged} row${ragged === 1 ? ' has' : 's have'} a different number of columns than the header; missing values are left empty.`)
  return { header, rows, delimiter, problems }
}

// ---------------------------------------------------------------- columns → recipient fields
export type CoreField = 'name' | 'company' | 'email' | 'website' | 'phone' | 'location'
export type ColumnTarget = CoreField | { custom: string } | null
export const CORE_FIELDS: CoreField[] = ['company', 'name', 'email', 'website', 'phone', 'location']
const SYNONYMS: Array<[CoreField, RegExp]> = [
  ['email', /^(e-?mail|email address|mail)$/i],
  ['company', /^(company|company name|business|business name|organi[sz]ation|account|employer)$/i],
  ['name', /^(name|full name|contact|contact name|person)$/i],
  ['website', /^(website|web site|url|site|domain|web|homepage)$/i],
  ['phone', /^(phone|telephone|tel|mobile|phone number|cell)$/i],
  ['location', /^(location|city|town|address|region|state)$/i],
]
const CUSTOM_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
/** "First name" → firstName, "Job Title" → jobTitle; null when nothing usable is left. */
export function customKeyFor(header: string): string | null {
  const words = header.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return null
  const key = words.map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1))).join('')
  const fixed = /^[A-Za-z]/.test(key) ? key : `f${key}`
  return CUSTOM_KEY.test(fixed) ? fixed : fixed.slice(0, 40)
}

export function suggestMapping(header: string[]): ColumnTarget[] {
  const used = new Set<CoreField>(); const keys = new Set<string>()
  return header.map((h) => {
    const name = cleanCell(h)
    for (const [field, re] of SYNONYMS) if (!used.has(field) && re.test(name)) { used.add(field); return field }
    const key = customKeyFor(name)
    if (!key || keys.has(key)) return null
    keys.add(key); return { custom: key }
  })
}

// ---------------------------------------------------------------- recipients
export interface Recipient {
  id: string; row: number
  name: string; company: string; email: string; website: string; phone: string; location: string
  /** Everything a template can use as {{field}}: the core fields, firstName, and any extra columns. */
  values: Record<string, string>
}
export type IssueLevel = 'error' | 'warn'
export interface ImportIssue { row: number; level: IssueLevel; code: 'no-identity' | 'bad-email' | 'bad-website' | 'duplicate' | 'long-value' | 'row-limit'; message: string }
export interface ImportResult { recipients: Recipient[]; issues: ImportIssue[]; counts: { rows: number; accepted: number; skipped: number; duplicates: number } }

const EMAIL_RE = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]{2,}$/
export const isValidEmail = (v: string): boolean => v.length <= 254 && EMAIL_RE.test(v)

/** Accepts "acme.com", "www.acme.com/x", "https://acme.com"; only http(s) with a real host and no embedded login. Returns null if unusable. */
export function normalizeWebsite(raw: string): string | null {
  const v = raw.trim()
  if (!v) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return null
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || !u.hostname.includes('.') || /\s/.test(v)) return null
    return `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname}${u.search}`.slice(0, 300)
  } catch { return null }
}

/** Short, stable (same input → same id), not a security value. */
function fnv(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) } return (h >>> 0).toString(16).padStart(8, '0') }
const hostOf = (site: string) => { try { return new URL(site).hostname.replace(/^www\./, '') } catch { return '' } }

export function buildRecipients(rows: string[][], header: string[], mapping: ColumnTarget[]): ImportResult {
  const issues: ImportIssue[] = []; const recipients: Recipient[] = []
  const firstSeen = new Map<string, number>()
  let duplicates = 0
  rows.forEach((cells, idx) => {
    const row = idx + 2 // spreadsheet numbering: row 1 is the header
    if (idx >= CSV_LIMITS.maxRows) { if (idx === CSV_LIMITS.maxRows) issues.push({ row, level: 'error', code: 'row-limit', message: `Rows after ${CSV_LIMITS.maxRows} are not imported.` }); return }
    const core: Record<CoreField, string> = { name: '', company: '', email: '', website: '', phone: '', location: '' }
    const custom: Record<string, string> = {}
    mapping.forEach((target, col) => {
      if (!target) return
      let v = cleanCell(cells[col] ?? '')
      if (v.length > CSV_LIMITS.maxCell) { v = v.slice(0, CSV_LIMITS.maxCell); issues.push({ row, level: 'warn', code: 'long-value', message: `A value in "${header[col]}" was cut to ${CSV_LIMITS.maxCell} characters.` }) }
      if (typeof target === 'string') core[target] = core[target] || v
      else if (v) custom[target.custom] = v
    })
    core.email = core.email.toLowerCase()
    if (!core.company && !core.name && !core.email) { if (cells.some((c) => cleanCell(c))) issues.push({ row, level: 'error', code: 'no-identity', message: 'Skipped: no company, name or email.' }); return }
    if (core.email && !isValidEmail(core.email)) { issues.push({ row, level: 'error', code: 'bad-email', message: `Skipped: "${core.email.slice(0, 60)}" is not a valid email address.` }); return }
    const site = normalizeWebsite(core.website)
    if (site === null) { issues.push({ row, level: 'error', code: 'bad-website', message: `Skipped: "${core.website.slice(0, 60)}" is not a usable web address.` }); return }
    core.website = site
    const dedupeKey = core.email ? `e:${core.email}` : `c:${(core.company || core.name).toLowerCase()}|${hostOf(site)}`
    const prior = firstSeen.get(dedupeKey)
    if (prior !== undefined) { duplicates += 1; issues.push({ row, level: 'error', code: 'duplicate', message: `Skipped: same ${core.email ? 'email address' : 'company and website'} as row ${prior}.` }); return }
    firstSeen.set(dedupeKey, row)
    const values: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...custom, ...core })) if (v) values[k] = v
    if (!values.firstName) { const first = (core.name || '').split(' ')[0]; if (first) values.firstName = first }
    recipients.push({ id: `r${String(recipients.length + 1).padStart(4, '0')}-${fnv(dedupeKey).slice(0, 6)}`, row, ...core, values })
  })
  const skipped = issues.filter((i) => i.level === 'error').length
  return { recipients, issues, counts: { rows: rows.length, accepted: recipients.length, skipped, duplicates } }
}

// ---------------------------------------------------------------- output
const FORMULA_START = /^[=+\-@\t\r]/
/** Spreadsheets run cells that start with = + - @ as formulas; a leading apostrophe makes them text. */
export const neutralizeCell = (v: string): string => (FORMULA_START.test(v) ? `'${v}` : v)
export function toCsv(rows: string[][]): string {
  const cell = (v: string) => { const s = neutralizeCell(String(v ?? '')); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
