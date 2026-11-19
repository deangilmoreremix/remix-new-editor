// Media Hub — hosts the vendored upstream VidBee web app (apps/vidbee) in an iframe.
// Like BrandStudioIframe this is a shell: all download / queue / RSS / transcription UI is upstream's.
// Access: the backend gate (backend/services/vidbeeProxy.js) issues a short-lived cookie after auth + allowlist.
import { mountStudioChrome } from '../lib/studioChrome.js';

const backendBase = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  // eslint-disable-next-line no-underscore-dangle
  if (typeof window !== 'undefined' && window.__BACKEND_URL__) return window.__BACKEND_URL__.replace(/\/$/, '');
  return '';
};

async function accessToken() {
  try {
    const { getSupabaseAccessToken } = await import('../lib/supabase.js');
    return await getSupabaseAccessToken();
  } catch {
    return null;
  }
}

export function MediaHubPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'media-hub' });

  const note = document.createElement('div');
  note.className = 'flex-1 flex items-center justify-center text-center p-8 text-sm';
  note.style.color = '#a1a1aa';
  note.textContent = 'Starting Media Hub…';
  container.appendChild(note);

  (async () => {
    const base = backendBase();
    try {
      const token = await accessToken();
      if (!token) throw new Error('Sign in to use Media Hub.');
      const res = await fetch(`${base}/api/vidbee/session`, { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Media Hub unavailable (${res.status})`);
      // Light / dark / system, remembered per browser; the iframe applies it through upstream's own theme setting (see host/web-shim.js).
      let theme = 'dark';
      try { const saved = localStorage.getItem('media-hub-theme'); if (['light', 'dark', 'system'].includes(saved)) theme = saved; } catch { /* storage unavailable */ }
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;padding:6px 12px;border-bottom:1px solid rgba(255,255,255,.08);';
      const iframe = document.createElement('iframe');
      const paint = () => bar.querySelectorAll('button').forEach((b) => {
        const on = b.dataset.theme === theme;
        b.style.cssText = `font:600 11px system-ui;padding:3px 10px;border-radius:999px;background:transparent;cursor:pointer;color:${on ? '#d9ff00' : '#a1a1aa'};border:1px solid ${on ? 'rgba(217,255,0,.5)' : 'rgba(255,255,255,.12)'};`;
      });
      ['light', 'dark', 'system'].forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.theme = t; b.textContent = t[0].toUpperCase() + t.slice(1);
        b.addEventListener('click', () => {
          theme = t; paint();
          try { localStorage.setItem('media-hub-theme', t); } catch { /* ignore */ }
          iframe.contentWindow?.postMessage({ type: 'vidbee-theme', theme: t }, window.location.origin);
        });
        bar.appendChild(b);
      });
      paint();
      iframe.src = `${base}/vidbee/?theme=${theme}`;
      iframe.title = 'Media Hub';
      iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;background:#050505;';
      iframe.setAttribute('allow', 'clipboard-write; fullscreen');
      note.replaceWith(bar, iframe);
    } catch (e) {
      note.textContent = e.message;
      note.style.color = '#ef4444';
    }
  })();

  return container;
}

export default MediaHubPage;
