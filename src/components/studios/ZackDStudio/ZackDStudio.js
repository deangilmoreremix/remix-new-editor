// SmartVid Zack D Studio: one question -> curiosity-loop script -> 3D character sheets -> keyframes -> Veo clips ->
// final cut (+ optional voice, music, burned-in captions). Adapted from
// https://github.com/Anil-matcha/zack-d-films-ai-video-generator (MIT).
//
// Built like the app's other video studios (components/VideoStudio.js): hero banner, floating prompt bar with
// control pills and a Generate button whose label follows the pipeline, card grid with hover-play, result canvas
// controls, right-hand history sidebar, and the shared job / error / notification helpers.
// Backend: /api/zackd (netlify/functions/zackd.js). The final cut runs in the browser (ffmpeg.wasm).
import { mountStudioChrome } from '../../../lib/studioChrome.js';
import { createStudioHeader } from '../../../lib/thumbnails.js';
import { saveGeneration } from '../../../lib/generationHistory.js';
import { uploadFileToSupabase } from '../../../lib/uploadService.js';
import { createPendingJobTracker, resumePendingJobs, getPendingJobs, removePendingJob } from '../../../lib/pendingJobs.js';
import { categorizeGenerationError, createAbortAwareGenerateButton, showInlineError, hideInlineError } from '../../../lib/studioHelpers.js';
import { showToast, createProgressBar } from '../../../lib/loading.js';
import { positionModelSelectorDropdown } from '../../../lib/modelSelectorUI.js';
import { notifyGeneration } from '../../studio/generationNotifications.js';
import { call, runJob, pollJob, pool } from '../../../lib/zackd/api.js';
import { runAssembly, buildSrt, DEFAULT_TRANSITION_SEC } from '../../../lib/zackd/assemble.js';
import { TEMPLATES, TEMPLATE_ATTRIBUTION, templateToProject } from '../../../lib/zackd/templates.js';
import {
  SEED_TOPICS, LOOKS, DEFAULT_LOOK, TTS_VOICES, DEFAULT_VOICE, DEFAULT_TTS_SPEED, UPSTREAM_VOICE, DEFAULT_EXTRAS,
  CAPTION_LANGUAGES, CAPTION_THEMES, DEFAULT_CAPTION_LANGUAGE, DEFAULT_CAPTION_THEME,
  characterSheetPrompt, keyframePrompt, clipPrompt, narrationText, allShots, totalDuration,
} from '../../../../netlify/functions/_shared/zackdPrompts.js';

const STORE_KEY = 'zackd_project_v1';
const HISTORY_KEY = 'zackd_history_v1';
const CONCURRENCY = 3;

// each project gets an id so a job that finishes after a new project/template started is never applied to it
const newPid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const blank = () => ({
  pid: newPid(), topic: '', map: null, approved: false, look: DEFAULT_LOOK, sheets: {}, shots: {}, voice: DEFAULT_VOICE,
  narration: null, music: null, captionLang: DEFAULT_CAPTION_LANGUAGE, captionTheme: DEFAULT_CAPTION_THEME, ...DEFAULT_EXTRAS,
});

function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; } catch { return blank(); }
}
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } };

const el = (tag, cls = '', text = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

// Class strings copied from VideoStudio.js / the results gallery so the look is shared, not re-invented.
const CARD = 'relative group rounded-lg overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col';
const OVERLAY_BTN = 'p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-primary hover:text-black border border-white/10 transition-all';
const SECTION_LABEL = 'text-[10px] font-bold text-secondary uppercase tracking-widest';
const FIELD = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/45 transition-colors';
const SELECT = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/45 transition-colors min-w-[150px]';
const CONTROL_BTN = 'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';
const CANVAS_BTN = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white disabled:opacity-50 disabled:cursor-not-allowed';
const GENERATE_BTN = 'btn-primary-modern px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto shadow-lg';
const ICON = {
  download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  redo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
  ratio: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><rect x="7" y="3" width="10" height="18" rx="2"/></svg>',
  look: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  voice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4"/></svg>',
  templates: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  advanced: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>',
};

export function ZackDStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center justify-start bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden';
  mountStudioChrome(container, { currentRoute: 'zackd' });

  // ---- state -------------------------------------------------------------------------------------------------
  let s = load();
  let disposed = false; // the studio was left (container.cleanup): a late result must not save this instance's stale state
  let assembling = false; let renderStale = false; // an input changed while a render was encoding
  let narrStale = false; // narration was dropped by an edit; the panel repaints on blur
  let history = loadHistory();
  let final = null; // { objectUrl, blob, duration, captioned?: { url } }: in memory only (blob URLs die with the page)
  const trends = SEED_TOPICS;
  const pending = new Set(); // keys of assets whose job is running, e.g. 'kf:beat_1_a'
  let busy = false;
  let progress = null; // createProgressBar element while a batch runs
  const abort = { current: new AbortController() };
  let cancelCtl = null;
  let dropdownOpen = null;
  let outsideClick = null;

  const save = () => {
    if (disposed) return; // this instance's copy is stale once the studio was left; late results go through applyResultToStored
    // `final` holds a Blob + object URL that die with the page; everything else survives a reload.
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* quota or private mode: keep working in memory */ }
  };
  const saveHistory = () => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30))); } catch { /* ignore */ } };
  const sheetList = () => s.map?.character_sheets || [];
  const shotList = () => (s.map ? allShots(s.map) : []);
  const shotPrompt = (shot) => keyframePrompt(shot, sheetList(), { look: s.look, boost: s.consistencyBoost });

  // ---- hero + prompt bar (same structure as VideoStudio.js) ----------------------------------------------------
  const hero = el('div', 'flex flex-col items-center mb-2 md:mb-4 animate-fade-in-up transition-all duration-700 w-full');
  hero.appendChild(createStudioHeader('zackd', 'Zack D Studio', 'Turn one question into a 3D animated explainer short'));
  container.appendChild(hero);

  const promptWrapper = el('div', 'w-full relative z-40 animate-fade-in-up');
  promptWrapper.style.animationDelay = '0.2s';
  const bar = el('div', 'w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl');

  const topRow = el('div', 'flex items-start gap-5 px-2');
  const textarea = el('textarea', 'flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar');
  textarea.setAttribute('data-studio-prompt', '');
  textarea.id = 'z-prompt-textarea';
  textarea.placeholder = 'Ask one curiosity question, e.g. What happens when you swallow gum?';
  textarea.rows = 1;
  textarea.maxLength = 200;
  textarea.setAttribute('aria-label', 'Topic');
  textarea.value = s.topic;
  const grow = () => { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, window.innerWidth < 768 ? 150 : 250)}px`; };
  textarea.oninput = () => { s.topic = textarea.value; save(); grow(); updateAction(); };
  topRow.appendChild(textarea);
  bar.appendChild(topRow);

  // Advanced panel: the extras. Defaults reproduce upstream; each option here is an extension.
  const advanced = el('div', 'hidden flex-col gap-2 px-2 pt-3 border-t border-white/5');
  advanced.id = 'z-advanced-panel';
  const extraBoxes = [];
  const extra = (key, id, label, hint) => {
    const row = el('label', 'flex items-center gap-2 text-sm text-white/80 cursor-pointer');
    const box = el('input'); box.type = 'checkbox'; box.id = id;
    box.checked = key === 'keepClipAudio' ? s.keepClipAudio !== false : !!s[key];
    box.onchange = () => { s[key] = box.checked; save(); };
    extraBoxes.push([key, box]);
    row.append(box, el('span', '', label));
    if (hint) row.title = hint;
    advanced.appendChild(row);
    return box;
  };
  advanced.appendChild(el('div', SECTION_LABEL, 'Final cut and prompts'));
  extra('keepClipAudio', 'zackd-keep-clip-audio', "Keep the clips' own sound (Veo audio)", 'Upstream always keeps it');
  extra('mixVoice', 'zackd-mix-voice', 'Mix in the narration and music I generated', 'Extra: upstream generates them but never mixes them into the video');
  extra('trimToPlanned', 'zackd-trim-planned', 'Trim each clip to its planned 2-4 s shot length', 'Extra: upstream uses each clip at its full length');
  extra('consistencyBoost', 'zackd-boost', 'Add character descriptions to the image prompts (consistency boost)', 'Extra: upstream only names the character sheets');
  bar.appendChild(advanced);

  const bottomRow = el('div', 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2 pt-4 border-t border-white/5');
  const controlsLeft = el('div', 'flex items-center gap-1.5 md:gap-2.5 relative overflow-x-auto no-scrollbar pb-1 md:pb-0');
  const controlBtn = (icon, label, id, tooltip) => {
    const btn = el('button', CONTROL_BTN);
    btn.type = 'button'; btn.id = id;
    if (tooltip) btn.setAttribute('data-tooltip', tooltip);
    btn.innerHTML = `${icon}<span id="${id}-label" class="text-xs font-bold text-white group-hover:text-primary transition-colors"></span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>`;
    btn.querySelector('span').textContent = label;
    return btn;
  };
  const lookBtn = controlBtn(ICON.look, LOOKS[s.look].label.replace(' (upstream)', ''), 'z-look-btn', 'Choose the 3D look');
  const voiceBtn = controlBtn(ICON.voice, s.voice.replace(/_/g, ' '), 'z-voice-btn', 'Choose the narration voice');
  const ratioBtn = el('div', `${CONTROL_BTN} cursor-default`);
  ratioBtn.id = 'z-ar-btn';
  ratioBtn.innerHTML = `${ICON.ratio}<span class="text-xs font-bold text-white">9:16</span>`;
  ratioBtn.title = 'Zack D shorts are always vertical 9:16';
  const templatesBtn = controlBtn(ICON.templates, 'Templates', 'z-templates-btn', 'Start from an upstream template');
  const advancedBtn = controlBtn(ICON.advanced, 'Advanced', 'z-advanced-btn', 'Show advanced options');
  controlsLeft.append(lookBtn, voiceBtn, ratioBtn, templatesBtn, advancedBtn);

  const generateBtn = el('button', GENERATE_BTN);
  generateBtn.type = 'button';
  generateBtn.setAttribute('aria-label', 'Generate');
  bottomRow.append(controlsLeft, generateBtn);
  bar.appendChild(bottomRow);
  promptWrapper.appendChild(bar);
  container.appendChild(promptWrapper);

  // One shared dropdown, as in VideoStudio.js
  const dropdown = el('div', 'fixed left-2 z-[200] transition-all opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 -translate-y-2 w-[calc(100vw-3rem)] max-w-xs shadow-4xl border border-white/10 flex flex-col');
  dropdown.inert = true; // closed: not focusable or clickable
  container.appendChild(dropdown);
  const closeDropdown = () => {
    dropdown.inert = true;
    dropdown.classList.add('opacity-0', 'pointer-events-none');
    dropdown.classList.remove('opacity-100', 'pointer-events-auto');
    dropdownOpen = null;
    if (outsideClick) { window.removeEventListener('click', outsideClick); outsideClick = null; }
  };
  const openDropdown = (type, anchor, title, items) => {
    if (dropdownOpen === type) { closeDropdown(); return; }
    dropdownOpen = type;
    dropdown.replaceChildren();
    dropdown.appendChild(el('div', `${SECTION_LABEL} px-3 py-2 border-b border-white/5 mb-2`, title));
    const list = el('div', 'flex flex-col gap-1 max-h-[50vh] overflow-y-auto custom-scrollbar');
    items.forEach((it) => {
      const row = el('button', 'w-full text-left flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group'); row.type = 'button'; row.setAttribute('aria-pressed', String(!!it.selected));
      const text = el('div', 'flex flex-col');
      text.appendChild(el('span', 'text-xs font-bold text-white opacity-80 group-hover:opacity-100', it.label));
      if (it.hint) text.appendChild(el('span', 'text-[10px] text-white/40 mt-0.5', it.hint));
      row.appendChild(text);
      if (it.selected) row.insertAdjacentHTML('beforeend', ICON.check);
      row.onclick = (e) => { e.stopPropagation(); closeDropdown(); it.onSelect(); };
      list.appendChild(row);
    });
    dropdown.appendChild(list);
    dropdown.inert = false;
    dropdown.classList.remove('opacity-0', 'pointer-events-none');
    dropdown.classList.add('opacity-100', 'pointer-events-auto');
    positionModelSelectorDropdown(dropdown, anchor, 8, container);
    if (window.innerWidth < 768) { dropdown.style.left = '50%'; dropdown.style.transform = 'translateX(-50%)'; }
    outsideClick = () => closeDropdown();
    setTimeout(() => window.addEventListener('click', outsideClick), 0);
  };
  lookBtn.onclick = (e) => { e.stopPropagation(); openDropdown('look', lookBtn, 'Look', Object.entries(LOOKS).map(([id, l]) => ({
    label: l.label, selected: s.look === id, hint: id === DEFAULT_LOOK ? 'Exactly upstream' : 'Extra look, not in upstream',
    onSelect: () => { s.look = id; save(); lookBtn.querySelector('span').textContent = l.label.replace(' (upstream)', ''); },
  }))); };
  voiceBtn.onclick = (e) => { e.stopPropagation(); openDropdown('voice', voiceBtn, 'Narration voice', TTS_VOICES.map((v) => ({
    label: v.replace(/_/g, ' '), selected: s.voice === v, hint: v === UPSTREAM_VOICE ? 'Upstream default (not verified on MuAPI)' : '',
    onSelect: () => { s.voice = v; save(); voiceBtn.querySelector('span').textContent = v.replace(/_/g, ' '); },
  }))); };
  templatesBtn.onclick = (e) => { e.stopPropagation(); openDropdown('templates', templatesBtn, 'Templates', TEMPLATES.map((t) => ({
    label: t.title, hint: t.kind === 'finished' ? 'Script + keyframes + clips' : 'Script only', selected: false, onSelect: () => useTemplate(t),
  }))); };
  advancedBtn.onclick = (e) => {
    e.stopPropagation();
    const open = advanced.classList.toggle('hidden');
    advanced.classList.toggle('flex', !open);
  };

  // ---- stage: script, sheets, shots, audio, final, templates, history -----------------------------------------------
  const stage = el('div', 'w-full mt-8 flex flex-col gap-8 pb-24');
  stage.id = 'z-stage';
  container.appendChild(stage);

  const historySidebar = el('div', 'fixed right-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-xl border-l border-white/5 z-50 flex flex-col items-center py-4 gap-3 overflow-y-auto transition-all duration-500 translate-x-full opacity-0');
  historySidebar.id = 'zackd-history-sidebar';
  historySidebar.appendChild(el('div', 'text-[9px] font-bold text-muted uppercase tracking-widest mb-2', 'History'));
  const historyList = el('div', 'flex flex-col gap-2 w-full px-2');
  historySidebar.appendChild(historyList);
  container.appendChild(historySidebar);

  function renderHistory() {
    historyList.replaceChildren();
    history.forEach((h) => {
      const item = el('div', 'relative group rounded-lg overflow-hidden border border-white/10 cursor-pointer');
      const v = el('video', 'w-full aspect-[9/16] object-cover bg-black'); v.src = h.url; v.muted = true; v.preload = 'metadata'; v.playsInline = true;
      item.appendChild(v);
      const del = el('button', 'absolute top-1 right-1 hidden group-hover:block p-1 bg-black/70 rounded-full text-red-400 text-[10px]', '✕');
      del.title = 'Remove from history'; del.setAttribute('aria-label', 'Remove from history');
      del.onclick = (e) => { e.stopPropagation(); history = loadHistory().filter((x) => x.id !== h.id); saveHistory(); renderHistory(); };
      item.appendChild(del);
      item.onclick = () => lightbox(h.url, 'video');
      historyList.appendChild(item);
    });
    const show = history.length > 0;
    historySidebar.classList.toggle('translate-x-full', !show); historySidebar.classList.toggle('opacity-0', !show);
    historySidebar.classList.toggle('translate-x-0', show); historySidebar.classList.toggle('opacity-100', show);
  }
  function addHistory(url, prompt) {
    // merge against the SAVED history: another studio instance (reopened, or recovering a caption) may have added entries since this one loaded it
    history = [{ id: `${Date.now()}`, url, prompt, ts: Date.now() }, ...loadHistory().filter((h) => h.url !== url)];
    saveHistory();
    if (disposed) window.dispatchEvent(new CustomEvent('zackd:stored-updated', { detail: { slot: 'captions' } })); // tell the live studio to reload its history
    else renderHistory();
  }

  function lightbox(url, kind) {
    const box = el('div', 'fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4');
    box.setAttribute('role', 'dialog');
    const media = el(kind === 'video' ? 'video' : 'img', 'max-w-[95vw] max-h-[90vh] rounded-2xl animate-scale-up');
    media.src = url;
    if (kind === 'video') { media.controls = true; media.autoplay = true; media.loop = true; media.playsInline = true; }
    const close = el('button', 'absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white', '✕');
    close.setAttribute('aria-label', 'Close');
    const done = () => { box.remove(); window.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') done(); };
    close.onclick = done; box.onclick = (e) => { if (e.target === box) done(); };
    window.addEventListener('keydown', onKey);
    box.append(media, close);
    document.body.appendChild(box);
  }

  // Result card, same anatomy as the results gallery: hover-play media, overlay actions, footer.
  function mediaCard({ key, label, kind, url, prompt, aspect = 'aspect-[9/16]', onRedo }) {
    const card = el('div', `${CARD} ${url ? 'cursor-pointer' : ''}`);
    card.dataset.resultCard = key;
    let mediaEl;
    if (pending.has(key)) {
      mediaEl = el('div', `w-full ${aspect} bg-white/5 animate-pulse flex items-center justify-center text-[10px] text-white/40`, 'Generating…');
    } else if (url && kind === 'video') {
      mediaEl = el('video', `w-full ${aspect} object-cover bg-black/40 hover:opacity-80`);
      mediaEl.src = url; mediaEl.muted = true; mediaEl.loop = true; mediaEl.playsInline = true; mediaEl.preload = 'metadata';
      card.onmouseenter = () => { mediaEl.play?.().catch?.(() => {}); };
      card.onmouseleave = () => { mediaEl.pause?.(); try { mediaEl.currentTime = 0; } catch { /* not ready */ } };
    } else if (url) {
      mediaEl = el('img', `w-full ${aspect} object-cover bg-black/40 hover:opacity-80`); mediaEl.src = url; mediaEl.alt = '';
    } else {
      mediaEl = el('div', `w-full ${aspect} bg-white/[0.03] flex items-center justify-center text-[11px] text-white/30`, 'Not generated yet');
    }
    card.appendChild(mediaEl);
    const actions = [];
    if (url) {
      actions.push(['Download', ICON.download, () => { const a = el('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = `${key.replace(/[^a-z0-9]+/gi, '-')}.${kind === 'video' ? 'mp4' : 'png'}`; a.click(); }]);
      if (prompt) actions.push(['Copy prompt', ICON.copy, () => { navigator.clipboard?.writeText(prompt).then(() => showToast('Prompt copied', 'success', 1800)).catch(() => {}); }]);
    }
    if (onRedo) actions.push([url ? 'Redo' : 'Generate', ICON.redo, onRedo]);
    if (actions.length) {
      const over = el('div', 'absolute top-2 right-2 hidden md:flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity');
      actions.forEach(([title, icon, fn]) => {
        const b = el('button', OVERLAY_BTN); b.type = 'button'; b.title = title; b.setAttribute('aria-label', `${title} ${label}`); b.innerHTML = icon;
        b.disabled = busy && title !== 'Download' && title !== 'Copy prompt';
        b.onclick = (e) => { e.stopPropagation(); fn(); };
        over.appendChild(b);
      });
      card.appendChild(over);
    }
    const footer = el('div', 'p-3 bg-black/80 backdrop-blur-sm border-t border-white/5 flex flex-col gap-2');
    footer.appendChild(el('div', 'text-white/70 text-xs line-clamp-2', label));
    if (actions.length) {
      const row = el('div', 'md:hidden flex gap-2'); // touch devices have no hover, so the actions sit in the footer
      actions.forEach(([title, icon, fn]) => {
        const b = el('button', 'px-3 py-1.5 bg-white/10 rounded-lg text-[11px] text-white flex items-center gap-1.5'); b.type = 'button'; b.innerHTML = `${icon}<span>${title}</span>`;
        b.disabled = busy && title !== 'Download' && title !== 'Copy prompt'; b.onclick = (e) => { e.stopPropagation(); fn(); };
        row.appendChild(b);
      });
      footer.appendChild(row);
    }
    card.appendChild(footer);
    if (url && !pending.has(key)) mediaEl.onclick = () => lightbox(url, kind);
    return card;
  }

  const section = (title, hint) => {
    const sec = el('section', 'w-full flex flex-col gap-3');
    sec.appendChild(el('div', SECTION_LABEL, title));
    if (hint) sec.appendChild(el('p', 'text-xs text-white/40', hint));
    return sec;
  };

  function renderStage() {
    stage.replaceChildren();
    hero.classList.toggle('hidden', !!s.map);
    if (progress) stage.appendChild(progress);

    if (s.map) {
      // 1. script: editable beat cards (Gate 1 is the "Approve script" action)
      const sc = section('Script', s.approved ? `${s.map.beats.length} beats · ${shotList().length} shots · about ${Math.round(totalDuration(s.map))}s planned` : `Gate 1: review the beat map (${s.map.beats.length} beats, ${shotList().length} shots). Edit anything, then approve.`);
      if (!s.approved) {
        const rewrite = el('button', CANVAS_BTN, 'Rewrite script'); rewrite.type = 'button'; rewrite.disabled = busy || !s.topic.trim();
        rewrite.onclick = () => { if (window.confirm('Write a new script from the topic? Your edits to this script are replaced.')) writeScript(); };
        sc.appendChild(rewrite);
      }
      const grid = el('div', 'grid gap-3 md:grid-cols-3');
      s.map.beats.forEach((b, bi) => {
        const card = el('div', `${CARD} p-3 gap-2`);
        card.appendChild(el('div', 'text-[10px] font-bold text-muted uppercase tracking-widest', `Beat ${bi + 1}${b.hook ? ' · Hook' : ''} · ${b.title_en}`));
        const nar = el('textarea', `${FIELD} text-sm`); nar.rows = 3; nar.maxLength = 400; nar.value = b.narration; nar.disabled = busy; nar.setAttribute('aria-label', `Narration, beat ${bi + 1}`);
        nar.oninput = () => {
          b.narration = nar.value;
          s.narrRev = (s.narrRev || 0) + 1; // any narration job started before this edit was made from older text
          // the generated voice-over speaks the old text: drop it, and a cut that mixed it in, so it has to be regenerated
          if (s.narration) {
            s.narration = null; narrStale = true;
            if (final?.mixed) { if (final.objectUrl) URL.revokeObjectURL(final.objectUrl); final = null; }
          }
          save();
        };
        nar.onchange = () => { if (narrStale) { narrStale = false; paint(); } }; // repaint once typing is done, so the focus is not lost
        card.appendChild(nar);
        b.shots.forEach((sh) => {
          const row = el('div', 'flex flex-col gap-1');
          row.appendChild(el('span', 'text-[10px] text-white/40', `${sh.shot_id} · ${sh.duration_sec}s planned${sh.zoom_impact ? ' · zoom' : ''}`));
          const d = el('textarea', `${FIELD} text-xs`); d.rows = 2; d.maxLength = 400; d.value = sh.scene_description; d.disabled = busy; d.setAttribute('aria-label', `Scene, ${sh.shot_id}`);
          d.oninput = () => { sh.scene_description = d.value; save(); };
          row.appendChild(d); card.appendChild(row);
        });
        grid.appendChild(card);
      });
      sc.appendChild(grid); stage.appendChild(sc);

      if (s.approved) {
        // 2. character sheets
        const sh = section('Character sheets', 'The consistency anchors. Each keyframe names the sheets it is anchored on.');
        const g = el('div', 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
        sheetList().forEach((x) => g.appendChild(mediaCard({
          key: `sheet:${x.id}`, label: `${x.id.replace(/_/g, ' ')}: ${x.description}`, kind: 'image', url: s.sheets[x.id]?.url, aspect: 'aspect-video',
          prompt: characterSheetPrompt(x, { look: s.look, boost: s.consistencyBoost }), onRedo: () => batch('Character sheet', [x], (i) => `sheet:${i.id}`, genSheet),
        })));
        sh.appendChild(g); stage.appendChild(sh);

        // 3. shots: keyframe, then the Veo clip, in one card per shot
        const shots = section('Shots', 'Keyframes first, then each one is animated with Veo 3.1. Hover a card to play it.');
        const sg = el('div', 'grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5');
        shotList().forEach((x) => {
          const e = s.shots[x.shot_id] || {};
          const clipping = e.keyframe && (e.clip || pending.has(`clip:${x.shot_id}`));
          sg.appendChild(mediaCard(clipping
            ? { key: `clip:${x.shot_id}`, label: `${x.shot_id} · ${x.camera_move.replace(/_/g, ' ')}`, kind: 'video', url: e.clip, prompt: clipPrompt(x), onRedo: () => batch('Clip', [x], (i) => `clip:${i.shot_id}`, genClip, 'Generate this clip?') }
            : { key: `kf:${x.shot_id}`, label: `${x.shot_id} · ${x.camera_move.replace(/_/g, ' ')}`, kind: 'image', url: e.keyframe, prompt: shotPrompt(x), onRedo: () => batch('Keyframe', [x], (i) => `kf:${i.shot_id}`, genKeyframe) }));
        });
        shots.appendChild(sg); stage.appendChild(shots);

        // 4. voice and music (optional extras)
        if (shotList().every((x) => s.shots[x.shot_id]?.clip)) {
          const au = section('Voice and music', 'Optional. Upstream generates narration but never mixes it into the video; turn on "Mix in the narration and music" in Advanced to use them in the cut.');
          const row = el('div', 'grid gap-3 md:grid-cols-2');
          const audioCard = (title, key, urlOf, genLabel, gen, confirmText) => {
            const card = el('div', `${CARD} p-3 gap-2`);
            card.appendChild(el('div', 'text-xs font-bold text-white', title));
            if (title === 'Narration') card.appendChild(el('div', 'text-xs text-white/50 line-clamp-3', narrationText(s.map)));
            if (urlOf()) { const a = el('audio', 'w-full'); a.src = urlOf(); a.controls = true; card.appendChild(a); }
            if (pending.has(key)) card.appendChild(el('div', 'text-[11px] text-white/40 animate-pulse', 'Generating…'));
            const b = el('button', CANVAS_BTN, urlOf() ? `Regenerate ${title.toLowerCase()}` : genLabel); b.type = 'button'; b.disabled = busy;
            b.onclick = () => batch(title, [1], () => key, gen, confirmText);
            card.appendChild(b); return card;
          };
          row.append(
            audioCard('Narration', 'narration', () => s.narration, 'Generate narration', genNarration, 'Generate narration audio?'),
            audioCard('Music', 'music', () => s.music, 'Generate music (optional)', genMusic, 'Generate a music track?'),
          );
          au.appendChild(row); stage.appendChild(au);
        }
      }

      // 5. final cut result, same canvas styling and controls as the Video Studio
      if (final) stage.appendChild(finalSection());
    }

    stage.appendChild(templatesSection());
    renderAction();
  }

  function finalSection() {
    const sec = section('Final cut', 'Rendered in your browser. By default each clip keeps its real length and its own sound, like upstream.');
    const wrap = el('div', 'flex flex-col items-center gap-4');
    const v = el('video', 'max-h-[60vh] max-w-[80vw] rounded-3xl shadow-3xl border border-white/10 interactive-glow object-contain');
    v.src = final.objectUrl; v.controls = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.style.aspectRatio = '9 / 16';
    wrap.appendChild(v);
    const controls = el('div', 'flex flex-wrap gap-3 justify-center');
    const dl = el('button', CANVAS_BTN, 'Download MP4'); dl.type = 'button';
    dl.onclick = () => download(final.blob, 'zackd-short.mp4');
    const srt = el('button', CANVAS_BTN, 'Download captions (.srt)'); srt.type = 'button';
    srt.onclick = () => download(new Blob([buildSrt(s.map.beats, { transition: DEFAULT_TRANSITION_SEC, durations: final.durations })], { type: 'text/plain' }), 'zackd-short.srt');
    const lib = el('button', CANVAS_BTN, final.saved ? 'Saved to library' : 'Save to library'); lib.type = 'button'; lib.disabled = busy || final.saved; lib.onclick = saveToLibrary;
    const fresh = el('button', CANVAS_BTN, 'New project'); fresh.type = 'button'; fresh.disabled = busy; // resetting mid-operation would discard a paid result
    fresh.onclick = () => { if (window.confirm('Start a new project? The current one will be cleared from this browser.')) { newProject(); } };
    controls.append(dl, srt, lib, fresh);
    wrap.appendChild(controls);
    wrap.appendChild(el('p', 'text-xs text-white/40', 'The .srt is a free, separate caption file. To burn animated captions into the video, use the option below.'));

    // Opt-in burned-in captions (MuAPI AI Captions / Vadoo)
    const cap = el('div', `${CARD} p-4 gap-3 w-full max-w-3xl`);
    cap.appendChild(el('div', 'text-sm font-bold text-white', 'Burn captions into the video'));
    cap.appendChild(el('div', 'text-xs text-white/50', 'Animated, word-by-word captions in a viral style. Paid: about $0.20 minimum ($0.005 per second), and it takes 2-3 minutes. Needs narration.'));
    const row = el('div', 'flex gap-2 items-center flex-wrap');
    const lang = el('select', SELECT); lang.setAttribute('aria-label', 'Caption language');
    CAPTION_LANGUAGES.forEach((l) => { const o = el('option', '', l); o.value = l; o.selected = l === s.captionLang; lang.appendChild(o); });
    lang.onchange = () => { s.captionLang = lang.value; save(); };
    const theme = el('select', SELECT); theme.setAttribute('aria-label', 'Caption theme');
    CAPTION_THEMES.forEach((t) => { const o = el('option', '', t.label); o.value = t.value; o.selected = t.value === s.captionTheme; theme.appendChild(o); });
    theme.onchange = () => { s.captionTheme = theme.value; save(); };
    const burn = el('button', CANVAS_BTN, final.captioned ? 'Burn again' : 'Burn captions'); burn.type = 'button';
    burn.disabled = busy || !s.narration || !final.hasNarration; burn.onclick = burnCaptions;
    row.append(lang, theme, burn); cap.appendChild(row);
    if (!s.narration) cap.appendChild(el('div', 'text-xs text-white/40', 'Generate narration first: captions are transcribed from the spoken audio.'));
    else if (!final.hasNarration) cap.appendChild(el('div', 'text-xs text-white/40', 'This cut does not contain the narration. Turn on "Mix in the narration and music" in Advanced and render again, then burn captions.'));
    if (final.captioned) {
      const cv = el('video', 'max-h-[60vh] rounded-2xl bg-black border border-white/10'); cv.src = final.captioned.url; cv.controls = true; cv.loop = true; cv.playsInline = true; cv.style.aspectRatio = '9 / 16';
      cap.appendChild(cv);
      const r2 = el('div', 'flex gap-2 flex-wrap');
      const open = el('a', CANVAS_BTN, 'Open / download captioned video'); open.href = final.captioned.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
      const save2 = el('button', CANVAS_BTN, final.captioned.saved ? 'Saved to library' : 'Save captioned to library'); save2.type = 'button';
      save2.disabled = busy || final.captioned.saved; save2.onclick = saveCaptionedToLibrary;
      r2.append(open, save2); cap.appendChild(r2);
    }
    wrap.appendChild(cap);
    sec.appendChild(wrap);
    return sec;
  }

  // Templates: same card look as the Example Gallery, one tap to load (never calls a paid API).
  function templatesSection() {
    const sec = el('section', 'eg-section w-full');
    sec.id = 'z-templates';
    sec.innerHTML = '<div class="eg-header"><div><div class="eg-title">Templates</div><div class="eg-subtitle"></div></div></div>';
    sec.querySelector('.eg-subtitle').textContent = TEMPLATE_ATTRIBUTION;
    const grid = el('div', 'eg-grid');
    TEMPLATES.forEach((t) => {
      const card = el('div', 'eg-card');
      const media = el('div', 'eg-media');
      if (t.demo) {
        const v = el('video'); v.src = t.demo; v.poster = t.poster; v.controls = true; v.preload = 'none'; v.playsInline = true; v.style.width = '100%'; v.style.aspectRatio = '9 / 16'; v.style.maxHeight = '320px'; v.style.objectFit = 'cover';
        media.appendChild(v);
      } else {
        media.appendChild(el('div', 'text-xs text-white/40 p-6 text-center', 'Script only'));
      }
      const body = el('div', 'p-3 flex flex-col gap-2');
      body.appendChild(el('div', 'text-sm font-bold text-white', t.title));
      body.appendChild(el('div', 'text-xs text-white/50', t.description));
      const use = el('button', CANVAS_BTN, t.kind === 'finished' ? 'Use as template' : 'Use script'); use.type = 'button';
      use.disabled = busy; use.onclick = () => useTemplate(t);
      body.appendChild(use);
      card.append(media, body); grid.appendChild(card);
    });
    sec.appendChild(grid);
    const ideas = el('div', 'flex flex-wrap gap-2 mt-3');
    trends.forEach((t) => {
      const chip = el('button', 'eg-filter-chip', t.topic); chip.type = 'button'; chip.title = t.hook;
      chip.onclick = () => { s.topic = t.topic; textarea.value = t.topic; save(); grow(); updateAction(); textarea.focus(); };
      ideas.appendChild(chip);
    });
    sec.appendChild(ideas);
    return sec;
  }

  // ---- the action button follows the pipeline -----------------------------------------------------------------------
  function nextStep() {
    if (!s.map) return { id: 'script', label: 'Write script ✨', disabled: !s.topic.trim() };
    if (!s.approved) return { id: 'approve', label: 'Approve script ✨' };
    const sheetsTodo = sheetList().filter((x) => !s.sheets[x.id]);
    const kfTodo = shotList().filter((x) => !s.shots[x.shot_id]?.keyframe);
    const clipTodo = shotList().filter((x) => !s.shots[x.shot_id]?.clip);
    // The sheets only anchor the keyframes, so a project that already has its keyframes (e.g. a finished template) skips them.
    if (kfTodo.length && sheetsTodo.length) return { id: 'sheets', label: `Generate ${sheetsTodo.length} character sheet${sheetsTodo.length > 1 ? 's' : ''} ✨` };
    if (kfTodo.length) return { id: 'keyframes', label: `Generate ${kfTodo.length} keyframe${kfTodo.length > 1 ? 's' : ''} ✨` };
    if (clipTodo.length) return { id: 'clips', label: `Animate ${clipTodo.length} clip${clipTodo.length > 1 ? 's' : ''} ✨` };
    return { id: 'final', label: final ? 'Render again ✨' : 'Render final cut ✨' };
  }
  function renderAction() {
    const n = nextStep();
    generateBtn.textContent = busy ? 'Working…' : n.label;
    generateBtn.disabled = busy || !!n.disabled;
    generateBtn.dataset.step = n.id;
  }
  const updateAction = () => renderAction();

  // The panel is built once, so keep its checkboxes in step with the state (e.g. a generated voice switches mixing on).
  const syncExtras = () => extraBoxes.forEach(([key, box]) => { box.checked = key === 'keepClipAudio' ? s.keepClipAudio !== false : !!s[key]; });
  function paint() { syncExtras(); renderStage(); renderHistory(); }
  function fail(e) {
    if (e?.name === 'AbortError') return;
    const { message } = categorizeGenerationError(e);
    const box = showInlineError(container, message, 0);
    promptWrapper.insertAdjacentElement('afterend', box); // right under the bar, not at the bottom of a long page
    showToast(message, 'error');
    box.scrollIntoView?.({ block: 'nearest' }); // a failure low on a long page must not hide above the fold
  }

  // ---- generation ----------------------------------------------------------------------------------------------------
  const slotOf = (job) => job?.historyMeta || {};
  // Merge a result into the LATEST saved project (used once this instance has been disposed, because the user may
  // have returned to the studio and changed the project since; this instance's own copy is stale).
  function applyResultToStored(meta, url) {
    const latest = load();
    if (meta.slot === 'captions') { // a finished standalone video: it belongs in the history whichever project is open now
      const h = [{ id: `${Date.now()}`, url, prompt: meta.topic || latest.topic, ts: Date.now() }, ...loadHistory().filter((x) => x.url !== url)].slice(0, 30);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('zackd:stored-updated', { detail: { slot: 'captions' } })); // a live studio reloads its history
      return;
    }
    if (meta.pid && meta.pid !== latest.pid) return;
    if (meta.slot === 'narration' && meta.rev !== undefined && meta.rev !== (latest.narrRev || 0)) return;
    if (meta.slot === 'sheet') latest.sheets = { ...latest.sheets, [meta.id]: { url } };
    else if (meta.slot === 'keyframe') latest.shots = { ...latest.shots, [meta.id]: { ...(latest.shots[meta.id] || {}), keyframe: url, clip: null } };
    else if (meta.slot === 'clip') latest.shots = { ...latest.shots, [meta.id]: { ...(latest.shots[meta.id] || {}), clip: url } };
    else if (meta.slot === 'narration') { latest.narration = url; latest.mixVoice = true; }
    else if (meta.slot === 'music') { latest.music = url; latest.mixVoice = true; }
    else return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(latest)); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('zackd:stored-updated', { detail: { slot: meta.slot } })); // a studio opened since then holds an older copy: tell it to reload
  }
  // Another (disposed) instance merged a recovered result into the saved project: reload it, so this instance's next
  // save does not overwrite that result with its older copy. Everything this instance changes is already saved.
  const onStoredUpdated = (ev) => {
    if (disposed) return;
    if (ev?.detail?.slot === 'captions') { history = loadHistory(); renderHistory(); return; } // only the history changed
    s = load(); invalidateCuts(ev?.detail?.slot); paint();
  };
  window.addEventListener('zackd:stored-updated', onStoredUpdated);
  // A changed clip/keyframe/narration/music makes any cut built from it stale: flag an in-flight render and drop a finished one.
  function invalidateCuts(slot) {
    if (assembling && (slot === 'clip' || slot === 'keyframe' || slot === 'narration' || slot === 'music')) renderStale = true;
    if (final && (slot === 'clip' || slot === 'keyframe' || ((slot === 'narration' || slot === 'music') && final.mixed))) {
      if (final.objectUrl) URL.revokeObjectURL(final.objectUrl);
      final = null;
    }
  }
  function applyResult(meta, url) {
    if (disposed) { applyResultToStored(meta, url); return; }
    if (meta.slot === 'captions') { addHistory(url, meta.topic || s.topic); showToast('Recovered your captioned video. It is in the history.', 'info', 4000); return; } // a finished standalone video: history, whichever project is open
    if (meta.pid && meta.pid !== s.pid) return; // belongs to an earlier project
    if (meta.slot === 'narration' && meta.rev !== undefined && meta.rev !== (s.narrRev || 0)) return; // made from narration text that has since been edited
    if (meta.slot === 'sheet') s.sheets[meta.id] = { url };
    else if (meta.slot === 'keyframe') s.shots[meta.id] = { ...(s.shots[meta.id] || {}), keyframe: url, clip: null };
    else if (meta.slot === 'clip') s.shots[meta.id] = { ...(s.shots[meta.id] || {}), clip: url };
    else if (meta.slot === 'narration') { s.narration = url; s.mixVoice = true; }
    else if (meta.slot === 'music') { s.music = url; s.mixVoice = true; }
    else return;
    invalidateCuts(meta.slot);
    save();
  }
  // The browser stopped waiting without the provider confirming a result: the paid job may still finish, so keep its record.
  const stoppedWaiting = (e) => e?.name === 'AbortError' || e?.code === 'network' || e?.code === 'timeout';
  // A new request for a slot replaces any retained (cancelled / interrupted) request for the same slot of this project:
  // resuming the older one later must not overwrite the newer asset.
  function supersedeRetained(slot, id, pid, keepRid) {
    for (const j of getPendingJobs('zackd')) {
      const m = j.historyMeta || {};
      if (j.requestId !== keepRid && m.slot === slot && m.id === id && m.pid === pid) removePendingJob(j.requestId);
    }
  }
  // Every media job goes through the app's pending-job tracker so it can be resumed after a reload.
  async function tracked(slot, id, body) {
    const pid = s.pid;
    const rev = slot === 'narration' ? (s.narrRev || 0) : undefined;
    const tracker = createPendingJobTracker('zackd', { slot, id, pid, rev }, { maxAttempts: 180, interval: 4000 });
    const onRequestId = (rid) => { supersedeRetained(slot, id, pid, rid); tracker.onRequestId(rid); };
    let keep = false;
    try {
      const r = await runJob(body, { signal: abort.current.signal, onRequestId });
      applyResult({ slot, id, pid, rev }, r.url);
      return r;
    } catch (e) { keep = stoppedWaiting(e); throw e; } // we stopped waiting (cancel, navigation, lost connection, poll timeout); the paid job may still finish
    finally { tracker.finish({ keep }); }
  }
  const genSheet = (sheet) => tracked('sheet', sheet.id, { kind: 'image', aspect: '16:9', prompt: characterSheetPrompt(sheet, { look: s.look, boost: s.consistencyBoost }) });
  const genKeyframe = (shot) => tracked('keyframe', shot.shot_id, { kind: 'image', aspect: '9:16', prompt: shotPrompt(shot) });
  const genClip = async (shot) => {
    const kf = s.shots[shot.shot_id]?.keyframe;
    if (!kf) throw new Error('Generate the keyframe first.');
    return tracked('clip', shot.shot_id, { kind: 'clip', imageUrl: kf, prompt: clipPrompt(shot) });
  };
  const genNarration = () => {
    const text = narrationText(s.map);
    if (text.length > 3000) throw new Error(`The narration is ${text.length} characters, over the 3,000 the voice service accepts. Shorten some beats and try again.`);
    return tracked('narration', 'narration', { kind: 'tts', text, voice: s.voice, speed: DEFAULT_TTS_SPEED });
  };
  const genMusic = () => tracked('music', 'music', { kind: 'music', prompt: `Underscore for a short about: ${s.topic}`, duration: Math.ceil(totalDuration(s.map)) + 5 });

  // A batch of paid jobs with a cost confirmation, per-card pending state, a progress bar and the shared lifecycle UX.
  async function batch(label, items, keyOf, fn, confirmText) {
    if (busy || !items.length) return;
    if (confirmText && !window.confirm(confirmText)) return;
    busy = true; hideInlineError(container);
    const id = `${label}-${Date.now()}`;
    notifyGeneration({ phase: 'start', id, studio: 'zackd', label });
    items.forEach((i) => pending.add(keyOf(i)));
    progress = createProgressBar(0, 'w-full max-w-2xl');
    const lab = progress.querySelector('.progress-label'); if (lab) lab.textContent = `${label}: 0/${items.length}`;
    cancelCtl = createAbortAwareGenerateButton(generateBtn);
    cancelCtl.showCancel();
    abort.current = cancelCtl.controller;
    paint();
    let done = 0;
    const results = await pool(items, CONCURRENCY, async (item) => {
      try { return await fn(item); } finally {
        pending.delete(keyOf(item)); done += 1;
        progress?.setProgress((done / items.length) * 100);
        const l = progress?.querySelector('.progress-label'); if (l) l.textContent = `${label}: ${done}/${items.length}`;
        paint();
      }
    });
    cancelCtl.reset(); cancelCtl = null; abort.current = new AbortController();
    busy = false; progress = null;
    const failed = results.filter((r) => !r.ok && r.error?.name !== 'AbortError');
    if (failed.length) {
      const fatal = failed.find((r) => r.error?.code === 'need_key' || r.error?.code === 'bad_key');
      const first = String(failed[0].error?.message || 'error').replace(/[.\s]+$/, '');
      fail(new Error(fatal ? fatal.error.message : `${failed.length} of ${items.length} failed: ${first}. Use Redo to retry them.`));
      notifyGeneration({ phase: 'error', id, studio: 'zackd', label, message: first });
    } else {
      showToast(`${label} ready`, 'success', 2500);
      notifyGeneration({ phase: 'success', id, studio: 'zackd', label });
    }
    save(); paint();
  }

  async function writeScript() {
    if (busy || !s.topic.trim()) return;
    busy = true; hideInlineError(container); renderAction();
    cancelCtl = createAbortAwareGenerateButton(generateBtn); cancelCtl.showCancel(); abort.current = cancelCtl.controller;
    try {
      const out = await call({ action: 'script', topic: s.topic.trim() }, { signal: abort.current.signal });
      s = { ...s, pid: newPid(), map: out.map, approved: false, sheets: {}, shots: {}, narration: null, music: null };
      final = null; save();
    } catch (e) { fail(e); }
    cancelCtl.reset(); cancelCtl = null; abort.current = new AbortController();
    busy = false; paint();
  }

  function useTemplate(t) {
    if (busy) return;
    if (s.map && !window.confirm('Replace the current project with this template?')) return;
    const p = templateToProject(t, window.location.origin);
    s = { ...blank(), ...p, look: s.look, voice: s.voice, approved: t.kind === 'finished' };
    textarea.value = s.topic; grow(); final = null; hideInlineError(container); save(); paint();
  }
  function newProject() { if (busy) return; s = blank(); textarea.value = ''; final = null; hideInlineError(container); save(); paint(); }

  async function assemble() {
    if (busy) return;
    const shots = shotList();
    const missing = shots.filter((x) => !s.shots[x.shot_id]?.clip);
    if (missing.length) { fail(new Error(`${missing.length} shot(s) have no clip yet.`)); return; }
    busy = true; hideInlineError(container);
    progress = createProgressBar(0, 'w-full max-w-2xl');
    cancelCtl = createAbortAwareGenerateButton(generateBtn); cancelCtl.showCancel(); abort.current = cancelCtl.controller;
    paint();
    const setLabel = (t) => { const l = progress?.querySelector('.progress-label'); if (l) l.textContent = t; };
    // What this cut is built from, fixed now: the options can still be toggled while it encodes, and the cut's metadata must describe its real inputs.
    const mixVoice = !!s.mixVoice; const narrationUrl = s.narration; const musicUrl = s.music;
    assembling = true; renderStale = false;
    try {
      const { blob, duration, durations } = await runAssembly({
        clips: shots.map((x) => ({ url: s.shots[x.shot_id].clip, planned: x.duration_sec, zoom: x.zoom_impact })),
        narrationUrl, musicUrl, keepClipAudio: s.keepClipAudio !== false, mixVoice, trimToPlanned: !!s.trimToPlanned,
        transition: DEFAULT_TRANSITION_SEC, signal: abort.current.signal,
        onProgress: (phase, p) => { if (phase === 'encode') { progress?.setProgress(p * 100); setLabel(`Encoding ${Math.round(p * 100)}%`); } else setLabel(phase === 'download' ? 'Downloading clips…' : 'Loading encoder…'); },
      });
      if (renderStale) {
        fail(new Error('A clip or the narration changed while this was rendering, so the cut is out of date. Render it again.'));
      } else {
        if (final?.objectUrl) URL.revokeObjectURL(final.objectUrl);
        final = { objectUrl: URL.createObjectURL(blob), blob, duration, durations, saved: false, hasNarration: !!(mixVoice && narrationUrl), mixed: mixVoice }; // captions are transcribed from the cut's audio
        showToast('Final cut ready', 'success', 2500);
      }
    } catch (e) { fail(e); }
    assembling = false;
    cancelCtl.reset(); cancelCtl = null; abort.current = new AbortController();
    busy = false; progress = null; paint();
  }

  async function saveToLibrary() {
    if (!final?.blob || busy) return;
    busy = true; paint();
    try {
      const file = new File([final.blob], `zackd-${(s.map?.title || 'short').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`, { type: 'video/mp4' });
      const { url } = await uploadFileToSupabase(file, { category: 'video' });
      saveGeneration({ studio: 'zackd', type: 'video', url, prompt: s.topic });
      final.saved = true; addHistory(url, s.topic); showToast('Saved to your library', 'success', 2500);
    } catch (e) { fail(new Error(`Couldn't save to library (${e?.message || 'upload failed'}). You can still download it.`)); }
    busy = false; paint();
  }

  // Opt-in, paid: upload the rendered cut to MuAPI, then burn animated captions in with ai-captions (Vadoo).
  async function burnCaptions() {
    if (!final?.blob || busy) return;
    if (!s.narration) { fail(new Error('Captions are generated from the spoken audio. Add narration first.')); return; }
    if (!final.hasNarration) { fail(new Error('This cut does not include the narration. Mix it in (Advanced) and render again before burning captions.')); return; }
    if (!window.confirm('Burn captions into the video with MuAPI AI Captions? About $0.20 minimum ($0.005 per second), and it takes a few minutes.')) return;
    busy = true; hideInlineError(container);
    progress = createProgressBar(0, 'w-full max-w-2xl');
    cancelCtl = createAbortAwareGenerateButton(generateBtn); cancelCtl.showCancel(); abort.current = cancelCtl.controller;
    paint();
    const setLabel = (t) => { const l = progress?.querySelector('.progress-label'); if (l) l.textContent = t; };
    setLabel('Uploading the video…');
    const cut = final; // the cut this burn belongs to
    // recorded like the other paid jobs, so a reload while it runs can still recover the result (into the history)
    const tracker = createPendingJobTracker('zackd', { slot: 'captions', id: 'captions', pid: s.pid }, { maxAttempts: 300, interval: 4000 });
    let keepJob = false;
    try {
      const { muapi } = await import('../../../lib/muapi.js');
      const file = new File([final.blob], 'zackd-cut.mp4', { type: 'video/mp4' });
      const videoUrl = await muapi.uploadFile(file, { signal: abort.current.signal });
      setLabel('Burning captions (2-3 minutes)…');
      const r = await runJob({ kind: 'captions', videoUrl, language: s.captionLang, theme: s.captionTheme }, { signal: abort.current.signal, onRequestId: tracker.onRequestId });
      cut.captioned = { url: r.url, saved: false };
      if (final !== cut || disposed) { addHistory(r.url, s.topic); showToast('Captions ready. The cut changed meanwhile, so the captioned video is in the history.', 'info', 4000); } // its cut is no longer shown: keep the paid result reachable
      else showToast('Captions ready', 'success', 2500);
    } catch (e) { fail(e); keepJob = stoppedWaiting(e); }
    tracker.finish({ keep: keepJob });
    cancelCtl.reset(); cancelCtl = null; abort.current = new AbortController();
    busy = false; progress = null; paint();
  }

  function saveCaptionedToLibrary() {
    const c = final?.captioned;
    if (!c || c.saved) return;
    saveGeneration({ studio: 'zackd', type: 'video', url: c.url, prompt: s.topic });
    c.saved = true; addHistory(c.url, s.topic); showToast('Saved to your library', 'success', 2500); paint();
  }

  function download(blob, name) {
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // The Generate button runs whichever step is next.
  generateBtn.onclick = () => {
    closeDropdown();
    const n = nextStep();
    if (n.id === 'script') writeScript();
    else if (n.id === 'approve') {
      s.approved = true; save(); paint();
      const todo = sheetList().filter((x) => !s.sheets[x.id]);
      if (todo.length) batch('Character sheets', todo, (x) => `sheet:${x.id}`, genSheet, `Generate ${todo.length} character sheet image(s)?`);
    } else if (n.id === 'sheets') {
      const todo = sheetList().filter((x) => !s.sheets[x.id]);
      batch('Character sheets', todo, (x) => `sheet:${x.id}`, genSheet, `Generate ${todo.length} character sheet image(s)?`);
    } else if (n.id === 'keyframes') {
      const todo = shotList().filter((x) => !s.shots[x.shot_id]?.keyframe);
      batch('Keyframes', todo, (x) => `kf:${x.shot_id}`, genKeyframe, `Generate ${todo.length} keyframe image(s)?`);
    } else if (n.id === 'clips') {
      const todo = shotList().filter((x) => !s.shots[x.shot_id]?.clip);
      batch('Clips', todo, (x) => `clip:${x.shot_id}`, genClip, `Generate ${todo.length} video clip(s) with Veo 3.1? This is the most expensive step.`);
    } else assemble();
  };

  // Jobs that were running when the page was reloaded are picked up again (same helper the other studios use).
  resumePendingJobs('zackd', {
    poll: (rid, attempts, interval) => pollJob(rid, attempts, interval),
    onResult: (url, job) => { applyResult(slotOf(job), url); if (!disposed) paint(); showToast('Recovered a generation that was still running', 'info', 3000); },
  });

  paint();
  grow();
  container.cleanup = () => {
    disposed = true;
    window.removeEventListener('zackd:stored-updated', onStoredUpdated);
    abort.current.abort();
    closeDropdown();
    if (final?.objectUrl) URL.revokeObjectURL(final.objectUrl);
  };
  return container;
}

export default ZackDStudio;
