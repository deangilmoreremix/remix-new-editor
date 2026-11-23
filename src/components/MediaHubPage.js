// SmartVidDownloader (formerly Media Hub) — hosts the vendored upstream VidBee web app (apps/vidbee) in an iframe.
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

// The frame learns our origin from ?parent= so its reconnect message is sent only to us, never to '*'.
const frameUrl = (url) => {
  const u = new URL(url, window.location.href);
  u.searchParams.set('parent', window.location.origin);
  return u.toString();
};

export function MediaHubPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'media-hub' });

  const note = document.createElement('div');
  note.className = 'flex-1 flex items-center justify-center text-center p-8 text-sm';
  note.style.color = '#a1a1aa';
  note.textContent = 'Starting SmartVidDownloader…';
  container.appendChild(note);

  const base = backendBase();
  let iframe = null;
  // Dev only: VITE_VIDBEE_DEV_URL (e.g. http://127.0.0.1:3300/) embeds a local VidBee server directly, skipping the gate.
  // Also requires the app itself to be on localhost, so a dev build that ends up deployed never bypasses the gate.
  const onLocalhost = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
  const devUrl = import.meta.env.DEV && onLocalhost ? import.meta.env.VITE_VIDBEE_DEV_URL : '';

  const showError = (message) => {
    if (iframe) { iframe.replaceWith(note); iframe = null; }
    note.replaceChildren();
    note.style.color = '#ef4444';
    const box = document.createElement('div');
    box.className = 'flex flex-col items-center gap-3';
    const text = document.createElement('div');
    text.textContent = message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.className = 'px-4 py-2 rounded-xl text-sm font-bold';
    retry.style.cssText = 'background:#d9ff00;color:#000;border:0;cursor:pointer;';
    retry.onclick = () => start();
    box.append(text, retry);
    note.appendChild(box);
  };

  // One session request at a time: the gate page's Reconnect button, the embedded app's reconnect message and Retry can
  // all fire together; later calls share the running one instead of racing it (and creating duplicate iframes).
  let inFlight = null;
  const run = async () => {
    try {
      if (devUrl) {
        if (iframe) { iframe.src = frameUrl(devUrl); return; }
        iframe = document.createElement('iframe');
        iframe.src = frameUrl(devUrl);
        iframe.title = 'SmartVidDownloader';
        iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;';
        note.replaceWith(iframe);
        return;
      }
      if (!iframe) {
        note.style.color = '#a1a1aa';
        note.textContent = 'Starting SmartVidDownloader…';
      }
      const token = await accessToken();
      if (!token) throw new Error('Sign in to use SmartVidDownloader.');
      const res = await fetch(`${base}/api/vidbee/session`, { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `SmartVidDownloader unavailable (${res.status})`);
      if (iframe) { iframe.src = frameUrl(`${base}/vidbee/?brand=remix`); return; }
      // Light / Dark / System is switched inside VidBee itself (title-bar button, or Settings → Theme).
      iframe = document.createElement('iframe');
      iframe.src = frameUrl(`${base}/vidbee/?brand=remix`);
      iframe.title = 'SmartVidDownloader';
      iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;';
      iframe.setAttribute('allow', 'clipboard-write; fullscreen');
      note.replaceWith(iframe);
    } catch (e) {
      showError(e.message);
    }
  };
  const start = () => {
    if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  };
  start();

  // The gate's error page (expired 8-hour session, service down) has a Reconnect button that posts this message; the embedded
  // app posts it too when an API call gets the gate's 401/502 (X-SmartVid-Reconnect, see apps/vidbee/brand/rebrand.mjs).
  const onMessage = (e) => {
    if (iframe && e.source === iframe.contentWindow && e.data?.type === 'smartviddownloader:reconnect') start();
  };
  window.addEventListener('message', onMessage);
  container.cleanup = () => window.removeEventListener('message', onMessage);

  return container;
}

export default MediaHubPage;
