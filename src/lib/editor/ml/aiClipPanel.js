/**
 * Clip editor section: "Free AI — runs on your device". Offers the in-browser
 * AI actions that fit the selected clip (mask, describe, tags, depth blur,
 * parallax, upscale, audio labels, remove silences, speakers, translate).
 * Work runs through aiActions.js; jobs outlive the panel (selecting another
 * clip doesn't cancel them).
 */
import * as actions from './aiActions.js';
import { LOCAL_MODELS, TRANSLATE_LANGUAGES } from './modelRegistry.js';
import { isModelCached } from './mlClient.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Running jobs by clip id: { label, last, cancel(), subscribe(fn), done } */
const jobs = new Map();

const MODELS_FOR = {
  mask: ['sam'], maskText: ['owl', 'sam'], describe: ['florence'], tags: ['clip', 'detr'],
  depth: ['depth'], parallax: ['depth'], upscale: ['upscale'], audio: ['clap'],
  silences: [], speakers: ['diarize'], translate: ['translate'],
};

/** Ask once before a first (large) model download. */
export async function confirmDownloads(keys, confirm = (m) => Promise.resolve(window.confirm(m))) {
  const missing = [];
  for (const k of keys) if (!(await isModelCached(k))) missing.push(LOCAL_MODELS[k]);
  if (!missing.length) return true;
  const mb = missing.reduce((a, m) => a + m.sizeMB, 0);
  return confirm(`This runs free on your device. It downloads ${missing.map((m) => m.label).join(', ')} once (about ${mb} MB), then works offline from the browser cache. Continue?`);
}

function startJob(clipId, label, run) {
  const controller = new AbortController();
  const listeners = new Set();
  const job = {
    label,
    last: null,
    cancel: () => controller.abort(),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
  const onProgress = (p) => { job.last = p; listeners.forEach((fn) => fn(p)); };
  job.done = (async () => run({ onProgress, signal: controller.signal }))();
  job.done.catch(() => {}).finally(() => jobs.delete(clipId));
  jobs.set(clipId, job);
  return job;
}

const progressText = (job, p) => {
  if (!p) return `${job.label}…`;
  if (p.stage === 'download') return `Downloading model… ${Math.round((p.progress || 0) * 100)}%`;
  if (p.frames) return `${job.label}: frame ${p.frame || 0} of ${p.frames}`;
  if (p.progress != null) return `${job.label}… ${Math.round(p.progress * 100)}%`;
  return `${job.label}…`;
};

/**
 * @param {HTMLElement} container
 * @param {object} opts { editor (aiActions contract), clip, confirm?(msg) → Promise<bool> }
 */
export function renderAIClipPanel(container, { editor, clip, confirm } = {}) {
  const ui = { result: '', error: '', frame: null, points: [], box: null, drag: null, query: '', mode: 'cutout', focus: 0.55, lang: 'es', unsub: null };
  const visual = actions.isVisual(clip);
  const image = actions.isImageClip(clip);
  const audio = actions.hasAudio(clip);
  const captions = clip?.type === 'captions';

  const job = () => jobs.get(clip.id);

  const draw = () => {
    const j = job();
    const restore = clip.localAI?.originalSrc
      ? `<p class="addon-field__hint">✓ ${esc(clip.localAI.op.replace(/-/g, ' '))} applied. The original is kept.</p><button type="button" class="mini-btn" data-ai="restore">Restore original</button>`
      : '';
    container.innerHTML = `
      <div class="bg-panel ai-local-panel">
        <h4 class="addon-panel__heading">Free AI <span class="addon-field__hint">· runs on your device</span></h4>
        ${j ? `<div class="cap-progress" role="status"><span data-ai-status>${esc(progressText(j, j.last))}</span> <button type="button" class="mini-btn" data-ai="cancel">Cancel</button></div>
               <div class="bg-bar" aria-hidden="true"><span data-ai-bar style="width:0%"></span></div>` : ''}
        ${ui.error ? `<p class="addon-field__hint" role="alert" style="color:var(--danger,#ff6b6b)">${esc(ui.error)}</p>` : ''}
        ${ui.result ? `<div class="addon-field__hint ai-local-result" style="white-space:pre-wrap">${esc(ui.result)}</div>` : ''}
        ${restore}
        ${visual ? `
          <details class="ai-local-group" ${ui.frame ? 'open' : ''}>
            <summary>Mask an object</summary>
            <p class="addon-field__hint">Click the object (Alt-click to exclude an area), drag a box around it, or type its name.</p>
            <div class="ai-mask-stage" style="position:relative;max-width:100%;cursor:crosshair">
              ${ui.frame ? '' : '<button type="button" class="mini-btn" data-ai="load-frame">Show frame at playhead</button>'}
              <canvas data-ai-canvas style="max-width:100%;${ui.frame ? '' : 'display:none'}"></canvas>
            </div>
            <label class="cap-row"><span>Or name it</span><input type="text" data-ai-query placeholder="e.g. the dog" value="${esc(ui.query)}"/></label>
            <label class="cap-row"><span>Result</span><select data-ai-mode>
              <option value="cutout" ${ui.mode === 'cutout' ? 'selected' : ''}>Cut out the object${image ? '' : ' (whole clip)'}</option>
              <option value="mask" ${ui.mode === 'mask' ? 'selected' : ''}>Save a mask only</option></select></label>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="mini-btn cap-primary" data-ai="mask" ${j ? 'disabled' : ''}>Mask object</button>
              <button type="button" class="mini-btn" data-ai="clear-prompt">Clear clicks</button>
            </div>
          </details>
          <details class="ai-local-group"><summary>Describe and tag</summary>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="mini-btn" data-ai="describe" ${j ? 'disabled' : ''}>Describe this frame</button>
              <button type="button" class="mini-btn" data-ai="tags" ${j ? 'disabled' : ''}>Auto-tag</button>
            </div>
            ${clip.metadata?.tags?.length ? `<p class="addon-field__hint">Tags: ${esc(clip.metadata.tags.join(', '))}${clip.metadata.objects?.length ? ` · Objects: ${esc(clip.metadata.objects.join(', '))}` : ''}</p>` : ''}
          </details>
          <details class="ai-local-group"><summary>Depth effects</summary>
            <label class="cap-row"><span>Keep sharp</span><input type="range" min="0.2" max="0.9" step="0.05" value="${ui.focus}" data-ai-focus aria-label="Focus depth"/></label>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="mini-btn" data-ai="depth" ${j ? 'disabled' : ''}>Blur background</button>
              ${clip.type === 'image' ? `<select data-ai-parallax aria-label="Parallax style"><option value="orbit">Orbit</option><option value="push">Push in</option><option value="pan">Pan</option></select>
                <button type="button" class="mini-btn" data-ai="parallax" ${j ? 'disabled' : ''}>Make 3D parallax</button>` : ''}
            </div>
          </details>
          ${image ? `<button type="button" class="mini-btn" data-ai="upscale" ${j ? 'disabled' : ''}>Upscale image 2×</button>` : ''}` : ''}
        ${audio ? `
          <details class="ai-local-group"><summary>Audio</summary>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="mini-btn" data-ai="audio" ${j ? 'disabled' : ''}>Find music / speech / silence</button>
              <button type="button" class="mini-btn" data-ai="silences" ${j ? 'disabled' : ''}>Remove silences</button>
            </div>
          </details>` : ''}
        ${captions ? `
          <details class="ai-local-group" open><summary>Captions AI</summary>
            <button type="button" class="mini-btn" data-ai="speakers" ${j ? 'disabled' : ''}>Label speakers</button>
            ${clip.speakers?.length ? `<p class="addon-field__hint">${clip.speakers.length} speaker(s) labelled</p>` : ''}
            <label class="cap-row"><span>Translate to</span><select data-ai-lang>${TRANSLATE_LANGUAGES.map(([c, n]) => `<option value="${c}" ${c === ui.lang ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
            <button type="button" class="mini-btn" data-ai="translate" ${j ? 'disabled' : ''}>Translate captions</button>
          </details>` : ''}
      </div>`;
    paintFrame();
    if (j) follow(j);
  };

  const canvasEl = () => container.querySelector('[data-ai-canvas]');

  function paintFrame() {
    const c = canvasEl();
    if (!c || !ui.frame) return;
    c.width = ui.frame.width;
    c.height = ui.frame.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(ui.frame, 0, 0);
    ctx.lineWidth = Math.max(2, c.width / 300);
    if (ui.box) {
      ctx.strokeStyle = '#4da3ff';
      const [x1, y1, x2, y2] = ui.box;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
    ui.points.forEach(([x, y], i) => {
      ctx.fillStyle = ui.labels?.[i] === 0 ? '#ff5470' : '#3ddc97';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(5, c.width / 120), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const toFrame = (e) => {
    const c = canvasEl();
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height];
  };

  function follow(j) {
    ui.unsub?.();
    const set = (p) => {
      const st = container.querySelector('[data-ai-status]');
      if (st) st.textContent = progressText(j, p);
      const bar = container.querySelector('[data-ai-bar]');
      if (bar) bar.style.width = `${Math.round((p?.stage === 'download' ? 0 : p?.progress || 0) * 100)}%`;
    };
    set(j.last);
    ui.unsub = j.subscribe(set);
  }

  async function run(kind, label, fn) {
    ui.error = '';
    if (!(await confirmDownloads(MODELS_FOR[kind] || [], confirm))) return;
    const j = startJob(clip.id, label, fn);
    draw();
    try {
      const out = await j.done;
      if (typeof out === 'string') ui.result = out;
    } catch (err) {
      if (err?.name !== 'AbortError') {
        ui.error = err?.message || String(err);
        editor.toast(`${label} failed: ${ui.error}`, 'error');
      }
    } finally {
      ui.unsub?.();
      ui.unsub = null;
      if (container.isConnected) draw();
    }
  }

  const fmtRegions = (regions) => regions.map((r) => `${r.start.toFixed(1)}–${r.end.toFixed(1)} s  ${r.label} (${Math.round((r.score || 0) * 100)}%)`).join('\n');

  const handlers = {
    async 'load-frame'() {
      try {
        ui.frame = await actions.frameAtPlayhead(editor, clip, { maxSize: 900 });
        ui.points = []; ui.labels = []; ui.box = null;
        draw();
      } catch (err) { ui.error = err.message; draw(); }
    },
    'clear-prompt'() { ui.points = []; ui.labels = []; ui.box = null; paintFrame(); },
    mask() {
      const query = ui.query.trim();
      const prompt = query && !ui.points.length && !ui.box ? { query } : { points: ui.points, labels: ui.labels, box: ui.box };
      return run(query && !ui.points.length && !ui.box ? 'maskText' : 'mask', 'Masking', (o) => actions.maskObject(editor, clip, { prompt, mode: ui.mode, frame: ui.frame || undefined, ...o }).then(() => (ui.mode === 'mask' ? 'Mask saved on the clip (clip.metadata.maskUrl).' : '')));
    },
    describe: () => run('describe', 'Describing', (o) => actions.describeClip(editor, clip, o)),
    tags: () => run('tags', 'Tagging', (o) => actions.tagClip(editor, clip, o).then(({ tags, objects }) => `Tags: ${tags.map((t) => t.label).join(', ') || '—'}\nObjects: ${objects.map((x) => x.label).join(', ') || '—'}`)),
    depth: () => run('depth', 'Blurring background', (o) => actions.depthBlur(editor, clip, { focus: ui.focus, ...o }).then(() => '')),
    parallax: () => {
      const style = container.querySelector('[data-ai-parallax]')?.value || 'orbit';
      return run('parallax', 'Building parallax', (o) => actions.parallax(editor, clip, { style, ...o }).then(() => ''));
    },
    upscale: () => run('upscale', 'Upscaling', (o) => actions.upscale(editor, clip, o).then(() => '')),
    audio: () => run('audio', 'Listening', (o) => actions.analyzeClipAudio(editor, clip, o).then(({ regions, mood }) => `${fmtRegions(regions)}${mood?.length ? `\nMood: ${mood.map((m) => m.label).join(', ')}` : ''}`)),
    silences: () => run('silences', 'Finding silences', (o) => actions.removeSilences(editor, clip, o).then((r) => (r.removedSec ? `Removed ${r.removedSec.toFixed(1)} s in ${r.pieces} pieces.` : 'No silences long enough to remove.'))),
    speakers: () => run('speakers', 'Labelling speakers', (o) => actions.labelSpeakers(editor, clip, o).then((s) => `${s.length || 1} speaker(s): ${s.map((x) => x.name).join(', ')}`)),
    translate: () => run('translate', 'Translating', (o) => actions.translateCaptionsClip(editor, clip, ui.lang, o).then((c) => `Added "${c.name}" on the captions track.`)),
    restore() { actions.restoreMedia(editor, clip); },
    cancel() { job()?.cancel(); },
  };

  const onClick = (e) => {
    const b = e.target.closest('[data-ai]');
    if (!b || !container.contains(b) || b.tagName !== 'BUTTON') return;
    handlers[b.dataset.ai]?.();
  };
  const onDown = (e) => {
    if (e.target !== canvasEl()) return;
    ui.drag = { start: toFrame(e), alt: e.altKey };
  };
  const onUp = (e) => {
    if (!ui.drag || !canvasEl()) return;
    const [x0, y0] = ui.drag.start;
    const [x1, y1] = toFrame(e);
    if (Math.hypot(x1 - x0, y1 - y0) > 8) {
      ui.box = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    } else {
      ui.points.push([x0, y0]);
      ui.labels = [...(ui.labels || []), ui.drag.alt ? 0 : 1];
    }
    ui.drag = null;
    paintFrame();
  };
  const onInput = (e) => {
    const el = e.target;
    if (el.dataset.aiQuery !== undefined) ui.query = el.value;
    else if (el.dataset.aiFocus !== undefined) ui.focus = Number(el.value);
  };
  const onChange = (e) => {
    const el = e.target;
    if (el.dataset.aiMode !== undefined) ui.mode = el.value;
    else if (el.dataset.aiLang !== undefined) ui.lang = el.value;
  };

  container.addEventListener('click', onClick);
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  draw();
  return {
    destroy() {
      ui.unsub?.();
      container.removeEventListener('click', onClick);
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChange);
    },
  };
}

/** Whether the panel has anything to offer for this clip. */
export const aiPanelSupports = (clip) => actions.isVisual(clip) || actions.hasAudio(clip) || clip?.type === 'captions';
