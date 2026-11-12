import { isCfgKey } from './config.js';
/**
 * Security policy for HyperFrames content in the browser renderer (PoC).
 *
 * Trust model:
 *  - Catalog blocks/components are TRUSTED CODE: vendored, version-pinned, and the only thing that may
 *    run scripts. Customers never supply scripts.
 *  - Customer data is UNTRUSTED and enters only as an OverrideSet (text, a small style allow-list,
 *    image URLs). validateOverrides() is the gate; anything not explicitly allowed is rejected.
 *  - The @hyperframes/sdk rejects event-handler attributes, javascript: URIs and <script>, but (verified
 *    in sdk-test.mjs) ACCEPTS remote image src values and addElement fragments with onerror handlers, so
 *    URL allow-listing and "no addElement from customers" are enforced here.
 */
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_DATA_URL = 2_000_000;

/** @returns {{ok:boolean, url?:string, reason?:string}} */
export function validateAssetUrl(input, { allowHosts = [], allowFontHosts = false, allowSvgData = false } = {}) {
  if (typeof input !== 'string') return { ok: false, reason: 'not a string' };
  const u = input.trim();
  if (!u) return { ok: false, reason: 'empty' };
  // data: URLs have their own (larger) limit below; everything else is capped at 4096 characters
  if (u.length > 4096 && !/^data:/i.test(u)) return { ok: false, reason: 'too long' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(u)) return { ok: false, reason: 'control character or backslash' };
  if (u.startsWith('//')) return { ok: false, reason: 'protocol-relative URL' };
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u)?.[1]?.toLowerCase();
  if (!scheme) {
    if (u.startsWith('/') || u.split('/').includes('..') || u.includes('%2e%2e') || u.includes('%2E%2E')) return { ok: false, reason: 'absolute path or traversal' };
    return { ok: true, url: u.replace(/^\.\//, '') };
  }
  if (scheme === 'blob') return { ok: true, url: u };
  if (scheme === 'data') {
    if (u.length > MAX_DATA_URL) return { ok: false, reason: 'data URL too large' };
    if (DATA_IMAGE.test(u)) return { ok: true, url: u };
    if (allowSvgData && /^data:image\/svg\+xml[;,]/.test(u)) return { ok: true, url: u };
    return { ok: false, reason: 'data URL type not allowed' };
  }
  if (scheme === 'https') {
    let host; try { host = new URL(u).hostname.toLowerCase(); } catch { return { ok: false, reason: 'unparsable URL' }; }
    const hosts = [...allowHosts, ...(allowFontHosts ? FONT_HOSTS : [])].map((h) => h.toLowerCase());
    if (hosts.some((h) => host === h || host.endsWith('.' + h))) return { ok: true, url: u };
    return { ok: false, reason: `host not allow-listed: ${host}` };
  }
  return { ok: false, reason: `scheme not allowed: ${scheme}` };
}

export const validateColor = (v) => typeof v === 'string' && v.length <= 80 && (/^#[0-9a-f]{3,8}$/i.test(v.trim()) || /^(rgb|hsl)a?\(\s*[-\d.%\s,/]+\)$/i.test(v.trim()) || /^[a-z]{3,20}$/i.test(v.trim()));
// eslint-disable-next-line no-control-regex -- stripping control characters is the point of this function
export const sanitizeText = (v, max = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : null);

const STYLE_ALLOW = {
  color: validateColor, backgroundColor: validateColor, borderColor: validateColor,
  opacity: (v) => /^(0|1|0?\.\d+)$/.test(String(v)),
  fontSize: (v) => /^\d{1,3}(\.\d+)?(px|rem|em|%)$/.test(String(v)),
  fontWeight: (v) => /^(normal|bold|[1-9]00)$/.test(String(v)),
  letterSpacing: (v) => /^-?\d{1,2}(\.\d+)?(px|em)$/.test(String(v)),
  textAlign: (v) => /^(left|right|center|start|end)$/.test(String(v)),
};
const BAD_KEY = /(^|\.)(__proto__|prototype|constructor)(\.|$)/;

/**
 * Validates a sparse OverrideSet (the object returned by comp.getOverrides()).
 * Allowed keys: `<id>.text`, `<id>.style.<allow-listed prop>`, `<id>.attr.src|alt`, `var.<id>`.
 * Rejected: whole-element snapshots (added HTML), event/style/href attributes, unknown keys, bad values.
 * @returns {{ok:boolean, cleaned:Object, rejected:Array<{key:string, reason:string}>}}
 */
export function validateOverrides(set, opts = {}) {
  const cleaned = {}; const rejected = [];
  if (!set || typeof set !== 'object' || Array.isArray(set)) return { ok: false, cleaned, rejected: [{ key: '(root)', reason: 'not an object' }] };
  for (const [key, value] of Object.entries(set)) {
    const no = (reason) => rejected.push({ key, reason });
    if (BAD_KEY.test(key) || key.length > 200) { no('forbidden key'); continue; }
    if (value === null) { no('removal markers are not accepted from customers'); continue; }
    let m;
    if ((m = /^(?<id>[A-Za-z0-9_/-]+)\.text$/.exec(key))) { const t = sanitizeText(value); t === null ? no('text must be a string') : (cleaned[key] = t); continue; }
    if ((m = /^(?<id>[A-Za-z0-9_/-]+)\.style\.(?<prop>[A-Za-z]+)$/.exec(key))) {
      const f = STYLE_ALLOW[m.groups ? key.split('.style.')[1] : ''];
      if (!f) { no('style property not allow-listed'); continue; }
      f(value) ? (cleaned[key] = String(value)) : no('style value rejected'); continue;
    }
    if ((m = /^(?<id>[A-Za-z0-9_/-]+)\.attr\.(?<name>src|alt)$/.exec(key))) {
      if (key.endsWith('.attr.alt')) { const t = sanitizeText(value, 120); t === null ? no('alt must be a string') : (cleaned[key] = t); continue; }
      const r = validateAssetUrl(value, opts); r.ok ? (cleaned[key] = r.url) : no(`image url: ${r.reason}`); continue;
    }
    if (key.startsWith('cfg.')) {
      if (!isCfgKey(key)) { no('config path not allowed'); continue; }
      if (typeof value === 'string') { const t = sanitizeText(value, 200); t === null ? no('config text rejected') : (cleaned[key] = t); continue; }
      if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100000) { cleaned[key] = value; continue; }
      if (typeof value === 'boolean') { cleaned[key] = value; continue; }
      no('config value type not allowed'); continue;
    }
    if (/^ivar\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) { // nested-composition instance variable: ivar.<instanceId>.<variableId>; type/range checks happen in resolveVariables
      if (typeof value === 'string') { value.length <= 2100000 ? (cleaned[key] = value) : no('variable text too long'); continue; }
      if (typeof value === 'number' || typeof value === 'boolean') { cleaned[key] = value; continue; }
      no('variable value type not allowed'); continue;
    }
    if ((m = /^var\.(?<id>[A-Za-z0-9_-]+)$/.exec(key))) {
      if (typeof value === 'string') { value.length <= 2100000 ? (cleaned[key] = value) : no('variable text too long'); continue; } // per-type checks (length, range, enum, asset allow-list) happen in resolveVariables against the declaration
      if (typeof value === 'number' || typeof value === 'boolean') { cleaned[key] = value; continue; }
      if (value && typeof value === 'object' && typeof value.url === 'string') { const r = validateAssetUrl(value.url, opts); r.ok ? (cleaned[key] = { url: r.url, ...(value.alt ? { alt: sanitizeText(value.alt, 120) } : {}) }) : no(`image url: ${r.reason}`); continue; }
      no('variable value type not allowed'); continue;
    }
    no('key not allowed (whole-element, unknown or unsafe attribute)');
  }
  return { ok: rejected.length === 0, cleaned, rejected };
}

/** Removes inline event handlers and javascript: URLs from imported catalog markup (defence in depth). */
export function stripUnsafeAttributes(root) {
  let n = 0;
  for (const el of root.querySelectorAll('*')) {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action|formaction)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) { el.removeAttribute(a.name); n++; }
    }
  }
  return n;
}
