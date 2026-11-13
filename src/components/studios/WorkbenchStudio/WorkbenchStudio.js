// SmartVid Workbench studio (replaces CineGen Studio).
//
// Hosts the Motion Workbench port (apps/shotcraft/workbench, built to
// public/workbench-app/ by `npm run build:workbench`) in a same-origin iframe and
// talks to it over postMessage (protocol in apps/shotcraft/workbench/src/host/bridge.ts):
//   → sv:auth           Clerk session token + the user's own OpenAI key (BYOK) for AI chat
//   → sv:import-assets  generations handed off by "Edit in Workbench" / the picker
//   ← sv:ready
//   ← sv:exported       in-browser rendered MP4 → uploaded and saved to the library
//   ← sv:upload         user's own file → uploaded to storage → sv:uploaded / sv:upload-failed
import { mountStudioChrome } from '../../../lib/studioChrome.js';
import { createEditorBanner } from '../../../lib/thumbnails.js';
import { apiKeyManager } from '../../../lib/apiKeyManager.js';
import { WORKBENCH_APP_PATH, consumeWorkbenchHandoff, isWorkbenchEligible, toWorkbenchAsset } from '../../../lib/workbench.js';
import { loadGenerationHistory, saveGeneration } from '../../../lib/generationHistory.js';
import { uploadFileToSupabase } from '../../../lib/uploadService.js';

// BYOK: the user's own OpenAI key (API key modal) is re-sent on this timer and when the
// window regains focus, so a key added or changed in Settings reaches the editor quickly.
const TOKEN_REFRESH_MS = 15_000;

function getUserOpenAIKey() {
  try { return apiKeyManager.getOpenAIKey() || null; } catch { return null; }
}

async function getClerkToken() {
  try {
    const session = window.Clerk?.session;
    return session && typeof session.getToken === 'function' ? (await session.getToken()) || null : null;
  } catch {
    return null;
  }
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

export function WorkbenchStudio() {
  const container = el('div', 'w-full flex flex-col overflow-hidden bg-app-bg');
  // The app shell grows to the sidebar's height, so h-full would make the editor
  // thousands of px tall. Pin it to the viewport below the header instead.
  const fit = () => {
    const header = document.querySelector('#app > header, header');
    const top = header ? Math.round(header.getBoundingClientRect().height) : 56;
    container.style.height = `calc(100dvh - ${top}px)`;
    container.style.position = 'sticky';
    container.style.top = `${top}px`;
  };
  fit();
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
  const { topbar } = mountStudioChrome(container, { currentRoute: 'workbench', title: 'Workbench' });
  // The banner carries the page title, so the bar below it only holds status and actions.
  topbar.querySelector('.studio-topbar__title')?.remove();
  container.insertBefore(createEditorBanner('workbench', 'Workbench', 'Edit your generations with motion cards, sound and AI chat'), container.firstChild);

  const status = el('span', 'text-xs text-secondary mr-3');
  status.setAttribute('aria-live', 'polite');
  const addBtn = el('button', 'btn-personalize', '+ Add your generations');
  addBtn.type = 'button';
  topbar.append(status, addBtn);

  const body = el('div', 'relative flex-1 min-h-0');
  container.appendChild(body);

  const iframe = document.createElement('iframe');
  iframe.src = WORKBENCH_APP_PATH;
  iframe.title = 'SmartVid Workbench';
  iframe.className = 'absolute inset-0 w-full h-full border-0 bg-black';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
  body.appendChild(iframe);

  let ready = false;
  let pending = consumeWorkbenchHandoff();
  let tokenTimer = null;
  let disposed = false;

  const post = (msg) => {
    if (ready && iframe.contentWindow) iframe.contentWindow.postMessage(msg, window.location.origin);
  };
  const sendToken = async () => post({ type: 'sv:auth', token: await getClerkToken(), openaiKey: getUserOpenAIKey() });
  const sendAssets = (assets, mode = 'append', name = null) => {
    if (!assets.length) return;
    if (!ready) { pending = { assets, mode, name }; return; }
    post({ type: 'sv:import-assets', assets, mode, name });
  };

  const setStatus = (text) => { status.textContent = text || ''; };

  async function saveExport(blob, name) {
    setStatus('Saving export to your library…');
    try {
      const file = new File([blob], name || 'workbench.mp4', { type: 'video/mp4' });
      const { url } = await uploadFileToSupabase(file, { category: 'video' });
      saveGeneration({ studio: 'workbench', type: 'video', url, prompt: name || 'Workbench export' });
      setStatus('Export saved to your library');
    } catch (e) {
      setStatus(`Export downloaded — couldn't save to library (${e?.message || 'upload failed'})`);
    }
  }

  // The user's own files (Upload button / drag from desktop): store them so the clip
  // keeps working after a reload, then hand the permanent URL back to the Workbench.
  async function uploadUserFile(id, blob, kind) {
    const category = ['video', 'image', 'audio'].includes(kind) ? kind : undefined;
    const file = blob instanceof File ? blob : new File([blob], `upload-${Date.now()}`, { type: blob.type });
    setStatus(`Uploading ${file.name}…`);
    try {
      const userId = window.Clerk?.user?.id;
      const { url } = await uploadFileToSupabase(file, { category, ...(userId ? { userId } : {}) });
      post({ type: 'sv:uploaded', id, url });
      setStatus(`${file.name} saved`);
    } catch (e) {
      post({ type: 'sv:upload-failed', id, error: e?.message || 'upload failed' });
      setStatus(`Couldn't save ${file.name} — ${e?.message || 'upload failed'}`);
    }
  }

  const onMessage = (e) => {
    if (e.origin !== window.location.origin || e.source !== iframe.contentWindow) return;
    const d = e.data;
    if (!d || typeof d.type !== 'string') return;
    if (d.type === 'sv:ready') {
      ready = true;
      sendToken();
      clearInterval(tokenTimer);
      tokenTimer = setInterval(sendToken, TOKEN_REFRESH_MS);
      window.addEventListener('focus', sendToken);
      if (pending) {
        const p = pending;
        pending = null;
        sendAssets(p.assets, p.mode || 'new', p.name);
      }
    } else if (d.type === 'sv:upload' && typeof d.id === 'string' && d.file instanceof Blob) {
      uploadUserFile(d.id, d.file, d.kind);
    } else if (d.type === 'sv:exported' && d.blob instanceof Blob) {
      saveExport(d.blob, typeof d.name === 'string' ? d.name : 'workbench.mp4');
    }
  };
  window.addEventListener('message', onMessage);

  // If the embedded build is missing (e.g. local dev without `npm run build:workbench`).
  iframe.addEventListener('load', () => {
    setTimeout(() => {
      if (!ready && !disposed) setStatus('Workbench is still loading… (dev: run `npm run build:workbench`)');
    }, 8000);
  });

  // —— "Add your generations" picker ——
  addBtn.onclick = async () => {
    const overlay = el('div', 'fixed inset-0 z-[130] bg-black/70 flex items-center justify-center p-4');
    const panel = el('div', 'w-full max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-panel-bg');
    const head = el('div', 'flex items-center justify-between p-4 border-b border-white/10');
    head.append(el('div', 'text-white font-bold', 'Add your generations'));
    const close = el('button', 'text-secondary hover:text-white text-sm', 'Close');
    close.type = 'button';
    head.append(close);
    const grid = el('div', 'p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto');
    grid.append(el('div', 'col-span-full text-secondary text-sm', 'Loading…'));
    const foot = el('div', 'flex items-center justify-end gap-2 p-4 border-t border-white/10');
    const addSel = el('button', 'btn-primary-modern px-4 py-2 text-sm', 'Add to timeline');
    addSel.type = 'button';
    addSel.disabled = true;
    foot.append(addSel);
    panel.append(head, grid, foot);
    overlay.append(panel);
    document.body.append(overlay);
    const shut = () => overlay.remove();
    close.onclick = shut;
    overlay.onclick = (ev) => { if (ev.target === overlay) shut(); };

    const selected = new Map();
    let items = [];
    try {
      items = (await loadGenerationHistory()).filter((h) => h?.url && isWorkbenchEligible(h.studio));
    } catch { items = []; }
    grid.innerHTML = '';
    if (!items.length) {
      grid.append(el('div', 'col-span-full text-secondary text-sm', 'No generations yet. Create something in any AI studio (Image, Video, Cinema, Audio…) first.'));
      return;
    }
    items.slice(0, 120).forEach((h) => {
      const cell = el('button', 'relative aspect-video rounded-xl overflow-hidden border-2 border-transparent bg-black');
      cell.type = 'button';
      cell.title = h.prompt || h.studio || '';
      let thumb;
      if (h.type === 'audio') {
        // Audio has no picture: show a music tile with its title.
        thumb = el('div', 'w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#1b1530] to-[#0d1b2a] text-white/80 p-2');
        thumb.append(el('span', 'text-2xl', '♪'), el('span', 'text-[10px] leading-tight line-clamp-2 text-center', h.prompt || h.name || 'Audio'));
      } else if (h.type === 'video') {
        thumb = el('video', 'w-full h-full object-cover');
        thumb.src = h.url; thumb.muted = true; thumb.preload = 'metadata';
      } else {
        thumb = el('img', 'w-full h-full object-cover');
        thumb.src = h.thumbnail_url || h.url; thumb.alt = h.prompt || 'Generation';
      }
      const badge = el('span', 'absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white', (h.type || 'image').toUpperCase());
      cell.append(thumb, badge);
      cell.onclick = () => {
        if (selected.has(h.url)) { selected.delete(h.url); cell.classList.remove('border-primary'); }
        else { selected.set(h.url, h); cell.classList.add('border-primary'); }
        addSel.disabled = selected.size === 0;
        addSel.textContent = selected.size ? `Add ${selected.size} to timeline` : 'Add to timeline';
      };
      grid.append(cell);
    });
    addSel.onclick = () => {
      sendAssets([...selected.values()].map(toWorkbenchAsset).filter(Boolean), 'append');
      shut();
    };
  };

  container.cleanup = () => {
    disposed = true;
    clearInterval(tokenTimer);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('resize', fit);
    window.removeEventListener('focus', sendToken);
  };
  return container;
}

export default WorkbenchStudio;
