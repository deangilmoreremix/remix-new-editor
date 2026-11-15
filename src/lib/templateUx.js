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

// ---------------------------------------------------------------------------
// Named presets: "My restaurant brand" -> saved text / select values.
// ---------------------------------------------------------------------------
const PRESETS_KEY = 'template_presets';
const MAX_PRESETS_PER_TEMPLATE = 20;
const MAX_PRESET_NAME = 40;

function readPresets() {
  const store = safeStorage();
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(PRESETS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.values && typeof p.values === 'object') : [];
  } catch { return []; }
}

function writePresets(list) {
  const store = safeStorage();
  if (!store) return;
  try { store.setItem(PRESETS_KEY, JSON.stringify(list)); } catch { /* optional */ }
}

export function listPresets(templateId) {
  return readPresets().filter((p) => p.templateId === templateId);
}

/**
 * Save (or overwrite, by name) a preset for a template.
 * @returns {object|null} the saved preset, or null when there was nothing to save
 */
export function savePreset(templateId, name, values = {}) {
  const cleanName = String(name || '').trim().slice(0, MAX_PRESET_NAME);
  if (!templateId || !cleanName) return null;
  const clean = {};
  Object.entries(values).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim() && !v.startsWith('data:') && !v.startsWith('blob:')) clean[k] = v.slice(0, MAX_SHARED_VALUE);
  });
  if (!Object.keys(clean).length) return null;
  const all = readPresets();
  const existing = all.find((p) => p.templateId === templateId && p.name.toLowerCase() === cleanName.toLowerCase());
  const preset = {
    id: existing ? existing.id : `preset_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    templateId,
    name: cleanName,
    values: clean,
    updatedAt: new Date().toISOString(),
  };
  const others = all.filter((p) => p.id !== preset.id);
  const mine = [preset, ...others.filter((p) => p.templateId === templateId)].slice(0, MAX_PRESETS_PER_TEMPLATE);
  writePresets([...others.filter((p) => p.templateId !== templateId), ...mine]);
  return preset;
}

export function deletePreset(id) {
  writePresets(readPresets().filter((p) => p.id !== id));
}

/**
 * Small "Presets" row: a select of saved presets, Save as..., Delete.
 * @param {Object} opts
 * @param {string} opts.templateId
 * @param {() => Object} opts.getValues  current text / select values by field name
 * @param {(values: Object) => void} opts.applyValues  put values back in the form
 * @param {(msg: string, type?: string) => void} [opts.notify]
 * @param {(msg: string) => string|null} [opts.askName]  defaults to window.prompt
 */
export function createPresetsControl({ templateId, getValues, applyValues, notify = () => {}, askName } = {}) {
  const el = document.createElement('div');
  el.className = 'template-presets mt-4 flex flex-wrap items-center gap-2';
  el.dataset.presets = '';
  el.innerHTML = `
    <label class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Presets
      <select data-preset-select class="ml-2 h-9 max-w-[11rem] rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-white outline-none"></select>
    </label>
    <button type="button" data-preset-save class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.08]">Save as…</button>
    <button type="button" data-preset-delete class="hidden rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-white/[0.06]" aria-label="Delete selected preset">Delete</button>
  `;
  const select = el.querySelector('[data-preset-select]');
  const delBtn = el.querySelector('[data-preset-delete]');

  const refresh = (selectId = '') => {
    const presets = listPresets(templateId);
    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = presets.length ? 'Choose a preset…' : 'No presets yet';
    select.appendChild(none);
    presets.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      select.appendChild(o);
    });
    select.value = presets.some((p) => p.id === selectId) ? selectId : '';
    delBtn.classList.toggle('hidden', !select.value);
  };

  select.onchange = () => {
    delBtn.classList.toggle('hidden', !select.value);
    const preset = listPresets(templateId).find((p) => p.id === select.value);
    if (preset) {
      applyValues(preset.values);
      notify(`Preset "${preset.name}" loaded.`, 'info');
    }
  };
  el.querySelector('[data-preset-save]').onclick = () => {
    const ask = askName || ((msg) => (typeof window !== 'undefined' ? window.prompt(msg, '') : null));
    const name = ask('Name this preset');
    if (!name || !name.trim()) return;
    const saved = savePreset(templateId, name, getValues());
    if (!saved) { notify('Fill in at least one field before saving a preset.', 'warning'); return; }
    refresh(saved.id);
    notify(`Preset "${saved.name}" saved.`, 'success');
  };
  delBtn.onclick = () => {
    if (!select.value) return;
    deletePreset(select.value);
    refresh();
    notify('Preset deleted.', 'info');
  };

  refresh();
  return { element: el, refresh };
}

/** A short "Cost: ..." label for a finished result when MuAPI reported one, else ''. */
export function formatActualCost(result) {
  const usd = Number(result && result.cost && result.cost.amount_usd);
  if (!Number.isFinite(usd) || usd <= 0) return '';
  return 'Cost: ' + String.fromCharCode(36) + usd.toFixed(usd < 0.1 ? 3 : 2);
}

// ---------------------------------------------------------------------------
// First-run tip strip (dismissible, remembered).
// ---------------------------------------------------------------------------
const TIP_KEY = 'template_tip_dismissed';

export function isTipDismissed() {
  const store = safeStorage();
  try { return !!store && store.getItem(TIP_KEY) === '1'; } catch { return false; }
}

/** A dismissible "how it works" strip, or null once the user has closed it. */
export function createTipStrip() {
  if (isTipDismissed()) return null;
  const el = document.createElement('div');
  el.dataset.tipStrip = '';
  el.setAttribute('role', 'note');
  el.className = 'mb-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-zinc-300';
  el.innerHTML = `
    <div class="min-w-0 flex-1"><span class="font-semibold text-white">How it works:</span>
      1. Add a photo or video if you want one &nbsp;·&nbsp; 2. Fill in the fields (or tap “Try an example”) &nbsp;·&nbsp; 3. Press Generate (Ctrl/Cmd+Enter).</div>
    <button type="button" data-tip-dismiss class="shrink-0 rounded-full px-2 text-zinc-400 transition hover:text-white" aria-label="Dismiss tip">✕</button>
  `;
  el.querySelector('[data-tip-dismiss]').onclick = () => {
    try { safeStorage()?.setItem(TIP_KEY, '1'); } catch { /* optional */ }
    el.remove();
  };
  return el;
}
