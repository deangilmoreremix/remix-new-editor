/**
 * Captions editor for a captions clip.
 *
 *   Auto-captions  transcribe a media clip in the browser (Whisper)
 *   Style          preset (word highlight, classic, boxed, karaoke, minimal),
 *                  font, size, colours, position, uppercase, outline, box
 *   Captions       edit text and timing, split / merge / delete, add at the
 *                  playhead, shift all, import SRT/VTT, export SRT/VTT
 */
import {
  CAPTION_PRESETS, CAPTION_POSITIONS, defaultCaptionStyle, sortCaptions, normalizeCaption,
  splitCaption, mergeCaptions, shiftCaptions, captionsFromFile, captionsToSrt, captionsToVtt,
} from './captions.js';
import { WHISPER_MODELS } from './transcribe.js';
import { OVERLAY_FONTS } from '../addons/overlayData.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sec = (ms) => (Math.round(ms / 10) / 100).toFixed(2);

export const CAPTION_FONTS = [...new Set(['Montserrat', 'Inter', 'Poppins', 'Anton', 'Bebas Neue', 'Roboto', ...OVERLAY_FONTS])];

export const CAPTION_LANGUAGES = [
  ['auto', 'Detect language'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'],
  ['it', 'Italian'], ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'], ['ru', 'Russian'], ['ar', 'Arabic'], ['hi', 'Hindi'],
  ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'],
];

/**
 * @param {HTMLElement} container
 * @param {object} opts
 *   captions, style, sources [{ id, label }], selectedSource,
 *   onChange({ captions, captionStyle }), onTranscribe({ sourceId, model, language, onProgress, signal }) → Promise<captions>,
 *   currentMs() → ms from the clip start at the playhead, onSeek(ms), onDownload(name, text, mime), onError(err)
 */
export function renderCaptionsPanel(container, opts = {}) {
  let captions = sortCaptions(opts.captions);
  let style = { ...defaultCaptionStyle(opts.style?.preset), ...(opts.style || {}) };
  const ui = { source: opts.selectedSource || opts.sources?.[0]?.id || '', model: (typeof navigator !== 'undefined' && navigator.gpu) ? WHISPER_MODELS[0][0] : WHISPER_MODELS[1][0], language: 'auto', busy: null, controller: null, shift: 0 };

  const emit = (redraw = true) => {
    opts.onChange?.({ captions: captions.map((c) => ({ ...c })), captionStyle: { ...style } });
    if (redraw) draw();
  };

  const draw = () => {
    const sources = opts.sources || [];
    container.innerHTML = `
      <div class="cap-panel">
        <h4 class="addon-panel__heading">Auto-captions</h4>
        ${sources.length ? `
          <label class="cap-row"><span>From clip</span><select data-cap-source>${sources.map((s) => `<option value="${esc(s.id)}" ${s.id === ui.source ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
          <label class="cap-row"><span>Language</span><select data-cap-lang>${CAPTION_LANGUAGES.map(([v, l]) => `<option value="${v}" ${v === ui.language ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="cap-row"><span>Model</span><select data-cap-model>${WHISPER_MODELS.map(([v, l]) => `<option value="${v}" ${v === ui.model ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          ${ui.busy
            ? `<div class="cap-progress" role="status"><span data-cap-status>${esc(ui.busy)}</span> <button type="button" class="mini-btn" data-cap-cancel>Cancel</button></div>`
            : `<button type="button" class="mini-btn cap-primary" data-cap-transcribe>${captions.length ? 'Re-transcribe (replaces captions)' : 'Generate captions'}</button>`}
          <p class="addon-field__hint">Runs in your browser — the audio never leaves your computer. The model downloads once.</p>`
          : '<p class="addon-field__hint">Add a video or audio clip to the timeline to generate captions from it.</p>'}

        <h4 class="addon-panel__heading">Style</h4>
        <div class="cap-presets">${Object.entries(CAPTION_PRESETS).map(([k, p]) => `<button type="button" class="mini-btn addon-tab${style.preset === k ? ' active' : ''}" data-cap-preset="${k}">${esc(p.label)}</button>`).join('')}</div>
        <label class="cap-row"><span>Font</span><select data-cap-style="fontFamily">${CAPTION_FONTS.map((f) => `<option ${f === style.fontFamily ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
        <label class="cap-row"><span>Size</span><input type="range" min="2" max="14" step="0.5" value="${esc(style.fontSize)}" data-cap-style="fontSize" data-num/></label>
        <label class="cap-row"><span>Position</span><select data-cap-style="position">${CAPTION_POSITIONS.map((p) => `<option value="${p}" ${p === style.position ? 'selected' : ''}>${p[0].toUpperCase()}${p.slice(1)}</option>`).join('')}</select></label>
        <label class="cap-row"><span>Text</span><input type="color" value="${esc(toHex(style.color))}" data-cap-style="color"/></label>
        <label class="cap-row"><span>Highlight</span><input type="color" value="${esc(toHex(style.highlightColor))}" data-cap-style="highlightColor"/></label>
        <label class="cap-row"><span>Words per page</span><input type="range" min="200" max="4000" step="100" value="${esc(style.combineMs)}" data-cap-style="combineMs" data-num title="How long a page of words lasts (ms)"/></label>
        <div class="cap-toggles">
          ${[['bold', 'Bold'], ['uppercase', 'Uppercase'], ['stroke', 'Outline'], ['background', 'Background'], ['highlightActive', 'Highlight spoken word']]
            .map(([k, l]) => `<label><input type="checkbox" data-cap-style="${k}" data-bool ${style[k] ? 'checked' : ''}/> ${l}</label>`).join('')}
        </div>

        <h4 class="addon-panel__heading">Captions (${captions.length})</h4>
        <div class="cap-actions">
          <button type="button" class="mini-btn" data-cap-add>＋ At playhead</button>
          <label class="mini-btn addon-upload-btn">Import SRT/VTT<input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain" data-cap-import hidden/></label>
          <button type="button" class="mini-btn" data-cap-export="srt" ${captions.length ? '' : 'disabled'}>Export SRT</button>
          <button type="button" class="mini-btn" data-cap-export="vtt" ${captions.length ? '' : 'disabled'}>Export VTT</button>
        </div>
        ${captions.length ? `
          <div class="cap-shift"><span>Shift all</span><input type="number" step="0.05" value="${ui.shift}" data-cap-shift-val aria-label="Seconds to shift"/><span>s</span><button type="button" class="mini-btn" data-cap-shift>Apply</button><button type="button" class="mini-btn" data-cap-clear>Clear all</button></div>
          <ol class="cap-list">${captions.map((c, i) => `
            <li class="cap-item" data-i="${i}">
              <button type="button" class="mini-btn" data-cap-seek="${i}" title="Go to this caption" aria-label="Go to caption ${i + 1}">⏵</button>
              <input type="number" step="0.01" min="0" value="${sec(c.startMs)}" data-cap-start="${i}" aria-label="Start (s)"/>
              <input type="number" step="0.01" min="0" value="${sec(c.endMs)}" data-cap-end="${i}" aria-label="End (s)"/>
              <input type="text" value="${esc(c.text.trim())}" data-cap-text="${i}" aria-label="Caption text"/>
              <button type="button" class="mini-btn" data-cap-split="${i}" title="Split" aria-label="Split caption">✂</button>
              <button type="button" class="mini-btn" data-cap-merge="${i}" title="Merge with next" aria-label="Merge with next" ${i === captions.length - 1 ? 'disabled' : ''}>⇣</button>
              <button type="button" class="mini-btn" data-cap-del="${i}" aria-label="Delete caption">✕</button>
            </li>`).join('')}</ol>` : '<p class="addon-field__hint">No captions yet — generate them, import a file or add one at the playhead.</p>'}
      </div>`;
  };

  const setStatus = (text) => {
    ui.busy = text;
    const el = container.querySelector('[data-cap-status]');
    if (el) el.textContent = text; else draw();
  };

  const transcribe = async () => {
    if (!opts.onTranscribe || !ui.source) return;
    ui.controller = new AbortController();
    setStatus('Preparing audio…');
    try {
      const next = await opts.onTranscribe({
        sourceId: ui.source, model: ui.model, language: ui.language, signal: ui.controller.signal,
        onProgress: (p) => setStatus(p.stage === 'download' ? `Downloading model… ${Math.round((p.progress || 0) * 100)}%`
          : p.stage === 'transcribe' ? 'Transcribing… (this can take a while)' : 'Reading audio…'),
      });
      captions = sortCaptions(next);
      ui.busy = null;
      emit();
    } catch (err) {
      ui.busy = null;
      draw();
      if (err?.name !== 'AbortError') opts.onError?.(err);
    } finally {
      ui.controller = null;
    }
  };

  const onInput = (e) => {
    const el = e.target;
    if (el.dataset.capStyle && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
      style = { ...style, [el.dataset.capStyle]: el.dataset.num !== undefined ? Number(el.value) : el.value };
      emit(false);
    } else if (el.dataset.capText !== undefined) {
      const i = Number(el.dataset.capText);
      captions[i] = { ...captions[i], text: (i === 0 ? '' : ' ') + el.value.trim() };
      emit(false);
    } else if (el.dataset.capShiftVal !== undefined) {
      ui.shift = Number(el.value) || 0;
    }
  };

  const onChangeEvt = (e) => {
    const el = e.target;
    if (el.dataset.capSource !== undefined) ui.source = el.value;
    else if (el.dataset.capLang !== undefined) ui.language = el.value;
    else if (el.dataset.capModel !== undefined) ui.model = el.value;
    else if (el.dataset.capStyle) {
      style = { ...style, [el.dataset.capStyle]: el.dataset.bool !== undefined ? el.checked : (el.dataset.num !== undefined ? Number(el.value) : el.value) };
      emit(el.tagName === 'SELECT');
    } else if (el.dataset.capStart !== undefined || el.dataset.capEnd !== undefined) {
      const i = Number(el.dataset.capStart ?? el.dataset.capEnd);
      const ms = Math.max(0, Number(el.value) * 1000);
      const c = { ...captions[i] };
      if (el.dataset.capStart !== undefined) c.startMs = ms; else c.endMs = ms;
      captions[i] = normalizeCaption({ ...c, timestampMs: null });
      captions = sortCaptions(captions);
      emit();
    } else if (el.dataset.capImport !== undefined && el.files?.[0]) {
      const file = el.files[0];
      file.text().then((text) => {
        const list = captionsFromFile(text, file.name);
        if (!list.length) throw new Error('No captions found in that file');
        captions = list;
        emit();
      }).catch((err) => opts.onError?.(err));
    }
  };

  const onClick = (e) => {
    const b = e.target.closest('button');
    if (!b || !container.contains(b)) return;
    const d = b.dataset;
    if (d.capTranscribe !== undefined) transcribe();
    else if (d.capCancel !== undefined) ui.controller?.abort();
    else if (d.capPreset) {
      const keep = { fontSize: style.fontSize, position: style.position };
      style = { ...defaultCaptionStyle(d.capPreset), ...keep };
      emit();
    } else if (d.capAdd !== undefined) {
      const at = Math.max(0, Math.round(opts.currentMs?.() || 0));
      captions = sortCaptions([...captions, { text: (captions.length ? ' ' : '') + 'New caption', startMs: at, endMs: at + 2000 }]);
      emit();
    } else if (d.capExport) {
      const text = d.capExport === 'vtt' ? captionsToVtt(captions, { combineMs: style.combineMs }) : captionsToSrt(captions, { combineMs: style.combineMs });
      opts.onDownload?.(`captions.${d.capExport}`, text, d.capExport === 'vtt' ? 'text/vtt' : 'application/x-subrip');
    } else if (d.capShift !== undefined) { captions = shiftCaptions(captions, ui.shift * 1000); emit(); }
    else if (d.capClear !== undefined) { captions = []; emit(); }
    else if (d.capSeek !== undefined) opts.onSeek?.(captions[Number(d.capSeek)]?.startMs || 0);
    else if (d.capSplit !== undefined) { captions = splitCaption(captions, Number(d.capSplit)); emit(); }
    else if (d.capMerge !== undefined) { captions = mergeCaptions(captions, Number(d.capMerge)); emit(); }
    else if (d.capDel !== undefined) { captions.splice(Number(d.capDel), 1); emit(); }
  };

  container.addEventListener('input', onInput);
  container.addEventListener('change', onChangeEvt);
  container.addEventListener('click', onClick);
  draw();
  if (opts.autoTranscribe && opts.sources?.length) transcribe();
  return {
    destroy() {
      ui.controller?.abort();
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChangeEvt);
      container.removeEventListener('click', onClick);
    },
    get captions() { return captions.map((c) => ({ ...c })); },
    get style() { return { ...style }; },
  };
}

function toHex(color) {
  const s = String(color || '#ffffff');
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  return '#ffffff';
}
