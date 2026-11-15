// Runs INSIDE the sandboxed iframe: renderer + block DOM + block scripts share this one frame (so capture works).
// Protocol (postMessage): { id, type:'render'|'probe', ... } -> { id, ok, ... }
import './sandbox-shims.js';
import React from 'react';
import { renderStillOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';
import { BlockClip, isSandboxed, scriptsAllowed } from './BlockClip.jsx';

const parentWin = window.parent;
const b64 = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); };
const comp = (name, width, height, seconds, fps = 30) => ({ id: 'sbx-' + name, component: () => <BlockClip name={name} width={width} height={height} />, width, height, fps, durationInFrames: Math.max(2, Math.round(seconds * fps)) });

// Things a hostile block script might try. Each returns a short outcome string; none may succeed.
async function escapeProbes() {
  const out = {};
  const t = async (k, fn) => { try { out[k] = await fn(); } catch (e) { out[k] = 'blocked: ' + String(e.name || e).slice(0, 40); } };
  await t('parent.document', () => String(parentWin.document.title));
  await t('parent.location', () => String(parentWin.location.href));
  await t('document.cookie', () => (document.cookie === '' ? 'empty/inert' : 'READ: ' + document.cookie));
  await t('localStorage', () => String(window.localStorage.length));
  await t('fetch external', async () => { const r = await fetch('https://example.com/', { mode: 'no-cors' }); return 'FETCHED ' + r.type; });
  await t('fetch same-origin app api', async () => { const r = await fetch('/api/anything'); return 'status ' + r.status + ' (readable)'; });
  await t('window.open', () => { const w = window.open('https://example.com'); return w ? 'OPENED' : 'blocked (null)'; });
  await t('top navigation', () => { window.top.location.href = 'https://example.com'; return 'NAVIGATED'; });
  await t('inject remote script', () => new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://example.com/x.js'; s.onload = () => res('LOADED'); s.onerror = () => rej(new Error('CSP/network blocked')); document.head.appendChild(s); setTimeout(() => rej(new Error('no load')), 2500); }));
  await t('inline handler injection', () => new Promise((res) => { window.__pwn = 0; const d = document.createElement('div'); d.innerHTML = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="window.__pwn=1">'; document.body.appendChild(d); setTimeout(() => res(window.__pwn === 1 ? 'EXECUTED (CSP allows inline attr?)' : 'not executed'), 300); }));
  return out;
}

window.addEventListener('message', async (e) => {
  if (e.source !== parentWin) return;
  const m = e.data || {}; const reply = (x) => parentWin.postMessage({ id: m.id, ...x }, '*');
  try {
    if (m.type === 'probe') return reply({ ok: true, origin: window.origin, sandboxed: isSandboxed(), scriptsAllowed: scriptsAllowed(), escape: await escapeProbes() });
    if (m.type === 'render') {
      window.__hfErrors = []; const c = comp(m.name, m.width, m.height, m.duration); const frames = [];
      for (const tt of m.times) { const r = await renderStillOnWeb({ composition: c, inputProps: {}, frame: Math.round(tt * 30), scale: m.scale || 0.5, delayRenderTimeoutInMilliseconds: 60000 }); frames.push({ t: tt, png: await b64(await r.blob({ format: 'png' })) }); }
      return reply({ ok: true, origin: window.origin, frames, errors: [...new Set(window.__hfErrors)].slice(0, 6) });
    }
    if (m.type === 'export') {
      window.__hfErrors = []; const c = comp(m.name, m.width, m.height, m.duration); const t0 = performance.now();
      const res = await renderMediaOnWeb({ composition: c, inputProps: {}, container: 'mp4', scale: m.scale || 1, hardwareAcceleration: 'prefer-software', logLevel: 'error', delayRenderTimeoutInMilliseconds: 60000 });
      const blob = await res.getBlob(); return reply({ ok: true, origin: window.origin, ms: Math.round(performance.now() - t0), bytes: blob.size, b64: await b64(blob), errors: [...new Set(window.__hfErrors)].slice(0, 6) });
    }
  } catch (err) { reply({ ok: false, error: String(err && err.message || err).slice(0, 300) }); }
});
parentWin.postMessage({ type: 'ready' }, '*');
