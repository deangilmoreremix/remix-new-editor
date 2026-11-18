/**
 * Generic support for the catalog's published-parameter convention: blocks declare `var CONFIG = { ... };` at the top of
 * their script (text, colours, sizes, toggles). A customer override `cfg.<dotted.path>` replaces one LEAF of that literal.
 * The block source is never edited on disk and its hash check is unchanged: the patch happens in memory, wraps the literal
 * in a merge call and passes the customer values as JSON data, so no customer input is ever evaluated as code.
 */
const PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const FORBIDDEN = /(^|\.)(__proto__|prototype|constructor)(\.|$)/;

export const isCfgKey = (key) => typeof key === 'string' && key.startsWith('cfg.') && PATH.test(key.slice(4)) && !FORBIDDEN.test(key.slice(4)) && key.length <= 120;

const DATA_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.([A-Za-z_][A-Za-z0-9_]*|[0-9]{1,3}))*$/;
export const isDataKey = (key) => typeof key === 'string' && key.startsWith('data.') && DATA_PATH.test(key.slice(5)) && !FORBIDDEN.test(key.slice(5)) && key.length <= 120;

/** Applies validated `data.<path>` overrides to the JSON text of a block's declarative data blob. Only EXISTING leaves of the same primitive type are replaced
 *  (nothing is added), the result is serialised back as JSON text, and nothing customer-supplied is evaluated. Returns the new text, or the input unchanged. */
export function patchDataBlob(text, overrides) {
  let obj; try { obj = JSON.parse(text.replace(/\s*[\r\n]+\s*/g, ' ')); } catch { return text; }
  let changed = false;
  for (const [key, value] of Object.entries(overrides)) {
    if (!isDataKey(key)) continue;
    const parts = key.slice(5).split('.'); let t = obj; let i = 0;
    for (; i < parts.length - 1 && t && typeof t === 'object' && Object.prototype.hasOwnProperty.call(t, parts[i]); i++) t = t[parts[i]];
    const last = parts[parts.length - 1];
    if (i === parts.length - 1 && t && typeof t === 'object' && Object.prototype.hasOwnProperty.call(t, last) && typeof t[last] === typeof value && typeof value !== 'object') { t[last] = value; changed = true; }
  }
  return changed ? JSON.stringify(obj) : text;
}

/** Returns [start, end) of the `{ ... }` literal that follows `var CONFIG =`, or null. Skips strings, template literals and comments. */
export function findConfigLiteral(code) {
  const m = /\bvar\s+CONFIG\s*=\s*\{/.exec(code);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = start; i < code.length; i++) {
    const c = code[i]; const n = code[i + 1];
    if (c === '/' && n === '/') { i = code.indexOf('\n', i); if (i < 0) return null; continue; }
    if (c === '/' && n === '*') { i = code.indexOf('*/', i + 2); if (i < 0) return null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { const q = c; for (i++; i < code.length && code[i] !== q; i++) if (code[i] === '\\') i++; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return [start, i + 1];
  }
  return null;
}

const MERGE = 'function(b,o){for(var k in o){var p=k.split("."),t=b,i;for(i=0;i<p.length-1&&t&&typeof t==="object"&&Object.prototype.hasOwnProperty.call(t,p[i]);i++)t=t[p[i]];var l=p[p.length-1];if(i===p.length-1&&t&&typeof t==="object"&&Object.prototype.hasOwnProperty.call(t,l)&&typeof t[l]===typeof o[k])t[l]=o[k];}return b;}';

/** Patches the script so CONFIG carries the overrides. `overrides` is `{ "cfg.a.b": value }` (already validated). Returns the new code, or null if the script has no CONFIG literal. */
export function patchConfig(code, overrides) {
  const keys = Object.keys(overrides || {});
  if (!keys.length) return code;
  const r = findConfigLiteral(code);
  if (!r) return null;
  const flat = {};
  for (const k of keys) { if (!isCfgKey(k)) continue; flat[k.slice(4)] = overrides[k]; }
  return `${code.slice(0, r[0])}(${MERGE})(${code.slice(r[0], r[1])},${JSON.stringify(flat)})${code.slice(r[1])}`;
}

/** Leaves of an evaluated CONFIG object as `[path, value]`; used by the build-time analyser, never at runtime. */
export function configLeaves(obj, prefix = '') {
  const out = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...configLeaves(v, p));
    else if (['string', 'number', 'boolean'].includes(typeof v)) out.push([p, v]);
  }
  return out;
}
