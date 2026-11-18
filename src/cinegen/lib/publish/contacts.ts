// [remix] Publish > Contacts: ONE list built from the three places contacts really live today, with the same person (same email) shown once.
//   imported = the browser contact store the personalizer uses (src/lib/contactStore.js, localStorage)
//   leads    = answers collected by this video's forms (table video_leads)
//   landing  = contacts added to your landing pages (table landing_page_contacts)
// Pure and unit-tested: loading is done by the panel's hook, drawing by the panel.
// @ts-expect-error plain JS CSV helpers (parser, header guess, row validation) shared with the landing pages
import { buildContacts, guessMapping, parseCsv } from '../../../lib/landingPages/csv.js';

export type ContactSource = 'imported' | 'leads' | 'landing';
export const CONTACT_SOURCE_LABEL: Record<ContactSource, string> = { imported: 'Imported', leads: 'Video leads', landing: 'Landing pages' };

export interface PubContact {
  /** Stable key for lists: the email when there is one, else source + id. */
  key: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  /** Every source this person was found in (a person can be in more than one). */
  sources: ContactSource[];
  /** Where, for display: "Video leads", "Landing page: Spring offer"... */
  from: string[];
  createdAt: string;
  /** Only imported contacts can be removed here; the others belong to their own page / video. */
  removableId: string | null;
}

export const normalizeEmail = (v: unknown): string => String(v ?? '').trim().toLowerCase();
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
export const isEmail = (v: string): boolean => EMAIL.test(v);

interface StoredContact { id: string; name?: string; firstName?: string; lastName?: string; email?: string; company?: string; phone?: string; createdAt?: string }
export function fromStored(c: StoredContact): PubContact {
  const email = normalizeEmail(c.email);
  return { key: email || `imported:${c.id}`, name: (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ')).trim(), email, phone: String(c.phone ?? ''), company: String(c.company ?? ''), sources: ['imported'], from: [CONTACT_SOURCE_LABEL.imported], createdAt: c.createdAt ?? '', removableId: c.id };
}

const pick = (data: Record<string, string>, re: RegExp): string => { const k = Object.keys(data).find((x) => re.test(x)); return k ? String(data[k] ?? '').trim() : ''; };
/** A lead row is a set of answers keyed by the form's question labels ("EMAIL", "FIRST NAME", "Phone"...). */
export function fromLeadRow(row: { id: string; createdAt: string; data: Record<string, string> }): PubContact {
  const d = row.data ?? {};
  const email = normalizeEmail(pick(d, /^e-?mail/i));
  const first = pick(d, /^first ?name/i); const last = pick(d, /^last ?name/i);
  return { key: email || `leads:${row.id}`, name: pick(d, /^(full ?)?name$/i) || [first, last].filter(Boolean).join(' ') || first, email, phone: pick(d, /phone|tel|mobile/i), company: pick(d, /company|business|organi[sz]ation/i), sources: ['leads'], from: [CONTACT_SOURCE_LABEL.leads], createdAt: row.createdAt, removableId: null };
}

export function fromLandingRow(row: { id: string; fields?: Record<string, string>; created_at?: string }, pageTitle: string): PubContact {
  const f = row.fields ?? {};
  const email = normalizeEmail(f.email);
  return { key: email || `landing:${row.id}`, name: [f.firstname, f.lastname].filter(Boolean).join(' ').trim(), email, phone: String(f.phone ?? ''), company: String(f.company ?? ''), sources: ['landing'], from: [`Landing page: ${pageTitle}`], createdAt: row.created_at ?? '', removableId: null };
}

/** Same email = same person: sources and places are combined, and empty details are filled from the other record. Order: newest first. */
export function mergeContacts(...lists: PubContact[][]): PubContact[] {
  const by = new Map<string, PubContact>();
  for (const c of lists.flat()) {
    const cur = by.get(c.key);
    if (!cur) { by.set(c.key, { ...c, sources: [...c.sources], from: [...c.from] }); continue; }
    cur.name ||= c.name; cur.phone ||= c.phone; cur.company ||= c.company;
    cur.removableId ||= c.removableId;
    for (const s of c.sources) if (!cur.sources.includes(s)) cur.sources.push(s);
    for (const f of c.from) if (!cur.from.includes(f)) cur.from.push(f);
    if (c.createdAt && (!cur.createdAt || c.createdAt < cur.createdAt)) cur.createdAt = c.createdAt; // first time we heard from them
  }
  return [...by.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export type SourceFilter = ContactSource | 'all';
export function filterContacts(all: PubContact[], source: SourceFilter, q: string, onlyWithEmail = false): PubContact[] {
  const s = q.trim().toLowerCase();
  return all.filter((c) => (source === 'all' || c.sources.includes(source)) && (!onlyWithEmail || !!c.email) && (!s || `${c.name} ${c.email} ${c.company} ${c.phone} ${c.from.join(' ')}`.toLowerCase().includes(s)));
}
/** Counts for the chips: they follow the search but not the active chip, like the other Publish pages. */
export function sourceCounts(all: PubContact[], q: string): Record<SourceFilter, number> {
  const base = filterContacts(all, 'all', q);
  return { all: base.length, imported: base.filter((c) => c.sources.includes('imported')).length, leads: base.filter((c) => c.sources.includes('leads')).length, landing: base.filter((c) => c.sources.includes('landing')).length };
}

// ── CSV ────────────────────────────────────────────────────────────────────
/** A cell starting with = + - @ would run as a formula in a spreadsheet; it is prefixed with ' (same rule as the landing page export). */
function cell(value: string): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function contactsToCsv(list: PubContact[]): string {
  const lines = [['name', 'email', 'phone', 'company', 'source', 'added'].join(',')];
  for (const c of list) lines.push([c.name, c.email, c.phone, c.company, c.from.join(' / '), c.createdAt].map(cell).join(','));
  return lines.join('\r\n');
}

export interface CsvImport { contacts: Array<{ id: string; name: string; firstName: string; lastName: string; email: string; company: string; location: string; source: string }>; skipped: Array<{ line: number; reason: string }>; hasEmailColumn: boolean }
/** Turn CSV text into contacts in the shape the personalizer's store uses. `existingEmails` (lowercase) are skipped as duplicates. */
export function importFromCsv(text: string, existingEmails: Set<string>, makeId: () => string): CsvImport {
  const { headers, rows } = parseCsv(text) as { headers: string[]; rows: string[][] };
  const mapping = guessMapping(headers) as string[];
  const hasEmailColumn = mapping.includes('email');
  const { contacts, skipped } = buildContacts(rows, mapping, { existing: existingEmails }) as { contacts: Array<{ fields: Record<string, string> }>; skipped: Array<{ line: number; reason: string }> };
  return {
    hasEmailColumn, skipped,
    contacts: contacts.map(({ fields: f }) => ({ id: makeId(), name: [f.firstname, f.lastname].filter(Boolean).join(' '), firstName: f.firstname ?? '', lastName: f.lastname ?? '', email: normalizeEmail(f.email), company: f.company ?? '', location: f.city ?? '', source: 'csv-import' })),
  };
}
