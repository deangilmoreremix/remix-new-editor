/**
 * "Free AI" side panel of the Timeline Editor: search footage by
 * description, free voiceover, and the list of on-device models (download
 * ahead of time, see what's cached, clear).
 */
import * as actions from './aiActions.js';
import { LOCAL_MODELS, KOKORO_VOICES } from './modelRegistry.js';
import { isModelCached, clearModel, preloadModel, hasWebGpu } from './mlClient.js';
import { confirmDownloads } from './aiClipPanel.js';
import * as music from '../ai/music.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtT = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

/**
 * @param {HTMLElement} container
 * @param {object} opts { editor (aiActions contract + seek(sec), select(clipId)), confirm?(msg) }
 */
export function renderLocalAIPanel(container, { editor, confirm } = {}) {
  const ui = { query: '', hits: null, busy: '', error: '', voice: KOKORO_VOICES[0][0], speed: 1, script: '', musicPrompt: '', genre: 'cinematic', mood: 'calm', mstyle: '', tempo: 100, mdur: 30, instrumental: true, plan: null, planStatus: {}, cached: {}, gpu: null, downloading: {}, controller: null };

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

        <h4 class="addon-panel__heading">Music</h4>
        <div class="cap-row"><span>Genre</span><select data-lai-m="genre">${music.GENRES.map((g) => `<option ${g === ui.genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
          <span>Mood</span><select data-lai-m="mood">${music.MOODS.map((g) => `<option ${g === ui.mood ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        <div class="cap-row"><span>Style</span><select data-lai-m="mstyle">${music.STYLES.map((g) => `<option value="${esc(g)}" ${g === ui.mstyle ? 'selected' : ''}>${esc(g || '—')}</option>`).join('')}</select>
          <span>Tempo</span><input type="number" data-lai-m="tempo" min="40" max="200" value="${ui.tempo}" style="width:64px"/> bpm</div>
        <div class="cap-row"><span>Length</span><input type="number" data-lai-m="mdur" min="${music.MIN_SECONDS}" max="${music.MAX_SECONDS}" value="${ui.mdur}" style="width:64px"/> s
          <label style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-lai-m="instrumental" ${ui.instrumental ? 'checked' : ''}/> Instrumental</label></div>
        <textarea data-lai-music rows="2" placeholder="Describe the music (optional), or write it from your clips…" style="width:100%">${esc(ui.musicPrompt)}</textarea>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="mini-btn" data-lai="music-prompt" ${ui.busy ? 'disabled' : ''}>Write prompt from clips (free)</button>
          ${editor.generateMusic ? `<button type="button" class="mini-btn cap-primary" data-lai="music" ${ui.busy ? 'disabled' : ''}>Generate music (MuAPI, your key)</button>` : ''}
        </div>
        <p class="addon-field__hint">The prompt is written on your device from what the clips show. Music is added at the playhead and fades and ducks under voiceovers.</p>

        <h4 class="addon-panel__heading">Composition Plan</h4>
        <p class="addon-field__hint">Plan a multi-section score for this video with OpenAI (your key), edit it, then generate every section in order.</p>
        <button type="button" class="mini-btn" data-lai="plan" ${ui.busy || !editor.projectContext ? 'disabled' : ''}>Plan sections (AI)</button>
        ${ui.plan ? `
          <label class="cap-row"><span>Shared style</span><input data-lai-plan="global_style" value="${esc(ui.plan.global_style)}"/></label>
          <ol style="padding-left:18px">${ui.plan.sections.map((sec, i) => `
            <li style="margin-bottom:8px"><input data-lai-sec="name" data-i="${i}" value="${esc(sec.name)}" style="width:55%;font-weight:600"/>
              <input data-lai-sec="duration" data-i="${i}" type="number" min="10" max="60" value="${sec.duration}" style="width:56px"/> s
              <span class="addon-field__hint">${esc(ui.planStatus[i] || '')}</span>
              <input data-lai-sec="style_tags" data-i="${i}" value="${esc(sec.style_tags)}" placeholder="Style tags" style="width:100%"/>
              <input data-lai-sec="description" data-i="${i}" value="${esc(sec.description)}" placeholder="What the music does" style="width:100%"/>
              <textarea data-lai-sec="lyrics" data-i="${i}" rows="1" placeholder="Lyrics (leave empty for instrumental)" style="width:100%">${esc(sec.lyrics)}</textarea></li>`).join('')}</ol>
          <button type="button" class="mini-btn cap-primary" data-lai="compose" ${ui.busy || !editor.generateMusic ? 'disabled' : ''}>Generate all sections (MuAPI, ~${ui.plan.sections.length * 0.09 < 1 ? '$' + (ui.plan.sections.length * 0.09).toFixed(2) : '$' + (ui.plan.sections.length * 0.09).toFixed(1)})</button>` : ''}

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
    music: () => task('Composing music (1–3 min)', [], (o) => music.generateMusic(editor, {
      prompt: ui.musicPrompt, genre: ui.genre, mood: ui.mood, style: ui.mstyle, tempo: ui.tempo, duration: ui.mdur, instrumental: ui.instrumental,
    }, { signal: o.signal, onProgress: (p) => p.elapsedSec && setBusy(`Composing music… ${p.elapsedSec}s`) })),
    plan: () => task('Planning the score', [], async (o) => {
      ui.plan = await music.planComposition(editor.projectContext(), { seconds: editor.timelineSeconds(), signal: o.signal });
      ui.planStatus = {};
    }),
    compose: () => task('Generating sections', [], async (o) => {
      const r = await music.composeFromPlan(editor, ui.plan, {
        signal: o.signal,
        onSection: (i, sec, st) => { ui.planStatus[i] = st; setBusy(`Section ${i + 1} of ${ui.plan.sections.length}: ${sec.name} (${st})…`); },
      });
      if (r.failed) throw new Error(`Stopped at ${r.failed}. ${r.placed.length} section(s) were placed.`);
      editor.toast?.(`Score added: ${r.placed.length} sections`, 'success');
    }),
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
    else if (el.dataset.laiMusic !== undefined) ui.musicPrompt = el.value;
    else if (el.dataset.laiM !== undefined) {
      const k = el.dataset.laiM;
      ui[k] = k === 'instrumental' ? el.checked : (k === 'tempo' || k === 'mdur') ? Number(el.value) : el.value;
    } else if (el.dataset.laiPlan !== undefined && ui.plan) ui.plan[el.dataset.laiPlan] = el.value;
    else if (el.dataset.laiSec !== undefined && ui.plan) {
      const sec = ui.plan.sections[Number(el.dataset.i)];
      if (sec) sec[el.dataset.laiSec] = el.dataset.laiSec === 'duration' ? music.snapDuration(el.value, music.MIN_SECONDS, 60) : el.value;
    }
    else if (el.dataset.laiSpeed !== undefined) ui.speed = Number(el.value);
  };
  const onChange = (e) => {
    const d = e.target.dataset;
    if (d.laiVoice !== undefined) ui.voice = e.target.value;
    else if (d.laiM !== undefined) {
      const k = d.laiM;
      ui[k] = k === 'instrumental' ? e.target.checked : (k === 'tempo' || k === 'mdur') ? Number(e.target.value) : e.target.value;
    }
  };
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
