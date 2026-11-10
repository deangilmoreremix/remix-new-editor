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
        const css = [...doc.querySelectorAll('style')].map((s) => scopeCss(s.textContent)).join('\n');
        el.innerHTML = `<style>.hf-hidden{visibility:hidden!important}${css}</style>`;
        for (const l of doc.querySelectorAll('link[rel=stylesheet]')) el.appendChild(l.cloneNode());
        for (const n of doc.body.childNodes) if (n.nodeName !== 'SCRIPT') el.appendChild(document.importNode(n, true));
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
        else { tl.pause(); state.current.tl = tl; }
        state.current.ready = true;
        // initial seek for the frame already requested
        const t = frame / fps;
        if (tl) { tl.totalTime(0, true); tl.totalTime(t, false); }
        applyClipVisibility(el, t);
      } catch (e) { report('mount', name, e); }
      finally { if (!cancelled) continueRender(handle.current); }
    })();
    return () => { ev('cleanup'); cancelled = true; state.current.tl?.kill?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useLayoutEffect(() => {
    const { tl, ready } = state.current;
    if (!ready) return;
    const t = frame / fps;
    if (tl) { tl.totalTime(0, true); tl.totalTime(t, false); }
    if (host.current) { applyClipVisibility(host.current, t); (window.__hfDebug ||= {})[name + ':seek'] = { connected: host.current.isConnected, w: host.current.offsetWidth }; }
  }, [frame, fps]);

  return <div ref={host} className="hf-host" style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }} />;
}
