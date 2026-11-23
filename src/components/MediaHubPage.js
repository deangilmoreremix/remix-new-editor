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

export function MediaHubPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'media-hub' });

  const note = document.createElement('div');
  note.className = 'flex-1 flex items-center justify-center text-center p-8 text-sm';
  note.style.color = '#a1a1aa';
  note.textContent = 'Starting SmartVidDownloader…';
  container.appendChild(note);

  (async () => {
    const base = backendBase();
    try {
      const token = await accessToken();
      if (!token) throw new Error('Sign in to use SmartVidDownloader.');
      const res = await fetch(`${base}/api/vidbee/session`, { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `SmartVidDownloader unavailable (${res.status})`);
      // Light / Dark / System is switched inside VidBee itself (title-bar button, or Settings → Theme).
      const iframe = document.createElement('iframe');
      iframe.src = `${base}/vidbee/`;
      iframe.title = 'SmartVidDownloader';
      iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;';
      iframe.setAttribute('allow', 'clipboard-write; fullscreen');
      note.replaceWith(iframe);
    } catch (e) {
      note.textContent = e.message;
      note.style.color = '#ef4444';
    }
  })();

  return container;
}

export default MediaHubPage;
