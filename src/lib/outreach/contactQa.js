// src/lib/outreach/contactQa.js
//
// Free, on-device checks of a contact list before a campaign is made (requirements 37 and 38):
//   validateContacts(contacts)   what is wrong or missing, per contact and in total
//   dedupeContacts(contacts)     the list without duplicates, plus what was removed so it can be put back
//   restoreDuplicates(kept, removed)  the exact reverse of dedupeContacts
//   mergeFieldReport(...)        for every contact: each {{token}} you use, where its value came from
//
// Email checks are syntax only. A well-formed address is not proof that mail reaches anyone.
import { tokensIn, fillTemplate } from './draft.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmailSyntax = (e) => EMAIL_RE.test(String(e || '').trim());

/** A website that can be shown: http(s) with a dotted host (a bare "acme.com" is accepted and read as https). */
export function websiteProblem(site) {
  const raw = String(site || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || /\s/.test(u.hostname)) return 'does not look like a web address';
    return '';
  } catch { return 'does not look like a web address'; }
}

/** The key two entries share when they are the same person: the email, else name and company. */
export function contactKey(c) {
  const email = String(c?.email || '').trim().toLowerCase();
  if (email) return `e:${email}`;
  const who = [c?.firstName, c?.lastName, c?.company].map((v) => String(v || '').trim().toLowerCase());
  // A company alone does not say it is the same person (two people at Acme): a name is needed.
  return who[0] || who[1] ? `n:${who.join('|')}` : '';
}

const nameOf = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(' ') || c?.email || 'No name';

/**
 * @returns {{ issues: {type, level:'warning'|'info', index:number, contactId:string, name:string, message:string}[],
 *   duplicateGroups: number[][], counts: Record<string, number> }}
 * Levels: "warning" is likely to hurt the campaign, "info" is a missing detail the fallbacks will cover.
 */
export function validateContacts(contacts, { requireEmail = false } = {}) {
  const list = Array.isArray(contacts) ? contacts : [];
  const issues = [];
  const add = (type, level, index, message) => issues.push({ type, level, index, contactId: list[index]?.id || '', name: nameOf(list[index]), message });
  const groups = new Map();
  list.forEach((c, i) => {
    const key = contactKey(c);
    if (key) groups.set(key, [...(groups.get(key) || []), i]);
    if (!String(c?.firstName || '').trim()) add('missing-first-name', 'info', i, 'No first name: the fallback greeting is used.');
    if (!String(c?.company || '').trim()) add('missing-company', 'info', i, 'No company: the company fallback is used.');
    const email = String(c?.email || '').trim();
    if (!email) add('missing-email', requireEmail ? 'warning' : 'info', i, 'No email address.');
    else if (!isEmailSyntax(email)) add('invalid-email', 'warning', i, 'The email does not look right (syntax only; delivery is not checked).');
    const problem = websiteProblem(c?.website);
    if (problem) add('invalid-website', 'warning', i, `The website ${problem}.`);
  });
  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);
  duplicateGroups.forEach((g) => g.slice(1).forEach((i) => add('duplicate', 'warning', i, `Duplicate of ${nameOf(list[g[0]])} (row ${g[0] + 1}).`)));
  issues.sort((a, b) => a.index - b.index);
  const counts = {};
  for (const x of issues) counts[x.type] = (counts[x.type] || 0) + 1;
  return { issues, duplicateGroups, counts };
}

/** Keep the first of each duplicate group. `removed` remembers each dropped contact and where it was. */
export function dedupeContacts(contacts) {
  const seen = new Set();
  const kept = [];
  const removed = [];
  (Array.isArray(contacts) ? contacts : []).forEach((c, index) => {
    const key = contactKey(c);
    if (key && seen.has(key)) { removed.push({ index, contact: c }); return; }
    if (key) seen.add(key);
    kept.push(c);
  });
  return { kept, removed };
}

/** Put the removed contacts back exactly where they were. */
export function restoreDuplicates(kept, removed) {
  const out = [...kept];
  [...removed].sort((a, b) => a.index - b.index).forEach(({ index, contact }) => out.splice(Math.min(index, out.length), 0, contact));
  return out;
}

const VALUE_OF = {
  firstname: (c) => c.firstName, lastname: (c) => c.lastName, email: (c) => c.email, company: (c) => c.company,
  jobtitle: (c) => c.jobTitle, role: (c) => c.jobTitle, website: (c) => c.website,
};

/**
 * For each contact, every {{token}} used by `templates` and where it came from: the contact, a fallback, or nothing.
 * @param {{ templates: Record<string,string>, contacts: object[], fallbacks?: object, linkFor?: (c:object)=>string }} o
 * @returns {{ rows: object[], missing: Record<string, number>, usingFallback: Record<string, number>, tokens: string[] }}
 */
export function mergeFieldReport({ templates = {}, contacts = [], fallbacks = {}, linkFor = () => '' } = {}) {
  const tokens = [...new Set(Object.values(templates).flatMap((t) => tokensIn(t)))];
  const fb = Object.fromEntries(Object.entries(fallbacks || {}).map(([k, v]) => [k.toLowerCase(), String(v ?? '').trim()]));
  const missing = {};
  const usingFallback = {};
  const rows = contacts.map((c, index) => {
    const own = (t) => String(t === 'link' ? linkFor(c) || '' : (VALUE_OF[t] ? VALUE_OF[t](c) : c?.[t]) ?? '').trim();
    const fields = tokens.map((token) => {
      const value = own(token);
      if (value) return { token, value, source: 'contact' };
      if (fb[token]) { usingFallback[token] = (usingFallback[token] || 0) + 1; return { token, value: fb[token], source: 'fallback' }; }
      missing[token] = (missing[token] || 0) + 1;
      return { token, value: '', source: 'missing' };
    });
    const values = Object.fromEntries(fields.map((f) => [f.token, f.value]));
    const filled = Object.fromEntries(Object.entries(templates).map(([k, t]) => [k, fillTemplate(t, values, {})]));
    return { index, contactId: c?.id || '', name: nameOf(c), fields, filled, ok: fields.every((f) => f.source !== 'missing') };
  });
  return { rows, missing, usingFallback, tokens };
}
