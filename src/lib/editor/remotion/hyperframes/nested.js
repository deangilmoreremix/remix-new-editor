/**
 * Pure helpers for HyperFrames nested compositions (a host document whose clips pull in other composition files through
 * `data-composition-src`). Timing follows the documented model: `data-start` is relative to the PARENT composition (a number, or
 * a reference to another clip `id`, `id+1.5`, `id-0.5` meaning "when that clip ends, plus an offset"), `data-duration` is the clip
 * length, `data-media-start` offsets into the child's timeline and `data-playback-rate` scales it.
 */

/** Normalises a project-relative path ("compositions/a.html", "./assets/x.svg"); returns null for absolute URLs, schemes or escapes. */
export function normalizeRel(path) {
  const p = String(path || '').trim();
  if (!p || /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('/') || p.startsWith('\\') || p.includes('\0')) return null;
  const out = [];
  for (const seg of p.replace(/^\.\//, '').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (!out.length) return null; out.pop(); continue; }
    out.push(seg);
  }
  return out.length ? out.join('/') : null;
}

const NUM = /^-?\d+(\.\d+)?$/;
/** Resolves a `data-start` expression to seconds relative to the parent. `ends` maps clip id -> end time (relative to the same parent). */
export function parseStart(expr, ends = {}) {
  const s = String(expr ?? '').trim();
  if (s === '') return 0;
  if (NUM.test(s)) return parseFloat(s);
  const m = /^([A-Za-z_][\w-]*)\s*([+-]\s*\d+(\.\d+)?)?$/.exec(s);
  if (!m || !(m[1] in ends)) return null; // unresolvable reference: caller reports it
  return ends[m[1]] + (m[2] ? parseFloat(m[2].replace(/\s+/g, '')) : 0);
}

const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

/**
 * Computes absolute windows for every timed element below `root`: [{ el, id, absStart, duration, rate, mediaStart, isComposition }].
 * `ancestors` walk = nearest ancestor that has data-start/data-composition-id (or `root` itself, starting at 0).
 * Elements whose start cannot be resolved are returned with `error` so the adapter can report instead of guessing.
 */
export function computeWindows(root) {
  const out = []; const meta = new Map(); // el -> { abs, dur }
  meta.set(root, { abs: 0, dur: num(root.getAttribute?.('data-duration'), Infinity), ends: {} });
  const timed = [...root.querySelectorAll('[data-start]')];
  for (const el of timed) {
    let p = el.parentElement; while (p && !meta.has(p)) p = p.parentElement;
    const parent = (p && meta.get(p)) || meta.get(root);
    const local = parseStart(el.getAttribute('data-start'), parent.ends);
    const id = el.getAttribute('id') || el.getAttribute('data-composition-id') || '';
    if (local === null) { out.push({ el, id, error: `unresolvable data-start "${el.getAttribute('data-start')}"` }); continue; }
    const rate = Math.max(0.05, Math.min(16, num(el.getAttribute('data-playback-rate'), 1)));
    const dur = num(el.getAttribute('data-duration'), el.hasAttribute('data-end') ? num(el.getAttribute('data-end'), 0) - local : Infinity);
    const abs = parent.abs + local;
    meta.set(el, { abs, dur, ends: {} });
    if (id) parent.ends[id] = local + (Number.isFinite(dur) ? dur : 0);
    out.push({ el, id, absStart: abs, duration: Math.min(dur, parent.dur - local), rate, mediaStart: num(el.getAttribute('data-media-start'), 0), isComposition: el.hasAttribute('data-composition-id') });
  }
  return out;
}

/** Child timeline time for master time `t`: ((t - start) * rate + mediaStart), clamped to [0, childDuration]. */
export function childTime(win, t, childDuration) {
  const local = (t - win.absStart) * win.rate + win.mediaStart;
  return Math.max(0, Math.min(Number.isFinite(childDuration) ? childDuration : local, local));
}

/** Instance variables come from `data-variable-values` JSON on the clip. Returns { 'var.<id>': value } for the resolver (it re-validates types). */
export function instanceOverrides(el) {
  const raw = el.getAttribute('data-variable-values'); if (!raw) return {};
  let obj; try { obj = JSON.parse(raw); } catch { return {}; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(k) && ['string', 'number', 'boolean'].includes(typeof v)) out[`var.${k}`] = v;
  return out;
}
