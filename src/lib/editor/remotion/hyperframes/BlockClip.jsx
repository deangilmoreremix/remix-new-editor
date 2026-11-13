/* global DOMParser, queueMicrotask */
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
import { validateAssetUrl, stripUnsafeAttributes, validateOverrides } from './security.js';
import { applyOverrides, stampHfIds } from './overrides.js';
import { patchConfig } from './config.js';
import { parseVariableDecls, resolveVariables, bindVariables } from './variables.js';
import { normalizeRel, computeWindows, childTime, instanceOverrides } from './nested.js';

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
export const rebaseUrl = (u, base = HF_BASE) => (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(u) || u.split('/').includes('..') ? u : `${base}/${u.replace(/^\.\//, '')}`);
export const rebaseCssUrls = (css, base = HF_BASE) => css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (_, q, u) => `url(${q}${rebaseUrl(u.trim(), base)}${q})`);
/** The sandbox frames' CSP only allows fonts from fonts.gstatic.com and data:, so a block's own vendored font files are inlined as data: URLs
 *  (sha256 of the block bundle is already verified; only files under this block bundle and font extensions are read, 3 MB cap). */
export async function inlineBlockFonts(css) {
  const re = /url\(\s*(['"]?)(\/hyperframes\/[^)'"]+\.(?:woff2?|ttf|otf))\1\s*\)/gi;
  const found = [...new Set([...css.matchAll(re)].map((m) => m[2]))];
  const data = {};
  await Promise.all(found.map(async (u) => {
    if (u.split('/').includes('..')) return;
    try {
      const buf = await (await fetch(u)).arrayBuffer(); if (buf.byteLength > 3 * 1024 * 1024) return;
      let bin = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
      data[u] = `data:font/${u.split('.').pop().toLowerCase()};base64,${btoa(bin)}`;
    } catch { /* font stays unresolved; the block falls back to its fallback font */ }
  }));
  return css.replace(re, (all, q, u) => (data[u] ? `url(${q}${data[u]}${q})` : all));
}
export function rebaseElementUrls(root, base = HF_BASE) {
  for (const el of root.querySelectorAll('[src],[poster],[href],image')) {
    for (const a of ['src', 'poster', 'href', 'xlink:href']) {
      const v = el.getAttribute(a); if (!v || /^<|\s/.test(v)) continue;
      if (a === 'src' || a === 'poster') { // asset policy: relative, blob:, small data images, allow-listed https only
        const chk = validateAssetUrl(v, { allowHosts: allowHosts, allowSvgData: true });
        if (!chk.ok && !v.startsWith(base + '/')) { el.setAttribute(a, ''); report('blocked-url', a, `${chk.reason}: ${v.slice(0, 60)}`); continue; }
      }
      const r = rebaseUrl(v, base); if (r !== v) { el.setAttribute(a, r); stats.rebased++; }
    }
  }
  for (const el of root.querySelectorAll('[style*="url("]')) el.setAttribute('style', rebaseCssUrls(el.getAttribute('style'), base));
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
  return [...host.querySelectorAll('[data-hf-video][data-hf-src]')].filter((el) => !/__[A-Z][A-Z0-9_]*__/.test(el.getAttribute('data-hf-src'))).map((el) => { // unfilled template slots (e.g. __VIDEO_SRC__) stay empty: there is no footage to paint
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
  g.addEventListener('seeked', done); setTimeout(done, g.readyState < 1 ? 2000 : 4000);
});
export async function paintVideos(videos, t) {
  for (const v of videos) {
    if (v.broken) continue;
    const w = v.el.offsetWidth, h = v.el.offsetHeight; if (!w || !h) continue;
    const local = (t - v.start) * v.rate + v.mediaStart;
    const mt = Math.min(Math.max(local, 0), Number.isFinite(v.ghost.duration) ? Math.max(0, v.ghost.duration - 0.001) : local);
    await seekGhost(v.ghost, mt);
    const vw = v.ghost.videoWidth, vh = v.ghost.videoHeight; if (!vw || !vh) { v.broken = true; continue; } // never loaded: do not wait again on every frame
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
/** Kinds that make the rendered output wrong or empty (fatal for export) vs. notes that leave a usable result. */
export const FATAL_KINDS = new Set(['refused', 'fetch', 'script', 'mount', 'timeline', 'blocked-script', 'blocked-url', 'integrity']);
const errorListeners = new Set();
/** Subscribe to adapter problems as they happen: fn({ kind, name, message, fatal }). Returns the unsubscribe function. */
export const onHyperframesError = (fn) => { errorListeners.add(fn); return () => errorListeners.delete(fn); };
const report = (kind, name, err) => {
  const message = err?.message || String(err);
  const msg = `${kind} ${name}: ${message}`;
  if (!errors.includes(msg)) console.warn(`[hyperframes] ${msg}`);
  // always notify (no de-duplication): the export frame is reused, so a repeat failure must still fail the next export
  errorListeners.forEach((fn) => { try { fn({ kind, name, message, fatal: FATAL_KINDS.has(kind) }); } catch { /* listener errors never break rendering */ } });
  errors.push(msg); if (errors.length > 50) errors.splice(0, errors.length - 50);
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
    body: host, documentElement: host, head: host, readyState: 'complete', get currentScript() { return store.__currentScript || null; },
  };
  const docProxy = new Proxy(document, {
    get: (t, p) => (p in docOverrides ? docOverrides[p] : (() => { const v = Reflect.get(t, p, t); return typeof v === 'function' ? v.bind(t) : v; })()),
    set: (t, p, v) => { store[p] = v; return true; },
  });
  const winOverrides = {
    document: docProxy,
    Image: function (w, h) { const i = new Image(w, h); i.crossOrigin = 'anonymous'; return i; },
    // `hf-seek` is HyperFrames' protocol for content that is not a GSAP timeline (WebGPU/WebGL shader backgrounds, three.js): the listener renders the given time. Kept per instance, never on the shared window.
    addEventListener: (t, cb, o) => { if (t === 'load') return fire(cb); if (t === 'hf-seek') { (store.__hfSeek ||= []).push(cb); return undefined; } window.addEventListener(t, cb, o); cleanups.push(() => window.removeEventListener(t, cb, o)); },
    removeEventListener: (t, cb, o) => window.removeEventListener(t, cb, o),
  };
  const winProxy = new Proxy(window, {
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

async function runScripts(doc, name, scope, cfg = {}, base = HF_BASE, owner = name) { // `owner` = the catalog item the problem is attributed to (errors from nested files still belong to it)
  let cfgUsed = false;
  const map = await cdnMap();
  for (const s of doc.querySelectorAll('script')) {
    if (s.type && !/javascript|^$/.test(s.type)) continue; // module scripts are not supported
    let code; let label;
    const src = s.getAttribute('src');
    if (src) {
      if (/gsap@[^/]+\/dist\/gsap(\.min)?\.js/.test(src) || /(^|\/)gsap(-[\d.]+)?(\.min)?\.js$/.test(src)) continue; // core gsap is bundled (CDN or a block-local copy)
      label = src;
      // Remote script URLs are never fetched: only the vendored copies (setup-blocks.mjs) or the block's own folder.
      const local = /^(https?:)?\/\//.test(src) ? map[src.startsWith('//') ? `https:${src}` : src] : src;
      if (!local || local.includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(local)) { report('blocked-script', owner, `${src}: not vendored`); continue; }
      try { code = await (await fetch(`${/^(https?:)?\/\//.test(src) ? HF_BASE : base}/${local}`)).text(); } catch (e) { report('fetch', owner, `${src}: ${e?.message || e}`); continue; }
    } else { code = s.textContent; label = `${name}#inline`; }
    if (Object.keys(cfg).length && !cfgUsed) { const patched = patchConfig(code, cfg); if (patched !== null) { code = patched; cfgUsed = true; } }
    try { scope.run(code, label); } catch (e) { report('script', owner, `${label}: ${e?.message || e}`); }
  }
  if (Object.keys(cfg).length && !cfgUsed) report('override-rejected', owner, 'block has no CONFIG object; cfg overrides ignored');
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

/** Nested projects use absolute windows (parent starts add up); plain blocks keep the original flat rule so verified blocks are unaffected. */
const applyVisibility = (host, t, wins) => {
  if (!wins) return applyClipVisibility(host, t);
  for (const w of wins) {
    if (w.error || w.el === host) continue;
    const end = Number.isFinite(w.duration) ? w.absStart + w.duration : Infinity;
    w.el.classList.toggle('hf-off', !(t >= w.absStart - 1e-6 && t < end)); // display:none: a child's own visibility:visible must not defeat the clip window
  }
};

/** `gsap` is a declared dependency (package.json), but a checkout whose node_modules predates that declaration gets an EMPTY stand-in: the dev
 *  server stubs unresolved imports (vite.config.js stubLegacy). Every block then died with the cryptic "gsap.timeline is not a function". */
export const gsapAvailable = () => typeof gsap?.timeline === 'function' && typeof gsap?.set === 'function';

const BLOCK_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const sha256Hex = async (buf) => { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); };

/** `expectedSha256` pins the block's source: a block whose bytes do not match is never executed. */
/** Catalog components (and some blocks) follow the "mount contract": the composition id / variables / duration sit on <html> and the
 *  fragment lives in a <template> that a host clones into a full-frame box. Mounting it here equals a full-frame host composition. */
export function unwrapTemplate(doc, width, height) {
  const tpl = [...doc.head.children, ...doc.body.children].find((c) => c.tagName === 'TEMPLATE');
  const html = doc.documentElement; const id = html.getAttribute('data-composition-id');
  if (!tpl || doc.body.querySelector('[data-composition-id]')) return false;
  if (!id) { // the composition root itself sits inside the template: mount its content as the body
    if (!tpl.content.querySelector('[data-composition-id]')) return false;
    doc.body.replaceChildren(...[...tpl.content.childNodes].map((n) => doc.importNode(n, true)));
    return true;
  }
  const wrap = doc.createElement('div');
  wrap.setAttribute('data-composition-id', id); wrap.setAttribute('data-start', '0');
  wrap.setAttribute('data-duration', html.getAttribute('data-composition-duration') || html.getAttribute('data-duration') || '5');
  const vars = html.getAttribute('data-composition-variables'); if (vars) wrap.setAttribute('data-composition-variables', vars);
  wrap.setAttribute('style', `position:relative;width:${width || 1920}px;height:${height || 1080}px;overflow:hidden`);
  for (const n of [...tpl.content.childNodes]) wrap.appendChild(doc.importNode(n, true));
  doc.body.replaceChildren(wrap);
  return true;
}

/** HyperFrames sizes every composition element from data-width / data-height; without that, percent-based children (width:100%; height:100%) collapse to 0. */
export function sizeCompositions(root, width, height) {
  for (const c of root.querySelectorAll('[data-composition-id]')) {
    const w = parseFloat(c.getAttribute('data-width')) || width, h = parseFloat(c.getAttribute('data-height')) || height;
    if (!c.style.width && w) c.style.width = `${w}px`;
    if (!c.style.height && h) c.style.height = `${h}px`;
  }
}

export function BlockClip({ name, width, height, overrides, expectedSha256, project }) {
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
        if (!gsapAvailable()) { report('mount', name, 'the gsap package is not installed in this build, so animations cannot run. Run "npm install" and restart the dev server.'); return; }
        const base = project ? `/hyperframes/${project.dir}` : HF_BASE; // starter projects and components are vendored next to the blocks folder
        const pinned = async (url, sha, label, rel) => { // fetch one file and verify it against its pinned sha256 (fail closed); problems are attributed to the catalog item, the file named in the message
          const at = rel ? `${rel}: ` : '';
          const res = await fetch(url);
          if (!res.ok) { report('fetch', label, `${at}HTTP ${res.status}`); return null; }
          const bytes = await res.arrayBuffer();
          if (sha) {
            if (!globalThis.crypto?.subtle) { report('refused', label, `${at}integrity check unavailable (no crypto.subtle)`); return null; }
            if ((await sha256Hex(bytes)) !== sha) { report('refused', label, `${at}source does not match the pinned sha256`); return null; }
          }
          return new TextDecoder().decode(bytes);
        };
        let html;
        if (project?.hostHtml) html = project.hostHtml; // generated host composition (components): built in code from validated values only
        else html = await pinned(project ? `${base}/${project.entry}` : `${HF_BASE}/${encodeURIComponent(name)}.html`, project ? project.files?.[project.entry] : expectedSha256, name);
        if (html === null) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        unwrapTemplate(doc, width, height);
        if (!project) stampHfIds(doc.body); // projects: ids are stamped on the composed tree after nested compositions are mounted
        const cleanedOv = validateOverrides(overrides || {}, { allowHosts }).cleaned;
        let css = [...doc.querySelectorAll('style')].map((s) => rebaseCssUrls(scopeCss(s.textContent), base)).join('\n');
        el.innerHTML = '';
        for (const l of doc.querySelectorAll('link[rel=stylesheet]')) el.appendChild(l.cloneNode());
        doc.querySelectorAll('img,image,source').forEach((x) => x.tagName.toLowerCase() === 'image' ? null : x.setAttribute('crossorigin', 'anonymous'));
        for (const n of doc.body.childNodes) if (n.nodeName !== 'SCRIPT') el.appendChild(document.importNode(n, true));
        el.querySelectorAll('script').forEach((x) => x.remove()); // scripts run from the parsed source below, never from the mounted DOM
        stripUnsafeAttributes(el);
        const applyEl = () => { if (overrides) applyOverrides(el, overrides, { allowHosts, onReject: (r) => report('override-rejected', name, r.map((x) => `${x.key}: ${x.reason}`).join('; ')) }); };
        if (!project) applyEl();
        rebaseElementUrls(el, base);
        const root = el.querySelector('[data-composition-id]');
        const id = root?.getAttribute('data-composition-id');
        const scope = createScope(el); scope.store.gsap = gsap; state.current.scope = scope;
        // a composition that mounts its component inline (e.g. a component's demo) declares the variables on that inner element, not on the root
        const declRoot = parseVariableDecls(root).length ? root : (el.querySelector('[data-composition-variables]') || root);
        const varValues = resolveVariables(parseVariableDecls(declRoot), cleanedOv, { allowHosts, onReject: (r) => report('override-rejected', name, `${r.key}: ${r.reason}`) });
        bindVariables(el, varValues);
        // ---- nested compositions (data-composition-src): fetched from the pinned file map only, mounted into their host clip ----
        const cfgOv = Object.fromEntries(Object.entries(cleanedOv).filter(([k]) => k.startsWith('cfg.')));
        const jobs = [{ code: doc, name, vars: varValues, cfg: project?.hostHtml ? {} : cfgOv }]; // generated hosts have no CONFIG: their component carries it
        const childIds = [];
        let loaded = 0;
        const loadNested = async (container, depth) => {
          for (const hostEl of [...container.querySelectorAll('[data-composition-src]')]) {
            if (hostEl.hasAttribute('data-hf-loaded')) continue;
            hostEl.setAttribute('data-hf-loaded', '1');
            if (depth >= 4 || ++loaded > 60) { report('refused', name, 'nested compositions: depth or count limit reached'); continue; }
            const rel = normalizeRel(hostEl.getAttribute('data-composition-src'));
            if (!project || !rel) { report('refused', name, `nested composition path not allowed: ${String(hostEl.getAttribute('data-composition-src')).slice(0, 80)}`); continue; }
            const sha = project.files?.[rel];
            if (!sha) { report('refused', name, `nested file "${rel}" is not in the pinned file list`); continue; }
            const text = await pinned(`${base}/${rel}`, sha, name, rel); if (text === null) continue;
            const cdoc = new DOMParser().parseFromString(text, 'text/html');
            const tpl = [...cdoc.head.children, ...cdoc.body.children].find((c) => c.tagName === 'TEMPLATE');
            const frag = document.createDocumentFragment();
            for (const n of (tpl ? [...tpl.content.childNodes] : [...cdoc.body.childNodes])) frag.appendChild(document.importNode(n, true));
            const cid = hostEl.getAttribute('data-composition-id') || cdoc.documentElement.getAttribute('data-composition-id') || frag.querySelector?.('[data-composition-id]')?.getAttribute('data-composition-id');
            const declHost = frag.querySelector('[data-composition-variables]') || cdoc.documentElement;
            const inst = { ...instanceOverrides(hostEl), ...Object.fromEntries(Object.entries(cleanedOv).filter(([k]) => k.startsWith(`ivar.${hostEl.id || cid}.`)).map(([k, v]) => [`var.${k.split('.').slice(2).join('.')}`, v])) };
            const vals = resolveVariables(parseVariableDecls(declHost), inst, { allowHosts, onReject: (r) => report('override-rejected', name, `${rel}: ${r.key}: ${r.reason}`) });
            const childCss = [...frag.querySelectorAll('style')].map((st) => { const t = rebaseCssUrls(scopeCss(st.textContent), base); st.textContent = rebaseCssUrls(st.textContent, base); return t; }).join('\n'); // like the block path: the original <style> stays in the mounted DOM next to its scoped copy
            css += '\n' + childCss + '\n' + [...cdoc.head.querySelectorAll('style')].map((st) => rebaseCssUrls(scopeCss(st.textContent), base)).join('\n'); // standalone files keep their styles in <head>
            for (const l of frag.querySelectorAll('link[rel=stylesheet]')) { el.appendChild(l.cloneNode()); l.remove(); }
            frag.querySelectorAll('img,source').forEach((x) => x.setAttribute('crossorigin', 'anonymous'));
            const scripts = document.createDocumentFragment(); for (const sc of [...frag.querySelectorAll('script')]) { scripts.appendChild(sc); }
            hostEl.replaceChildren(frag);
            stripUnsafeAttributes(hostEl); rebaseElementUrls(hostEl, base); bindVariables(hostEl, vals);
            if (cid && !hostEl.hasAttribute('data-composition-id')) hostEl.setAttribute('data-composition-id', cid);
            if (cid) childIds.push(cid);
            jobs.push({ code: scripts, name: rel, vars: vals, cfg: project?.hostHtml ? cfgOv : {}, host: hostEl });
            await loadNested(hostEl, depth + 1);
          }
        };
        await loadNested(el, 0);
        if (project) { sizeCompositions(el, width, height); stampHfIds(el); applyEl(); } // nested projects only: plain blocks keep their verified layout and ids
        css = await inlineBlockFonts(css);
        state.current.bars = extractInsetBars(css);
        const styleEl = document.createElement('style'); styleEl.textContent = `.hf-hidden{visibility:hidden!important}.hf-off{display:none!important}${css}`; el.prepend(styleEl);
        convertVideos(el);
        // Script-built nodes (innerHTML from block scripts) get the same relative-URL rebasing.
        const rebaseNode = (n) => { if (n.nodeType !== 1) return; for (const im of (n.tagName === 'IMG' ? [n] : n.querySelectorAll?.('img') || [])) if (!im.crossOrigin) im.crossOrigin = 'anonymous'; for (const a of ['src', 'poster', 'href']) { const v = n.getAttribute(a); if (v && !/^<|\s/.test(v)) { const r = rebaseUrl(v, base); if (r !== v) n.setAttribute(a, r); } } rebaseElementUrls(n, base); };
        observer = new MutationObserver((muts) => { for (const m of muts) { if (m.type === 'attributes') rebaseNode(m.target); else for (const n of m.addedNodes) rebaseNode(n); } });
        observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'poster', 'href'] });
        const fams = fontFamiliesIn(css + ' ' + [...el.querySelectorAll('[style]')].map((n) => n.getAttribute('style')).join(';'));
        state.current.fonts = await loadGoogleFonts(fams, el);
        if (scriptsAllowed()) {
          for (const j of jobs) {
            scope.store.__hyperframes = { getVariables: () => ({ ...j.vars }) };
            const cs = document.createElement('script'); (j.host || el).appendChild(cs); scope.store.__currentScript = cs; // inert stand-in so document.currentScript.closest(...) works
            await runScripts(j.code, j.name, scope, j.cfg, base, name);
          }
        } else report('refused', name, 'scripts not run: not in an opaque-origin sandbox');
        // ---- timelines: the root composition plus every nested composition, each seeked to its own local time ----
        const want = [...new Set([id, ...childIds, ...[...el.querySelectorAll('[data-composition-id]')].map((x) => x.getAttribute('data-composition-id'))])].filter(Boolean); // inline compositions (no src) register timelines too
        const tls = {};
        const hfBuild = Object.values(scope.store.__hf?.buildReady || {}); // promises the block's runtime publishes while it builds (e.g. the shader library creating its GPU pipeline)
        if (hfBuild.length) { try { await Promise.race([Promise.all(hfBuild), new Promise((_, rej) => setTimeout(() => rej(new Error('block runtime did not become ready in 30s')), 30000))]); } catch (e) { report('build', name, e); } }
        const seekOnly = !!scope.store.__hfSeek?.length && root?.hasAttribute('data-no-timeline');
        for (let i = 0; i < (seekOnly ? 0 : 120) && !cancelled; i++) {
          for (const w of want) if (!tls[w] && scope.store.__timelines?.[w]) tls[w] = scope.store.__timelines[w];
          if (want.every((w) => tls[w]) || (!project && want.length <= 1 && tls[id])) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        const tl = (id && tls[id]) || null;
        if (!tl && !project && !scope.store.__hfSeek?.length) report('timeline', name, 'no __timelines entry' + (root?.hasAttribute('data-no-timeline') ? ' (data-no-timeline block)' : ''));
        // a nested composition that registers no timeline is a static (CSS/markup only) composition: valid, nothing to seek
        const wins = project || childIds.length || want.length > 1 ? computeWindows(root || el) : null;
        if (wins) for (const w of wins) if (w.error) report('timeline', name, w.error);
        const seekers = [];
        for (const [cid, t2] of Object.entries(tls)) {
          t2.pause(); const st = await settleTimeline(t2); const emptyMaster = (cid === id || !!(wins && wins.find((w) => !w.error && (w.id === cid || w.el.getAttribute('data-composition-id') === cid)))) && (project || childIds.length || want.length > 1) && st.duration === 0; // an empty host master timeline is legitimate: the nested compositions carry the animation
          if (!st.settled && !emptyMaster) report('timeline', name, `timeline "${cid}" did not settle (duration ${st.duration})`);
          const win = cid === id ? null : (wins || []).find((w) => !w.error && (w.id === cid || w.el.getAttribute('data-composition-id') === cid));
          seekers.push({ tl: t2, win });
        }
        state.current.tl = tl; state.current.seekers = seekers; state.current.wins = wins;
        state.current.seek = (t) => {
          for (const { tl: x, win } of seekers) {
            const lt = win ? childTime(win, t, x.duration()) : t;
            x.totalTime(0, true); x.totalTime(lt, false);
          }
        };
        state.current.ext = scope.store.__hfSeek?.length ? (t) => { // ask every hf-seek listener to render time t and wait for the ones that say they are busy
          const waits = []; const detail = { time: t, waitUntil: (p) => { waits.push(Promise.resolve(p)); } };
          for (const cb of scope.store.__hfSeek) { try { cb(new CustomEvent('hf-seek', { detail })); } catch (e) { report('seek', name, e); } }
          return Promise.all(waits).catch((e) => report('seek', name, e));
        } : null;
        await Promise.all([...el.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
        state.current.blurs = rasterBlurShapes(el);
        state.current.rasters = rasterRadials(el);
        state.current.layers = explodeMultiGradients(el);
        await Promise.all([...el.querySelectorAll('img[data-hf-layer]')].map((i) => i.decode().catch(() => {})));
        state.current.videos = collectVideos(el);
        if (state.current.videos.length) await paintVideos(state.current.videos, frame / fps);
        state.current.ready = true;
        const t = frame / fps;
        state.current.seek(t);
        await state.current.ext?.(t);
        applyVisibility(el, t, state.current.wins);
        applyInsetBars(el, state.current.bars || []);
      } catch (e) { report('mount', name, e); }
      finally { if (!cancelled) continueRender(handle.current); }
    })();
    return () => { cancelled = true; observer?.disconnect(); state.current.scope?.dispose(); state.current.tl?.kill?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, expectedSha256, JSON.stringify(project ?? null), JSON.stringify(overrides ?? null)]);

  useLayoutEffect(() => {
    const { ready } = state.current;
    if (!ready) return;
    const t = frame / fps;
    state.current.seek?.(t);
    if (state.current.ext) { const h = delayRender('hf-seek-frame'); state.current.ext(t).finally(() => continueRender(h)); }
    if (state.current.videos?.length) { const h = delayRender('hf-video-frame'); paintVideos(state.current.videos, t).finally(() => continueRender(h)); }
    if (host.current) { applyVisibility(host.current, t, state.current.wins); applyInsetBars(host.current, state.current.bars || []); }
  }, [frame, fps]);

  return <div ref={host} className="hf-host" style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }} />;
}
