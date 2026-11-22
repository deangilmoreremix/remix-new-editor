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
      const after = typeof answers.get(it.id) === 'string' ? matchStyle(it.text, answers.get(it.id)) : answers.get(it.id);
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

// ---------------------------------------------------------------------------------------------
// Fitting the words to the box: casing, endings, highlight marks, lists, numbers.
// ---------------------------------------------------------------------------------------------

const PLACEHOLDER = /(\{\{[^}]*\}\})/;                       // never change the inside of a {{token|fallback}}
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'nor', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'as', 'vs', 'into', 'onto', 'from', 'over', 'than', 'upon']);
const stripMarks = (s) => String(s).replace(/\{\{[^}]*\}\}/g, '').replace(/\[\[|\]\]/g, '');

/** How a piece of text is cased: 'upper' (ALL CAPS), 'title' (Each Main Word), 'sentence', or 'none' (too short to tell). */
export function caseOf(text) {
  const t = stripMarks(text);
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return 'none';
  if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return 'upper';
  const words = t.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  const main = words.filter((w) => { const bare = w.replace(/[^\p{L}]/gu, ''); return bare.length > 3 && !SMALL_WORDS.has(bare.toLowerCase()); });
  // One long word ('Book now') cannot tell Title Case from a sentence, so at least two are needed.
  if (words.length >= 2 && main.length >= 2 && main.every((w) => /^\p{Lu}/u.test(w))) return 'title';
  return 'sentence';
}

const mapOutsidePlaceholders = (s, fn) => String(s).split(PLACEHOLDER).map((part, i) => (i % 2 ? part : fn(part))).join('');
/** Some designs capitalise every word ('Turn Cold Contacts Into Hot Leads With Video'); most keep small words lower. Copy the design. */
const capitalisesSmallWords = (text) => stripMarks(text).split(/\s+/).slice(1).some((w) => SMALL_WORDS.has(w.toLowerCase()) && /^\p{Lu}/u.test(w));

const titleWord = (w, first, keepSmallCapital) => {
  const m = /^([^\p{L}]*)(\p{L}[\p{L}'’-]*)(.*)$/su.exec(w);
  if (!m) return w;
  const [, pre, word, post] = m;
  if (!first && !keepSmallCapital && SMALL_WORDS.has(word.toLowerCase())) return pre + word.toLowerCase() + post;
  return pre + word.charAt(0).toUpperCase() + word.slice(1) + post;
};

/**
 * Make `option` look like the text it replaces: the same casing (ALL CAPS stays ALL CAPS, Title Case stays Title Case),
 * the same ending (no full stop where there was none, "!" where there was one), single spaces. {{tokens}} are untouched.
 * With nothing to copy (an empty field) the option is returned as the writer wrote it, tidied.
 */
export function matchStyle(current, option) {
  let out = String(option ?? '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  const cur = String(current ?? '').trim();
  if (!cur || !out) return out;
  const kind = caseOf(cur);
  if (kind === 'upper') out = mapOutsidePlaceholders(out, (x) => x.toUpperCase());
  else if (kind === 'title' && caseOf(out) !== 'upper') {
    let first = true;
    const keepSmallCapital = capitalisesSmallWords(cur);
    out = mapOutsidePlaceholders(out, (x) => x.split(/(\s+)/).map((w) => { if (!/\S/.test(w)) return w; const r = titleWord(w, first, keepSmallCapital); first = false; return r; }).join(''));
  }
  // One short sentence: copy how the old text ended. Longer copy (several sentences) is left alone.
  const single = !/[.!?]\s+\p{L}/u.test(stripMarks(out)) && !/[.!?]\s*\n/.test(stripMarks(out));
  if (single) {
    const curEnd = /[.!?]$/.exec(stripMarks(cur).trimEnd())?.[0] || '';
    const outEnd = /[.!?]$/.exec(out)?.[0] || '';
    if (!curEnd && outEnd === '.') out = out.slice(0, -1).trimEnd();
    else if (curEnd && !outEnd) out = `${out}${curEnd}`;
    else if (curEnd && outEnd && curEnd !== outEnd && out.length) out = `${out.slice(0, -1)}${curEnd}`;
  }
  return out;
}

/** True for fields where the AI writes words. Links, colours, field names and icon names are not words. */
export function isCopyField(label = '') {
  const l = String(label);
  if (/#hex|colou?r\b|\(a-z\)|field name|icon name|\bicon \(|\burl\b|https?|\bpath\b|mailto|\blink\b(?! text)/i.test(l)) return false;
  if (/\bimage\b|\bphoto\b|\bpicture\b|\blogo\b/i.test(l) && !/alt text|description/i.test(l)) return false;
  return true;
}

const BIG_NUMBER = /^[\d.,+\-%x×$€£kKmMbB\s/]{1,14}$/;

/**
 * What a field expects, read from its label and what is in it now:
 *   highlight  [[double brackets]] colour key words (the design's accent style)
 *   list       comma separated, with the number of items when it is fixed
 *   lines      rows (one line per row / new lines allowed), with the current count
 *   numeric    a big number or statistic such as "3.4x" or "128,349"
 */
export function fieldFormat(label = '', current = '') {
  const l = String(label);
  const cur = String(current ?? '');
  const list = /comma separated/i.test(l) || /choices/i.test(l)
    ? { count: Number((/\((\d+)\)/.exec(l) || [])[1]) || (cur.trim() ? cur.split(',').length : 0) || null }
    : null;
  const lines = /one line per row|new line allowed/i.test(l) || cur.includes('\n')
    ? { count: cur.trim() ? cur.split('\n').length : null }
    : null;
  const numeric = (/^(number|big number|value)\b/i.test(l) || /\bstat\b/i.test(l)) && (!cur.trim() || BIG_NUMBER.test(cur)) ? true : (!!cur.trim() && BIG_NUMBER.test(cur) && /\d/.test(cur) && cur.length <= 14 && !/[a-z]{4,}/i.test(cur));
  return { highlight: /\[\[/.test(l) || /\[\[/.test(cur), list, lines, numeric: !!numeric };
}

const tokensOf = (s) => (String(s).match(/\{\{[^}]*\}\}/g) || []).sort().join('|');

/** Does `text` fit what the field expects? (`current` is what is in the field now.) */
export function fitsFormat(text, fmt, current = '') {
  const t = String(text);
  const marks = (t.match(/\[\[/g) || []).length;
  if (marks !== (t.match(/\]\]/g) || []).length) return false;
  if (!fmt.highlight && marks) return false;
  if (marks > 2) return false;
  if (String(current).trim()) {
    if (tokensOf(t) !== tokensOf(current)) return false;                 // keep the field's own placeholders
    if (/\[\[/.test(current) && marks !== (String(current).match(/\[\[/g) || []).length) return false;
  }
  if (fmt.list) {
    const items = t.split(',').map((x) => x.trim());
    if (items.some((x) => !x)) return false;
    if (fmt.list.count && items.length !== fmt.list.count) return false;
  }
  if (fmt.lines?.count && t.split('\n').length !== fmt.lines.count) return false;
  if (fmt.numeric && !BIG_NUMBER.test(t)) return false;
  return true;
}

/**
 * Up to `n` options for one field. Empty `current` is fine. Each option is fitted to the field (casing, ending),
 * then kept only if it has no markup or links, fits the length and the field's format (placeholders, highlight marks,
 * lists, rows, numbers). `result.adjusted` is true when the style had to be corrected so it fits.
 * Throws a readable Error when the key is missing or the service says no.
 */
export async function generateFieldCopy({ label, current = '', multiline = false, instruction = '', context = '', n = 3, fetchImpl = fetch, headers, signal } = {}) {
  const keyHeaders = headers || openaiKeyHeader();
  if (!keyHeaders['X-OpenAI-Key']) throw new Error('This uses your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).');
  const role = roleForLabel(label);
  const maxChars = maxCharsFor(role, current, multiline);
  const format = fieldFormat(label, current);
  const res = await fetchImpl(REWRITE_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...keyHeaders },
    body: JSON.stringify({ input: { mode: 'write', label, role, current, maxChars, instruction, context, n, format, casing: caseOf(current) } }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `The AI writer is unavailable (HTTP ${res.status}).`);
  const seen = new Set();
  const out = [];
  let adjusted = false;
  for (const it of data.items || []) {
    const raw = typeof it?.text === 'string' ? it.text.trim() : '';
    const text = matchStyle(current, raw);
    if (!text || seen.has(text) || text === String(current).trim()) continue;
    if (text.length > Math.round(maxChars * 1.3) || /[<>]/.test(text) || /https?:\/\/|www\./i.test(text)) continue;
    if (!fitsFormat(text, format, current)) continue;
    if (text !== raw.replace(/[ \t]+/g, ' ').trim()) adjusted = true;
    seen.add(text);
    out.push(text);
  }
  Object.defineProperty(out, 'adjusted', { value: adjusted, enumerable: false });   // a plain list that also says whether the style was corrected
  return out;
}
