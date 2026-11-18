/**
 * CSV in -> contacts for personalized links; contacts -> CSV of links out.
 * Pure functions, unit tested.
 *
 * Contact `fields` hold the public token keys (firstname, company, ...; see
 * PUBLIC_TOKEN_KEYS) plus `email`, which is private: the viewer-facing RPC
 * only ever returns the public keys.
 */
import { PUBLIC_TOKEN_KEYS } from './templates.js';
import { personalUrl } from './client.js';

export const MAX_CONTACTS_PER_IMPORT = 1000;
export const CONTACT_FIELDS = Object.freeze([...PUBLIC_TOKEN_KEYS, 'email']);

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** Parse CSV text (quotes, escaped quotes, CRLF, BOM, comma/semicolon/tab). */
export function parseCsv(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  if (!text.trim()) return { headers: [], rows: [] };
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];

  const records = [];
  let field = '';
  let record = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { record.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field); field = '';
      if (record.some((c) => c.trim() !== '')) records.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.some((c) => c.trim() !== '')) records.push(record);

  const [headerRow, ...rows] = records;
  const headers = (headerRow || []).map((h) => h.trim());
  return { headers, rows: rows.map((r) => headers.map((_, i) => (r[i] ?? '').trim())) };
}

const HEADER_GUESSES = [
  ['email', /^(e-?mail|email address|mail)$/i],
  ['firstname', /^(first ?name|first_name|given ?name|forename|fname)$/i],
  ['lastname', /^(last ?name|last_name|surname|family ?name|lname)$/i],
  ['companylogo', /^(company logo|logo|logo url|company logo url)$/i],
  ['company', /^(company|company name|organi[sz]ation|business|employer|account)$/i],
  ['role', /^(role|title|job ?title|position)$/i],
  ['city', /^(city|town|location)$/i],
];

/** Suggest a field for each header; unknown headers map to '' (ignored). */
export function guessMapping(headers) {
  const used = new Set();
  return headers.map((h) => {
    const hit = HEADER_GUESSES.find(([field, re]) => !used.has(field) && re.test(h.trim()));
    if (hit) { used.add(hit[0]); return hit[0]; }
    return '';
  });
}

/**
 * @param {string[][]} rows
 * @param {string[]} mapping field name (or '') per column
 * @param {object} opts { existing: Set<string> of lowercase emails, limit }
 * @returns {{ contacts: {fields: object}[], skipped: {line: number, reason: string}[] }}
 */
export function buildContacts(rows, mapping, { existing = new Set(), limit = MAX_CONTACTS_PER_IMPORT } = {}) {
  const contacts = [];
  const skipped = [];
  const seen = new Set(existing);
  const columns = mapping.map((f, i) => [f, i]).filter(([f]) => CONTACT_FIELDS.includes(f));
  const usesEmail = columns.some(([f]) => f === 'email');

  rows.forEach((row, idx) => {
    const line = idx + 2; // +1 header, +1 for 1-based
    if (contacts.length >= limit) { if (!skipped.some((s) => s.reason === 'over limit')) skipped.push({ line, reason: 'over limit' }); return; }
    const fields = {};
    columns.forEach(([f, i]) => {
      const v = String(row[i] ?? '').trim().slice(0, 200);
      if (v && !(f in fields)) fields[f] = v;
    });
    // A logo must be an https image link; anything else is dropped (the contact is still imported).
    if (fields.companylogo && !/^https:\/\/\S+$/i.test(fields.companylogo)) delete fields.companylogo;
    if (!Object.keys(fields).length) { skipped.push({ line, reason: 'empty' }); return; }
    if (fields.email && !EMAIL.test(fields.email)) { skipped.push({ line, reason: 'invalid email' }); return; }
    if (usesEmail && !fields.email) { skipped.push({ line, reason: 'missing email' }); return; }
    const key = fields.email ? fields.email.toLowerCase() : `${fields.firstname || ''}|${fields.lastname || ''}|${fields.company || ''}`.toLowerCase();
    if (seen.has(key)) { skipped.push({ line, reason: 'duplicate' }); return; }
    seen.add(key);
    contacts.push({ fields });
  });
  return { contacts, skipped };
}

/** Neutralize spreadsheet formulas: a cell starting with = + - @ (or tab/CR) is prefixed with '. */
function cell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of every contact with its personal link, for any email tool. */
export function exportLinksCsv(contacts, pageId, origin) {
  const header = ['firstname', 'lastname', 'company', 'email', 'link'];
  const lines = [header.join(',')];
  contacts.forEach((c) => {
    const f = c.fields || {};
    lines.push([f.firstname, f.lastname, f.company, f.email, personalUrl(pageId, c.id, origin)].map(cell).join(','));
  });
  return lines.join('\r\n');
}

/** Display name for a contact row. */
export function contactLabel(c) {
  const f = c?.fields || {};
  return [f.firstname, f.lastname].filter(Boolean).join(' ') || f.company || f.email || 'Contact';
}
