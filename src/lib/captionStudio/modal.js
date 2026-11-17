// Caption Studio modal — free, on-device captions. Framework-free (plain DOM), no imports from the host app, so the identical file
// runs in remix-new-editor (Vite) and OpenHiggsBolt (Next.js, client-only). Host apps wrap it in a thin adapter.
//
// Upload (or pass in) a finished video → Whisper transcribes it in the browser (Transformers.js, WebGPU with a WebAssembly fallback) →
// edit the lines, pick one of 32 caption looks and recolour it → export SRT / VTT, or render the captions into the video, all in the
// browser. No credits, no server, the audio never leaves the device. "Record live" uses the Web Speech API with the microphone.
//
// openCaptionStudio(options):
//   videoUrl, language ('en' | 'auto' | …), accentColor ('#d9ff00'), captions, style,
//   onComplete(url)                                 the video with captions burned in (blob: URL)
//   onApply({ captions, captionStyle, srt, vtt })   hand the captions to a timeline / project
//   onError(err), onClose()
import {
  ENGINES, WHISPER_MODELS, CAPTION_LANGUAGES, detectCapabilities, recommendEngine, recommendModel, transcribeMedia,
} from './engines.js';
import { paintCaptions, ensureCaptionFont } from './painter.js';
import { captionLines, setLineText, removeLine, setLineTiming } from './lines.js';
import { burnCaptions } from './burn.js';
import { liveSpeechSupported, startLiveCaptions } from './live.js';
import {
  CAPTION_PRESETS, CAPITE_PRESETS, CAPITE_PRESET_GROUPS, CAPTION_POSITIONS, defaultCaptionStyle, sortCaptions, captionsFromFile,
  captionsToSrt, captionsToVtt, captionPages, shiftCaptions,
} from './model.js';
import { BASE_FONTS } from './styles.js';

const FONTS = [...new Set([...BASE_FONTS, ...Object.values(CAPITE_PRESETS).map((p) => p.fontFamily)])];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = (ms) => (Math.round(ms / 10) / 100).toFixed(2);
const toHex = (c) => {
  if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c || '');
  return m ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : '#000000';
};
const hexToRgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const TABS = [['generate', '1 · Captions'], ['style', '2 · Style'], ['edit', '3 · Edit'], ['export', '4 · Export']];
const SAMPLE = [' Free', ' captions', ' that', ' run', ' on', ' your', ' device'].map((text, i) => ({ text, startMs: i * 450, endMs: i * 450 + 450, timestampMs: i * 450 + 225, confidence: null }));

const STYLE_TEXT = `
.csm-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:flex-end;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
.csm-dialog{display:flex;flex-direction:column;width:min(1280px,94vw);height:100%;background:#0d1219;color:#e5edf5;border-left:1px solid rgba(255,255,255,.1);box-shadow:-20px 0 60px rgba(0,0,0,.5)}
.csm-head{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid rgba(255,255,255,.08)}
.csm-head h2{margin:0;font-size:17px}
.csm-x{background:none;border:1px solid rgba(255,255,255,.15);color:inherit;border-radius:8px;width:32px;height:32px;font-size:16px;cursor:pointer}
.csm-body{flex:1;overflow:auto;padding:20px 24px}
.csm-foot{display:flex;justify-content:flex-end;gap:10px;padding:14px 24px;border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.csm{display:grid;grid-template-columns:minmax(260px,1fr) minmax(300px,1.1fr);gap:18px;color:var(--text,#e5edf5);font-size:12.5px}
@media(max-width:900px){.csm{grid-template-columns:1fr}}
.csm-stage{position:relative;background:#000;border-radius:12px;overflow:hidden;margin:0 auto;box-shadow:0 0 0 1px rgba(255,255,255,.08)}
.csm-stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.csm-stage canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.csm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.csm-tab{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:transparent;color:inherit;font-weight:700;font-size:11.5px;cursor:pointer}
.csm-tab.on{border-color:var(--app-primary,#d9ff00);color:var(--app-primary,#d9ff00);background:var(--app-soft,rgba(217,255,0,.1))}
.csm h4{margin:14px 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.65}
.csm h4:first-child{margin-top:0}
.csm-row{display:grid;grid-template-columns:104px 1fr;align-items:center;gap:8px;margin:6px 0}
.csm select,.csm input[type=text],.csm input[type=number]{width:100%;box-sizing:border-box;background:rgba(0,0,0,.4);color:inherit;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 9px;font:inherit}
.csm input[type=color]{width:44px;height:28px;border:0;background:none;padding:0;cursor:pointer}
.csm input[type=range]{width:100%}
.csm-btn{padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer}
.csm-btn:hover{border-color:rgba(255,255,255,.4)}
.csm-btn.primary{border-color:var(--app-primary,#d9ff00);color:var(--app-primary,#d9ff00)}
.csm-btn:disabled{opacity:.4;cursor:not-allowed}
.csm-chips{display:flex;flex-wrap:wrap;gap:6px}
.csm-chip{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:transparent;color:inherit;cursor:pointer;font-size:11.5px}
.csm-chip.on{border-color:var(--app-primary,#d9ff00);color:var(--app-primary,#d9ff00)}
.csm-drop{border:1.5px dashed rgba(255,255,255,.22);border-radius:12px;padding:16px;text-align:center;cursor:pointer}
.csm-drop.over,.csm-drop:hover{border-color:var(--app-primary,#d9ff00)}
.csm-hint{opacity:.62;font-size:11.5px;line-height:1.45;margin:6px 0}
.csm-note{padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06);margin:8px 0}
.csm-err{padding:8px 10px;border-radius:8px;background:rgba(239,68,68,.14);color:#fca5a5;margin:8px 0}
.csm-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin:8px 0}
.csm-bar>i{display:block;height:100%;background:var(--app-primary,#d9ff00);transition:width .2s}
.csm-lines{max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px}
.csm-line{display:grid;grid-template-columns:auto 62px 62px 1fr auto;gap:5px;align-items:center}
.csm-toggles{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px}
.csm-toggles label{display:flex;gap:6px;align-items:center}
.csm-live{font-size:15px;min-height:44px;padding:10px;border-radius:10px;background:rgba(0,0,0,.4)}
`;
let cssIn = false;
const injectCss = () => { if (cssIn || typeof document === 'undefined') return; const s = document.createElement('style'); s.textContent = STYLE_TEXT; document.head.appendChild(s); cssIn = true; };


const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Minimal modal chrome: overlay, header, body, footer, Escape, focus trap, focus restore, refresh that keeps focus. */
class ModalShell {
  constructor({ title }) { this.title = title; this.overlay = null; this.state = 'closed'; }

  open() {
    if (this.state === 'open' || typeof document === 'undefined') return;
    injectCss();
    this.opener = document.activeElement;
    const o = document.createElement('div');
    o.className = 'csm-overlay';
    o.innerHTML = `<div class="csm-dialog" role="dialog" aria-modal="true" aria-label="${esc(this.title)}" tabindex="-1">
      <div class="csm-head"><h2>${esc(this.title)}</h2><button type="button" class="csm-x" data-act="close" aria-label="Close">✕</button></div>
      <div class="csm-body">${this.renderBody()}</div><div class="csm-foot">${this.renderFooter()}</div></div>`;
    o.addEventListener('mousedown', (e) => { if (e.target === o) this.close(); });
    this.overlay = o;
    this.onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); return; }
      if (e.key !== 'Tab') return;
      const items = [...o.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !o.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', this.onKey, true);
    this.prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(o);
    this.state = 'open';
    o.querySelector('.csm-dialog').focus({ preventScroll: true });
    this.start?.();
    this.onRender();
  }

  /** Re-render body and footer in place, keeping the focused control and caret. */
  refresh() {
    const o = this.overlay;
    if (!o || this.state !== 'open') return;
    const a = document.activeElement;
    let sel = null; let s0 = null; let s1 = null;
    if (a && o.contains(a)) {
      const attr = [...a.attributes].find((x) => x.name.startsWith('data-'));
      if (attr) sel = `[${attr.name}${attr.value ? `="${CSS.escape(attr.value)}"` : ''}]`;
      try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch { /* not a text field */ }
    }
    o.querySelector('.csm-body').innerHTML = this.renderBody();
    o.querySelector('.csm-foot').innerHTML = this.renderFooter();
    this.onRender();
    const el = sel && o.querySelector(sel);
    if (el) { el.focus(); if (s0 != null) { try { el.setSelectionRange(s0, s1); } catch { /* ignore */ } } }
  }

  close() { if (this.state === 'open') { this.destroy(); } }

  destroy() {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    document.removeEventListener('keydown', this.onKey, true);
    document.body.style.overflow = this.prevOverflow || '';
    this.state = 'closed';
    if (this.opener?.isConnected) this.opener.focus?.({ preventScroll: true });
    this.opts?.onClose?.();
  }
}

export class CaptionStudioModal extends ModalShell {
  constructor(options = {}) {
    super({ title: '💬 Free AI Captions' });
    this.accent = /^#[0-9a-f]{6}$/i.test(options.accentColor || '') ? options.accentColor : '#d9ff00';
    this.opts = options;
    this.tab = 'generate';
    this.caps = null;
    this.engine = 'whisper-wasm';
    this.model = WHISPER_MODELS[1][0];
    this.language = options.language && CAPTION_LANGUAGES.some(([v]) => v === options.language) ? options.language : 'auto';
    this.captions = sortCaptions(options.captions || []);
    this.style = { ...defaultCaptionStyle(options.theme || 'tiktok'), ...(options.style || {}) };
    this.srcUrl = options.videoUrl || '';
    this.srcBlob = null;
    this.srcName = options.videoUrl ? options.videoUrl.split('?')[0].split('/').pop() : '';
    this.busy = null; // { text, progress }
    this.controller = null;
    this.errMsg = '';
    this.note = '';
    this.result = null; // { url, ext, engine }
    this.live = null; // { handle, interim, mode, recorder }
    this.shift = 0;
    this._raf = 0;
  }

  // ---------------------------------------------------------------- theme / chrome
  get themeStyle() {
    return `--app-primary:${this.accent};--app-soft:${hexToRgba(this.accent, 0.12)}`;
  }

  start() {
    injectCss();
    detectCapabilities().then((caps) => {
      this.caps = caps;
      this.engine = recommendEngine(caps);
      this.model = recommendModel(caps);
      this.refresh();
    });
    ensureCaptionFont(this.style);
    this.loop();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this._raf = -1;
    this.controller?.abort();
    this.live?.handle?.stop();
    this.live?.recorder?.state === 'recording' && this.live.recorder.stop();
    this.live?.stream?.getTracks().forEach((t) => t.stop());
    if (this.srcBlob && this.srcUrl) URL.revokeObjectURL(this.srcUrl);
    super.destroy();
  }

  renderFooter() {
    return `
      ${this.opts.onApply ? '<button type="button" class="csm-btn primary" data-act="apply"' + (this.captions.length ? '' : ' disabled') + '>＋ Add captions to timeline</button>' : ''}
      <button type="button" class="csm-btn" data-act="close">Close</button>`;
  }

  // ---------------------------------------------------------------- preview stage (built once, re-attached after each refresh)
  ensureStage() {
    if (this.stage) return;
    const stage = document.createElement('div');
    stage.className = 'csm-stage';
    stage.innerHTML = '<video controls playsinline preload="metadata"></video><canvas></canvas>';
    this.stage = stage;
    this.video = stage.querySelector('video');
    this.canvas = stage.querySelector('canvas');
    this.video.addEventListener('loadedmetadata', () => this.fitStage());
    this.video.addEventListener('error', () => { if (this.srcUrl) { this.errMsg = 'The browser could not open this video. Try uploading the file instead of using a link.'; this.refresh(); } });
    window.addEventListener('resize', () => this.fitStage());
    if (this.srcUrl) this.video.src = this.srcUrl;
  }

  fitStage() {
    if (!this.stage?.parentElement) return;
    const w = this.video.videoWidth || 16; const h = this.video.videoHeight || 9;
    const maxW = this.stage.parentElement.clientWidth || 480;
    const maxH = Math.max(200, window.innerHeight * 0.5);
    const s = Math.min(maxW / w, maxH / h);
    this.stage.style.width = `${Math.floor(w * s)}px`;
    this.stage.style.height = `${Math.floor(h * s)}px`;
  }

  loop() {
    if (this._raf === -1) return;
    const c = this.canvas;
    if (c && this.stage?.isConnected) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(c.clientWidth * dpr); const H = Math.round(c.clientHeight * dpr);
      if (W && H) {
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        const hasCaptions = this.captions.length > 0;
        const showSample = !hasCaptions && this.tab === 'style';
        const list = hasCaptions ? this.captions : showSample ? SAMPLE : [];
        const ms = showSample ? ((this.video.currentTime * 1000) % 3150) : this.video.currentTime * 1000;
        if (list.length) paintCaptions(ctx, W, H, list, this.style, ms, { pages: this.pagesFor(list) });
        if (this.live?.interim) paintCaptions(ctx, W, H, [{ text: this.live.interim.trim(), startMs: 0, endMs: 1e9 }], { ...this.style, highlightActive: false }, 100);
      }
    }
    this._raf = requestAnimationFrame(() => this.loop());
  }

  pagesFor(list) {
    const key = `${list.length}|${list[0]?.text}|${list[list.length - 1]?.endMs}|${this.style.combineMs}`;
    if (this._pk !== key) { this._pk = key; this._pages = captionPages(list, this.style); }
    return this._pages;
  }

  // ---------------------------------------------------------------- source
  setSource(fileOrUrl, name = '') {
    if (this.srcBlob && this.srcUrl) URL.revokeObjectURL(this.srcUrl);
    if (fileOrUrl instanceof Blob) { this.srcBlob = fileOrUrl; this.srcUrl = URL.createObjectURL(fileOrUrl); this.srcName = name || fileOrUrl.name || 'video'; }
    else { this.srcBlob = null; this.srcUrl = String(fileOrUrl || ''); this.srcName = name || this.srcUrl.split('?')[0].split('/').pop(); }
    this.result = null; this.errMsg = ''; this.note = '';
    this.ensureStage();
    this.video.src = this.srcUrl;
    this.refresh();
  }

  // ---------------------------------------------------------------- render
  renderBody() {
    return `<div class="csm" style="${this.themeStyle}">
      <div>
        <div data-stage-slot></div>
        ${this.live ? `<div class="csm-live" aria-live="polite">${esc(this.live.interim || 'Listening…')}</div>` : ''}
        <p class="csm-hint">${this.captions.length ? `${this.captions.length} words · the preview shows exactly what will be rendered.` : 'Add a video, then generate captions. Everything runs on your device.'}</p>
      </div>
      <div>
        <div class="csm-tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" class="csm-tab${this.tab === id ? ' on' : ''}" data-act="tab" data-tab="${id}">${label}</button>`).join('')}</div>
        ${this.errMsg ? `<div class="csm-err" role="alert">⚠ ${esc(this.errMsg)}</div>` : ''}
        ${this.note ? `<div class="csm-note">${esc(this.note)}</div>` : ''}
        ${{ generate: () => this.renderGenerate(), style: () => this.renderStyle(), edit: () => this.renderEdit(), export: () => this.renderExport() }[this.tab]()}
      </div>
    </div>`;
  }

  progressHtml() {
    const b = this.busy;
    return `<div role="status"><div>${esc(b.text)}</div><div class="csm-bar"><i style="width:${Math.round((b.progress || 0) * 100)}%"></i></div><button type="button" class="csm-btn" data-act="cancel">Cancel</button></div>`;
  }

  renderGenerate() {
    const caps = this.caps;
    const engines = ENGINES.filter((e) => e.file && (e.device !== 'webgpu' || caps?.webgpu));
    return `
      <h4>Video</h4>
      <div class="csm-drop" data-act="pick" data-drop>
        <input type="file" accept="video/*,audio/*" hidden data-file />
        ${this.srcName ? `<strong>${esc(this.srcName)}</strong><div class="csm-hint">Click or drop to replace</div>` : '<strong>Drop a finished video here or click to browse</strong><div class="csm-hint">MP4, MOV, WebM, MP3, WAV…</div>'}
      </div>
      <h4>Free on-device transcription</h4>
      <label class="csm-row"><span>Engine</span><select data-set="engine">${engines.map((e) => `<option value="${e.id}" ${e.id === this.engine ? 'selected' : ''}>${esc(e.label)}</option>`).join('')}</select></label>
      <label class="csm-row"><span>Model</span><select data-set="model">${WHISPER_MODELS.map(([v, l]) => `<option value="${v}" ${v === this.model ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="csm-row"><span>Language</span><select data-set="language">${CAPTION_LANGUAGES.map(([v, l]) => `<option value="${v}" ${v === this.language ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${this.busy && !this.live ? this.progressHtml() : `<button type="button" class="csm-btn primary" data-act="generate" ${this.srcUrl ? '' : 'disabled'}>${this.captions.length ? 'Re-generate (replaces captions)' : '✨ Generate captions — free'}</button>`}
      <p class="csm-hint">Whisper runs in your browser${caps?.webgpu ? ' on your GPU' : ''}. The model (~40–80 MB) downloads once and is cached. No credits are used and the audio never leaves your computer.</p>
      <h4>Live captions (microphone)</h4>
      ${this.live ? '<button type="button" class="csm-btn" data-act="live-stop">■ Stop</button>' : `<button type="button" class="csm-btn" data-act="live-start" ${liveSpeechSupported() ? '' : 'disabled'}>● Record with live captions</button>`}
      <p class="csm-hint">${liveSpeechSupported()
        ? (this.live?.mode === 'on-device' ? 'Recognition is running on-device.' : this.live?.mode === 'browser-cloud' ? 'Your browser is sending the speech to its own speech service; use a video file for fully local captions.' : 'Uses your camera and microphone and the browser’s Web Speech API. Word timing is approximate; generate from the recording for exact timing.')
        : 'Live speech recognition needs Chrome or Edge.'}</p>
      <h4>Or import</h4>
      <label class="csm-btn" style="display:inline-block">Import SRT / VTT<input type="file" accept=".srt,.vtt,text/vtt,text/plain" hidden data-import /></label>`;
  }

  renderStyle() {
    const s = this.style;
    const presetBtn = (k, p) => `<button type="button" class="csm-chip${s.preset === k ? ' on' : ''}" data-act="preset" data-preset="${k}">${esc(p.label)}</button>`;
    return `
      <h4>Looks</h4>
      <div class="csm-chips">${Object.entries(CAPTION_PRESETS).map(([k, p]) => presetBtn(k, p)).join('')}</div>
      ${CAPITE_PRESET_GROUPS.map((g) => `<h4>${esc(g.label)}</h4><div class="csm-chips">${Object.entries(CAPITE_PRESETS).filter(([, p]) => p.group === g.id).map(([k, p]) => presetBtn(k, p)).join('')}</div>`).join('')}
      <h4>Customize</h4>
      <label class="csm-row"><span>Font</span><select data-style="fontFamily">${FONTS.map((f) => `<option ${f === s.fontFamily ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
      <label class="csm-row"><span>Size</span><input type="range" min="2" max="14" step="0.5" value="${esc(s.fontSize)}" data-style="fontSize" data-kind="num" /></label>
      <label class="csm-row"><span>Position</span><select data-style="position">${CAPTION_POSITIONS.map((p) => `<option value="${p}" ${p === s.position ? 'selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select></label>
      <label class="csm-row"><span>Text colour</span><input type="color" value="${toHex(s.color)}" data-style="color" /></label>
      <label class="csm-row"><span>Highlight</span><input type="color" value="${toHex(s.highlightColor)}" data-style="highlightColor" /></label>
      <label class="csm-row"><span>Outline</span><input type="color" value="${toHex(s.strokeColor || '#000000')}" data-style="strokeColor" /></label>
      <label class="csm-row"><span>Background</span><input type="color" value="${toHex(s.backgroundColor)}" data-style="backgroundColor" data-kind="rgba" /></label>
      <label class="csm-row"><span>Page length</span><input type="range" min="200" max="4000" step="100" value="${esc(s.combineMs)}" data-style="combineMs" data-kind="num" title="How much text shows at once (ms)" /></label>
      <div class="csm-toggles">${[['bold', 'Bold'], ['italic', 'Italic'], ['uppercase', 'Uppercase'], ['stroke', 'Outline'], ['background', 'Background box'], ['highlightActive', 'Highlight spoken word']]
        .map(([k, l]) => `<label><input type="checkbox" data-style="${k}" data-kind="bool" ${s[k] ? 'checked' : ''} /> ${l}</label>`).join('')}</div>`;
  }

  renderEdit() {
    if (!this.captions.length) return '<p class="csm-hint">No captions yet. Generate them, record live, or import an SRT/VTT file.</p>';
    const lines = captionLines(this.captions, this.style);
    return `
      <h4>Lines (${lines.length})</h4>
      <div class="csm-lines">${lines.map((l, i) => `
        <div class="csm-line">
          <button type="button" class="csm-chip" data-act="seek" data-ms="${l.startMs}" aria-label="Play from line ${i + 1}">⏵</button>
          <input type="number" step="0.05" min="0" value="${secs(l.startMs)}" data-line-start="${i}" aria-label="Start (s)" />
          <input type="number" step="0.05" min="0" value="${secs(l.endMs)}" data-line-end="${i}" aria-label="End (s)" />
          <input type="text" value="${esc(l.text)}" data-line-text="${i}" aria-label="Caption text" />
          <button type="button" class="csm-chip" data-act="del-line" data-i="${i}" aria-label="Delete line ${i + 1}">✕</button>
        </div>`).join('')}</div>
      <div class="csm-row" style="grid-template-columns:104px 80px auto"><span>Shift all (s)</span><input type="number" step="0.05" value="${this.shift}" data-shift /><button type="button" class="csm-btn" data-act="shift">Apply</button></div>
      <button type="button" class="csm-btn" data-act="clear">Clear all captions</button>`;
  }

  renderExport() {
    const has = this.captions.length > 0;
    const r = this.result;
    return `
      <h4>Subtitle files</h4>
      <div class="csm-chips"><button type="button" class="csm-btn" data-act="dl-srt" ${has ? '' : 'disabled'}>Download SRT</button><button type="button" class="csm-btn" data-act="dl-vtt" ${has ? '' : 'disabled'}>Download VTT</button></div>
      <h4>Video with captions burned in</h4>
      ${this.busy ? this.progressHtml() : `<button type="button" class="csm-btn primary" data-act="render" ${has && this.srcUrl ? '' : 'disabled'}>🎞 Render video with captions — free</button>`}
      <p class="csm-hint">Rendered in your browser with the style shown in the preview, keeping the original audio. ${this.caps?.webCodecs === false ? 'This browser lacks WebCodecs, so the render runs in real time.' : 'Output is MP4 where the browser can encode it, otherwise WebM.'}</p>
      ${r ? `<div class="csm-note"><strong>Done</strong> (${esc(r.ext.toUpperCase())}, ${r.engine === 'webcodecs' ? 'fast render' : 'real-time render'})
        <video src="${esc(r.url)}" controls playsinline style="width:100%;margin-top:8px;border-radius:8px;background:#000"></video>
        <div class="csm-chips" style="margin-top:8px"><a class="csm-btn" href="${esc(r.url)}" download="captioned-${esc((this.srcName || 'video').replace(/\.[^.]+$/, ''))}.${r.ext}">Download</a>
        ${this.opts.onComplete ? '<button type="button" class="csm-btn primary" data-act="use">Use this video</button>' : ''}</div></div>` : ''}`;
  }

  // ---------------------------------------------------------------- wiring (delegated once; survives refresh())
  onRender() {
    this.ensureStage();
    const slot = this.overlay.querySelector('[data-stage-slot]');
    if (slot && this.stage.parentElement !== slot) slot.appendChild(this.stage);
    this.fitStage();
    if (this.overlay._csm) return;
    this.overlay._csm = true;
    const o = this.overlay;
    o.addEventListener('click', (e) => this.onClick(e));
    o.addEventListener('change', (e) => this.onChange(e));
    o.addEventListener('input', (e) => { if (e.target.matches('input[type=range],input[type=color]')) this.onChange(e); });
    o.addEventListener('dragover', (e) => { if (e.target.closest?.('[data-drop]')) { e.preventDefault(); e.target.closest('[data-drop]').classList.add('over'); } });
    o.addEventListener('dragleave', (e) => e.target.closest?.('[data-drop]')?.classList.remove('over'));
    o.addEventListener('drop', (e) => {
      if (!e.target.closest?.('[data-drop]')) return;
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f && /^(video|audio)\//.test(f.type)) this.setSource(f);
    });
  }

  fail(err) {
    if (err?.name === 'AbortError') return;
    this.errMsg = err?.message || String(err);
    this.busy = null;
    this.opts.onError?.(err);
    this.refresh();
  }

  onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'pick') { if (e.target.tagName !== 'INPUT') this.overlay.querySelector('[data-file]')?.click(); return; }
    const actions = {
      close: () => this.close(),
      tab: () => { this.tab = el.dataset.tab; this.errMsg = ''; this.refresh(); },
      generate: () => this.generate(),
      cancel: () => { this.controller?.abort(); this.busy = null; this.refresh(); },
      preset: () => { this.style = { ...defaultCaptionStyle(el.dataset.preset), fontSize: this.style.fontSize, position: this.style.position }; ensureCaptionFont(this.style); this.refresh(); },
      seek: () => { this.video.currentTime = Number(el.dataset.ms) / 1000; this.video.play().catch(() => {}); },
      'del-line': () => { this.captions = removeLine(this.captions, captionLines(this.captions, this.style)[Number(el.dataset.i)]); this.refresh(); },
      shift: () => { this.captions = shiftCaptions(this.captions, Math.round(Number(this.overlay.querySelector('[data-shift]').value || 0) * 1000)); this.refresh(); },
      clear: () => { this.captions = []; this.result = null; this.refresh(); },
      'dl-srt': () => this.download('captions.srt', captionsToSrt(this.captions, { combineMs: this.style.combineMs }), 'application/x-subrip'),
      'dl-vtt': () => this.download('captions.vtt', captionsToVtt(this.captions, { combineMs: this.style.combineMs }), 'text/vtt'),
      render: () => this.renderVideo(),
      use: () => { this.opts.onComplete?.(this.result.url); this.close(); },
      apply: () => this.apply(),
      'live-start': () => this.liveStart(),
      'live-stop': () => this.liveStop(),
    };
    actions[act]?.();
  }

  onChange(e) {
    const t = e.target;
    if (t.matches('[data-file]')) { const f = t.files?.[0]; if (f) this.setSource(f); return; }
    if (t.matches('[data-import]')) {
      const f = t.files?.[0];
      f?.text().then((text) => { this.captions = captionsFromFile(text, f.name); this.note = `Imported ${this.captions.length} captions from ${f.name}.`; this.tab = 'style'; this.refresh(); }).catch((err) => this.fail(err));
      return;
    }
    if (t.dataset.set) { this[t.dataset.set] = t.value; return; }
    if (t.dataset.style) {
      const k = t.dataset.style; const kind = t.dataset.kind;
      this.style = { ...this.style, [k]: kind === 'bool' ? t.checked : kind === 'num' ? Number(t.value) : kind === 'rgba' ? hexToRgba(t.value, 0.6) : t.value };
      if (k === 'fontFamily' || k === 'bold' || k === 'italic') ensureCaptionFont(this.style);
      return;
    }
    const lines = () => captionLines(this.captions, this.style);
    if (t.dataset.lineText != null) { const l = lines()[Number(t.dataset.lineText)]; if (l) this.captions = setLineText(this.captions, l, t.value); this.refresh(); return; }
    if (t.dataset.lineStart != null || t.dataset.lineEnd != null) {
      const i = Number(t.dataset.lineStart ?? t.dataset.lineEnd); const l = lines()[i]; if (!l) return;
      const row = t.closest('.csm-line');
      this.captions = setLineTiming(this.captions, l, Number(row.querySelector('[data-line-start]').value) * 1000, Number(row.querySelector('[data-line-end]').value) * 1000);
      this.refresh();
    }
  }

  // ---------------------------------------------------------------- actions
  download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  setBusy(text, progress = 0) {
    this.busy = { text, progress };
    const bar = this.overlay?.querySelector('.csm-bar > i');
    const txt = bar?.parentElement?.previousElementSibling;
    if (bar && txt) { bar.style.width = `${Math.round(progress * 100)}%`; txt.textContent = text; } else this.refresh();
  }

  async generate() {
    if (!this.srcUrl) return;
    this.controller?.abort();
    const ctl = new AbortController(); this.controller = ctl;
    this.errMsg = ''; this.note = '';
    this.setBusy('Reading audio…');
    try {
      const { captions } = await transcribeMedia(this.srcBlob || this.srcUrl, {
        engine: this.engine, model: this.model, language: this.language, signal: ctl.signal,
        onProgress: (p) => this.setBusy(p.stage === 'download' ? `Downloading the free speech model… ${Math.round((p.progress || 0) * 100)}%` : p.stage === 'transcribe' ? 'Transcribing on your device… this can take a while' : 'Reading audio…', p.stage === 'download' ? p.progress : 0.02),
      });
      if (ctl.signal.aborted) return;
      this.captions = sortCaptions(captions);
      this.busy = null; this.result = null;
      this.note = `${this.captions.length} words transcribed. Pick a look, then render or export.`;
      this.tab = 'style';
      this.refresh();
    } catch (err) { this.fail(err); } finally { if (this.controller === ctl) this.controller = null; }
  }

  async renderVideo() {
    const ctl = new AbortController(); this.controller = ctl;
    this.errMsg = ''; this.result = null;
    this.setBusy('Rendering captions into the video…');
    try {
      const out = await burnCaptions({
        src: this.srcBlob || this.srcUrl, captions: this.captions, style: this.style, signal: ctl.signal,
        onProgress: (p) => this.setBusy(p.stage === 'fallback' ? 'This browser can’t render faster than real time — recording the video with captions…' : 'Rendering captions into the video…', p.progress || 0),
      });
      this.result = out; this.busy = null; this.refresh();
    } catch (err) { this.fail(err); } finally { if (this.controller === ctl) this.controller = null; }
  }

  apply() {
    this.opts.onApply?.({
      captions: this.captions.map((c) => ({ ...c })), captionStyle: { ...this.style },
      srt: captionsToSrt(this.captions, { combineMs: this.style.combineMs }), vtt: captionsToVtt(this.captions, { combineMs: this.style.combineMs }),
    });
    this.close();
  }

  async liveStart() {
    this.errMsg = ''; this.note = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } }).catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      this.live = { stream, recorder, interim: '', mode: null };
      this.video.srcObject = stream; this.video.muted = true; this.video.controls = false; this.video.play().catch(() => {});
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        this.video.srcObject = null; this.video.muted = false; this.video.controls = true;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        this.live = null;
        this.setSource(blob, 'recording.webm');
        this.note = 'Recording saved. Live captions were approximate — press “Generate captions” for exact word timing, or keep them.';
        this.refresh();
      };
      recorder.start(500);
      this.live.handle = await startLiveCaptions({
        lang: this.language === 'auto' ? (navigator.language || 'en-US') : this.language,
        onMode: (m) => { this.live.mode = m; this.refresh(); },
        onUpdate: ({ captions, interim }) => { this.captions = captions; if (this.live) this.live.interim = interim; const el = this.overlay?.querySelector('.csm-live'); if (el) el.textContent = interim || captions.slice(-6).map((c) => c.text).join('') || 'Listening…'; },
        onError: (err) => this.fail(err),
      });
      this.refresh();
    } catch (err) {
      this.live?.stream?.getTracks().forEach((tr) => tr.stop());
      this.live = null;
      this.fail(err?.name === 'NotAllowedError' ? new Error('Camera/microphone permission was denied.') : err);
    }
  }

  liveStop() {
    this.live?.handle?.stop();
    if (this.live?.recorder?.state === 'recording') this.live.recorder.stop();
  }
}

export function openCaptionStudio(options = {}) {
  const modal = new CaptionStudioModal(options);
  modal.open();
  return modal;
}
