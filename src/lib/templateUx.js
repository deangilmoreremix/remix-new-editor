// Small client-side helpers that make the template studios easier to use:
// "Try an example", remembered inputs, and required-field checks. Nothing
// here calls an API; saved inputs live in localStorage.

const STORAGE_PREFIX = 'template_last_inputs:';
const FORM_TYPES = new Set(['text', 'textarea', 'select']);

/** CSS.escape with a fallback (older browsers, jsdom). */
export function cssEscape(value) {
  const str = String(value);
  return (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(str) : str.replace(/["\\\]\[]/g, '\\$&');
}

const isFormInput = (input) => !!input && !!input.name && FORM_TYPES.has(input.type);

function safeStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** Sample value for one input, or null when it should be left alone. */
export function exampleValueFor(input) {
  if (!isFormInput(input)) return null;
  if (input.type === 'select') {
    const options = input.options || [];
    return options.length ? options[Math.min(1, options.length - 1)] : null;
  }
  const placeholder = String(input.placeholder || '').trim();
  if (placeholder) return placeholder.replace(/^(e\.g\.?|for example|ex:)\s*/i, '').trim();
  return `Sample ${String(input.label || input.name).toLowerCase()}`;
}

/** { name: sampleValue } for every text / textarea / select input. */
export function buildExampleValues(inputs = []) {
  const values = {};
  inputs.forEach((input) => {
    const v = exampleValueFor(input);
    if (v) values[input.name] = v;
  });
  return values;
}

/** Remember the user's text / select inputs for a template (media is never stored). */
export function saveTemplateInputs(templateId, inputs = [], values = {}) {
  const store = safeStorage();
  if (!store || !templateId) return;
  const out = {};
  inputs.filter(isFormInput).forEach((input) => {
    const v = values[input.name];
    if (typeof v === 'string' && v.trim()) out[input.name] = v;
  });
  try {
    if (Object.keys(out).length) store.setItem(STORAGE_PREFIX + templateId, JSON.stringify(out));
    else store.removeItem(STORAGE_PREFIX + templateId);
  } catch { /* quota or private mode: remembering is optional */ }
}

/** Saved values for a template, limited to inputs that still exist (select values must still be options). */
export function loadTemplateInputs(templateId, inputs = []) {
  const store = safeStorage();
  if (!store || !templateId) return {};
  let saved;
  try { saved = JSON.parse(store.getItem(STORAGE_PREFIX + templateId) || 'null'); } catch { return {}; }
  if (!saved || typeof saved !== 'object') return {};
  const out = {};
  inputs.filter(isFormInput).forEach((input) => {
    const v = saved[input.name];
    if (typeof v !== 'string' || !v) return;
    if (input.type === 'select' && !(input.options || []).includes(v)) return;
    out[input.name] = v;
  });
  return out;
}

/** Required text / select inputs that are empty, in form order. */
export function missingRequiredInputs(inputs = [], values = {}) {
  return inputs.filter((input) => isFormInput(input) && input.required
    && !String(values[input.name] ?? '').trim());
}

/**
 * Write values into the rendered fields (matched by data-input-name or name) and fire
 * input/change so the studio's own handlers update their state.
 * @returns {number} how many fields were filled
 */
export function applyValuesToForm(root, values = {}) {
  let filled = 0;
  Object.entries(values).forEach(([name, value]) => {
    const n = cssEscape(name);
    const el = root.querySelector(`[data-input-name="${n}"], [name="${n}"]`);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    filled++;
  });
  return filled;
}

/** Mark / unmark a field as invalid for assistive tech and sighted users. */
export function setFieldInvalid(el, invalid) {
  if (!el) return;
  if (invalid) {
    el.setAttribute('aria-invalid', 'true');
    el.classList.add('border-red-400/60');
  } else {
    el.removeAttribute('aria-invalid');
    el.classList.remove('border-red-400/60');
  }
}

/** True for Ctrl/Cmd+Enter. */
export function isGenerateShortcut(event) {
  return !!(event && event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey);
}

// ---------------------------------------------------------------------------
// Gallery favorites and recents (separate from Cinema's own TemplateStorage,
// which tracks cinematic template ids).
// ---------------------------------------------------------------------------
const FAVORITES_KEY = 'template_gallery_favorites';
const RECENT_KEY = 'template_gallery_recent';
const MAX_RECENT = 12;

function readList(key) {
  const store = safeStorage();
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(key) || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch { return []; }
}

function writeList(key, list) {
  const store = safeStorage();
  if (!store) return;
  try { store.setItem(key, JSON.stringify(list)); } catch { /* optional */ }
}

export const getFavoriteTemplateIds = () => readList(FAVORITES_KEY);
export const isFavoriteTemplate = (id) => readList(FAVORITES_KEY).includes(id);

/** Toggle a favorite; returns the new state. */
export function toggleFavoriteTemplate(id) {
  if (!id) return false;
  const list = readList(FAVORITES_KEY);
  const next = list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
  writeList(FAVORITES_KEY, next);
  return next.includes(id);
}

export const getRecentTemplateIds = () => readList(RECENT_KEY);

/** Move a template to the front of the recent list (most recent first, capped). */
export function addRecentTemplate(id) {
  if (!id) return;
  writeList(RECENT_KEY, [id, ...readList(RECENT_KEY).filter((x) => x !== id)].slice(0, MAX_RECENT));
}

// ---------------------------------------------------------------------------
// Shareable links: ?fill=<base64url JSON of text / select values>#/template/<id>
// ---------------------------------------------------------------------------
const MAX_SHARED_VALUE = 500;

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Encode the user's text / select values for a share link ('' when empty). */
export function encodeShareValues(inputs = [], values = {}) {
  const out = {};
  inputs.filter(isFormInput).forEach((input) => {
    const v = values[input.name];
    if (typeof v === 'string' && v.trim()) out[input.name] = v.slice(0, MAX_SHARED_VALUE);
  });
  return Object.keys(out).length ? toBase64Url(JSON.stringify(out)) : '';
}

/**
 * Decode a share parameter. Only inputs the template really has are kept, select
 * values must still be options, and anything malformed is ignored.
 */
export function decodeShareValues(encoded, inputs = []) {
  if (!encoded) return {};
  let data;
  try { data = JSON.parse(fromBase64Url(encoded)); } catch { return {}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out = {};
  inputs.filter(isFormInput).forEach((input) => {
    const v = data[input.name];
    if (typeof v !== 'string' || !v.trim()) return;
    if (input.type === 'select' && !(input.options || []).includes(v)) return;
    out[input.name] = v.slice(0, MAX_SHARED_VALUE);
  });
  return out;
}

/** Full URL a user can send to someone else. */
export function buildShareUrl(templateId, inputs, values, loc = (typeof window !== 'undefined' ? window.location : null)) {
  const base = loc ? `${loc.origin}${loc.pathname}` : '';
  const fill = encodeShareValues(inputs, values);
  return `${base}${fill ? `?fill=${fill}` : ''}#/template/${templateId}`;
}
