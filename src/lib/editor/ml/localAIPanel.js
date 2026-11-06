/**
 * "Free AI" side panel of the Timeline Editor: search footage by
 * description, free voiceover, and the list of on-device models (download
 * ahead of time, see what's cached, clear).
 */
import * as actions from './aiActions.js';
import { LOCAL_MODELS, KOKORO_VOICES } from './modelRegistry.js';
import { isModelCached, clearModel, preloadModel, hasWebGpu } from './mlClient.js';
import { confirmDownloads } from './aiClipPanel.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtT = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

/**
 * @param {HTMLElement} container
 * @param {object} opts { editor (aiActions contract + seek(sec), select(clipId)), confirm?(msg) }
 */
export function renderLocalAIPanel(container, { editor, confirm } = {}) {
  const ui = { query: '', hits: null, busy: '', error: '', voice: KOKORO_VOICES[0][0], speed: 1, script: '', musicPrompt: '', cached: {}, gpu: null, downloading: {}, controller: null };

  const draw = () => {
    container.innerHTML = `
      <div class="bg-panel ai-local-side">
        <p class="addon-field__hint">These run free on your device — no API key, nothing uploaded. Models download once, then load from the browser cache.${ui.gpu === false ? ' <strong>No WebGPU in this browser</strong>, so they run on the CPU (slower).' : ''}</p>
        ${ui.busy ? `<div class="cap-progress" role="status"><span data-lai-status>${esc(ui.busy)}</span> <button type="button" class="mini-btn" data-lai="cancel">Cancel</button></div>` : ''}
        ${ui.error ? `<p class="addon-field__hint" role="alert" style="color:var(--danger,#ff6b6b)">${esc(ui.error)}</p>` : ''}

        <h4 class="addon-panel__heading">Search footage</h4>
        <input type="search" data-lai-query placeholder='e.g. "beach at sunset"' value="${esc(ui.query)}" aria-label="Describe what to find" style="width:100%;box-sizing:border-box;margin-bottom:6px"/>
        <button type="button" class="mini-btn cap-primary" data-lai="search" ${ui.busy ? 'disabled' : ''}>Search</button>
        <p class="addon-field__hint">Searches the video and images in this project. The first search looks at each clip once.</p>
        ${ui.hits ? (ui.hits.length ? `<ol class="ai-hits" style="padding-left:18px;margin:6px 0">${ui.hits.map((h, i) => `
          <li><button type="button" class="mini-btn" data-lai="hit" data-i="${i}" style="text-align:left">${esc(h.name)} · ${h.type === 'image' ? 'image' : fmtT(h.t)}${h.timelineSec != null ? ` → timeline ${fmtT(h.timelineSec)}` : ''} <span class="addon-field__hint">${Math.round(h.score * 100)}</span></button></li>`).join('')}</ol>`
          : '<p class="addon-field__hint">No matches. Try different words.</p>') : ''}

        <h4 class="addon-panel__heading">Free voiceover</h4>
        <textarea data-lai-script rows="3" placeholder="Type the script…" style="width:100%">${esc(ui.script)}</textarea>
        <label class="cap-row"><span>Voice</span><select data-lai-voice>${KOKORO_VOICES.map(([v, l]) => `<option value="${v}" ${v === ui.voice ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="cap-row"><span>Speed</span><input type="range" min="0.6" max="1.6" step="0.05" value="${ui.speed}" data-lai-speed aria-label="Speech speed"/></label>
        <button type="button" class="mini-btn cap-primary" data-lai="voice" ${ui.busy ? 'disabled' : ''}>Add voiceover at playhead</button>

        <h4 class="addon-panel__heading">Music for this video</h4>
        <textarea data-lai-music rows="3" placeholder="Describe the music, or write it from your clips…" style="width:100%">${esc(ui.musicPrompt)}</textarea>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="mini-btn" data-lai="music-prompt" ${ui.busy ? 'disabled' : ''}>Write prompt from clips (free)</button>
          ${editor.addMusic ? `<button type="button" class="mini-btn cap-primary" data-lai="music" ${ui.busy || !ui.musicPrompt.trim() ? 'disabled' : ''}>Generate music (MuAPI, your key)</button>` : ''}
        </div>
        <p class="addon-field__hint">The prompt is written on your device from what the clips show. Music fades and ducks under voiceovers.</p>

        <h4 class="addon-panel__heading">On-device models</h4>
        <ul class="ai-models" style="list-style:none;padding:0;margin:0">
          ${Object.entries(LOCAL_MODELS).map(([key, m]) => `
            <li style="display:flex;gap:6px;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border,rgba(255,255,255,.08))">
              <span><strong>${esc(m.label)}</strong><br><span class="addon-field__hint">${esc(m.feature)} · ~${m.sizeMB} MB · ${esc(m.license)}</span></span>
              <span style="white-space:nowrap">${ui.downloading[key] != null
                ? `<span class="addon-field__hint">${Math.round(ui.downloading[key] * 100)}%</span>`
                : ui.cached[key]
                  ? `<span class="addon-field__hint">✓ cached</span> <button type="button" class="mini-btn" data-lai="clear" data-key="${key}">Clear</button>`
                  : `<button type="button" class="mini-btn" data-lai="download" data-key="${key}">Download</button>`}</span>
            </li>`).join('')}
        </ul>
      </div>`;
  };

  const setBusy = (text) => {
    ui.busy = text;
    const st = container.querySelector('[data-lai-status]');
    if (st && text) st.textContent = text; else draw();
  };

  async function refreshCache() {
    const entries = await Promise.all(Object.keys(LOCAL_MODELS).map(async (k) => [k, await isModelCached(k)]));
    ui.cached = Object.fromEntries(entries);
    if (container.isConnected) draw();
  }

  async function task(label, models, fn) {
    ui.error = '';
    if (!(await confirmDownloads(models, confirm))) return;
    ui.controller = new AbortController();
    setBusy(`${label}…`);
    try {
      await fn({
        signal: ui.controller.signal,
        onProgress: (p) => setBusy(p.stage === 'download' ? `Downloading model… ${Math.round((p.progress || 0) * 100)}%`
          : p.total ? `${label}: ${p.done} of ${p.total}` : `${label}… ${Math.round((p.progress || 0) * 100)}%`),
      });
    } catch (err) {
      if (err?.name !== 'AbortError') { ui.error = err?.message || String(err); editor.toast(`${label} failed: ${ui.error}`, 'error'); }
    } finally {
      ui.busy = '';
      ui.controller = null;
      refreshCache();
    }
  }

  const handlers = {
    search: () => {
      const q = ui.query.trim();
      if (!q) return;
      return task('Searching', ['clip', 'detr'], async (o) => {
        await actions.indexAll(editor, o);
        ui.hits = await actions.searchTimelineMedia(editor, q, o);
      });
    },
    hit: (b) => {
      const h = ui.hits?.[Number(b.dataset.i)];
      if (!h) return;
      if (h.timelineSec != null) editor.seek?.(h.timelineSec);
      if (h.clipId) editor.select?.(h.clipId);
    },
    voice: () => task('Speaking', ['kokoro'], (o) => actions.addFreeVoiceover(editor, { text: ui.script, voice: ui.voice, speed: ui.speed, ...o })),
    'music-prompt': () => task('Watching your clips', ['florence'], async (o) => {
      const clips = editor.allClips().filter((c) => actions.isVisual(c) && editor.mediaSrc(c));
      if (!clips.length) throw new Error('Add video or image clips first');
      ui.musicPrompt = await actions.promptForMusic(editor, clips, o) || ui.musicPrompt;
    }),
    music: () => task('Composing music (1–3 min)', [], () => editor.addMusic(ui.musicPrompt.trim())),
    download: async (b) => {
      const key = b.dataset.key;
      ui.downloading[key] = 0;
      draw();
      try {
        await preloadModel(key, { onProgress: (p) => { ui.downloading[key] = p.progress || 0; draw(); } });
        editor.toast(`${LOCAL_MODELS[key].label} is ready`, 'success');
      } catch (err) {
        editor.toast(`Download failed: ${err?.message || err}`, 'error');
      } finally {
        delete ui.downloading[key];
        refreshCache();
      }
    },
    clear: async (b) => { await clearModel(b.dataset.key); refreshCache(); },
    cancel: () => ui.controller?.abort(),
  };

  const onClick = (e) => {
    const b = e.target.closest('[data-lai]');
    if (!b || !container.contains(b) || b.tagName !== 'BUTTON') return;
    handlers[b.dataset.lai]?.(b);
  };
  const onInput = (e) => {
    const el = e.target;
    if (el.dataset.laiQuery !== undefined) ui.query = el.value;
    else if (el.dataset.laiScript !== undefined) ui.script = el.value;
    else if (el.dataset.laiMusic !== undefined) {
      const had = !!ui.musicPrompt.trim();
      ui.musicPrompt = el.value;
      const btn = container.querySelector('[data-lai="music"]');
      if (btn && had !== !!ui.musicPrompt.trim()) btn.disabled = !ui.musicPrompt.trim();
    }
    else if (el.dataset.laiSpeed !== undefined) ui.speed = Number(el.value);
  };
  const onChange = (e) => { if (e.target.dataset.laiVoice !== undefined) ui.voice = e.target.value; };
  const onKey = (e) => { if (e.key === 'Enter' && e.target.dataset?.laiQuery !== undefined) handlers.search(); };

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  container.addEventListener('keydown', onKey);
  draw();
  refreshCache();
  hasWebGpu().then((g) => { ui.gpu = g; if (container.isConnected) draw(); });
  return {
    destroy() {
      container.removeEventListener('click', onClick);
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChange);
      container.removeEventListener('keydown', onKey);
    },
  };
}
