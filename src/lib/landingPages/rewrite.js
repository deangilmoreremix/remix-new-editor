/**
 * AI rewrite for landing pages, built so it can only change WORDS:
 *   collectTexts  walks the page data and lists every human-readable string (with its path)
 *   rewriteTexts  sends just {id, role, text} to /api/landing-rewrite (user's own OpenAI key)
 *   checkRewrite  accepts an answer only if its {{tokens}}, [[markers]] and line breaks survive
 *   applyChanges  writes accepted strings back at their exact paths into a copy of the data
 * Sections, order, layout, links, images, icons, form fields and component settings are never
 * sent to the model and never written back.
 */
import { openaiKeyHeader } from '../openaiKeyHeader.js';

export const REWRITE_ENDPOINT = '/api/landing-rewrite';
export const BATCH = 60;
const MAX_TEXT = 700;

// Keys that are settings, links, media or identifiers, not copy.
const SKIP_KEYS = /^(id|type|key|kind|variant|layout|columns|cols|align|style|icon|design|url|href|src|image|img|photo|logo|avatar|background|bg|poster|arrow|accent|highlight|rounded|showForm|options|required|buttonUrl|loginUrl|days|month|time|date|zones|root)$/i;
// Whole lists that hold form field definitions (names/placeholders must stay as built).
const SKIP_LISTS = /^(formFields|fields)$/i;
const URLISH = /^(https?:|mailto:|tel:|#|\/|data:|javascript:)/i;
const HEX = /^#[0-9a-f]{3,8}$/i;
const ENUM = /^[a-z][a-z0-9_-]*$/; // single lowercase token, e.g. 'story', 'yes', 'center'

export function isCopy(key, value) {
  if (typeof value !== 'string') return false;
  if (SKIP_KEYS.test(key)) return false;
  const v = value.trim();
  if (v.length < 2 || v.length > MAX_TEXT) return false;
  if (URLISH.test(v) || HEX.test(v) || ENUM.test(v)) return false;
  return /[\p{L}\p{N}]/u.test(v);
}

const roleOf = (key) => {
  if (/headline|title|heading|h1|h2|q$/i.test(key)) return 'headline';
  if (/button|label|cta|submit/i.test(key)) return 'button';
  if (/^name$|by|role/i.test(key)) return 'name';
  if (/quote|testimonial/i.test(key)) return 'quote';
  if (/value|stat/i.test(key)) return 'stat';
  return 'text';
};

/** Short label for a top-level section, e.g. "Hero: Alex, here's a smarter way…". */
export function sectionLabel(item) {
  const p = item?.props || {};
  const first = ['headline', 'title', 'eyebrow', 'text', 'label'].map((k) => p[k]).find((v) => typeof v === 'string' && v.trim());
  const clean = (first || '').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim();
  return `${item?.type || 'Section'}${clean ? `: ${clean.slice(0, 40)}` : ''}`;
}

export function sectionList(editorData) {
  return (editorData?.content || []).map((item, index) => ({ index, label: sectionLabel(item), count: collectTexts(editorData, { section: index }).length }));
}

/** Every rewritable text: [{id, path, section, role, text}]. `section` limits to one top-level item. */
export function collectTexts(editorData, { section = null } = {}) {
  const out = [];
  const walk = (node, path, top, key) => {
    if (typeof node === 'string') {
      if (isCopy(key, node)) out.push({ id: `t${out.length}`, path, section: top, role: roleOf(key), text: node });
      return;
    }
    if (Array.isArray(node)) {
      if (SKIP_LISTS.test(key)) return;
      node.forEach((v, i) => walk(v, [...path, i], top, key));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'type' || k === 'id') continue;
        walk(v, [...path, k], top, k);
      }
    }
  };
  (editorData?.content || []).forEach((item, i) => {
    if (section != null && i !== section) return;
    walk(item?.props || {}, ['content', i, 'props'], i, '');
  });
  return out;
}

const markers = (s) => (s.match(/\{\{[^}]*\}\}|\[\[|\]\]/g) || []).sort().join('|');
const breaks = (s) => (s.match(/\n/g) || []).length;

/** True when the model's text is safe to use in place of `before`. */
export function checkRewrite(before, after) {
  if (typeof after !== 'string') return false;
  const a = after.trim();
  if (!a || a === before.trim()) return false;
  if (a.length > Math.max(before.length * 2 + 60, 80) || a.length > MAX_TEXT) return false;
  if (markers(a) !== markers(before) || breaks(a) !== breaks(before)) return false;
  if (/[<>]/.test(a) || /https?:\/\/|www\./i.test(a)) return false;
  return true;
}

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** One request for up to BATCH texts. Returns Map(id -> text). */
export async function rewriteBatch(items, { instruction = '', context = '', fetchImpl = fetch, headers, signal } = {}) {
  const keyHeaders = headers || openaiKeyHeader();
  if (!keyHeaders['X-OpenAI-Key']) throw new Error('This uses your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).');
  const res = await fetchImpl(REWRITE_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...keyHeaders },
    body: JSON.stringify({ input: { items: items.map(({ id, role, text }) => ({ id, role, text })), instruction, context } }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `The AI rewrite is unavailable (HTTP ${res.status}).`);
  return new Map((data.items || []).map((i) => [i.id, i.text]));
}

/**
 * Rewrite a page (or one section). Returns the proposed changes WITHOUT applying them:
 *   { changes: [{ ...item, after }], skipped: n }
 */
export async function proposeRewrite(editorData, { section = null, instruction, context, fetchImpl, headers, signal } = {}) {
  const items = collectTexts(editorData, { section });
  if (!items.length) return { changes: [], skipped: 0 };
  const changes = [];
  let skipped = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const answers = await rewriteBatch(batch, { instruction, context, fetchImpl, headers, signal });
    for (const it of batch) {
      const after = answers.get(it.id);
      if (checkRewrite(it.text, after)) changes.push({ ...it, after: after.trim() });
      else skipped += 1;
    }
  }
  return { changes, skipped };
}

/** Copy of editorData with the chosen changes written at their paths. Only strings are replaced. */
export function applyChanges(editorData, changes) {
  const next = JSON.parse(JSON.stringify(editorData));
  for (const c of changes) {
    let node = next;
    for (let i = 0; i < c.path.length - 1; i += 1) node = node?.[c.path[i]];
    const last = c.path[c.path.length - 1];
    if (node && typeof node[last] === 'string') node[last] = c.after;
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// One field at a time ("Write with AI" next to a text box). The field may be empty.
// ---------------------------------------------------------------------------------------------

/** The kind of text a field holds, from its label in the editor ("Button text", "Headline", "Quote"...). */
export function roleForLabel(label = '') {
  const l = String(label);
  if (/quote|testimonial/i.test(l)) return 'quote';
  if (/button|call to action|cta|link text/i.test(l)) return 'button';
  if (/small label|eyebrow|badge|chip|^label\b/i.test(l)) return 'label';
  if (/head(line|ing)|title/i.test(l)) return 'headline';
  if (/^name\b|your name|person/i.test(l)) return 'name';
  if (/label|small|eyebrow|badge|chip/i.test(l)) return 'label';
  if (/number|value|stat/i.test(l)) return 'stat';
  return 'text';
}

const ROLE_MAX = { headline: 90, button: 30, label: 40, name: 40, stat: 12, quote: 220, text: 260 };

/** A sensible maximum for a field: by kind, never tighter than what the field holds now. */
export function maxCharsFor(role, current = '', multiline = false) {
  const base = ROLE_MAX[role] || ROLE_MAX.text;
  return Math.min(MAX_TEXT, Math.max(multiline ? Math.max(base, 320) : base, Math.round(String(current).length * 1.3)));
}

/**
 * Up to `n` options for one field. Empty `current` is fine. Each option is kept only if it keeps the
 * field's {{tokens}} / [[markers]] (when it has any), has no markup or links, and fits the length.
 * Throws a readable Error when the key is missing or the service says no.
 */
export async function generateFieldCopy({ label, current = '', multiline = false, instruction = '', context = '', n = 3, fetchImpl = fetch, headers, signal } = {}) {
  const keyHeaders = headers || openaiKeyHeader();
  if (!keyHeaders['X-OpenAI-Key']) throw new Error('This uses your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).');
  const role = roleForLabel(label);
  const maxChars = maxCharsFor(role, current, multiline);
  const res = await fetchImpl(REWRITE_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...keyHeaders },
    body: JSON.stringify({ input: { mode: 'write', label, role, current, maxChars, instruction, context, n } }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `The AI writer is unavailable (HTTP ${res.status}).`);
  const seen = new Set();
  const out = [];
  for (const it of data.items || []) {
    const text = typeof it?.text === 'string' ? it.text.trim() : '';
    if (!text || seen.has(text) || text === String(current).trim()) continue;
    if (text.length > Math.round(maxChars * 1.3) || /[<>]/.test(text) || /https?:\/\/|www\./i.test(text)) continue;
    if (String(current).trim() && (markers(text) !== markers(current))) continue;   // keep the field's own placeholders and highlight marks
    seen.add(text);
    out.push(text);
  }
  return out;
}
