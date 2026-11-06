/**
 * AI Tools window (the editor's CineGen-derived tools): Fill Gap, Extend,
 * Element and Shot Board, on the user's own MuAPI key. The window is built
 * like Smart Speech (the .speech-modal styles) and works through services
 * the page provides, so it can be tested without a browser video stack.
 */
import { AI_TOOL_INFO, TIMELINE_AI_TOOLS, NEED_KEY_MESSAGE, GENERATE_VIDEO_MODELS } from '../aiToolsClient.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TOOL_ORDER = [TIMELINE_AI_TOOLS.FILL_GAP, TIMELINE_AI_TOOLS.EXTEND, TIMELINE_AI_TOOLS.ELEMENT_CREATE, TIMELINE_AI_TOOLS.SHOT_BOARD, TIMELINE_AI_TOOLS.GENERATE];
const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
const STYLES = ['cinematic', 'photoreal', 'illustration', 'anime', 'minimal', 'documentary'];

/** A one-line summary of a finished run, for the history list. */
export function summarizeResult(result) {
  if (!result) return '';
  if (result.success === false) return result.error || 'Failed';
  if (result.tool === 'shot_board') return `${result.count || result.urls?.length || 0} shot${(result.count || result.urls?.length) === 1 ? '' : 's'}`;
  if (result.tool === 'generate') return result.kind === 'image' ? 'Generated image' : `${result.duration || 5}s generated clip`;
  if (result.tool === 'fill_gap') return `${result.duration || 5}s bridging clip`;
  if (result.tool === 'extend') return `${result.addedDuration || 5}s extension`;
  return result.element?.name || 'Image';
}

/**
 * @param {object} s services (see module comment):
 *   getSelected() / getNext(clip)            clips as { id, src, type, name, durationSec, trimIn }
 *   captureFrame(clip, 'start'|'end')        → Promise<image url>
 *   upload(file)                             → Promise<url>
 *   run(tool, params, { signal, onProgress }) → Promise<result>
 *   hasKey()                                 → boolean
 *   addToTimeline({ kind, src, name, durationSec, after })
 *   addToLibrary({ src, label, type })
 *   record(result), toast(msg, kind)
 * @param {object} [o] { tool, mount }
 */
export function openAiToolsWindow(s, { tool = TIMELINE_AI_TOOLS.FILL_GAP, mount = document.body } = {}) {
  const ui = {
    tool: TOOL_ORDER.includes(tool) ? tool : TIMELINE_AI_TOOLS.FILL_GAP,
    prompt: '', negative: '', kind: 'video', model: GENERATE_VIDEO_MODELS[0][0], duration: 5, aspect: '16:9', style: 'cinematic', count: 4,
    frames: { first: null, last: null, source: null }, // { url, note }
    busy: null, error: '', result: null, controller: null,
  };
  const backdrop = document.createElement('div');
  backdrop.className = 'speech-modal';
  mount.appendChild(backdrop);

  const keyMissing = () => s.hasKey && !s.hasKey();

  function frameSlot(slot, label, hint, choices) {
    const f = ui.frames[slot];
    return `<div class="aitool-frame">
      <span class="speech-modal__field"><span>${esc(label)}</span></span>
      ${f ? `<img class="aitool-thumb" src="${esc(f.url)}" alt="${esc(label)}"/><span class="speech-modal__hint">${esc(f.note || 'Image ready')}</span>` : `<span class="speech-modal__hint">${esc(hint)}</span>`}
      <div class="aitool-frame-actions">${choices.map(([act, text, disabled]) => `<button type="button" class="speech-modal__ghost" data-frame="${slot}" data-act="${act}"${disabled ? ' disabled' : ''}>${esc(text)}</button>`).join('')}
        <label class="speech-modal__ghost aitool-upload">Upload image…<input type="file" accept="image/*" hidden data-upload="${slot}"/></label>
        ${f ? `<button type="button" class="speech-modal__ghost" data-frame="${slot}" data-act="clear">Remove</button>` : ''}</div>
    </div>`;
  }

  function formHtml() {
    const sel = s.getSelected?.();
    const next = sel ? s.getNext?.(sel) : null;
    const t = ui.tool;
    const prompt = (ph) => `<label class="speech-modal__field speech-modal__field--text"><span>${t === 'shot_board' ? 'Story' : 'Description'}</span>
      <textarea data-k="prompt" rows="3" placeholder="${esc(ph)}">${esc(ui.prompt)}</textarea></label>`;
    const range = (key, label, min, max, step = 1) => `<label class="speech-modal__field"><span>${label} <output>${ui[key]}s</output></span>
      <input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${ui[key]}"/></label>`;
    if (t === 'fill_gap') return `<p class="speech-modal__hint">${esc(AI_TOOL_INFO.fill_gap.description)}</p>
      <div class="aitool-frames">
        ${frameSlot('first', 'Start frame', 'The moment before the gap.', [['end-of-selected', 'Use the end of the selected clip', !sel]])}
        ${frameSlot('last', 'End frame (optional)', 'The moment after the gap. Leave empty to hold the start frame.', [['start-of-next', 'Use the start of the next clip', !next]])}
      </div>${prompt('What happens in the gap, e.g. the camera drifts across the desk')}${range('duration', 'Length', 2, 15)}`;
    if (t === 'extend') return `<p class="speech-modal__hint">${esc(AI_TOOL_INFO.extend.description)}</p>
      <div class="aitool-frames">${frameSlot('source', 'Last frame of the clip', 'The frame the new footage continues from.', [['end-of-selected', 'Use the end of the selected clip', !sel]])}</div>
      ${prompt('What happens next, e.g. the person turns and smiles')}${range('duration', 'Added length', 1, 15)}`;
    if (t === 'generate') return `<p class="speech-modal__hint">${esc(AI_TOOL_INFO.generate.description)}</p>${prompt('e.g. a drone shot over a misty forest at sunrise')}
      <label class="speech-modal__field speech-modal__field--text"><span>Leave out (optional)</span><input type="text" data-k="negative" value="${esc(ui.negative)}" placeholder="blurry, text, watermark"/></label>
      <div class="speech-modal__sliders">
        <label class="speech-modal__field"><span>Make a</span><select data-k="kind"><option value="video"${ui.kind === 'video' ? ' selected' : ''}>Video clip</option><option value="image"${ui.kind === 'image' ? ' selected' : ''}>Image</option></select></label>
        ${ui.kind === 'video' ? `<label class="speech-modal__field"><span>Model</span><select data-k="model">${GENERATE_VIDEO_MODELS.map(([id, name]) => `<option value="${id}"${id === ui.model ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>` : ''}
        <label class="speech-modal__field"><span>Shape</span><select data-k="aspect">${ASPECTS.map((a) => `<option${a === ui.aspect ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="speech-modal__field"><span>Style</span><select data-k="style">${STYLES.map((a) => `<option${a === ui.style ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
      </div>${ui.kind === 'video' ? range('duration', 'Length', 3, 12) : ''}`;
    if (t === 'element_create') return `<p class="speech-modal__hint">${esc(AI_TOOL_INFO.element_create.description)}</p>${prompt('e.g. a glass of iced coffee on a wooden table, soft light')}
      <label class="speech-modal__field"><span>Shape</span><select data-k="aspect">${ASPECTS.map((a) => `<option${a === ui.aspect ? ' selected' : ''}>${a}</option>`).join('')}</select></label>`;
    return `<p class="speech-modal__hint">${esc(AI_TOOL_INFO.shot_board.description)}</p>${prompt('e.g. a founder launches a new product in a busy workshop')}
      <div class="speech-modal__sliders">
        <label class="speech-modal__field"><span>Style</span><select data-k="style">${STYLES.map((a) => `<option${a === ui.style ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="speech-modal__field"><span>Shape</span><select data-k="aspect">${ASPECTS.map((a) => `<option${a === ui.aspect ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="speech-modal__field"><span>Shots <output>${ui.count}</output></span><input type="range" data-k="count" min="1" max="8" step="1" value="${ui.count}"/></label>
      </div>`;
  }

  function resultHtml() {
    const r = ui.result;
    if (!r || r.success === false) return '';
    if (r.urls) return `<div class="aitool-grid">${r.urls.map((u, i) => `<figure class="aitool-shot"><img src="${esc(u)}" alt="Shot ${i + 1}"/><button type="button" class="speech-modal__ghost" data-add="${i}">Add to timeline</button></figure>`).join('')}</div>
      <button type="button" class="speech-modal__btn" data-add="all">Add all ${r.urls.length} to the timeline</button>`;
    const video = r.tool === 'fill_gap' || r.tool === 'extend' || (r.tool === 'generate' && r.kind !== 'image');
    return `<div class="aitool-result">${video ? `<video src="${esc(r.url)}" controls muted playsinline></video>` : `<img src="${esc(r.url)}" alt="Result"/>`}
      <div class="aitool-result-actions"><button type="button" class="speech-modal__btn speech-modal__btn--primary" data-add="0">Add to timeline</button>
      ${r.tool === 'element_create' || (r.tool === 'generate' && r.kind === 'image') ? '<button type="button" class="speech-modal__btn" data-lib="1">Save to media library</button>' : ''}</div></div>`;
  }

  function draw() {
    const focus = document.activeElement?.dataset?.k;
    const pos = document.activeElement?.selectionStart;
    const info = AI_TOOL_INFO[ui.tool];
    backdrop.innerHTML = `
      <div class="speech-modal__dialog" role="dialog" aria-modal="true" aria-label="AI Tools">
        <header class="speech-modal__head">
          <h3>🎨 AI Tools</h3>
          <div class="speech-modal__tabs" role="tablist">${TOOL_ORDER.map((id) => `<button type="button" role="tab" aria-selected="${id === ui.tool}" class="speech-modal__tab${id === ui.tool ? ' is-on' : ''}" data-tool="${id}">${AI_TOOL_INFO[id].icon} ${AI_TOOL_INFO[id].label}</button>`).join('')}</div>
          <button type="button" class="speech-modal__close" aria-label="Close">✕</button>
        </header>
        <div class="speech-modal__body"><div class="aitool-body">
          ${formHtml()}
          ${keyMissing() ? `<p class="speech-modal__key">${esc(NEED_KEY_MESSAGE)}</p>` : ''}
          <ul class="speech-modal__errors" role="alert">${ui.busy ? `<li class="is-busy">${esc(ui.busy)}</li>` : ui.error ? `<li>${esc(ui.error)}</li>` : ''}</ul>
          ${resultHtml()}
        </div></div>
        <footer class="speech-modal__foot">
          ${ui.busy ? '<button type="button" class="speech-modal__btn" data-act="stop">Stop</button>' : ''}
          <button type="button" class="speech-modal__btn speech-modal__btn--primary" data-act="generate"${ui.busy ? ' disabled' : ''}>${info.icon} ${ui.tool === 'shot_board' ? 'Make shot board' : ui.tool === 'element_create' ? 'Make image' : ui.tool === 'generate' ? 'Generate' : 'Make footage'}</button>
        </footer>
      </div>`;
    if (focus) {
      const el = backdrop.querySelector(`[data-k="${focus}"]`);
      if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); }
    }
  }

  function params() {
    const f = ui.frames;
    if (ui.tool === 'fill_gap') return { firstFrameUrl: f.first?.url, lastFrameUrl: f.last?.url, prompt: ui.prompt, duration: ui.duration };
    if (ui.tool === 'extend') return { sourceFrameUrl: f.source?.url, prompt: ui.prompt, addedDuration: ui.duration };
    if (ui.tool === 'generate') return { kind: ui.kind, prompt: ui.prompt, negative_prompt: ui.negative, aspect_ratio: ui.aspect, style: ui.style, model: ui.model, duration: ui.duration };
    if (ui.tool === 'element_create') return { prompt: ui.prompt, aspect_ratio: ui.aspect };
    return { prompt: ui.prompt, style: ui.style, aspect_ratio: ui.aspect, count: ui.count };
  }

  function missingInput() {
    if (ui.tool === 'fill_gap' && !ui.frames.first) return 'Add the start frame first.';
    if (ui.tool === 'extend' && !ui.frames.source) return 'Add the last frame of the clip first.';
    if ((ui.tool === 'element_create' || ui.tool === 'shot_board' || ui.tool === 'generate') && !ui.prompt.trim()) return ui.tool === 'shot_board' ? 'Describe the story to storyboard.' : ui.tool === 'generate' ? 'Describe what to generate.' : 'Describe the image to make.';
    return '';
  }

  async function generate() {
    const problem = missingInput();
    if (problem) { ui.error = problem; draw(); return; }
    ui.error = ''; ui.result = null;
    ui.controller = new AbortController();
    ui.busy = 'Making it… this can take a minute or two.';
    draw();
    const result = await s.run(ui.tool, params(), {
      signal: ui.controller.signal,
      onProgress: ({ elapsedSec }) => { ui.busy = `Making it… ${elapsedSec}s`; const li = backdrop.querySelector('.speech-modal__errors .is-busy'); if (li) li.textContent = ui.busy; },
    });
    ui.busy = null; ui.controller = null;
    s.record?.(result);
    if (result?.success) ui.result = result; else ui.error = result?.error || 'Something went wrong.';
    draw();
  }

  async function setFrame(slot, act) {
    const sel = s.getSelected?.();
    const clip = act === 'start-of-next' ? (sel ? s.getNext?.(sel) : null) : sel;
    if (!clip) return;
    ui.busy = 'Reading the frame…'; ui.error = ''; draw();
    try {
      const url = await s.captureFrame(clip, act === 'start-of-next' ? 'start' : 'end');
      ui.frames[slot] = { url, note: `${act === 'start-of-next' ? 'Start' : 'End'} of "${clip.name || 'clip'}"` };
    } catch (err) {
      ui.error = err?.message || 'Could not read a frame from that clip. Upload an image of it instead.';
    }
    ui.busy = null; draw();
  }

  function add(which) {
    const r = ui.result;
    if (!r?.success) return;
    if (r.urls) {
      (which === 'all' ? r.urls : [r.urls[Number(which)]]).filter(Boolean).forEach((src, i) => s.addToTimeline({ kind: 'image', src, name: `Shot ${which === 'all' ? i + 1 : Number(which) + 1}`, durationSec: 3, after: which === 'all' && i > 0 ? 'previous' : undefined }));
      s.toast?.(which === 'all' ? 'Shots added to the timeline' : 'Shot added to the timeline', 'success');
      return;
    }
    const video = r.tool === 'fill_gap' || r.tool === 'extend' || (r.tool === 'generate' && r.kind !== 'image');
    s.addToTimeline({ kind: video ? 'video' : 'image', src: r.url, name: AI_TOOL_INFO[r.tool].label, durationSec: video ? (r.duration || r.addedDuration || 5) : 5, after: video && r.tool !== 'generate' ? 'selected' : undefined });
    s.toast?.('Added to the timeline', 'success');
  }

  function close() {
    ui.controller?.abort();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('input', (e) => {
    const k = e.target.dataset?.k;
    if (!k) return;
    ui[k] = ['duration', 'count'].includes(k) ? Number(e.target.value) : e.target.value;
    const out = e.target.closest('label')?.querySelector('output');
    if (out) out.textContent = k === 'count' ? String(ui.count) : `${ui[k]}s`;
  });
  backdrop.addEventListener('change', async (e) => {
    const k = e.target.dataset?.k;
    if (k === 'aspect' || k === 'style' || k === 'model') { ui[k] = e.target.value; return; }
    if (k === 'kind') { ui.kind = e.target.value; draw(); return; }
    const slot = e.target.dataset?.upload;
    if (slot && e.target.files?.[0]) {
      ui.busy = 'Uploading…'; ui.error = ''; draw();
      try { ui.frames[slot] = { url: await s.upload(e.target.files[0]), note: e.target.files[0].name }; }
      catch (err) { ui.error = err?.message || 'Upload failed. Sign in and try again.'; }
      ui.busy = null; draw();
    }
  });
  backdrop.addEventListener('click', (e) => {
    const t = e.target;
    if (t === backdrop || t.closest('.speech-modal__close')) { close(); return; }
    const toolBtn = t.closest('[data-tool]')?.dataset.tool;
    if (toolBtn) { if (!ui.busy) { ui.tool = toolBtn; ui.error = ''; ui.result = null; draw(); } return; }
    const frame = t.closest('[data-frame]');
    if (frame) { const { frame: slot, act } = frame.dataset; if (act === 'clear') { ui.frames[slot] = null; draw(); } else setFrame(slot, act); return; }
    const addBtn = t.closest('[data-add]')?.dataset.add;
    if (addBtn != null) { add(addBtn); return; }
    if (t.closest('[data-lib]') && ui.result?.url) { s.addToLibrary?.({ src: ui.result.url, label: ui.result.element?.name || 'Element', type: 'image' }); s.toast?.('Saved to the media library', 'success'); return; }
    const act = t.closest('[data-act]')?.dataset.act;
    if (act === 'generate') generate();
    else if (act === 'stop') ui.controller?.abort();
  });

  draw();
  return { el: backdrop, close, ui, setTool: (id) => { if (TOOL_ORDER.includes(id)) { ui.tool = id; draw(); } } };
}
