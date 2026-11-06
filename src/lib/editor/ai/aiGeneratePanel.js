/**
 * Clip editor section: "AI generate — MuAPI (paid, your key)". Fill Gap,
 * Extend before/after, Layers and Remove watermark for the selected clip.
 * Generation runs on MuAPI only; prompts can be written for free from the
 * clip's frames (Florence-2 in the browser).
 */
import * as muapi from './timelineMuapi.js';
import * as local from '../ml/aiActions.js';
import { confirmDownloads } from '../ml/aiClipPanel.js';
import { listElements, resolveMentions } from './elementsStore.js';
import * as frameTools from './frameTools.js';
import {
  FIRST_LAST_FRAME_MODELS, DEFAULT_FILL_GAP_MODEL,
  VIDEO_EXTEND_MODELS, DEFAULT_EXTEND_MODEL,
  LAYER_MODELS, DEFAULT_LAYER_MODEL,
  WATERMARK_MODELS, DEFAULT_WATERMARK_MODEL,
} from '../../muapi/frameModels.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const price = (m) => `$${m.costUsd < 0.1 ? m.costUsd.toFixed(3).replace(/0$/, '') : m.costUsd.toFixed(2)}`;
const options = (table, selected) => Object.entries(table).map(([id, m]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(m.label)} · ${price(m)}/run</option>`).join('');

const jobs = new Map(); // clipId → { label, last, cancel, subscribe, done }

function startJob(clipId, label, run) {
  const controller = new AbortController();
  const listeners = new Set();
  const job = { label, last: null, cancel: () => controller.abort(), subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
  const onProgress = (p) => { job.last = p; listeners.forEach((fn) => fn(p)); };
  // Remove the job as part of `done` itself, so by the time a caller's `await job.done`
  // continues (and redraws) the panel no longer sees a running job.
  job.done = (async () => {
    try { return await run({ onProgress, signal: controller.signal }); } finally { jobs.delete(clipId); }
  })();
  job.done.catch(() => {});
  jobs.set(clipId, job);
  return job;
}

const statusText = (job, p) => {
  if (!p) return `${job.label}…`;
  if (p.stage === 'frames') return 'Reading frames…';
  if (p.stage === 'submit') return 'Sending to MuAPI…';
  if (p.stage === 'generating') return `${job.label} on MuAPI… ${p.elapsedSec || 0}s`;
  if (p.stage === 'download') return `Downloading model… ${Math.round((p.progress || 0) * 100)}%`;
  return `${job.label}…`;
};

/** Which tool to scroll to / highlight when the panel is opened from a shortcut. */
export const MUAPI_TOOL_ANCHORS = { fill_gap: 'fill', extend: 'extend', layers: 'layers', watermark: 'watermark' };

/**
 * @param {HTMLElement} container
 * @param {object} opts { editor (aiActions contract), clip, focus?: 'fill'|'extend'|'layers'|'watermark', confirm?(msg) }
 */
export function renderMuapiClipPanel(container, { editor, clip, focus, confirm } = {}) {
  const isVideo = clip?.type === 'video';
  const isImage = clip?.type === 'image' || clip?.type === 'overlay-image';
  const ui = {
    fillModel: DEFAULT_FILL_GAP_MODEL, fillPrompt: '', fillSide: 'after',
    extDir: 'after', extSeconds: 5, extModel: DEFAULT_EXTEND_MODEL, extPrompt: '',
    layerModel: DEFAULT_LAYER_MODEL, wmModel: DEFAULT_WATERMARK_MODEL, rights: false,
    qeText: '', askText: '', askAnswer: '',
    error: '', unsub: null,
  };
  const gaps = () => ({ after: muapi.gapNextTo(editor, clip, { side: 'after' }), before: muapi.gapNextTo(editor, clip, { side: 'before' }) });

  const draw = () => {
    const j = jobs.get(clip.id);
    const g = gaps();
    const gap = g[ui.fillSide] || g.after || g.before;
    if (gap && !g[ui.fillSide]) ui.fillSide = g.after ? 'after' : 'before';
    const extTable = ui.extDir === 'after' ? VIDEO_EXTEND_MODELS : FIRST_LAST_FRAME_MODELS;
    if (!extTable[ui.extModel]) ui.extModel = ui.extDir === 'after' ? DEFAULT_EXTEND_MODEL : DEFAULT_FILL_GAP_MODEL;
    const stock = muapi.isStockClip(clip);
    container.innerHTML = `
      <div class="bg-panel ai-muapi-panel">
        <h4 class="addon-panel__heading">AI generate <span class="addon-field__hint">· MuAPI, uses your key</span></h4>
        ${j ? `<div class="cap-progress" role="status"><span data-mu-status>${esc(statusText(j, j.last))}</span> <button type="button" class="mini-btn" data-mu="cancel">Cancel</button></div>` : ''}
        ${ui.error ? `<p class="addon-field__hint" role="alert" style="color:var(--danger,#ff6b6b)">${esc(ui.error)}</p>` : ''}

        ${isVideo || isImage ? `
        <details class="ai-local-group" data-mu-anchor="fill" ${focus === 'fill' ? 'open' : ''}>
          <summary>Fill gap</summary>
          ${gap ? `
            ${g.after && g.before ? `<label class="cap-row"><span>Gap</span><select data-mu-side>
              <option value="after" ${ui.fillSide === 'after' ? 'selected' : ''}>After this clip (${(g.after.end - g.after.start).toFixed(1)}s)</option>
              <option value="before" ${ui.fillSide === 'before' ? 'selected' : ''}>Before this clip (${(g.before.end - g.before.start).toFixed(1)}s)</option></select></label>`
              : `<p class="addon-field__hint">Gap ${ui.fillSide} this clip: ${(gap.end - gap.start).toFixed(1)}s. Uses the real last and first frames on each side.</p>`}
            <label class="cap-row"><span>Model</span><select data-mu-fill-model>${options(FIRST_LAST_FRAME_MODELS, ui.fillModel)}</select></label>
            <textarea data-mu-fill-prompt rows="2" placeholder="What happens in between (optional)" style="width:100%">${esc(ui.fillPrompt)}</textarea>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="mini-btn" data-mu="fill-prompt" ${j ? 'disabled' : ''}>Write prompt from frames (free)</button>
              <button type="button" class="mini-btn cap-primary" data-mu="fill" ${j ? 'disabled' : ''}>Fill gap</button>
            </div>` : '<p class="addon-field__hint">No gap next to this clip on its track. Leave space between two clips to fill it.</p>'}
        </details>` : ''}

        ${isVideo ? `
        <details class="ai-local-group" data-mu-anchor="extend" ${focus === 'extend' ? 'open' : ''}>
          <summary>Extend clip</summary>
          <label class="cap-row"><span>Direction</span><select data-mu-ext-dir>
            <option value="after" ${ui.extDir === 'after' ? 'selected' : ''}>After (continue the shot)</option>
            <option value="before" ${ui.extDir === 'before' ? 'selected' : ''}>Before (lead-in)</option></select></label>
          <label class="cap-row"><span>Seconds</span><input type="number" min="1" max="15" step="1" value="${ui.extSeconds}" data-mu-ext-sec style="width:70px"/></label>
          <label class="cap-row"><span>Model</span><select data-mu-ext-model>${options(extTable, ui.extModel)}</select></label>
          <textarea data-mu-ext-prompt rows="2" placeholder="Describe the extra footage (optional)" style="width:100%">${esc(ui.extPrompt)}</textarea>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="mini-btn" data-mu="ext-prompt" ${j ? 'disabled' : ''}>Write prompt from frame (free)</button>
            <button type="button" class="mini-btn cap-primary" data-mu="extend" ${j ? 'disabled' : ''}>Extend</button>
          </div>
        </details>` : ''}

        ${isVideo || isImage ? `
        <details class="ai-local-group" data-mu-anchor="quickedit">
          <summary>Quick edit this frame <span class="addon-field__hint">(Images 2.6, your OpenAI key)</span></summary>
          <p class="addon-field__hint">Changes the frame at the playhead and adds the result as an image clip there. Use @Name to bring in an Element.</p>
          <input data-mu-qe value="${esc(ui.qeText)}" placeholder='e.g. "make it night" or "remove the car"' style="width:100%"/>
          <button type="button" class="mini-btn cap-primary" data-mu="quickedit" ${j ? 'disabled' : ''}>Edit frame</button>
        </details>
        <details class="ai-local-group" data-mu-anchor="askframe" ${ui.askAnswer ? 'open' : ''}>
          <summary>Ask about this frame <span class="addon-field__hint">(OpenAI, your key)</span></summary>
          <input data-mu-ask value="${esc(ui.askText)}" placeholder='e.g. "is the text readable?"' style="width:100%"/>
          <button type="button" class="mini-btn" data-mu="askframe" ${j ? 'disabled' : ''}>Ask</button>
          ${ui.askAnswer ? `<p class="addon-field__hint" style="white-space:pre-wrap">${esc(ui.askAnswer)}</p>` : ''}
        </details>` : ''}

        ${isVideo || isImage ? `
        <details class="ai-local-group" data-mu-anchor="layers" ${focus === 'layers' ? 'open' : ''}>
          <summary>Split into layers</summary>
          <p class="addon-field__hint">Separates ${isVideo ? 'the frame at the playhead' : 'the image'} into foreground and background layers, added above this clip.</p>
          <label class="cap-row"><span>Model</span><select data-mu-layer-model>${options(LAYER_MODELS, ui.layerModel)}</select></label>
          <button type="button" class="mini-btn cap-primary" data-mu="layers" ${j ? 'disabled' : ''}>Split into layers</button>
        </details>` : ''}

        ${isVideo ? `
        <details class="ai-local-group" data-mu-anchor="watermark" ${focus === 'watermark' ? 'open' : ''}>
          <summary>Remove watermark</summary>
          ${stock ? '<p class="addon-field__hint">Not available for stock footage.</p>' : `
            <p class="addon-field__hint">For your own footage or AI clips you generated (e.g. a generator's watermark). The original is kept.</p>
            <label class="cap-row"><span>Model</span><select data-mu-wm-model>${options(WATERMARK_MODELS, ui.wmModel)}</select></label>
            <label style="display:flex;gap:6px;align-items:flex-start;font-size:12px"><input type="checkbox" data-mu-rights ${ui.rights ? 'checked' : ''}/> I own this footage or have the rights to remove its watermark.</label>
            <button type="button" class="mini-btn cap-primary" data-mu="watermark" ${j || !ui.rights ? 'disabled' : ''}>Remove watermark</button>`}
          ${clip.localAI?.op === 'watermark-removed' ? '<button type="button" class="mini-btn" data-mu="restore">Restore original</button>' : ''}
        </details>` : ''}
      </div>`;
    if (j) follow(j);
  };

  function follow(j) {
    ui.unsub?.();
    const set = (p) => { const st = container.querySelector('[data-mu-status]'); if (st) st.textContent = statusText(j, p); };
    set(j.last);
    ui.unsub = j.subscribe(set);
  }

  async function run(label, fn) {
    ui.error = '';
    const j = startJob(clip.id, label, fn);
    draw();
    try {
      await j.done;
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

  const handlers = {
    async 'fill-prompt'() {
      const gap = gaps()[ui.fillSide];
      if (!gap) return;
      if (!(await confirmDownloads(['florence'], confirm))) return;
      await run('Writing prompt', async (o) => { ui.fillPrompt = await local.promptForGap(editor, gap.before, gap.after, o); });
    },
    fill() {
      const gap = gaps()[ui.fillSide];
      return run('Filling gap', async (o) => {
        const { text } = resolveMentions(ui.fillPrompt, await listElements()); // @Element → its description
        return muapi.fillGap(editor, gap, { model: ui.fillModel, prompt: text, ...o });
      });
    },
    async 'ext-prompt'() {
      if (!(await confirmDownloads(['florence'], confirm))) return;
      await run('Writing prompt', async (o) => {
        const text = await local.describeClip(editor, clip, { detail: 'short', ...o });
        ui.extPrompt = `${ui.extDir === 'after' ? 'Continue the shot' : 'Lead-in shot that ends on this frame'}: ${text}`;
      });
    },
    extend() {
      const seconds = Math.max(1, Math.min(15, Math.round(ui.extSeconds) || 5));
      return run('Extending', async (o) => {
        const { text } = resolveMentions(ui.extPrompt, await listElements());
        return muapi.extendClip(editor, clip, { direction: ui.extDir, seconds, model: ui.extModel, prompt: text, ...o });
      });
    },
    quickedit() { return run('Editing the frame', (o) => frameTools.quickEdit(editor, clip, ui.qeText, o)); },
    askframe() { return run('Looking at the frame', async (o) => { ui.askAnswer = await frameTools.askFrame(editor, clip, ui.askText, o); }); },
    layers() { return run('Splitting layers', (o) => muapi.decomposeLayers(editor, clip, { model: ui.layerModel, ...o })); },
    watermark() { return run('Removing watermark', (o) => muapi.removeWatermark(editor, clip, { model: ui.wmModel, rightsConfirmed: ui.rights, ...o })); },
    restore() { local.restoreMedia(editor, clip); },
    cancel() { jobs.get(clip.id)?.cancel(); },
  };

  const onClick = (e) => {
    const b = e.target.closest('[data-mu]');
    if (!b || !container.contains(b) || b.tagName !== 'BUTTON') return;
    handlers[b.dataset.mu]?.();
  };
  const onInput = (e) => {
    const d = e.target.dataset;
    if (d.muFillPrompt !== undefined) ui.fillPrompt = e.target.value;
    else if (d.muExtPrompt !== undefined) ui.extPrompt = e.target.value;
    else if (d.muExtSec !== undefined) ui.extSeconds = Number(e.target.value);
    else if (d.muQe !== undefined) ui.qeText = e.target.value;
    else if (d.muAsk !== undefined) ui.askText = e.target.value;
  };
  const onChange = (e) => {
    const d = e.target.dataset;
    const v = e.target.value;
    if (d.muFillModel !== undefined) ui.fillModel = v;
    else if (d.muSide !== undefined) { ui.fillSide = v; draw(); }
    else if (d.muExtDir !== undefined) { ui.extDir = v; draw(); }
    else if (d.muExtModel !== undefined) ui.extModel = v;
    else if (d.muLayerModel !== undefined) ui.layerModel = v;
    else if (d.muWmModel !== undefined) ui.wmModel = v;
    else if (d.muRights !== undefined) { ui.rights = e.target.checked; draw(); }
  };
  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  draw();
  if (focus) container.querySelector(`[data-mu-anchor="${focus}"]`)?.scrollIntoView?.({ block: 'nearest' });
  return {
    destroy() {
      ui.unsub?.();
      container.removeEventListener('click', onClick);
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChange);
    },
  };
}

export const muapiPanelSupports = (clip) => clip?.type === 'video' || clip?.type === 'image' || clip?.type === 'overlay-image';
