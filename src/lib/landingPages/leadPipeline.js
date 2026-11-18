/**
 * One lead pipeline for the timeline's List Builder / Lead Generator and for landing pages.
 *
 * A page form's answers are saved the way the timeline saves them: each answer is keyed by its box's TOKEN (the label
 * upper-cased: "FIRST NAME", "EMAIL"; duplicates get _2, _3) and the lead carries the form's kind:
 *   Lead Generator -> 'lead-form'   List Builder -> 'list-builder'   Personalizer -> 'personalizer'
 * so leads land in the same Leads sections, filters, CSV columns, webhook payloads and e-mail-list mappings.
 */
import { leadFieldTokens } from './optin/leadClient.js';

export const LEAD_KINDS = Object.freeze(['lead-form', 'list-builder', 'personalizer']);

/** The stored lead kind for a form type (anything unknown is a plain lead form). */
export function leadKindFor(formType) {
  if (formType === 'list-builder') return 'list-builder';
  if (formType === 'personalizer') return 'personalizer';
  return 'lead-form';
}

export const safeLeadKind = (kind) => (LEAD_KINDS.includes(kind) ? kind : 'lead-form');

/**
 * Rename a form's answers (keyed by each box's field key) to the timeline's tokens, in box order.
 * `fields` are the rendered boxes ({ key, label }); keys with no box keep their own name.
 */
export function tokenAnswers(fields, data) {
  const list = (Array.isArray(fields) ? fields : []).filter((f) => f && f.key);
  const tokens = leadFieldTokens(list.map((f) => ({ label: f.label || f.key })));
  const out = {};
  const used = new Set();
  list.forEach((f, i) => {
    const v = data?.[f.key];
    used.add(f.key);
    if (v !== undefined && v !== null && String(v).trim() !== '') out[tokens[i]] = String(v).trim().slice(0, 2000);
  });
  for (const [k, v] of Object.entries(data || {})) {
    if (used.has(k) || v === undefined || v === null || String(v).trim() === '') continue;
    out[String(k).toUpperCase().slice(0, 64)] = String(v).trim().slice(0, 2000);
  }
  return out;
}

/** The first valid-looking e-mail answer, whatever the box was called (the same rule the e-mail-list step uses). */
export function emailOf(answers) {
  const entries = Object.entries(answers || {});
  const ok = (v) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(v).trim());
  return entries.find(([k, v]) => /MAIL/i.test(k) && ok(v))?.[1] ?? entries.find(([, v]) => ok(v))?.[1] ?? '';
}
