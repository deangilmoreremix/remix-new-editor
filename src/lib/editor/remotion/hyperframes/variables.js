/**
 * HyperFrames composition variables: the root element declares `data-composition-variables='[{id,type,label,default,min,max,step,options}]'`
 * and the block reads values through `window.__hyperframes.getVariables()` and/or `data-var-text` / `data-var-src` bindings.
 * Customer values arrive as `var.<id>` overrides, are checked against the declaration (type, range, enum membership, asset allow-list)
 * and anything invalid falls back to the declared default. The master HTML is never changed.
 */
import { sanitizeText, validateAssetUrl, validateColor } from './security.js';

const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

export function parseVariableDecls(root) {
  const raw = root?.getAttribute?.('data-composition-variables');
  if (!raw) return [];
  let arr; try { arr = JSON.parse(raw); } catch { return []; }
  return Array.isArray(arr) ? arr.filter((d) => d && ID.test(String(d.id)) && ['string', 'number', 'boolean', 'color', 'enum', 'image'].includes(d.type)).slice(0, 200) : [];
}

export function resolveVariables(decls, overrides = {}, { allowHosts = [], onReject } = {}) {
  const values = {};
  for (const d of decls) {
    values[d.id] = d.default;
    const key = `var.${d.id}`; if (!(key in overrides)) continue;
    const v = overrides[key]; let ok = false; let out;
    switch (d.type) {
      case 'string': { const t = sanitizeText(v, 400); if (t !== null) { out = t; ok = true; } break; }
      case 'number': { const n = Number(v); if (Number.isFinite(n)) { out = Math.min(d.max ?? 1e5, Math.max(d.min ?? -1e5, n)); ok = true; } break; }
      case 'boolean': if (typeof v === 'boolean') { out = v; ok = true; } break;
      case 'color': if (typeof v === 'string' && validateColor(v)) { out = v; ok = true; } break;
      case 'enum': { const opts = (d.options || []).map((o) => (typeof o === 'object' ? String(o.value) : String(o))); if (opts.includes(String(v))) { out = String(v); ok = true; } break; }
      case 'image': { const r = validateAssetUrl(typeof v === 'object' && v ? v.url : v, { allowHosts }); if (r.ok) { out = r.url; ok = true; } break; }
      default: break;
    }
    if (ok) values[d.id] = out; else onReject?.({ key, reason: `value does not satisfy the declared ${d.type} variable` });
  }
  return values;
}

/** Declarative bindings: data-var-text="<id>" sets text, data-var-src="<id>" sets src (already validated values only). */
export function bindVariables(root, values) {
  for (const el of root.querySelectorAll('[data-var-text]')) { const id = el.getAttribute('data-var-text'); if (id in values) el.textContent = String(values[id]); }
  for (const el of root.querySelectorAll('[data-var-src]')) { const id = el.getAttribute('data-var-src'); if (id in values && typeof values[id] === 'string') el.setAttribute('src', values[id]); }
}
