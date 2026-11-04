/**
 * Remotion effects (@remotion/effects) for timeline clips.
 *
 * A clip's effect stack is stored as clip.effects = [{ uid, id, params, enabled }]
 * (id = the @remotion/effects preset, e.g. 'blur', 'color-correction').
 * The composition turns it into Remotion effect descriptors via the
 * `effects` prop on <Video> / <Img>. Effect modules are loaded lazily, only
 * for the presets a project uses.
 */
import { EFFECTS } from './effectsCatalog.data.js';
import { EFFECT_LOADERS } from './effectsLoaders.js';

export const EFFECT_CATEGORIES = ['Color', 'Blur', 'Light', 'Stylize', 'Distort', 'Reveal', 'Generate'];

const BY_ID = new Map(EFFECTS.map((e) => [e.id, e]));
export const getEffectDef = (id) => BY_ID.get(id) || null;
export const listEffects = () => EFFECTS;

/** Sensible slider ranges where the package documents none. */
function fillRange(effectId, p) {
  if (p.type !== 'number') return p;
  const q = { ...p };
  const k = p.key.toLowerCase();
  if (q.min === undefined || q.min === null) {
    q.min = /offset|translate|shift|angle|rotation|x$|y$/.test(k) ? -100 : 0;
    if (/angle|rotation/.test(k)) q.min = -180;
  }
  if (q.max === undefined || q.max === null) {
    if (/angle|rotation|hue/.test(k)) q.max = 180;
    else if (/contrast|saturation|intensity|strength|scale|zoom|multiplier/.test(k)) q.max = 3;
    else if (/opacity|amount|mix|threshold|progress|feather|softness/.test(k)) q.max = 1;
    else q.max = 100;
  }
  if (q.default === undefined || q.default === null) {
    q.default = /contrast|saturation|intensity|scale|zoom/.test(k) ? 1 : (q.min >= 0 ? Math.min(q.max, Math.max(q.min, 10)) : 0);
  }
  if (!q.step) q.step = q.max - q.min <= 2 ? 0.01 : q.max - q.min <= 20 ? 0.1 : 1;
  return q;
}

/** Parameters with complete ranges/defaults, ready for the settings form. */
export function effectParams(id) {
  const def = getEffectDef(id);
  return def ? def.params.map((p) => fillRange(id, p)) : [];
}

export function defaultEffectParams(id) {
  const out = {};
  effectParams(id).forEach((p) => {
    if (p.default !== undefined && p.default !== null) out[p.key] = JSON.parse(JSON.stringify(p.default));
  });
  return out;
}

let uidCounter = 0;
export function createEffect(id, params = {}) {
  uidCounter += 1;
  return { uid: `fx-${Date.now().toString(36)}-${uidCounter}`, id, enabled: true, params: { ...defaultEffectParams(id), ...params } };
}

/** Fields for renderAddonEditor (src/lib/editor/addons/addonEditor.js). */
export function effectFields(id) {
  return effectParams(id).map((p) => {
    const field = { key: p.key, label: p.label };
    if (p.type === 'number') return { ...field, type: 'range', min: p.min, max: p.max, step: p.step };
    if (p.type === 'boolean') return { ...field, type: 'toggle' };
    if (p.type === 'select') return { ...field, type: 'select', options: p.options.map((o) => [o, o]) };
    if (p.type === 'color') return { ...field, type: 'color' };
    if (p.type === 'uv') return { ...field, type: 'uv' };
    if (p.type === 'points') return { ...field, type: 'points' };
    if (p.type === 'cube') return { ...field, type: 'cube', label: 'LUT (.cube)' };
    return { ...field, type: 'text' };
  });
}

// ------------------------------------------------------------------ runtime

const loaded = new Map(); // id → module

/** Load the modules for these preset ids (cached). */
export async function loadEffects(ids = []) {
  const todo = [...new Set(ids)].filter((id) => !loaded.has(id) && EFFECT_LOADERS[id]);
  await Promise.all(todo.map((id) => EFFECT_LOADERS[id]().then((m) => loaded.set(id, m)).catch(() => null)));
}

export const effectIdsInModel = (model) => {
  const ids = new Set();
  (model?.layers || []).forEach((l) => (l.effects || []).forEach((e) => ids.add(e.id)));
  return [...ids];
};

/**
 * Remotion effect descriptors for a stack. Effects whose module hasn't
 * loaded yet are skipped (call loadEffects first).
 */
export function buildEffectDescriptors(stack = []) {
  const out = [];
  stack.forEach((fx) => {
    if (!fx || fx.enabled === false) return;
    const def = getEffectDef(fx.id);
    const mod = loaded.get(fx.id);
    const factory = def && mod && mod[def.exportName];
    if (typeof factory !== 'function') return;
    try {
      // Only pass parameters the preset declares (UI-only keys such as a
      // LUT's file name are dropped).
      const known = new Set(def.params.map((p) => p.key));
      const merged = { ...defaultEffectParams(fx.id), ...(fx.params || {}) };
      const params = Object.fromEntries(Object.entries(merged).filter(([k]) => known.has(k)));
      out.push(factory(params));
    } catch (err) {
      console.warn(`[effects] ${fx.id} rejected its parameters`, err);
    }
  });
  return out;
}

// ------------------------------------------------------------------ helpers for the Color panel

/** Find (or create) the single effect of a given id in a stack. */
export function ensureEffect(stack, id, params) {
  let fx = stack.find((e) => e.id === id);
  if (!fx) {
    fx = createEffect(id, params);
    stack.push(fx);
  }
  return fx;
}

/** Parse "x,y; x,y" into [[x,y],…] for curves points. */
export function parsePoints(text) {
  const pts = String(text || '').split(/[;\n]/).map((pair) => pair.split(',').map((n) => Number(n.trim())))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n)))
    .map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))])
    .sort((a, b) => a[0] - b[0]);
  return pts.length >= 2 ? pts : [[0, 0], [1, 1]];
}

export const formatPoints = (pts) => (pts || []).map(([x, y]) => `${x}, ${y}`).join('; ');

/** A .cube file must declare a 3D LUT size; reject anything else early. */
export function isCubeLut(text) {
  return /LUT_3D_SIZE\s+\d+/.test(String(text || '')) && String(text).length < 20 * 1024 * 1024;
}
