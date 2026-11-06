/**
 * Video Studio after-generation tools for the template studios.
 *
 * Template Studio and Cinema Template Studio get the same result features
 * as the Video Studio:
 *   - History strip (saved per studio, click to view, download / delete)
 *   - Frame scrubber under the result video
 *   - Regenerate
 *   - Extend (Seedance 2.0 generations → seedance-v2.0-extend with the
 *     original request id, optional continuation prompt and duration)
 *
 * Existing result actions in the studios (Download, Publish to Social,
 * Open in new tab, AI Captions) are kept; these are added next to them.
 */

/** Models whose generations can be extended (same as the Video Studio). */
export const EXTENDABLE_MODELS = new Set(['seedance-v2.0-t2v', 'seedance-v2.0-i2v']);
export const EXTEND_MODEL_ID = 'seedance-v2.0-extend';
export const EXTEND_DURATIONS = [5, 10, 15];
const MAX_HISTORY = 100;

export function canExtend(entry) {
  return !!(entry && entry.id && entry.type !== 'image' && EXTENDABLE_MODELS.has(entry.model));
}

/** Params for muapi.generateVideo to extend a Seedance 2.0 generation. */
export function buildExtendParams(entry, { prompt = '', duration = 5 } = {}) {
  const params = { model: EXTEND_MODEL_ID, request_id: entry.id, duration: Number(duration) || 5 };
  const p = String(prompt || '').trim();
  if (p) params.prompt = p;
  return params;
}

/** Download a result (blob first, new tab as fallback) — same as the Video Studio. */
export async function downloadMedia(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank');
  }
}

/** "Frame" scrubber bound to a result video. */
export function createFrameScrubber(video) {
  const row = document.createElement('div');
  row.className = 'template-frame-scrubber mt-3 flex w-full items-center gap-3';
  row.innerHTML = `
    <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap">Frame</span>
    <input type="range" min="0" max="100" step="0.1" value="0" aria-label="Video frame scrubber" class="flex-1 accent-primary cursor-pointer" />
    <span data-time class="w-16 text-right font-mono text-[10px] text-zinc-500">0:00</span>
  `;
  const input = row.querySelector('input');
  const time = row.querySelector('[data-time]');
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const sync = () => {
    if (!video.duration) return;
    input.value = String((video.currentTime / video.duration) * 100);
    time.textContent = fmt(video.currentTime);
  };
  video.addEventListener('timeupdate', sync);
  video.addEventListener('loadedmetadata', () => { input.value = '0'; time.textContent = '0:00'; });
  input.addEventListener('input', () => {
    if (!video.duration) return;
    video.currentTime = (parseFloat(input.value) / 100) * video.duration;
    time.textContent = fmt(video.currentTime);
  });
  return row;
}

/**
 * History strip of past generations (persisted in localStorage).
 * @param {Object} opts
 * @param {string} opts.storageKey
 * @param {(entry: object) => void} opts.onSelect
 * @param {string} [opts.title='History']
 */
export function createResultHistory({ storageKey, onSelect, title = 'History' } = {}) {
  let entries = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) entries = saved.filter(e => e && e.url).slice(0, MAX_HISTORY);
  } catch { /* storage unavailable */ }
  let activeUrl = null;

  const el = document.createElement('div');
  el.className = 'template-result-history mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4';
  el.dataset.resultHistory = '';
  el.innerHTML = `<div class="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">${title}</div><div data-list class="flex gap-2 overflow-x-auto pb-1"></div>`;
  const list = el.querySelector('[data-list]');

  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch { /* full / disabled */ }
  };

  function render() {
    el.classList.toggle('hidden', entries.length === 0);
    list.innerHTML = '';
    entries.forEach((entry) => {
      const isActive = entry.url === activeUrl;
      const thumb = document.createElement('div');
      thumb.className = `group/thumb relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition ${isActive ? 'border-primary shadow-glow' : 'border-white/10 hover:border-white/30'}`;
      thumb.dataset.historyUrl = entry.url;
      thumb.title = entry.prompt ? String(entry.prompt).slice(0, 120) : 'Generation';
      let media;
      if (entry.type === 'image') {
        media = document.createElement('img');
        media.src = entry.url;
        media.alt = 'Previous generation';
        media.className = 'h-full w-full object-cover';
      } else {
        // src set as a DOM property (never parsed as HTML).
        media = document.createElement('video');
        media.src = entry.url;
        media.className = 'h-full w-full object-cover';
        media.preload = 'metadata';
        media.muted = true;
        media.playsInline = true;
      }
      thumb.appendChild(media);

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover/thumb:opacity-100';
      const dl = document.createElement('button');
      dl.type = 'button';
      dl.title = 'Download';
      dl.dataset.action = 'download';
      dl.className = 'rounded-lg bg-primary/10 border border-primary/30 p-1.5 text-white';
      dl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
      dl.onclick = (e) => {
        e.stopPropagation();
        downloadMedia(entry.url, `${entry.templateId || 'template'}-${entry.id || Date.now()}.${entry.type === 'image' ? 'png' : 'mp4'}`);
      };
      const del = document.createElement('button');
      del.type = 'button';
      del.title = 'Delete';
      del.dataset.action = 'delete';
      del.className = 'rounded-lg bg-red-500/80 p-1.5 text-white';
      del.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
      del.onclick = async (e) => {
        e.stopPropagation();
        try {
          const { confirmDeleteGeneration } = await import('./generationHistory.js');
          if (!confirmDeleteGeneration(entry.url, entry.type === 'image' ? 'image' : 'video')) return;
        } catch {
          if (!window.confirm('Delete this generation?')) return;
        }
        entries = entries.filter(x => x !== entry);
        persist();
        render();
      };
      overlay.appendChild(dl);
      overlay.appendChild(del);
      thumb.appendChild(overlay);

      thumb.onclick = () => {
        activeUrl = entry.url;
        render();
        onSelect?.(entry);
      };
      list.appendChild(thumb);
    });
  }

  render();
  return {
    element: el,
    add(entry) {
      if (!entry || !entry.url) return;
      entries = [{ ...entry, timestamp: entry.timestamp || new Date().toISOString() }, ...entries.filter(x => x.url !== entry.url)].slice(0, MAX_HISTORY);
      activeUrl = entry.url;
      persist();
      render();
    },
    setActive(url) { activeUrl = url; render(); },
    find(url) { return entries.find(x => x.url === url) || null; },
    entries: () => entries.slice(),
  };
}

/**
 * Regenerate + Extend actions (with the Extend form) for the current result.
 * @param {Object} opts
 * @param {() => void} opts.onRegenerate
 * @param {(entry: object, opts: {prompt: string, duration: number}) => Promise<void>} opts.onExtend
 */
export function createResultActions({ onRegenerate, onExtend } = {}) {
  let current = null;
  const el = document.createElement('div');
  el.className = 'template-result-actions mt-4 flex flex-col gap-3';
  el.innerHTML = `
    <div class="flex flex-wrap gap-3">
      <button type="button" data-action="regenerate" class="rounded-2xl border border-white/10 bg-white/10 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-white/20">↻ Regenerate</button>
      <button type="button" data-action="extend" title="Extend this video using Seedance 2.0 Extend" class="hidden rounded-2xl border border-primary/30 bg-white/10 px-5 py-2.5 text-xs font-bold text-primary transition hover:bg-white/20">↗ Extend</button>
    </div>
    <div data-extend-form class="hidden flex flex-col gap-3 rounded-[20px] border border-primary/20 bg-black/40 p-4">
      <div class="text-sm font-semibold text-white">Extend this video</div>
      <textarea rows="2" name="extend-prompt" placeholder="Optional: describe how to continue the video..." class="w-full resize-none rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"></textarea>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Duration
          <select name="extend-duration" class="h-9 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white outline-none">
            ${EXTEND_DURATIONS.map(d => `<option value="${d}">${d}s</option>`).join('')}
          </select>
        </label>
        <button type="button" data-action="extend-run" class="ml-auto rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-black transition hover:opacity-90">Extend ✨</button>
      </div>
      <div data-extend-status class="text-xs text-zinc-400"></div>
    </div>
  `;
  const regenBtn = el.querySelector('[data-action="regenerate"]');
  const extendBtn = el.querySelector('[data-action="extend"]');
  const form = el.querySelector('[data-extend-form]');
  const runBtn = el.querySelector('[data-action="extend-run"]');
  const status = el.querySelector('[data-extend-status]');

  regenBtn.onclick = (e) => { e.stopPropagation(); onRegenerate?.(); };
  extendBtn.onclick = (e) => { e.stopPropagation(); form.classList.toggle('hidden'); };
  runBtn.onclick = async (e) => {
    e.stopPropagation();
    if (!current || !canExtend(current)) return;
    runBtn.disabled = true;
    status.textContent = 'Extending video (this may take a few minutes)...';
    try {
      await onExtend?.(current, {
        prompt: el.querySelector('[name="extend-prompt"]').value,
        duration: Number(el.querySelector('[name="extend-duration"]').value) || 5,
      });
      status.textContent = '';
      form.classList.add('hidden');
    } catch (err) {
      status.textContent = `Extend failed: ${err?.message || err}`;
    } finally {
      runBtn.disabled = false;
    }
  };

  return {
    element: el,
    /** Show the actions for this result (Extend only for Seedance 2.0). */
    setEntry(entry) {
      current = entry || null;
      const extendable = canExtend(current);
      extendBtn.classList.toggle('hidden', !extendable);
      if (!extendable) form.classList.add('hidden');
    },
  };
}

/**
 * Plain-data copy of the settings that produced a result, kept on its history
 * entry so "Regenerate" can re-run exactly that result. History is saved as
 * JSON in localStorage, so functions, the per-run AbortSignal and inline
 * `data:` URLs (e.g. a custom thumbnail) are left out.
 * @param {object} params final request params
 * @returns {object|null}
 */
export function snapshotGenerationParams(params) {
  if (!params || typeof params !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(params, (key, val) => {
      if (key === 'signal' || typeof val === 'function') return undefined;
      if (typeof val === 'string' && val.startsWith('data:')) return undefined;
      return val;
    }));
  } catch {
    return null;
  }
}
