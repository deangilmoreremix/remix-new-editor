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
//   applyLabel ('Add captions to timeline'), fonts (the ONLY fonts allowed, e.g. the one font a host can draw and export; every look is forced onto them)
//   onError(err), onClose()
import {
  ENGINES, WHISPER_MODELS, CAPTION_LANGUAGES, detectCapabilities, recommendEngine, recommendModel, transcribeMedia,
} from './engines.js';
import { paintCaptions, ensureCaptionFont } from './painter.js';
import { captionLines, setLineText, removeLine, setLineTiming, nudgeLine, findReplace, changeCase, captionsToPlain } from './lines.js';
import { captionsToTxt, captionsToAss } from './exports.js';
import { burnCaptions } from './burn.js';
import { liveSpeechSupported, startLiveCaptions, spreadWords } from './live.js';
import {
  CAPTION_PRESETS, CAPITE_PRESETS, CAPITE_PRESET_GROUPS, CAPTION_POSITIONS, defaultCaptionStyle, sortCaptions, captionsFromFile,
  captionsToSrt, captionsToVtt, captionPages, shiftCaptions,
} from './model.js';
import { BASE_FONTS, capiteStyleById } from './styles.js';
import { loadVideos, addVideo, subscribeNewVideos, captureFrame, announceVideo, filterVideos, studioCounts } from './videos.js';
import { saveJob, listJobs, getJob, deleteJob, clearJobs, formatBytes, formatDuration } from './history.js';

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
/** The Capite look behind a preset key, only for `capite-*` keys (the basic presets 'classic', 'karaoke' and 'minimal' share names with Capite ids). */
const capiteOf = (key) => (typeof key === 'string' && key.startsWith('capite-') ? capiteStyleById(key.slice(7)) : undefined);
const SAMPLE = [' Free', ' captions', ' that', ' run', ' on', ' your', ' device'].map((text, i) => ({ text, startMs: i * 450, endMs: i * 450 + 450, timestampMs: i * 450 + 225, confidence: null }));

const STYLE_TEXT = `
.csm-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.7);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
.csm-dialog{--ink:#e5edf5;--mute:rgba(229,237,245,.62);--line:rgba(255,255,255,.1);--card:#0f151c;--field:rgba(0,0,0,.4);position:relative;display:flex;flex-direction:column;width:min(1480px,100%);height:min(930px,100%);background:#0a0e13;color:var(--ink);border:1px solid var(--line);border-radius:28px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.6);outline:none}
.csm-dialog.full{width:100%;height:100%;border-radius:0}
.csm-head{display:flex;align-items:flex-start;gap:16px;padding:20px 26px 16px;border-bottom:1px solid var(--line)}
.csm-icon{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:var(--app-soft,rgba(217,255,0,.12));color:var(--app-primary,#d9ff00);border:1px solid var(--app-line,rgba(217,255,0,.25))}
.csm-titles{flex:1;min-width:0}
.csm-titles h2{margin:0;font-size:19px;font-weight:700}
.csm-titles p{margin:4px 0 0;font-size:12.5px;line-height:1.5;color:var(--mute);max-width:820px}
.csm-iconbtn{flex:none;height:34px;min-width:34px;padding:0 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-size:13px;cursor:pointer}
.csm-iconbtn:hover{border-color:rgba(255,255,255,.35)}
.csm-body{flex:1;min-height:0;overflow:auto;padding:18px 26px}
.csm-foot{display:flex;justify-content:flex-end;gap:10px;padding:12px 26px;border-top:1px solid var(--line)}
.csm{display:grid;grid-template-columns:minmax(300px,1fr) minmax(360px,1.05fr);gap:22px;font-size:12.5px;align-items:start}
@media(max-width:960px){.csm{grid-template-columns:1fr}}
.csm-left{display:flex;flex-direction:column;gap:12px;min-width:0}
.csm-stage{position:relative;background:#000;border-radius:18px;overflow:hidden;margin:0 auto;box-shadow:0 0 0 1px var(--line)}
.csm-stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:transparent}
.csm-stage canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.csm-stage.phone{border-radius:38px;box-shadow:0 0 0 7px #151b24,0 0 0 8px var(--line),0 24px 60px rgba(0,0,0,.5)}
.csm-stage.phone::before{content:"";position:absolute;top:8px;left:50%;width:28%;height:15px;margin-left:-14%;border-radius:99px;background:#05070a;z-index:3}
.csm-handle{position:absolute;right:8px;width:30px;height:30px;margin-top:-15px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.65);border:1px solid var(--app-primary,#d9ff00);color:var(--app-primary,#d9ff00);cursor:ns-resize;touch-action:none;font-size:15px;z-index:2}
.csm-speed{display:flex;align-items:center;gap:6px;justify-content:center}
.csm-seg3{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:2px;background:rgba(255,255,255,.03)}
.csm-seg3 button{border:0;background:transparent;color:var(--mute);padding:5px 11px;border-radius:999px;font:inherit;font-size:11.5px;font-weight:600;cursor:pointer}
.csm-seg3 button.on{background:var(--app-soft,rgba(217,255,0,.12));color:var(--app-primary,#d9ff00)}
.csm-final{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px;border-radius:18px;border:1px solid var(--line);background:var(--card)}
.csm-final-icon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.05);font-size:18px}
.csm-final-text{flex:1;min-width:160px;display:flex;flex-direction:column;gap:2px}
.csm-final-text strong{font-size:13.5px}
.csm-final-text span{color:var(--mute);font-size:11.5px}
.csm-final-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.csm-tip{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:14px;border:1px solid var(--line);color:var(--mute);font-size:12px}
.csm-tip strong{color:var(--ink)}
.csm-tip kbd{margin-left:auto;padding:3px 8px;border-radius:7px;background:rgba(255,255,255,.07);font:inherit;font-size:11px}
.csm-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.csm-tab{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.csm-tab.on{border-color:var(--app-primary,#d9ff00);color:var(--app-primary,#d9ff00);background:var(--app-soft,rgba(217,255,0,.12))}
.csm-badge{min-width:22px;height:20px;padding:0 6px;box-sizing:border-box;display:inline-grid;place-items:center;border-radius:999px;font-size:11px;background:rgba(255,255,255,.08)}
.csm-tab.on .csm-badge{background:var(--app-soft,rgba(217,255,0,.18))}
.csm-section{border:1px solid var(--line);border-radius:20px;background:var(--card);padding:16px 18px}
.csm-sec-title{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.csm-sec-title .glyph{color:var(--app-primary,#d9ff00)}
.csm-sec-title .grow{flex:1}
.csm-sec-title button{text-transform:none;letter-spacing:0;font-weight:600}
.csm h4{margin:16px 0 6px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--mute)}
.csm-row{display:grid;grid-template-columns:104px 1fr;align-items:center;gap:8px;margin:7px 0}
.csm select,.csm input[type=text],.csm input[type=number]{width:100%;box-sizing:border-box;background:var(--field);color:inherit;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 10px;font:inherit}
.csm input[type=color]{width:44px;height:28px;border:0;background:none;padding:0;cursor:pointer}
.csm input[type=range]{width:100%;accent-color:var(--app-primary,#d9ff00)}
.csm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer;text-decoration:none}
.csm-btn:hover{border-color:rgba(255,255,255,.4)}
.csm-btn.primary{border-color:var(--app-primary,#d9ff00);color:var(--app-primary,#d9ff00);background:var(--app-soft,rgba(217,255,0,.1))}
.csm-btn:disabled{opacity:.4;cursor:not-allowed}
.csm-chips{display:flex;flex-wrap:wrap;gap:7px}
.csm-center{justify-content:center}
.csm-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
.csm-chip.on{border-color:var(--app-primary,#d9ff00);color:var(--app-primary,#d9ff00);background:var(--app-soft,rgba(217,255,0,.1))}
.csm-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px;margin-top:10px}
.csm-preset{position:relative;text-align:left;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.025);color:inherit;font:inherit;cursor:pointer;min-width:0}
.csm-preset:hover{border-color:rgba(255,255,255,.3)}
.csm-preset.on{border-color:var(--app-primary,#d9ff00);background:var(--app-soft,rgba(217,255,0,.1))}
.csm-preset b{display:block;font-size:12.5px;padding-right:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.csm-preset span{display:block;margin-top:3px;font-size:11px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.csm-preset i{position:absolute;top:10px;right:10px;width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
.csm-drop{border:1.5px dashed rgba(255,255,255,.22);border-radius:16px;padding:22px 16px;text-align:center;cursor:pointer}
.csm-drop.over,.csm-drop:hover{border-color:var(--app-primary,#d9ff00)}
.csm-hint{opacity:.7;font-size:11.5px;line-height:1.5;margin:6px 0}
.csm-note{padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.06);margin:0 0 12px}
.csm-err{padding:9px 12px;border-radius:12px;background:rgba(239,68,68,.14);color:#fca5a5;margin:0 0 12px}
.csm-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin:8px 0}
.csm-bar>i{display:block;height:100%;background:var(--app-primary,#d9ff00);transition:width .2s}
.csm-toggles{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px}
.csm-toggles label{display:flex;gap:6px;align-items:center}
.csm-tools{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:8px 0}
.csm-tools input[type=text]{width:140px}
.csm-segs{display:flex;flex-direction:column;gap:10px;max-height:min(52vh,520px);overflow:auto;padding-right:4px;margin-top:6px}
.csm-seg{border:1px solid var(--line);border-radius:16px;padding:11px 13px;background:rgba(255,255,255,.02)}
.csm-seg.speaking{border-color:var(--app-primary,#d9ff00);background:var(--app-soft,rgba(217,255,0,.07))}
.csm-seg-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.csm-seg-head .grow{flex:1}
.csm-time{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:0;background:rgba(255,255,255,.09);color:inherit;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;font-variant-numeric:tabular-nums}
.csm-seg.speaking .csm-time{background:var(--app-primary,#d9ff00);color:#000}
.csm-dur{color:var(--mute);font-size:11px}
.csm-speaking{color:var(--app-primary,#d9ff00);font-size:11px;font-weight:700}
.csm-mini{padding:3px 8px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--mute);font:inherit;font-size:11px;cursor:pointer}
.csm-mini:hover{border-color:var(--line);color:var(--ink)}
.csm-seg-words{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.csm-word{padding:3px 8px;border-radius:7px;border:1px solid transparent;background:rgba(255,255,255,.07);color:inherit;font:inherit;cursor:pointer}
.csm-word:hover{border-color:rgba(255,255,255,.3)}
.csm-word.on{background:var(--app-primary,#d9ff00);color:#000}
.csm-word-edit{width:auto!important;min-width:60px;padding:2px 6px!important}
.csm-lineedit{display:grid;grid-template-columns:62px 62px 1fr;gap:6px;margin-top:9px}
.csm-foot-note{display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:var(--mute);font-size:11.5px}
.csm-live{font-size:15px;min-height:44px;padding:10px;border-radius:12px;background:var(--field)}
.csm-row input[type=search]{flex:1;min-width:0;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--field);color:inherit;font:inherit}
.csm-src{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 10px}
.csm-vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;max-height:300px;overflow:auto;padding-right:4px;margin-top:8px}
.csm-vcard{display:flex;flex-direction:column;gap:5px;padding:7px;text-align:left;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:inherit;font:inherit;cursor:pointer;min-width:0}
.csm-vcard:hover{border-color:rgba(255,255,255,.3)}
.csm-vcard.on{border-color:#22c55e;background:rgba(34,197,94,.08);box-shadow:0 0 0 1px #22c55e}
.csm-vthumb{position:relative;display:block;aspect-ratio:16/10;border-radius:9px;overflow:hidden;background:#000}
.csm-vthumb video{width:100%;height:100%;object-fit:cover;pointer-events:none}
.csm-vbadge{position:absolute;top:5px;right:5px;padding:1px 7px;border-radius:999px;background:#22c55e;color:#04130a;font-size:10px;font-weight:800}
.csm-vtitle{font-size:12px;font-weight:700;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.csm-vmeta{font-size:10.5px;color:var(--mute)}
.csm-vempty{padding:22px 12px;text-align:center;border:1px dashed rgba(255,255,255,.2);border-radius:14px;color:var(--mute)}
.csm-pic{display:grid;place-items:end center;aspect-ratio:16/8;border-radius:9px;overflow:hidden;margin-bottom:8px;padding-bottom:6%;background-size:cover;background-position:center;background-color:#000}
.csm-pic span{display:block;max-width:94%;text-align:center;font-size:12px;line-height:1.1}
.csm-jobs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-top:10px}
.csm-job{display:flex;flex-direction:column;gap:9px;padding:13px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.025)}
.csm-job h5{margin:0;font-size:13.5px;overflow-wrap:anywhere}
.csm-job dl{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:7px 10px}
.csm-job dt{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.csm-job dd{margin:2px 0 0;font-size:12px}
`;
let cssIn = false;
const injectCss = () => { if (cssIn || typeof document === 'undefined') return; const s = document.createElement('style'); s.textContent = STYLE_TEXT; document.head.appendChild(s); cssIn = true; };


const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Minimal modal chrome: overlay, header, body, footer, Escape, focus trap, focus restore, refresh that keeps focus. */
class ModalShell {
  constructor({ title, subtitle }) { this.title = title; this.subtitle = subtitle; this.overlay = null; this.state = 'closed'; }

  open() {
    if (this.state === 'open' || typeof document === 'undefined') return;
    injectCss();
    this.opener = document.activeElement;
    const o = document.createElement('div');
    o.className = 'csm-overlay';
    o.innerHTML = `<div class="csm-dialog" role="dialog" aria-modal="true" aria-label="${esc(this.title)}" tabindex="-1" style="${this.themeStyle || ''}">
      <div class="csm-head">
        <div class="csm-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 11h4M13 11h4M7 15h7"/></svg></div>
        <div class="csm-titles"><h2>${esc(this.title)}</h2><p>${esc(this.subtitle || '')}</p></div>
        <button type="button" class="csm-iconbtn" data-act="full" aria-label="Expand" title="Expand">⛶</button>
        <button type="button" class="csm-iconbtn" data-act="close" aria-label="Close">✕</button>
      </div>
      <div class="csm-body">${this.renderBody()}</div><div class="csm-foot">${this.renderFooter()}</div></div>`;
    o.addEventListener('mousedown', (e) => { if (e.target === o) this.close(); });
    this.overlay = o;
    this.onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); return; }
      if (e.key === ' ' && this.onSpace) { this.onSpace(e); return; }
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
    super({ title: 'Free AI Captions', subtitle: 'Add captions on your device — free, no credits. Upload a finished video, edit the script, pick a motion style, then export SRT, VTT, TXT or ASS, or render the captions into the video.' });
    this.accent = /^#[0-9a-f]{6}$/i.test(options.accentColor || '') ? options.accentColor : '#d9ff00';
    this.opts = options;
    this.tab = 'generate';
    this.caps = null;
    this.engine = 'whisper-wasm';
    this.model = WHISPER_MODELS[1][0];
    this.language = options.language && CAPTION_LANGUAGES.some(([v]) => v === options.language) ? options.language : 'auto';
    this.captions = sortCaptions(options.captions || []);
    this.style = this.coerceFont({ ...defaultCaptionStyle(options.theme || 'tiktok'), ...(options.style || {}) });
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
    this.speed = 1; this.backdrop = 'cinematic'; this.view = 'lines'; this.styleFilter = 'all'; this.autoScroll = true; this.editingLine = -1; this.fr = { find: '', replace: '', matchCase: false };
    this.renderQuality = 'high'; this.renderSize = 'original'; this._wi = -1;
    // "Your videos" (everything the host reports + videos finished in this tab) and the history of caption jobs
    this.source = 'library'; this.library = []; this.libraryLoading = true; this.libQuery = ''; this.libStudio = 'all'; this.libLimit = 24;
    this.selectedUrl = options.videoUrl || ''; this.frame = ''; this.jobs = []; this.jobId = ''; this.processingMs = 0; this.captionedUrls = new Set();
    if (this.srcUrl) this.restore();
    this._raf = 0;
  }

  // ---------------------------------------------------------------- theme / chrome
  get themeStyle() {
    return `--app-primary:${this.accent};--app-soft:${hexToRgba(this.accent, 0.12)};--app-line:${hexToRgba(this.accent, 0.3)}`;
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
    this.loadLibrary();
    this.refreshJobs();
    this.stopWatching = subscribeNewVideos((card) => this.onNewVideo(card), { watch: this.opts.watchVideos });
    if (this.srcUrl) this.loadFrame(this.srcUrl);
  }

  destroy() {
    this.stopWatching?.();
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
      ${this.opts.onApply ? '<button type="button" class="csm-btn primary" data-act="apply"' + (this.captions.length ? '' : ' disabled') + `>＋ ${esc(this.opts.applyLabel || 'Add captions to timeline')}</button>` : ''}
      <button type="button" class="csm-btn" data-act="close">Close</button>`;
  }

  // ---------------------------------------------------------------- preview stage (built once, re-attached after each refresh)
  ensureStage() {
    if (this.stage) return;
    const stage = document.createElement('div');
    stage.className = 'csm-stage';
    stage.innerHTML = '<video controls playsinline preload="metadata"></video><canvas></canvas><div class="csm-handle" title="Drag to move the captions up or down" role="slider" aria-label="Caption position" hidden>⇕</div>';
    this.stage = stage;
    this.video = stage.querySelector('video');
    this.canvas = stage.querySelector('canvas');
    this.handle = stage.querySelector('.csm-handle');
    this.handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = this.stage.getBoundingClientRect();
        this.style = { ...this.style, positionY: Math.max(0.04, Math.min(0.96, (ev.clientY - r.top) / r.height)) };
        this.queueSave();
      };
      const up = () => { this.handle.removeEventListener('pointermove', move); this.handle.removeEventListener('pointerup', up); if (this.tab === 'style') this.refresh(); };
      this.handle.addEventListener('pointermove', move);
      this.handle.addEventListener('pointerup', up);
    });
    this.video.addEventListener('loadedmetadata', () => this.fitStage());
    this.video.addEventListener('error', () => { if (this.srcUrl) { this.errMsg = 'The browser could not open this video. Try uploading the file instead of using a link.'; this.refresh(); } });
    window.addEventListener('resize', () => this.fitStage());
    if (this.srcUrl) this.video.src = this.srcUrl;
  }

  fitStage() {
    if (!this.stage?.parentElement) return;
    const phone = !this.srcUrl;
    const w = phone ? 9 : (this.video.videoWidth || 16); const h = phone ? 16 : (this.video.videoHeight || 9);
    const maxW = this.stage.parentElement.clientWidth || 480;
    const maxH = Math.max(220, window.innerHeight * (phone ? 0.5 : 0.46));
    const k = Math.min(maxW / w, maxH / h);
    this.stage.style.width = `${Math.floor(w * k)}px`;
    this.stage.style.height = `${Math.floor(h * k)}px`;
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
        const showSample = !hasCaptions && (!this.srcUrl || this.tab === 'style');
        const list = hasCaptions ? this.captions : showSample ? SAMPLE : [];
        const ms = showSample ? ((this.video.currentTime * 1000) % 3150) : this.video.currentTime * 1000;
        const st = !this.srcUrl && this.style.position === 'top' && !Number.isFinite(this.style.positionY) ? { ...this.style, positionY: 0.13 } : this.style; // clear of the phone notch
        if (list.length) paintCaptions(ctx, W, H, list, st, ms, { pages: this.pagesFor(list) });
        this.handle.hidden = !list.length;
        this.handle.style.top = `${this.effectiveY() * 100}%`;
        if (this.live?.interim) paintCaptions(ctx, W, H, [{ text: this.live.interim.trim(), startMs: 0, endMs: 1e9 }], { ...this.style, highlightActive: false }, 100);
      }
    }
    this.followWord();
    this._raf = requestAnimationFrame(() => this.loop());
  }

  effectiveY() { return Number.isFinite(this.style.positionY) ? this.style.positionY : ({ top: 0.08, middle: 0.5, bottom: 0.82 }[this.style.position] ?? 0.82); }

  /** Highlight the word and segment being spoken in the Script & Words tab; keep them in sight when Auto-scroll is on. */
  followWord() {
    if (this.tab !== 'edit' || !this.overlay || !this._lineMap) return;
    const ms = this.video.currentTime * 1000;
    let idx = -1;
    for (let i = 0; i < this.captions.length; i += 1) { if (this.captions[i].startMs <= ms) idx = i; else break; }
    if (idx === this._wi) return;
    this._wi = idx;
    this.overlay.querySelectorAll('.csm-word').forEach((c) => c.classList.toggle('on', Number(c.dataset.wi) === idx));
    const seg = this._lineMap.findIndex(([f, t]) => idx >= f && idx < t);
    this.overlay.querySelectorAll('.csm-seg').forEach((el) => {
      const on = Number(el.dataset.seg) === seg;
      el.classList.toggle('speaking', on);
      el.querySelector('.csm-speaking').hidden = !on;
    });
    if (this.autoScroll) this.overlay.querySelector(`.csm-seg[data-seg="${seg}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  onSpace(e) {
    if (!this.srcUrl || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target?.tagName || '')) return;
    e.preventDefault();
    if (this.video.paused) this.video.play().catch(() => {}); else this.video.pause();
  }

  fontText() { return this.captions.map((c) => c.text).join(''); }

  /** Page layout for the preview. Every edit makes a new captions array, so the array itself is the cache key (plus the page length). */
  pagesFor(list) {
    if (this._pl !== list || this._pc !== this.style.combineMs) { this._pl = list; this._pc = this.style.combineMs; this._pages = captionPages(list, this.style); }
    return this._pages;
  }

  // ---------------------------------------------------------------- autosave (captions + look per video, in this browser)
  storageKey() {
    const id = this.srcBlob ? `${this.srcName}|${this.srcBlob.size}` : this.srcUrl.split('?')[0];
    return id ? `captionStudio:v1:${id}` : '';
  }

  queueSave() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try {
        const key = this.storageKey();
        if (!key) return;
        if (!this.captions.length) { localStorage.removeItem(key); return; }
        const json = JSON.stringify({ captions: this.captions, style: this.style, savedAt: Date.now() });
        if (json.length < 1.5e6) localStorage.setItem(key, json);
      } catch { /* private mode or full storage: autosave is a convenience */ }
    }, 500);
  }

  restore() {
    try {
      const raw = this.storageKey() && localStorage.getItem(this.storageKey());
      const saved = raw && JSON.parse(raw);
      if (saved?.captions?.length && !this.captions.length) {
        this.captions = sortCaptions(saved.captions);
        this.style = { ...this.style, ...saved.style };
        this.note = `Restored your saved captions for this video (${this.captions.length} words).`;
        ensureCaptionFont(this.style, this.fontText());
      }
    } catch { /* ignore a corrupt entry */ }
  }

  // ---------------------------------------------------------------- source
  setSource(fileOrUrl, name = '') {
    if (this.srcBlob && this.srcUrl) URL.revokeObjectURL(this.srcUrl);
    if (fileOrUrl instanceof Blob) { this.srcBlob = fileOrUrl; this.srcUrl = URL.createObjectURL(fileOrUrl); this.srcName = name || fileOrUrl.name || 'video'; }
    else { this.srcBlob = null; this.srcUrl = String(fileOrUrl || ''); this.srcName = name || this.srcUrl.split('?')[0].split('/').pop(); }
    this.result = null; this.errMsg = ''; this.note = ''; this.captions = []; this.jobId = '';
    if (!(fileOrUrl instanceof Blob)) this.selectedUrl = this.srcUrl;
    this.loadFrame(this.srcUrl);
    this.restore();
    this.ensureStage();
    this.video.src = this.srcUrl;
    this.refresh();
  }

  // ---------------------------------------------------------------- render
  /** The Font menu: only the host's fonts when it gave a list, otherwise every font. */
  fontList() {
    return this.opts.fonts?.length ? [...this.opts.fonts] : FONTS;
  }

  /** With a host font list, a look's own font is replaced by an allowed one so the preview shows exactly what the host will draw. */
  coerceFont(style) {
    const allowed = this.opts.fonts;
    if (!allowed?.length || allowed.includes(style.fontFamily)) return style;
    return { ...style, fontFamily: allowed.includes('Inter') ? 'Inter' : allowed[0] };
  }

  lookName() {
    const c = capiteOf(this.style.preset);
    return c?.name || CAPTION_PRESETS[this.style.preset]?.label || 'Custom';
  }

  renderBody() {
    const words = this.captions.length;
    const tabs = [['generate', 'Generate', '◎', null], ['edit', 'Script & Words', '≣', words || null], ['style', 'Motion & Style', '✺', 32], ['export', 'Export', '⬇', null], ['history', 'History', '🕘', this.jobs.length || null]];
    const noVideo = !this.srcUrl;
    return `<div class="csm" style="${this.themeStyle}">
      <div class="csm-left">
        <div data-stage-slot></div>
        ${noVideo ? `<div class="csm-chips csm-center">${['top', 'middle', 'bottom'].map((q) => `<button type="button" class="csm-chip${this.style.position === q && !Number.isFinite(this.style.positionY) ? ' on' : ''}" data-act="pos" data-p="${q}">${q[0].toUpperCase()}${q.slice(1)}</button>`).join('')}</div><p class="csm-hint" style="text-align:center">Drag ⇕ on the preview to reposition. Add a video to see your own footage.</p>` : `
        <div class="csm-speed"><span class="csm-hint" style="margin:0">Speed</span><div class="csm-seg3">${[0.75, 1, 1.25, 1.5].map((v) => `<button type="button" class="${v === this.speed ? 'on' : ''}" data-act="speed" data-v="${v}">${v}×</button>`).join('')}</div></div>`}
        ${this.live ? `<div class="csm-live" aria-live="polite">${esc(this.live.interim || 'Listening…')}</div>` : ''}
        ${this.renderFinal()}
        <div class="csm-tip"><span aria-hidden="true">✦</span><span><strong>Tip:</strong> click a word to jump there, double-click it to fix the spelling.</span><kbd>Space = play / pause</kbd></div>
      </div>
      <div class="csm-right">
        <div class="csm-tabs" role="tablist">${tabs.map(([id, label, glyph, n]) => `<button type="button" role="tab" class="csm-tab${this.tab === id ? ' on' : ''}" data-act="tab" data-tab="${id}"><span aria-hidden="true">${glyph}</span>${label}${n ? `<span class="csm-badge">${n}</span>` : ''}</button>`).join('')}</div>
        ${this.errMsg ? `<div class="csm-err" role="alert">⚠ ${esc(this.errMsg)}</div>` : ''}
        ${this.note ? `<div class="csm-note">${esc(this.note)}</div>` : ''}
        <section class="csm-section">${{ generate: () => this.renderGenerate(), style: () => this.renderStyle(), edit: () => this.renderEdit(), export: () => this.renderExport(), history: () => this.renderHistory() }[this.tab]()}</section>
      </div>
    </div>`;
  }

  /** "Final captioned video" card under the preview: render, download, and the subtitle files. */
  renderFinal() {
    const has = this.captions.length > 0;
    const r = this.result;
    const status = r ? `Hardcoded motion subtitles • ${esc(this.lookName())} style` : has ? `Ready to render • ${esc(this.lookName())} style` : 'Generate or import captions first';
    const file = (k, l, t = '') => `<button type="button" class="csm-chip" data-act="dl-${k}" ${has ? '' : 'disabled'}${t ? ` title="${t}"` : ''}>${l}</button>`;
    return `<div class="csm-final">
      <div class="csm-final-icon" aria-hidden="true">🎞</div>
      <div class="csm-final-text"><strong>Final captioned video</strong><span>${status}</span></div>
      <div class="csm-final-actions">
        ${this.busy?.kind === 'render' ? '' : `<button type="button" class="csm-btn primary" data-act="render" ${has && this.srcUrl ? '' : 'disabled'}>${r ? '↻ Render again' : '⬇ Render video — free'}</button>`}
        ${r ? `<a class="csm-btn" href="${esc(r.url)}" download="captioned-${esc((this.srcName || 'video').replace(/\.[^.]+$/, ''))}.${r.ext}">Download .${esc(r.ext)}</a>` : ''}
        ${r && this.opts.onComplete ? '<button type="button" class="csm-btn" data-act="use">Use this video</button>' : ''}
      </div>
      ${this.busy?.kind === 'render' ? `<div style="flex-basis:100%">${this.progressHtml()}</div>` : ''}
      <div class="csm-chips" style="flex-basis:100%">${file('srt', 'SRT')}${file('vtt', 'VTT')}${file('txt', 'TXT')}${file('ass', 'ASS', 'Animated subtitles for VLC, Aegisub and FFmpeg')}</div>
    </div>`;
  }

  progressHtml() {
    const b = this.busy;
    return `<div role="status"><div>${esc(b.text)}</div><div class="csm-bar"><i style="width:${Math.round((b.progress || 0) * 100)}%"></i></div><button type="button" class="csm-btn" data-act="cancel">Cancel</button></div>`;
  }

  // ---------------------------------------------------------------- your videos
  /** Source of the clip: "Your videos" (everything made in the app, no upload) or a file from this computer. */
  renderSource() {
    const chips = `<div class="csm-src">${[['library', '🎞 Your videos', this.library.length], ['upload', '📁 Upload a file', null]].map(([id, l, n]) => `<button type="button" class="csm-chip${this.source === id ? ' on' : ''}" data-act="src" data-s="${id}">${l}${n ? `<span class="csm-badge">${n}</span>` : ''}</button>`).join('')}</div>`;
    const upload = `<div class="csm-drop" data-act="pick" data-drop>
        <input type="file" accept="video/*,audio/*" hidden data-file />
        ${this.srcName && this.source === 'upload' ? `<strong>${esc(this.srcName)}</strong><div class="csm-hint">Click or drop to replace</div>` : '<strong>Drop a finished video here or click to browse</strong><div class="csm-hint">MP4, MOV, WebM, MP3, WAV…</div>'}
      </div>`;
    return chips + (this.source === 'library' ? this.renderLibrary() : upload);
  }

  renderLibrary() {
    if (!this.library.length) return `<div class="csm-vempty" data-testid="csm-vempty">${this.libraryLoading ? 'Looking for your videos…' : 'No videos made yet. Create one in any studio and it shows up here, or upload a file.'}</div>`;
    const list = filterVideos(this.library, { query: this.libQuery, studio: this.libStudio });
    const shown = list.slice(0, this.libLimit);
    const cards = shown.map((v) => `<button type="button" class="csm-vcard${this.selectedUrl === v.url ? ' on' : ''}" data-act="pick-video" data-id="${esc(v.id)}" data-testid="csm-vcard" aria-pressed="${this.selectedUrl === v.url}"><span class="csm-vthumb"><video src="${esc(v.url)}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video>${this.captionedUrls.has(v.url) ? '<span class="csm-vbadge">Captioned</span>' : ''}</span><span class="csm-vtitle">${esc(v.title)}</span><span class="csm-vmeta">${esc(v.label)} · ${esc(new Date(v.createdAt).toLocaleDateString())}</span></button>`).join('');
    return `<div class="csm-chips">${studioCounts(this.library).map(([id, l, n]) => `<button type="button" class="csm-chip${this.libStudio === id ? ' on' : ''}" data-act="lib-studio" data-v="${esc(id)}">${esc(l)}<span class="csm-badge">${n}</span></button>`).join('')}</div>
      <label class="csm-row"><span>Search</span><input type="search" data-lib-q placeholder="Search your videos…" value="${esc(this.libQuery)}" /></label>
      <p class="csm-hint">Showing ${shown.length} of ${this.library.length} videos · pick one to caption it, nothing is uploaded</p>
      <div class="csm-vgrid" data-testid="csm-vgrid">${cards || '<div class="csm-vempty">No video matches.</div>'}</div>
      ${list.length > shown.length ? `<button type="button" class="csm-mini" data-act="lib-more">Show more (${list.length - shown.length})</button>` : ''}`;
  }

  /** Every video made in the app (host list + this visit) with the clip the Studio was opened with first and picked. */
  async loadLibrary() {
    const current = this.opts.videoUrl ? { url: this.opts.videoUrl, title: this.srcName } : null;
    this.library = await loadVideos({ current, load: this.opts.videoLibrary });
    this.libraryLoading = false;
    if (!this.srcUrl && this.library[0]) this.selectVideo(this.library[0]);
    if (!this.library.length && !this.srcUrl) this.source = 'upload';
    if (this.overlay && !this.busy) this.refresh();
  }

  selectVideo(card) {
    this.selectedUrl = card.url;
    if (card.url !== this.srcUrl) this.setSource(card.url, card.title);
  }

  pickVideo(id) {
    const card = this.library.find((v) => v.id === id);
    if (card) this.selectVideo(card);
  }

  /** A video was just made: add it, and pick it when nothing is picked yet. */
  onNewVideo(card) {
    this.library = addVideo(this.library, card);
    if (!this.srcUrl && this.source === 'library') this.selectVideo(card);
    else if (this.overlay && !this.busy && this.tab === 'generate') this.refresh();
  }

  async loadFrame(url) {
    this.frame = '';
    const still = await captureFrame(url);
    if (this.srcUrl !== url || !still) return;
    this.frame = still;
    if (this.overlay && !this.busy && (this.tab === 'style' || this.tab === 'generate')) this.refresh();
  }

  /** The look drawn over a real picture: the picked video's own frame, else the host's sample image. Nothing made-up. */
  lookPic(p) {
    const img = this.frame || this.opts.sampleImage;
    if (!img) return '';
    const u = String(img).replace(/["'\\\n()]/g, ''); // goes inside style="…": no quotes or brackets
    const stroke = p.stroke ? `-webkit-text-stroke:1px ${esc(p.strokeColor || '#000')};paint-order:stroke fill;` : '';
    const box = p.boxed ? `background:${esc(p.highlightColor)};padding:0 4px;border-radius:4px;` : '';
    return `<span class="csm-pic" style="background-image:url('${u}')"><span style="font-family:${esc(p.fontFamily)},system-ui,sans-serif;font-weight:${p.bold ? 800 : 500};${p.italic ? 'font-style:italic;' : ''}color:${esc(p.color)};${p.uppercase ? 'text-transform:uppercase;' : ''}${stroke}${box}">Make it pop</span></span>`;
  }

  // ---------------------------------------------------------------- history
  async refreshJobs() {
    try { this.jobs = (await listJobs()).map((j) => ({ ...j, hasVideo: !!j.video })); } catch { this.jobs = []; }
    this.captionedUrls = new Set(this.jobs.map((j) => j.sourceUrl).filter(Boolean));
    if (this.overlay && !this.busy && (this.tab === 'history' || this.tab === 'generate')) this.refresh();
  }

  async saveCurrentJob(extra = {}) {
    if (!this.captions.length) return;
    const last = this.captions[this.captions.length - 1];
    const rec = await saveJob({
      id: this.jobId || undefined, title: this.srcName || 'Untitled video', durationSec: this.video?.duration > 0 && Number.isFinite(this.video.duration) ? this.video.duration : last.endMs / 1000,
      language: this.language, lookName: this.lookName(), processingMs: this.processingMs || 0, fileSize: this.srcBlob?.size || 0,
      sourceUrl: this.srcBlob || /^blob:/.test(this.srcUrl) ? '' : this.srcUrl, captions: this.captions, style: this.style, ...(this.srcBlob ? { video: this.srcBlob } : {}), ...extra,
    });
    this.jobId = rec.id;
    this.refreshJobs();
  }

  renderHistory() {
    if (!this.jobs.length) return '<h3 class="csm-sec-title"><span class="glyph">🕘</span>Caption history</h3><div class="csm-vempty" data-testid="csm-history-empty">No caption jobs yet. They are kept in this browser only.</div>';
    const cards = this.jobs.map((j) => `<article class="csm-job" data-testid="csm-job"><h5>${esc(j.title || 'Untitled video')}</h5><dl>`
      + `<div><dt>Duration</dt><dd>${formatDuration(j.durationSec)}</dd></div><div><dt>Language</dt><dd>${esc(j.language || '—')}</dd></div><div><dt>Caption style</dt><dd>${esc(j.lookName || '—')}</dd></div>`
      + `<div><dt>Processing time</dt><dd>${j.processingMs ? `${(j.processingMs / 1000).toFixed(1)}s` : '—'}</dd></div><div><dt>File size</dt><dd>${formatBytes(j.fileSize)}</dd></div><div><dt>Created</dt><dd>${esc(new Date(j.createdAt).toLocaleString())}</dd></div></dl>`
      + `<div class="csm-chips"><button type="button" class="csm-btn primary" data-act="job-open" data-id="${esc(j.id)}">${j.hasVideo ? 'Open &amp; edit' : 'Open script'}</button><button type="button" class="csm-mini" data-act="job-srt" data-id="${esc(j.id)}">SRT</button><button type="button" class="csm-mini" data-act="job-del" data-id="${esc(j.id)}">Delete</button></div></article>`).join('');
    return `<h3 class="csm-sec-title"><span class="glyph">🕘</span>Caption history<span class="grow"></span><button type="button" class="csm-mini" data-act="job-clear">Clear all</button></h3><div class="csm-jobs" data-testid="csm-jobs">${cards}</div>`;
  }

  async openJob(id) {
    const j = await getJob(id);
    if (!j) return;
    if (j.video) this.setSource(j.video, j.title); else if (j.sourceUrl) this.setSource(j.sourceUrl, j.title);
    this.captions = sortCaptions(j.captions || []);
    this.style = this.coerceFont({ ...this.style, ...(j.style || {}) });
    ensureCaptionFont(this.style, this.fontText());
    this.jobId = j.id; this.processingMs = j.processingMs || 0; this.language = j.language || this.language;
    this.note = `Opened “${j.title}” from your history.`;
    this.tab = 'edit'; this.refresh();
  }

  async exportJob(id) {
    const j = await getJob(id);
    if (j) this.download(`${(j.title || 'captions').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')}.srt`, captionsToSrt(sortCaptions(j.captions || []), { combineMs: (j.style || this.style).combineMs }), 'application/x-subrip');
  }

  renderGenerate() {
    const caps = this.caps;
    const engines = ENGINES.filter((e) => e.file && (e.device !== 'webgpu' || caps?.webgpu));
    return `
      <h3 class="csm-sec-title"><span class="glyph">◎</span>Free on-device transcription</h3>
      <p class="csm-hint">Whisper runs in your browser${caps?.webgpu ? ' on your GPU' : ''}. The model downloads once and is cached. No credits are used and the audio never leaves your computer.</p>
      ${this.renderSource()}
      <h4>Engine</h4>
      <label class="csm-row"><span>Engine</span><select data-set="engine">${engines.map((e) => `<option value="${e.id}" ${e.id === this.engine ? 'selected' : ''}>${esc(e.label)}</option>`).join('')}</select></label>
      <label class="csm-row"><span>Model</span><select data-set="model">${WHISPER_MODELS.map(([v, l]) => `<option value="${v}" ${v === this.model ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="csm-row"><span>Language</span><select data-set="language">${CAPTION_LANGUAGES.map(([v, l]) => `<option value="${v}" ${v === this.language ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${this.busy?.kind === 'transcribe' && !this.live ? this.progressHtml() : `<button type="button" class="csm-btn primary" data-act="generate" ${this.srcUrl ? '' : 'disabled'}>${this.captions.length ? '↻ Re-generate (replaces captions)' : '✨ Generate captions — free'}</button>`}
      <h4>Live captions (microphone)</h4>
      ${this.live ? '<button type="button" class="csm-btn" data-act="live-stop">■ Stop</button>' : `<button type="button" class="csm-btn" data-act="live-start" ${liveSpeechSupported() ? '' : 'disabled'}>● Record with live captions</button>`}
      <p class="csm-hint">${liveSpeechSupported()
        ? (this.live?.mode === 'on-device' ? 'Recognition is running on-device.' : this.live?.mode === 'browser-cloud' ? 'Your browser is sending the speech to its own speech service; use a video file for fully local captions.' : 'Uses your camera and microphone and the browser’s Web Speech API. Word timing is approximate; generate from the recording for exact timing.')
        : 'Live speech recognition needs Chrome or Edge.'}</p>
      <h4>Or import</h4>
      <label class="csm-btn" style="display:inline-flex">Import SRT / VTT<input type="file" accept=".srt,.vtt,text/vtt,text/plain" hidden data-import /></label>`;
  }

  renderStyle() {
    const s = this.style;
    const catOf = (k) => CAPITE_PRESETS[k]?.group || 'basic';
    const all = [...Object.entries(CAPTION_PRESETS).map(([k, p]) => [k, p, 'basic']), ...Object.entries(CAPITE_PRESETS).map(([k, p]) => [k, p, catOf(k)])];
    const cats = [['all', 'All', all.length], ...CAPITE_PRESET_GROUPS.map((g) => [g.id, g.label, all.filter((x) => x[2] === g.id).length]), ['basic', 'Basic', 5]];
    const shown = all.filter((x) => this.styleFilter === 'all' || x[2] === this.styleFilter);
    const blurb = { tiktok: 'Short-form hooks', classic: 'Clean subtitles', box: 'Boxed words', karaoke: 'Sing-along wipe', minimal: 'Quiet & simple' };
    const card = ([k, p]) => `<button type="button" class="csm-preset${s.preset === k ? ' on' : ''}" data-act="preset" data-preset="${k}" title="${esc(capiteOf(k)?.description || p.label)}">
      ${this.lookPic(p)}<b>${esc(p.label)}</b><span>${esc(capiteOf(k)?.bestFor || `Basic • ${blurb[k] || ''}`)}</span><i style="background:linear-gradient(135deg,${esc(toHex(p.color))} 50%,${esc(toHex(p.highlightColor))} 50%)"></i></button>`;
    const info = capiteOf(s.preset);
    return `
      <h3 class="csm-sec-title"><span class="glyph">✺</span>Motion style presets<span class="grow"></span><button type="button" class="csm-mini" data-act="reset-style">↺ Reset to default</button></h3>
      <p class="csm-hint">${info ? `<strong>${esc(info.name)}</strong> — ${esc(info.description)}. Best for ${esc(info.bestFor)}.` : 'Pick a look, then fine-tune it below. The preview shows exactly what will be rendered.'}</p>
      <div class="csm-chips">${cats.map(([id, label, n]) => `<button type="button" class="csm-chip${this.styleFilter === id ? ' on' : ''}" data-act="filter" data-f="${id}">${esc(label)}<span class="csm-badge">${n}</span></button>`).join('')}</div>
      <div class="csm-presets">${shown.map(card).join('')}</div>
      <h4>Customize</h4>
      <label class="csm-row"><span>Font</span><select data-style="fontFamily">${this.fontList().map((f) => `<option ${f === s.fontFamily ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
      ${this.opts.fonts?.length ? `<p class="csm-hint" style="margin:0">Captions here use the editor's built-in font (${esc(this.fontList().join(', '))}) so the preview and the exported video always match.</p>` : ''}
      <label class="csm-row"><span>Size</span><input type="range" min="2" max="14" step="0.5" value="${esc(s.fontSize)}" data-style="fontSize" data-kind="num" /></label>
      <label class="csm-row"><span>Position</span><select data-style="position">${CAPTION_POSITIONS.map((q) => `<option value="${q}" ${q === s.position && !Number.isFinite(s.positionY) ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}${Number.isFinite(s.positionY) ? '<option value="custom" selected>Custom (dragged)</option>' : ''}</select></label>
      <label class="csm-row"><span>Height</span><input type="range" min="4" max="96" step="1" value="${Math.round(this.effectiveY() * 100)}" data-style="positionY" data-kind="pct" title="Or drag the ⇕ handle on the video" /></label>
      <label class="csm-row"><span>Text colour</span><input type="color" value="${toHex(s.color)}" data-style="color" /></label>
      <label class="csm-row"><span>Highlight</span><input type="color" value="${toHex(s.highlightColor)}" data-style="highlightColor" /></label>
      <label class="csm-row"><span>Outline</span><input type="color" value="${toHex(s.strokeColor || '#000000')}" data-style="strokeColor" /></label>
      <label class="csm-row"><span>Background</span><input type="color" value="${toHex(s.backgroundColor)}" data-style="backgroundColor" data-kind="rgba" /></label>
      <label class="csm-row"><span>Page length</span><input type="range" min="200" max="4000" step="100" value="${esc(s.combineMs)}" data-style="combineMs" data-kind="num" title="How much text shows at once (ms)" /></label>
      <div class="csm-toggles">${[['bold', 'Bold'], ['italic', 'Italic'], ['uppercase', 'Uppercase'], ['stroke', 'Outline'], ['background', 'Background box'], ['highlightActive', 'Highlight spoken word']]
        .map(([k, l]) => `<label><input type="checkbox" data-style="${k}" data-kind="bool" ${s[k] ? 'checked' : ''} /> ${l}</label>`).join('')}</div>
      ${this.srcUrl ? '' : `<h4>Preview backdrop</h4><div class="csm-chips">${['cinematic', 'dark', 'light', 'grid'].map((b) => `<button type="button" class="csm-chip${this.backdrop === b ? ' on' : ''}" data-act="backdrop" data-b="${b}">${b[0].toUpperCase()}${b.slice(1)}</button>`).join('')}</div>`}`;
  }

  renderEdit() {
    const head = '<h3 class="csm-sec-title"><span class="glyph">≣</span>Script &amp; words</h3>';
    if (!this.captions.length) return `${head}<p class="csm-hint">No captions yet. Generate them on the first tab, record live, or import an SRT/VTT file.</p>`;
    const lines = captionLines(this.captions, this.style);
    this._lineMap = lines.map((l) => [l.from, l.to]);
    const fr = this.fr;
    const fmt = (ms) => { const t = Math.max(0, Math.round(ms / 10)); return `${String(Math.floor(t / 6000)).padStart(2, '0')}:${String(Math.floor((t % 6000) / 100)).padStart(2, '0')}.${String(t % 100).padStart(2, '0')}`; };
    const lang = this.language === 'auto' ? 'Auto' : this.language.toUpperCase();
    return `${head}
      <div class="csm-tools">
        <input type="text" placeholder="Find" value="${esc(fr.find)}" data-fr="find" aria-label="Find" />
        <input type="text" placeholder="Replace with" value="${esc(fr.replace)}" data-fr="replace" aria-label="Replace with" />
        <label class="csm-toggles" style="margin:0"><input type="checkbox" data-fr="matchCase" ${fr.matchCase ? 'checked' : ''} /> Aa</label>
        <button type="button" class="csm-chip" data-act="fr-apply">Find &amp; Replace</button>
      </div>
      <div class="csm-tools">
        <div class="csm-seg3"><button type="button" data-act="case" data-mode="upper">AA</button><button type="button" data-act="case" data-mode="title">Aa</button><button type="button" data-act="case" data-mode="lower">aa</button></div>
        <button type="button" class="csm-chip${this.autoScroll ? ' on' : ''}" data-act="autoscroll">Auto-scroll</button>
        <button type="button" class="csm-chip" data-act="copy">Copy</button>
        <button type="button" class="csm-chip" data-act="add-line">＋ Add</button>
      </div>
      <div class="csm-segs">${lines.map((l, i) => `
        <div class="csm-seg" data-seg="${i}">
          <div class="csm-seg-head">
            <button type="button" class="csm-time" data-act="seek" data-ms="${l.startMs}" aria-label="Play from segment ${i + 1}">◔ ${fmt(l.startMs)} – ${fmt(l.endMs)}</button>
            <span class="csm-dur">${((l.endMs - l.startMs) / 1000).toFixed(1)}s</span>
            <span class="csm-speaking" hidden>● Speaking</span>
            <span class="grow"></span>
            <button type="button" class="csm-mini" data-act="nudge" data-i="${i}" data-d="-100" title="0.1 s earlier" aria-label="Move segment ${i + 1} 0.1 seconds earlier">−0.1s</button>
            <button type="button" class="csm-mini" data-act="nudge" data-i="${i}" data-d="100" title="0.1 s later" aria-label="Move segment ${i + 1} 0.1 seconds later">+0.1s</button>
            <button type="button" class="csm-mini" data-act="edit-line" data-i="${i}" title="Edit text and timing">Edit line</button>
            <button type="button" class="csm-mini" data-act="del-line" data-i="${i}" aria-label="Delete segment ${i + 1}">✕</button>
          </div>
          <div class="csm-seg-words">${this.captions.slice(l.from, l.to).map((c, k) => `<button type="button" class="csm-word" data-act="seek" data-ms="${c.startMs}" data-wi="${l.from + k}" title="Click to jump, double-click to edit">${esc(c.text.trim())}</button>`).join('')}</div>
          ${this.editingLine === i ? `<div class="csm-lineedit"><input type="number" step="0.05" min="0" value="${secs(l.startMs)}" data-line-start="${i}" aria-label="Start (s)" /><input type="number" step="0.05" min="0" value="${secs(l.endMs)}" data-line-end="${i}" aria-label="End (s)" /><input type="text" value="${esc(l.text)}" data-line-text="${i}" aria-label="Caption text" /></div>` : ''}
        </div>`).join('')}</div>
      <div class="csm-foot-note"><span>${lines.length} segments • ${this.captions.length} words • ${lang}</span><span>Click any word to fix spelling</span></div>
      <div class="csm-tools"><span>Shift all (s)</span><input type="number" step="0.05" value="${this.shift}" data-shift style="width:80px" /><button type="button" class="csm-chip" data-act="shift">Apply</button><button type="button" class="csm-chip" data-act="clear">Clear all</button></div>`;
  }

  renderExport() {
    const r = this.result;
    return `
      <h3 class="csm-sec-title"><span class="glyph">⬇</span>Export</h3>
      <p class="csm-hint">Rendered in your browser with the style shown in the preview, keeping the original audio. ${this.caps?.webCodecs === false ? 'This browser lacks WebCodecs, so the render runs in real time.' : 'Output is MP4 where the browser can encode it, otherwise WebM.'} Use <em>Render video</em> under the preview.</p>
      <label class="csm-row"><span>Quality</span><select data-set="renderQuality"><option value="high" ${this.renderQuality === 'high' ? 'selected' : ''}>High</option><option value="veryHigh" ${this.renderQuality === 'veryHigh' ? 'selected' : ''}>Very high (larger file)</option></select></label>
      <label class="csm-row"><span>Size</span><select data-set="renderSize"><option value="original" ${this.renderSize === 'original' ? 'selected' : ''}>Original (up to 4K)</option><option value="1080" ${this.renderSize === '1080' ? 'selected' : ''}>1080p</option><option value="720" ${this.renderSize === '720' ? 'selected' : ''}>720p</option></select></label>
      ${r ? `<h4>Result (${esc(r.ext.toUpperCase())}, ${r.engine === 'webcodecs' ? 'fast render' : 'real-time render'})</h4><video src="${esc(r.url)}" controls playsinline style="width:100%;border-radius:14px;background:#000"></video>` : '<p class="csm-hint">Nothing rendered yet.</p>'}`;
  }

  // ---------------------------------------------------------------- wiring (delegated once; survives refresh())
  onRender() {
    this.ensureStage();
    const slot = this.overlay.querySelector('[data-stage-slot]');
    if (slot && this.stage.parentElement !== slot) slot.appendChild(this.stage);
    this.fitStage();
    this.applyBackdrop();
    this.video.playbackRate = this.speed;
    this.queueSave();
    if (this.overlay._csm) return;
    this.overlay._csm = true;
    const o = this.overlay;
    o.addEventListener('click', (e) => this.onClick(e));
    o.addEventListener('change', (e) => this.onChange(e));
    o.addEventListener('dblclick', (e) => this.editWord(e));
    o.addEventListener('input', (e) => {
      if (e.target.matches('input[type=range],input[type=color]')) this.onChange(e);
      else if (e.target.matches('[data-lib-q]')) { this.libQuery = e.target.value; this.libLimit = 24; this.refresh(); const q = this.overlay.querySelector('[data-lib-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    });
    o.addEventListener('dragover', (e) => { if (e.target.closest?.('[data-drop]')) { e.preventDefault(); e.target.closest('[data-drop]').classList.add('over'); } });
    o.addEventListener('dragleave', (e) => e.target.closest?.('[data-drop]')?.classList.remove('over'));
    o.addEventListener('drop', (e) => {
      if (!e.target.closest?.('[data-drop]')) return;
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f && /^(video|audio)\//.test(f.type)) this.setSource(f);
    });
  }

  applyBackdrop() {
    const BACKDROPS = {
      cinematic: 'linear-gradient(160deg,#1f2a44,#0b0f1a 60%,#3a1c2e)', dark: 'linear-gradient(#202428,#101214)',
      light: 'linear-gradient(#f3f4f6,#d1d5db)', grid: 'repeating-linear-gradient(0deg,#0b0f14 0 23px,#1b2430 23px 24px),repeating-linear-gradient(90deg,#0b0f14 0 23px,#1b2430 23px 24px)',
    };
    this.stage.classList.toggle('phone', !this.srcUrl);
    this.stage.style.background = this.srcUrl ? '#000' : BACKDROPS[this.backdrop] || BACKDROPS.cinematic;
    this.video.style.visibility = this.srcUrl ? 'visible' : 'hidden';
  }

  /** Double-click a word chip to fix it in place. Empty deletes the word; several words share its time. */
  editWord(e) {
    const chip = e.target.closest?.('.csm-word');
    if (!chip) return;
    const i = Number(chip.dataset.wi);
    const c = this.captions[i];
    if (!c) return;
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'csm-word-edit'; input.value = c.text.trim(); input.size = Math.max(4, input.value.length + 1);
    input.setAttribute('aria-label', 'Edit word');
    chip.replaceWith(input);
    input.focus(); input.select();
    let cancelled = false;
    input.addEventListener('keydown', (k) => { if (k.key === 'Enter') input.blur(); if (k.key === 'Escape') { cancelled = true; input.blur(); } k.stopPropagation(); });
    input.addEventListener('blur', () => {
      const v = input.value.trim();
      if (!cancelled && v !== c.text.trim()) {
        const next = this.captions.slice();
        next.splice(i, 1, ...(v ? spreadWords(v, c.startMs, c.endMs, i === 0) : []));
        this.captions = sortCaptions(next);
      }
      this.refresh();
    });
  }

  /** "+ Add": a new two-word caption at the playhead (or after the last one), ready to edit. */
  addLine() {
    const at = this.srcUrl ? Math.round(this.video.currentTime * 1000) : (this.captions.at(-1)?.endMs || 0);
    this.captions = sortCaptions([...this.captions, ...spreadWords('New caption', at, at + 1800, this.captions.length === 0)]);
    this.note = 'Added a caption at the playhead. Double-click a word to change it.';
    this.refresh();
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
      src: () => { this.source = el.dataset.s; this.refresh(); },
      'pick-video': () => this.pickVideo(el.dataset.id),
      'lib-studio': () => { this.libStudio = el.dataset.v; this.libLimit = 24; this.refresh(); },
      'lib-more': () => { this.libLimit += 24; this.refresh(); },
      'job-open': () => this.openJob(el.dataset.id),
      'job-srt': () => this.exportJob(el.dataset.id),
      'job-del': () => deleteJob(el.dataset.id).then(() => this.refreshJobs()),
      'job-clear': () => clearJobs().then(() => this.refreshJobs()),
      cancel: () => { this.controller?.abort(); this.busy = null; this.refresh(); },
      preset: () => { this.style = this.coerceFont({ ...defaultCaptionStyle(el.dataset.preset), fontSize: this.style.fontSize, position: this.style.position, ...(Number.isFinite(this.style.positionY) ? { positionY: this.style.positionY } : {}) }); ensureCaptionFont(this.style, this.fontText()); this.refresh(); },
      seek: () => { this.video.currentTime = Number(el.dataset.ms) / 1000; this.video.play().catch(() => {}); },
      'del-line': () => { this.editingLine = -1; this.captions = removeLine(this.captions, captionLines(this.captions, this.style)[Number(el.dataset.i)]); this.refresh(); },
      shift: () => { this.captions = shiftCaptions(this.captions, Math.round(Number(this.overlay.querySelector('[data-shift]').value || 0) * 1000)); this.refresh(); },
      clear: () => { this.captions = []; this.result = null; this.editingLine = -1; this.refresh(); },
      'dl-srt': () => this.download('captions.srt', captionsToSrt(this.captions, { combineMs: this.style.combineMs }), 'application/x-subrip'),
      'dl-vtt': () => this.download('captions.vtt', captionsToVtt(this.captions, { combineMs: this.style.combineMs }), 'text/vtt'),
      'dl-txt': () => this.download('transcript.txt', captionsToTxt(this.captions, { combineMs: this.style.combineMs }), 'text/plain'),
      'dl-ass': () => this.download('captions.ass', captionsToAss(this.captions, this.style, { width: this.video.videoWidth || 1080, height: this.video.videoHeight || 1920 }), 'text/x-ssa'),
      backdrop: () => { this.backdrop = el.dataset.b; this.refresh(); },
      speed: () => { this.speed = Number(el.dataset.v); this.video.playbackRate = this.speed; this.refresh(); },
      pos: () => { this.style = { ...this.style, position: el.dataset.p }; delete this.style.positionY; this.queueSave(); this.refresh(); },
      filter: () => { this.styleFilter = el.dataset.f; this.refresh(); },
      'reset-style': () => { this.style = this.coerceFont(defaultCaptionStyle(this.style.preset)); ensureCaptionFont(this.style, this.fontText()); this.refresh(); },
      autoscroll: () => { this.autoScroll = !this.autoScroll; this.refresh(); },
      'edit-line': () => { const i = Number(el.dataset.i); this.editingLine = this.editingLine === i ? -1 : i; this.refresh(); },
      'add-line': () => this.addLine(),
      full: () => { this.overlay.querySelector('.csm-dialog').classList.toggle('full'); this.fitStage(); },
      nudge: () => { this.captions = nudgeLine(this.captions, captionLines(this.captions, this.style)[Number(el.dataset.i)], Number(el.dataset.d)); this.refresh(); },
      case: () => { this.captions = changeCase(this.captions, el.dataset.mode); this.refresh(); },
      copy: () => { const text = captionsToPlain(this.captions); (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => { this.note = 'Transcript copied.'; this.refresh(); }, () => { this.errMsg = 'Copying was blocked by the browser.'; this.refresh(); }); },
      'fr-apply': () => { const r = findReplace(this.captions, this.fr.find, this.fr.replace, { matchCase: this.fr.matchCase }); this.captions = r.captions; this.note = r.count ? `Replaced ${r.count} match${r.count === 1 ? '' : 'es'}.` : 'No matches found.'; this.refresh(); },
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
      f?.text().then((text) => { this.captions = captionsFromFile(text, f.name); ensureCaptionFont(this.style, this.fontText()); this.note = `Imported ${this.captions.length} captions from ${f.name}.`; this.tab = 'edit'; this.refresh(); }).catch((err) => this.fail(err));
      return;
    }
    if (t.dataset.set) { this[t.dataset.set] = t.value; return; }
    if (t.dataset.speed !== undefined) { this.speed = Number(t.value); this.video.playbackRate = this.speed; return; }
    if (t.dataset.fr) { this.fr[t.dataset.fr] = t.type === 'checkbox' ? t.checked : t.value; return; }
    if (t.dataset.style) {
      const k = t.dataset.style; const kind = t.dataset.kind;
      if (k === 'position' && t.value === 'custom') return;
      this.style = { ...this.style, [k]: kind === 'bool' ? t.checked : kind === 'num' ? Number(t.value) : kind === 'pct' ? Number(t.value) / 100 : kind === 'rgba' ? hexToRgba(t.value, 0.6) : t.value };
      if (k === 'position') { delete this.style.positionY; this.refresh(); }
      if (k === 'fontFamily' || k === 'bold' || k === 'italic') ensureCaptionFont(this.style, this.fontText());
      this.queueSave();
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

  setBusy(text, progress = 0, kind) {
    this.busy = { text, progress, kind: kind || this.busy?.kind || 'transcribe' };
    const bar = this.overlay?.querySelector('.csm-bar > i');
    const txt = bar?.parentElement?.previousElementSibling;
    if (bar && txt) { bar.style.width = `${Math.round(progress * 100)}%`; txt.textContent = text; } else this.refresh();
  }

  async generate() {
    if (!this.srcUrl) return;
    this.controller?.abort();
    const ctl = new AbortController(); this.controller = ctl;
    this.errMsg = ''; this.note = '';
    this.setBusy('Reading audio…', 0, 'transcribe');
    const t0 = Date.now();
    try {
      const { captions } = await transcribeMedia(this.srcBlob || this.srcUrl, {
        engine: this.engine, model: this.model, language: this.language, signal: ctl.signal,
        onProgress: (p) => this.setBusy(p.stage === 'download' ? `Downloading the free speech model… ${Math.round((p.progress || 0) * 100)}%` : p.stage === 'transcribe' ? 'Transcribing on your device… this can take a while' : 'Reading audio…', p.stage === 'download' ? p.progress : 0.02),
      });
      if (ctl.signal.aborted) return;
      this.captions = sortCaptions(captions);
      ensureCaptionFont(this.style, this.fontText());
      this.busy = null; this.result = null;
      this.processingMs = Date.now() - t0;
      this.note = `${this.captions.length} words transcribed. Pick a look, then render or export.`;
      this.tab = 'edit';
      this.refresh();
      this.saveCurrentJob();
    } catch (err) { this.fail(err); } finally { if (this.controller === ctl) this.controller = null; }
  }

  async renderVideo() {
    const ctl = new AbortController(); this.controller = ctl;
    this.errMsg = ''; this.result = null;
    this.setBusy('Rendering captions into the video…', 0, 'render');
    try {
      const out = await burnCaptions({
        src: this.srcBlob || this.srcUrl, captions: this.captions, style: this.style, signal: ctl.signal,
        quality: this.renderQuality, maxLongEdge: { original: 4096, 1080: 1920, 720: 1280 }[this.renderSize] || 1920,
        onProgress: (p) => this.setBusy(p.stage === 'fallback' ? 'This browser can’t render faster than real time — recording the video with captions…' : 'Rendering captions into the video…', p.progress || 0),
      });
      this.result = out; this.busy = null; this.refresh();
      announceVideo({ url: out.url, title: `${this.srcName || 'Video'} (captioned)`, studio: 'caption-studio' });
      this.saveCurrentJob({ fileSize: out.blob?.size || out.size || 0 });
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
