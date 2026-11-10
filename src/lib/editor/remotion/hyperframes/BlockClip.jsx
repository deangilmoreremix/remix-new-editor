/**
 * BlockClip: runs an UNMODIFIED HyperFrames registry block (a standalone HTML document) inside a
 * Remotion composition and seeks it from Remotion's frame clock.
 *
 * What the adapter has to do that a plain innerHTML mount does not:
 *  1. Scope the block's page-level CSS (`html, body, :root`) to the host element.
 *  2. Run its <script>s in order; core gsap comes from the bundled copy, other CDN libs from the
 *     local vendor map (setup-blocks.mjs), relative libs from /blocks/.
 *  3. Shim DOMContentLoaded/load listeners (the app page is already loaded).
 *  4. Wait for window.__timelines[<root composition id>] (some blocks register asynchronously).
 *  5. Emulate the HyperFrames runtime's clip visibility (data-start / data-duration on .clip).
 */
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig, useDelayRender } from 'remotion';
import { gsap } from 'gsap';
import { validateAssetUrl, stripUnsafeAttributes } from './security.js';
import { applyOverrides, stampHfIds } from './overrides.js';

let cdnMapPromise;
export const HF_BASE = '/hyperframes/blocks';
let allowHosts = [];
/** Extra https hosts customer assets may come from (own storage). Default: none. */
export const setAllowedAssetHosts = (hosts) => { allowHosts = Array.isArray(hosts) ? hosts.filter((h) => typeof h === 'string') : []; };
const cdnMap = () => (cdnMapPromise ||= fetch(`${HF_BASE}/_cdn/map.json`).then((r) => r.json()).catch(() => ({})));

export const scopeCss = (css) =>
  css
    .replace(/(^|[},;\s])(html|body|:root)(?=\s*[,{:.\s>+~[])/g, '$1.hf-host')
    .replace(/\.hf-host\s+\.hf-host/g, '.hf-host');

/**
 * Compat transform: Remotion's web renderer does not paint `box-shadow: inset ...`, pseudo-elements,
 * background-size or px gradient stops (verified in src/diag.jsx), but it does honour % gradient stops.
 * Hard single-edge inset shadows (e.g. `inset 3px 0 #3fb950`, used for diff/quote/active bars) are
 * therefore re-expressed per element as a % gradient once its size is known. Source CSS is not edited.
 */
export function extractInsetBars(css) {
  const bars = [];
  const rule = /([^{}@]+)\{([^{}]*)\}/g;
  let m;
  while ((m = rule.exec(css))) {
    const sel = m[1].trim();
    if (!sel || /::?(before|after|hover|focus|active|first|last|nth|not|is|where)/.test(sel)) continue;
    const sh = /box-shadow\s*:\s*inset\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(?:0(?:px)?\s+){0,2}(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)\s*(?:;|$)/.exec(m[2]);
    if (!sh) continue;
    const x = parseFloat(sh[1]), y = parseFloat(sh[2]);
    if ((x === 0) === (y === 0)) continue; // need exactly one non-zero offset (single hard edge)
    bars.push({ selector: sel, x, y, color: sh[3] });
  }
  return bars;
}

export function applyInsetBars(host, bars) {
  for (const b of bars) {
    let els;
    try { els = host.querySelectorAll(b.selector); } catch { continue; }
    for (const el of els) {
      const dir = b.x > 0 ? 'to right' : b.x < 0 ? 'to left' : b.y > 0 ? 'to bottom' : 'to top';
      const len = b.x !== 0 ? el.offsetWidth : el.offsetHeight;
      if (!len) continue;
      const pct = Math.min(100, (Math.abs(b.x || b.y) / len) * 100).toFixed(3);
      // The renderer drops background-color once a background-image exists and ignores a second
      // gradient layer, so one gradient carries both: bar colour up to P%, then the element's own colour.
      const bg = el.dataset.hfBg ?? (el.dataset.hfBg = getComputedStyle(el).backgroundColor);
      const rest = bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : 'transparent';
      const g = `linear-gradient(${dir}, ${b.color} ${pct}%, ${rest} ${pct}%)`;
      if (el.style.backgroundImage !== g) el.style.backgroundImage = g;
    }
  }
}

/**
 * Blocks are authored as standalone pages, so `assets/x.png` is relative to the block's own folder.
 * Injected into the app page those URLs would resolve against the app root, so they are re-based onto
 * /blocks/. Only plain relative paths are touched (no scheme, no leading slash, no `..`).
 */
export const stats = { rebased: 0 };
export const rebaseUrl = (u) => (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(u) || u.split('/').includes('..') ? u : `${HF_BASE}/${u.replace(/^\.\//, '')}`);
export const rebaseCssUrls = (css) => css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (_, q, u) => `url(${q}${rebaseUrl(u.trim())}${q})`);
export function rebaseElementUrls(root) {
  for (const el of root.querySelectorAll('[src],[poster],[href],image')) {
    for (const a of ['src', 'poster', 'href', 'xlink:href']) {
      const v = el.getAttribute(a); if (!v || /^<|\s/.test(v)) continue;
      if (a === 'src' || a === 'poster') { // asset policy: relative, blob:, small data images, allow-listed https only
        const chk = validateAssetUrl(v, { allowHosts: allowHosts, allowSvgData: true });
        if (!chk.ok && !v.startsWith(HF_BASE + '/')) { el.setAttribute(a, ''); report('blocked-url', a, `${chk.reason}: ${v.slice(0, 60)}`); continue; }
      }
      const r = rebaseUrl(v); if (r !== v) { el.setAttribute(a, r); stats.rebased++; }
    }
  }
  for (const el of root.querySelectorAll('[style*="url("]')) el.setAttribute('style', rebaseCssUrls(el.getAttribute('style')));
}

/**
 * Some blocks register an empty timeline immediately and fill it in once fonts have loaded and layout has
 * been measured. Seeking before that renders the initial state only. Wait for fonts, then until the
 * timeline duration has been unchanged and > 0 for a few consecutive checks (bounded).
 */
export async function settleTimeline(tl, { maxMs = 5000, stableChecks = 4, stepMs = 60 } = {}) {
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]); } catch { /* ignore */ }
  const t0 = performance.now(); let last = -1, stable = 0;
  while (performance.now() - t0 < maxMs) {
    const d = tl.duration();
    stable = d > 0 && d === last ? stable + 1 : 0; last = d;
    if (stable >= stableChecks) return { settled: true, duration: d, ms: Math.round(performance.now() - t0) };
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return { settled: false, duration: tl.duration(), ms: Math.round(performance.now() - t0) };
}

/**
 * Compat transform: the renderer draws radial gradients only when centred (verified in src/diag.jsx);
 * `at X Y` positions and % sizes render blank. Elements whose every background layer is a radial gradient
 * are rasterized with canvas 2D into a child <img> (the renderer paints <img>, not url() backgrounds).
 */
const topSplit = (str) => { const out = []; let d = 0, c = ''; for (const ch of str) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(c.trim()); c = ''; } else c += ch; } if (c.trim()) out.push(c.trim()); return out; };
export function parseRadial(layer, w, h) {
  const m = /^radial-gradient\((.*)\)$/s.exec(layer); if (!m) return null;
  const parts = topSplit(m[1]); let header = '';
  if (/^(circle|ellipse|closest|farthest|[\d.]+(%|px)?\s|at\s)/.test(parts[0]) && !/^(rgb|hsl|#)/.test(parts[0])) header = parts.shift();
  const stopsRaw = parts; if (stopsRaw.length < 2) return null;
  let cx = w / 2, cy = h / 2;
  const at = /at\s+(\S+)\s*(\S+)?/.exec(header); const pos = (t, len) => (t.endsWith('%') ? (parseFloat(t) / 100) * len : t === 'center' ? len / 2 : parseFloat(t));
  if (at) { cx = pos(at[1], w); cy = pos(at[2] || '50%', h); }
  const sizeTxt = header.replace(/at\s+.*$/, '').trim(); const nums = sizeTxt.match(/[\d.]+(?:%|px)?/g) || []; const circle = /circle/.test(sizeTxt);
  const sx = Math.max(cx, w - cx), sy = Math.max(cy, h - cy), mx = Math.min(cx, w - cx), my = Math.min(cy, h - cy);
  let rx, ry;
  if (nums.length >= 2) { rx = pos(nums[0], w); ry = pos(nums[1], h); }
  else if (nums.length === 1) { rx = ry = pos(nums[0], w); }
  else if (/closest-side/.test(sizeTxt)) { rx = circle ? Math.min(mx, my) : mx; ry = circle ? rx : my; }
  else if (/farthest-side/.test(sizeTxt)) { rx = circle ? Math.max(sx, sy) : sx; ry = circle ? rx : sy; }
  else if (circle) { rx = ry = Math.hypot(sx, sy); }
  else { rx = sx * Math.SQRT2; ry = sy * Math.SQRT2; }
  const stops = stopsRaw.map((x) => { const mm = /^(.*?)(?:\s+(-?[\d.]+)(%|px))?$/.exec(x); return { color: mm[1].trim(), at: mm[2] == null ? null : mm[3] === '%' ? parseFloat(mm[2]) / 100 : parseFloat(mm[2]) / rx }; });
  stops[0].at ??= 0; stops[stops.length - 1].at ??= 1;
  for (let i = 1; i < stops.length - 1; i++) if (stops[i].at == null) { let j = i; while (stops[j].at == null) j++; const a = stops[i - 1].at, b = stops[j].at; for (let k = i; k < j; k++) stops[k].at = a + ((b - a) * (k - i + 1)) / (j - i + 1); }
  return { cx, cy, rx, ry, stops };
}
export function rasterRadials(host) {
  let n = 0;
  for (const el of host.querySelectorAll('*')) {
    if (el.dataset?.hfLayers) continue;
    const cs = getComputedStyle(el); const bi = cs.backgroundImage;
    if (!bi || !bi.includes('radial-gradient(')) continue;
    const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h || cs.position === 'static') continue;
    const layers = splitLayers(bi).filter((x) => x !== 'none').map((x) => parseRadial(x, w, h));
    if (layers.some((l) => !l)) continue; // mixed/unparsable: leave to explodeMultiGradients
    const needs = layers.length > 1 || layers.some((l) => Math.abs(l.cx - w / 2) > 1 || Math.abs(l.cy - h / 2) > 1 || el.getAttribute('style')?.includes('%'));
    if (!needs) continue;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    for (const L of [...layers].reverse()) {
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const s of L.stops) grad.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
      g.save(); g.translate(L.cx, L.cy); g.scale(L.rx, L.ry); g.fillStyle = grad; g.fillRect(-L.cx / L.rx, -L.cy / L.ry, w / L.rx, h / L.ry); g.restore();
    }
    const img = document.createElement('img'); img.setAttribute('data-hf-layer', ''); img.src = c.toDataURL('image/png');
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;border-radius:inherit';
    el.dataset.hfLayers = '1'; el.style.backgroundImage = 'none'; el.style.isolation = 'isolate'; el.prepend(img); n++;
  }
  return n;
}

/**
 * Compat transform: the web renderer drops ALL layers when an element has several stacked gradients
 * (verified in src/diag.jsx); a single gradient works. Each layer is therefore moved onto its own
 * absolutely-positioned child behind the content. Needs a positioned element; others are skipped.
 */
export function splitLayers(bg) {
  const out = []; let depth = 0, cur = '';
  for (const ch of bg) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/**
 * Compat transform: the renderer applies `filter: blur()` but CLIPS it to the element's border box (verified in
 * src/diag.jsx), so large glows look hard-edged. Simple leaf shapes (solid colour, no children or text, positioned)
 * are rasterized with canvas 2D onto a padded canvas and shown as a child <img> that may overflow the box.
 */
export function rasterBlurShapes(host) {
  let n = 0;
  for (const el of host.querySelectorAll('*')) {
    if (el.dataset?.hfBlur || el.children.length || el.textContent.trim()) continue;
    const cs = getComputedStyle(el); const m = /^blur\(([\d.]+)px\)$/.exec(cs.filter);
    if (!m || cs.position === 'static' || (cs.backgroundImage && cs.backgroundImage !== 'none')) continue;
    const w = el.offsetWidth, h = el.offsetHeight, sigma = parseFloat(m[1]); if (!w || !h || !sigma) continue;
    const color = cs.backgroundColor; if (!color || color === 'rgba(0, 0, 0, 0)') continue;
    const pad = Math.min(600, Math.ceil(sigma * 3));
    const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2; const g = c.getContext('2d');
    g.filter = `blur(${sigma}px)`; g.fillStyle = color;
    const br = cs.borderTopLeftRadius; const r = br.endsWith('%') ? (parseFloat(br) / 100) * Math.min(w, h) : parseFloat(br) || 0;
    g.beginPath(); g.roundRect(pad, pad, w, h, r); g.fill();
    const img = document.createElement('img'); img.setAttribute('data-hf-layer', ''); img.src = c.toDataURL('image/png');
    img.style.cssText = `position:absolute;left:${-pad}px;top:${-pad}px;width:${w + pad * 2}px;height:${h + pad * 2}px;pointer-events:none;max-width:none`;
    el.dataset.hfBlur = '1'; el.style.filter = 'none'; el.style.backgroundColor = 'transparent'; el.append(img); n++;
  }
  return n;
}

export function explodeMultiGradients(host) {
  let n = 0;
  for (const el of host.querySelectorAll('*')) {
    if (el.dataset?.hfLayers) continue;
    const cs = getComputedStyle(el); const bi = cs.backgroundImage;
    if (!bi || bi === 'none' || !bi.includes('gradient(')) continue;
    const layers = splitLayers(bi).filter((x) => x !== 'none');
    if (layers.length < 2 || cs.position === 'static') continue;
    el.dataset.hfLayers = '1';
    const frag = document.createDocumentFragment();
    for (const g of [...layers].reverse()) { // bottom layer first; later siblings paint on top
      const d = document.createElement('div');
      d.setAttribute('data-hf-layer', '');
      d.style.cssText = `position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background-image:${g}`;
      frag.appendChild(d);
    }
    el.style.backgroundImage = 'none'; el.style.isolation = 'isolate';
    el.prepend(frag); n++;
  }
  return n;
}

/**
 * Compat transform: <video> elements are not painted by the web renderer. Each one keeps its DOM node
 * (so the block's own GSAP tweens on it still work) and the decoded frame for the current media time is
 * drawn to a canvas at the element's CSS size (object-fit honoured) and set as its background-image.
 */
/** Converts <video> to <div data-hf-src> BEFORE block scripts run, so their tweens bind to the div. */
export function convertVideos(host) {
  for (const v of [...host.querySelectorAll('video')]) {
    const src = v.getAttribute('src') || v.querySelector('source')?.getAttribute('src');
    const d = document.createElement('div');
    for (const a of v.attributes) if (!['src', 'muted', 'playsinline', 'autoplay', 'loop', 'controls', 'preload', 'poster'].includes(a.name)) d.setAttribute(a.name, a.value);
    if (src) d.setAttribute('data-hf-src', src);
    d.setAttribute('data-hf-video', '');
    v.replaceWith(d);
  }
}
export function collectVideos(host) {
  return [...host.querySelectorAll('[data-hf-video][data-hf-src]')].map((el) => {
    const ghost = document.createElement('video');
    ghost.muted = true; ghost.playsInline = true; ghost.preload = 'auto'; ghost.crossOrigin = 'anonymous'; ghost.src = el.getAttribute('data-hf-src');
    const num = (a, d) => (el.hasAttribute(a) && !Number.isNaN(parseFloat(el.getAttribute(a))) ? parseFloat(el.getAttribute(a)) : d);
    return { el, ghost, start: num('data-start', 0), dur: num('data-duration', Infinity), mediaStart: num('data-media-start', 0), rate: num('data-playback-rate', 1), canvas: document.createElement('canvas') };
  });
}
const seekGhost = (g, t) => new Promise((res) => {
  const done = () => { g.removeEventListener('seeked', done); res(); };
  if (g.readyState < 1) { g.addEventListener('loadedmetadata', () => { g.currentTime = t; }, { once: true }); }
  else if (Math.abs(g.currentTime - t) < 1e-3) return res();
  else g.currentTime = t;
  g.addEventListener('seeked', done); setTimeout(done, 4000);
});
export async function paintVideos(videos, t) {
  for (const v of videos) {
    const w = v.el.offsetWidth, h = v.el.offsetHeight; if (!w || !h) continue;
    const local = (t - v.start) * v.rate + v.mediaStart;
    const mt = Math.min(Math.max(local, 0), Number.isFinite(v.ghost.duration) ? Math.max(0, v.ghost.duration - 0.001) : local);
    await seekGhost(v.ghost, mt);
    const vw = v.ghost.videoWidth, vh = v.ghost.videoHeight; if (!vw || !vh) continue;
    v.canvas.width = w; v.canvas.height = h; const g = v.canvas.getContext('2d');
    const k = v.el.dataset.hfFit === 'contain' ? Math.min(w / vw, h / vh) : Math.max(w / vw, h / vh);
    g.clearRect(0, 0, w, h); g.drawImage(v.ghost, (w - vw * k) / 2, (h - vh * k) / 2, vw * k, vh * k);
    // The renderer paints <img> but not url() backgrounds, so the frame lives in a child <img>.
    let img = v.img;
    if (!img) { img = v.img = document.createElement('img'); img.setAttribute('data-hf-video-frame', ''); img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;border-radius:inherit'; v.el.prepend(img); }
    img.src = v.canvas.toDataURL('image/jpeg', 0.92);
    try { await img.decode(); } catch { /* ignore */ }
  }
}

/**
 * Fonts: HyperFrames' own renderer embeds the fonts a composition names; in the browser they must be
 * loaded explicitly or text falls back to a default face (visible in the Player-vs-native comparison).
 * Families named in the block's CSS are fetched from Google Fonts ONLY (host allow-list), injected as
 * @font-face and awaited before the block's scripts measure layout.
 */
const GENERIC = /^(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|inherit|initial|unset|emoji|math|-apple-system|blinkmacsystemfont)$/i;
export function fontFamiliesIn(cssAndStyles) {
  const out = new Set();
  for (const m of cssAndStyles.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) for (const f of m[1].split(',')) { const n = f.replace(/!important/i, '').replace(/["']/g, '').trim(); if (n && !GENERIC.test(n) && !n.startsWith('var(') && /^[A-Za-z0-9 _-]+$/.test(n)) out.add(n); }
  return [...out];
}
const fontCache = new Map();
export async function loadGoogleFonts(families, hostEl) {
  const loaded = [];
  for (const fam of families) {
    if (!fontCache.has(fam)) {
      fontCache.set(fam, (async () => {
        for (const spec of [':wght@100;200;300;400;500;600;700;800;900', ':wght@400;700', '']) {
          const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}${spec}&display=block`;
          if (new URL(url).hostname !== 'fonts.googleapis.com') return null; // allow-list
          try { const r = await fetch(url); if (r.ok) return await r.text(); } catch { /* try next */ }
        }
        return null;
      })());
    }
    const css = await fontCache.get(fam);
    if (css) { const st = document.createElement('style'); st.setAttribute('data-hf-font', fam); st.textContent = css; hostEl.prepend(st); loaded.push(fam); }
  }
  try { await Promise.race([Promise.all(loaded.map((f) => document.fonts.load(`16px "${f}"`))), new Promise((r) => setTimeout(r, 4000))]); } catch { /* ignore */ }
  return loaded;
}

/** Block scripts are trusted catalog code but still only run inside an opaque-origin sandbox (window.origin === 'null'). */
export const isSandboxed = () => window.origin === 'null';
export const scriptsAllowed = () => isSandboxed();

const errors = [];
/** Problems seen while mounting blocks (blocked URLs, failed scripts). Read and cleared by the renderer pages. */
export const takeHyperframesErrors = () => errors.splice(0).slice(0, 20);
const report = (kind, name, err) => {
  errors.push(`${kind} ${name}: ${err?.message || err}`);
};

/**
 * Per-instance script scope (JS-level isolation, NOT a security boundary: the sandboxed iframe is).
 * Block scripts run through `with (scope)` so bare `document`/`window`/`self` resolve to per-instance
 * proxies: DOM lookups are confined to this block's host, `window.__timelines` and any globals the scripts
 * define live in a per-instance store, and DOMContentLoaded/load callbacks fire without patching the real
 * document/window. Everything not overridden falls through to the real globals.
 */
export function createScope(host) {
  const store = { __timelines: {} };
  const cleanups = [];
  const q = (sel) => host.querySelector(sel);
  const qa = (sel) => host.querySelectorAll(sel);
  const fire = (cb) => queueMicrotask(() => { try { typeof cb === 'function' ? cb(new Event('load')) : cb?.handleEvent?.(new Event('load')); } catch (e) { report('load-handler', '', e); } });
  const docOverrides = {
    getElementById: (id) => host.querySelector(`[id="${String(id).replace(/"/g, '\\"')}"]`),
    querySelector: q, querySelectorAll: qa,
    createElement: (tag, o) => { const e = document.createElement(tag, o); if (/^(img|video|audio)$/i.test(String(tag))) e.crossOrigin = 'anonymous'; return e; },
    getElementsByClassName: (c) => host.getElementsByClassName(c), getElementsByTagName: (t) => host.getElementsByTagName(t),
    addEventListener: (t, cb, o) => { if (t === 'DOMContentLoaded' || t === 'readystatechange') return fire(cb); document.addEventListener(t, cb, o); cleanups.push(() => document.removeEventListener(t, cb, o)); },
    removeEventListener: (t, cb, o) => document.removeEventListener(t, cb, o),
    body: host, documentElement: host, head: host, readyState: 'complete', currentScript: null,
  };
  const docProxy = new Proxy(document, {
    get: (t, p) => (p in docOverrides ? docOverrides[p] : (() => { const v = Reflect.get(t, p, t); return typeof v === 'function' ? v.bind(t) : v; })()),
    set: (t, p, v) => { store[p] = v; return true; },
  });
  const winOverrides = {
    document: docProxy,
    Image: function (w, h) { const i = new Image(w, h); i.crossOrigin = 'anonymous'; return i; },
    addEventListener: (t, cb, o) => { if (t === 'load') return fire(cb); window.addEventListener(t, cb, o); cleanups.push(() => window.removeEventListener(t, cb, o)); },
    removeEventListener: (t, cb, o) => window.removeEventListener(t, cb, o),
  };
  let winProxy;
  winProxy = new Proxy(window, {
    get: (t, p) => { if (p === 'window' || p === 'self' || p === 'globalThis' || p === 'top' || p === 'parent') return winProxy; if (p in store) return store[p]; if (p in winOverrides) return winOverrides[p]; const v = Reflect.get(t, p, t); return typeof v === 'function' && !/^[A-Z]/.test(String(p)) ? v.bind(t) : v; },
    set: (t, p, v) => { store[p] = v; return true; },
    has: () => true,
    deleteProperty: (t, p) => delete store[p],
  });
  const scope = new Proxy({}, {
    has: (t, p) => typeof p === 'string' && p !== 'eval' && p !== 'arguments' && (p in store || p in winOverrides || p === 'window' || p === 'self' || p === 'globalThis' || p === 'document' || p in window),
    get: (t, p) => (p === Symbol.unscopables ? undefined : winProxy[p]),
    set: (t, p, v) => { store[p] = v; return true; },
  });
  const run = (code, label) => new Function('__scope', `with (__scope) {\n${code}\n}\n//# sourceURL=hf-block/${label}`)(scope);
  return { run, store, dispose: () => { cleanups.splice(0).forEach((f) => f()); } };
}

async function runScripts(doc, name, scope) {
  const map = await cdnMap();
  for (const s of doc.querySelectorAll('script')) {
    if (s.type && !/javascript|^$/.test(s.type)) continue; // module scripts are not supported
    let code; let label;
    const src = s.getAttribute('src');
    if (src) {
      if (/gsap@[^/]+\/dist\/gsap(\.min)?\.js/.test(src)) continue; // bundled
      label = src;
      // Remote script URLs are never fetched: only the vendored copies (setup-blocks.mjs) or the block's own folder.
      const local = /^https?:/.test(src) ? map[src] : src;
      if (!local || local.includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(local)) { report('blocked-script', src, 'not vendored'); continue; }
      try { code = await (await fetch(`${HF_BASE}/${local}`)).text(); } catch (e) { report('fetch', src, e); continue; }
    } else { code = s.textContent; label = `${name}#inline`; }
    try { scope.run(code, label); } catch (e) { report('script', label, e); }
  }
}

const applyClipVisibility = (host, t) => {
  for (const el of host.querySelectorAll('.clip[data-start]')) {
    if (el.hasAttribute('data-composition-id')) continue;
    const start = parseFloat(el.dataset.start);
    if (Number.isNaN(start)) continue;
    const dur = el.dataset.duration != null ? parseFloat(el.dataset.duration) : NaN;
    const end = !Number.isNaN(dur) ? start + dur : el.dataset.end != null ? parseFloat(el.dataset.end) : Infinity;
    el.classList.toggle('hf-hidden', !(t >= start - 1e-6 && t < end));
  }
};

const BLOCK_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const sha256Hex = async (buf) => { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); };

/** `expectedSha256` pins the block's source: a block whose bytes do not match is never executed. */
export function BlockClip({ name, width, height, overrides, expectedSha256 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const host = useRef(null);
  const state = useRef({ tl: null });
  const { delayRender, continueRender } = useDelayRender();
  const handle = useRef(null);
  if (handle.current === null) handle.current = delayRender(`hf-block-${name}`, { timeoutInMilliseconds: 60000 });

  useLayoutEffect(() => {
    let cancelled = false;
    let observer = null;
    const el = host.current;
    (async () => {
      try {
        if (!BLOCK_ID.test(String(name))) { report('refused', String(name).slice(0, 40), 'invalid block id'); return; }
        const res = await fetch(`${HF_BASE}/${encodeURIComponent(name)}.html`);
        if (!res.ok) { report('fetch', name, `HTTP ${res.status}`); return; }
        const bytes = await res.arrayBuffer();
        if (expectedSha256) {
          if (!globalThis.crypto?.subtle) { report('refused', name, 'integrity check unavailable (no crypto.subtle)'); return; }
          if ((await sha256Hex(bytes)) !== expectedSha256) { report('refused', name, 'source does not match the pinned sha256'); return; }
        }
        const html = new TextDecoder().decode(bytes);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        stampHfIds(doc.body);
        const css = [...doc.querySelectorAll('style')].map((s) => rebaseCssUrls(scopeCss(s.textContent))).join('\n');
        state.current.bars = extractInsetBars(css);
        el.innerHTML = `<style>.hf-hidden{visibility:hidden!important}${css}</style>`;
        for (const l of doc.querySelectorAll('link[rel=stylesheet]')) el.appendChild(l.cloneNode());
        doc.querySelectorAll('img,image,source').forEach((x) => x.tagName.toLowerCase() === 'image' ? null : x.setAttribute('crossorigin', 'anonymous'));
        for (const n of doc.body.childNodes) if (n.nodeName !== 'SCRIPT') el.appendChild(document.importNode(n, true));
        stripUnsafeAttributes(el);
        if (overrides) applyOverrides(el, overrides, { allowHosts, onReject: (r) => report('override-rejected', name, r.map((x) => `${x.key}: ${x.reason}`).join('; ')) });
        rebaseElementUrls(el);
        convertVideos(el);
        // Script-built nodes (innerHTML from block scripts) get the same relative-URL rebasing.
        const rebaseNode = (n) => { if (n.nodeType !== 1) return; for (const im of (n.tagName === 'IMG' ? [n] : n.querySelectorAll?.('img') || [])) if (!im.crossOrigin) im.crossOrigin = 'anonymous'; for (const a of ['src', 'poster', 'href']) { const v = n.getAttribute(a); if (v && !/^<|\s/.test(v)) { const r = rebaseUrl(v); if (r !== v) n.setAttribute(a, r); } } rebaseElementUrls(n); };
        observer = new MutationObserver((muts) => { for (const m of muts) { if (m.type === 'attributes') rebaseNode(m.target); else for (const n of m.addedNodes) rebaseNode(n); } });
        observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'poster', 'href'] });
        const root = el.querySelector('[data-composition-id]');
        const id = root?.getAttribute('data-composition-id');
        const scope = createScope(el); scope.store.gsap = gsap; state.current.scope = scope;
        const fams = fontFamiliesIn(css + ' ' + [...doc.querySelectorAll('[style]')].map((n) => n.getAttribute('style')).join(';'));
        state.current.fonts = await loadGoogleFonts(fams, el);
        if (scriptsAllowed()) await runScripts(doc, name, scope); else report('refused', name, 'scripts not run: not in an opaque-origin sandbox');
        let tl = null;
        for (let i = 0; i < 120 && !cancelled; i++) {
          tl = (id && scope.store.__timelines[id]) || null;
          if (tl) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        if (!tl) report('timeline', name, 'no __timelines entry' + (root?.hasAttribute('data-no-timeline') ? ' (data-no-timeline block)' : ''));
        else {
          tl.pause(); state.current.tl = tl;
          const st = await settleTimeline(tl);
          if (!st.settled) report('timeline', name, `timeline did not settle (duration ${st.duration})`);
        }
        await Promise.all([...el.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
        state.current.blurs = rasterBlurShapes(el);
        state.current.rasters = rasterRadials(el);
        state.current.layers = explodeMultiGradients(el);
        await Promise.all([...el.querySelectorAll('img[data-hf-layer]')].map((i) => i.decode().catch(() => {})));
        state.current.videos = collectVideos(el);
        if (state.current.videos.length) await paintVideos(state.current.videos, frame / fps);
        state.current.ready = true;
        // initial seek for the frame already requested
        const t = frame / fps;
        if (tl) { tl.totalTime(0, true); tl.totalTime(t, false); }
        applyClipVisibility(el, t);
        applyInsetBars(el, state.current.bars || []);
      } catch (e) { report('mount', name, e); }
      finally { if (!cancelled) continueRender(handle.current); }
    })();
    return () => { cancelled = true; observer?.disconnect(); state.current.scope?.dispose(); state.current.tl?.kill?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, expectedSha256, JSON.stringify(overrides ?? null)]);

  useLayoutEffect(() => {
    const { tl, ready } = state.current;
    if (!ready) return;
    const t = frame / fps;
    if (tl) { tl.totalTime(0, true); tl.totalTime(t, false); }
    if (state.current.videos?.length) { const h = delayRender('hf-video-frame'); paintVideos(state.current.videos, t).finally(() => continueRender(h)); }
    if (host.current) { applyClipVisibility(host.current, t); applyInsetBars(host.current, state.current.bars || []); }
  }, [frame, fps]);

  return <div ref={host} className="hf-host" style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }} />;
}
