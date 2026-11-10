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

window.gsap = gsap;
const indirectEval = eval; // eslint-disable-line no-eval
let cdnMapPromise;
const cdnMap = () => (cdnMapPromise ||= fetch('/blocks/_cdn/map.json').then((r) => r.json()).catch(() => ({})));

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
export const rebaseUrl = (u) => (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(u) || u.split('/').includes('..') ? u : `/blocks/${u.replace(/^\.\//, '')}`);
export const rebaseCssUrls = (css) => css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (_, q, u) => `url(${q}${rebaseUrl(u.trim())}${q})`);
export function rebaseElementUrls(root) {
  for (const el of root.querySelectorAll('[src],[poster],[href],image')) {
    for (const a of ['src', 'poster', 'href', 'xlink:href']) { const v = el.getAttribute(a); if (v && !/^<|\s/.test(v)) { const r = rebaseUrl(v); if (r !== v) el.setAttribute(a, r); } }
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

const report = (kind, name, err) => {
  (window.__hfErrors ||= []).push(`${kind} ${name}: ${err?.message || err}`);
};

async function runScripts(doc, name) {
  const map = await cdnMap();
  for (const s of doc.querySelectorAll('script')) {
    if (s.type && !/javascript|module|^$/.test(s.type)) continue;
    let code;
    let label;
    const src = s.getAttribute('src');
    if (src) {
      if (/gsap@[^/]+\/dist\/gsap(\.min)?\.js/.test(src)) continue; // bundled
      label = src;
      const url = /^https?:/.test(src) ? (map[src] ? `/blocks/${map[src]}` : src) : `/blocks/${src}`;
      try { code = await (await fetch(url)).text(); } catch (e) { report('fetch', src, e); continue; }
    } else { code = s.textContent; label = `${name}#inline`; }
    try { indirectEval(`${code}\n//# sourceURL=hf-block/${label}`); } catch (e) { report('script', label, e); }
  }
}

function withLoadShims(fn) {
  const origDoc = document.addEventListener, origWin = window.addEventListener;
  const fire = (cb) => queueMicrotask(() => { try { typeof cb === 'function' ? cb(new Event('load')) : cb?.handleEvent?.(new Event('load')); } catch (e) { report('load-handler', '', e); } });
  document.addEventListener = function (t, cb, o) { if (t === 'DOMContentLoaded') return fire(cb); if (t === 'readystatechange') return fire(cb); return origDoc.call(this, t, cb, o); };
  window.addEventListener = function (t, cb, o) { if (t === 'load') return fire(cb); return origWin.call(this, t, cb, o); };
  return fn().finally(() => { document.addEventListener = origDoc; window.addEventListener = origWin; });
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

export function BlockClip({ name, width, height }) {
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
    const iid = Math.random().toString(36).slice(2, 6); const ev = (m) => (window.__hfEv ||= []).push(`${iid} ${Math.round(performance.now())} ${m} conn=${el.isConnected}`);
    const el = host.current;
    (window.__hfDebug ||= {})[name + ':sync'] = { connected: el.isConnected, w: el.offsetWidth, rootNode: el.getRootNode()?.nodeName, parent: el.parentElement?.tagName, chain: (() => { let n = el, c = []; while (n && c.length < 6) { c.push(n.tagName + (n.id ? '#' + n.id : '')); n = n.parentElement; } return c.join('<'); })() };
    ev('effect-start');
    (async () => {
      try {
        const html = await (await fetch(`/blocks/${name}.html`)).text();
        ev('fetched cancelled=' + cancelled);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        (window.__hfDebug ||= {})[name] = { connected: el.isConnected, root: el.getRootNode()?.nodeName };
        const css = [...doc.querySelectorAll('style')].map((s) => rebaseCssUrls(scopeCss(s.textContent))).join('\n');
        state.current.bars = extractInsetBars(css);
        el.innerHTML = `<style>.hf-hidden{visibility:hidden!important}${css}</style>`;
        for (const l of doc.querySelectorAll('link[rel=stylesheet]')) el.appendChild(l.cloneNode());
        for (const n of doc.body.childNodes) if (n.nodeName !== 'SCRIPT') el.appendChild(document.importNode(n, true));
        rebaseElementUrls(el);
        convertVideos(el);
        // Script-built nodes (innerHTML from block scripts) get the same relative-URL rebasing.
        const rebaseNode = (n) => { if (n.nodeType !== 1) return; for (const a of ['src', 'poster', 'href']) { const v = n.getAttribute(a); if (v && !/^<|\s/.test(v)) { const r = rebaseUrl(v); if (r !== v) n.setAttribute(a, r); } } rebaseElementUrls(n); };
        observer = new MutationObserver((muts) => { for (const m of muts) { if (m.type === 'attributes') rebaseNode(m.target); else for (const n of m.addedNodes) rebaseNode(n); } });
        observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'poster', 'href'] });
        const root = el.querySelector('[data-composition-id]');
        const id = root?.getAttribute('data-composition-id');
        (window.__timelines ||= {});
        if (id) delete window.__timelines[id];
        await withLoadShims(() => runScripts(doc, name));
        let tl = null;
        for (let i = 0; i < 120 && !cancelled; i++) {
          tl = (id && window.__timelines[id]) || null;
          if (tl) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        if (!tl) report('timeline', name, 'no window.__timelines entry' + (root?.hasAttribute('data-no-timeline') ? ' (data-no-timeline block)' : ''));
        else {
          tl.pause(); state.current.tl = tl;
          const st = await settleTimeline(tl);
          if (!st.settled) report('timeline', name, `timeline did not settle (duration ${st.duration})`);
        }
        (window.__hfInfo ||= {})[name] = { id, hasTl: !!tl, dur: tl && tl.duration(), kids: tl && tl.getChildren().length, hostW: el.offsetWidth, hostH: el.offsetHeight, rootW: root && root.offsetWidth, rootH: root && root.offsetHeight, rootDisplay: root && getComputedStyle(root).display };
        await Promise.all([...el.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
        state.current.rasters = rasterRadials(el);
        state.current.layers = explodeMultiGradients(el);
        await Promise.all([...el.querySelectorAll('img[data-hf-layer]')].map((i) => i.decode().catch(() => {})));
        state.current.videos = collectVideos(el);
        Object.assign((window.__hfInfo ||= {})[name] ||= {}, { rasters: state.current.rasters, layersSplit: state.current.layers, videos: state.current.videos.length });
        if (state.current.videos.length) await paintVideos(state.current.videos, frame / fps);
        (window.__hfInfo[name] ||= {}).vdbg = state.current.videos.map((v) => ({ w: v.el.offsetWidth, h: v.el.offsetHeight, rs: v.ghost.readyState, vw: v.ghost.videoWidth, ct: v.ghost.currentTime, bg: (v.el.style.backgroundImage || '').slice(0, 30), src: (v.el.getAttribute('src') || '').slice(0, 40), start: v.start, dur: v.dur }));
        state.current.ready = true;
        // initial seek for the frame already requested
        const t = frame / fps;
        if (tl) { tl.totalTime(0, true); tl.totalTime(t, false); }
        applyClipVisibility(el, t);
        applyInsetBars(el, state.current.bars || []);
      } catch (e) { report('mount', name, e); }
      finally { if (!cancelled) continueRender(handle.current); }
    })();
    return () => { ev('cleanup'); cancelled = true; observer?.disconnect(); state.current.tl?.kill?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useLayoutEffect(() => {
    const { tl, ready } = state.current;
    if (!ready) return;
    const t = frame / fps;
    if (tl) { tl.totalTime(0, true); tl.totalTime(t, false); }
    if (state.current.videos?.length) { const h = delayRender('hf-video-frame'); paintVideos(state.current.videos, t).finally(() => continueRender(h)); }
    if (host.current) { applyClipVisibility(host.current, t); applyInsetBars(host.current, state.current.bars || []); (window.__hfDebug ||= {})[name + ':seek'] = { connected: host.current.isConnected, w: host.current.offsetWidth }; }
  }, [frame, fps]);

  return <div ref={host} className="hf-host" style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }} />;
}
