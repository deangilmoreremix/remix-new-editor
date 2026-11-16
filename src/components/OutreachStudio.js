// src/components/OutreachStudio.js
//
// Video Outreach studio (route: #/outreach), a standalone studio: record one
// video, greet each contact by name in your own (cloned) voice, write the
// landing page, add contacts, generate every contact's personal link, and
// track who watched. Nothing here opens the Timeline Editor.
//
// A campaign is one published video played by the public page /watch/<id>;
// each contact's link (?c=<id>&firstName=…) picks their voiced greeting and
// fills the landing text. The logic lives in src/lib/outreach/draft.js.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { emailFor, mailtoUrl, mailMergeCsv, gmailUrl, linkedinMessage } from '../lib/outreach/email.js';
import { WRITER_LANGUAGES } from '../lib/outreach/aiWriter.js';

// Caption translation languages (src/lib/editor/ml/modelRegistry.js TRANSLATE_LANGUAGES).
const TRANSLATE_LANGS = [['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['pl', 'Polish'], ['ru', 'Russian'], ['tr', 'Turkish'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['sv', 'Swedish'], ['en', 'English']];
import {
  STEPS, SETUP_STEPS, STOCK_VOICES, FIRST_NAME_FALLBACKS, CONTACT_FIELDS, CSV_TEMPLATE, MAX_CONTACTS,
  loadDraft, saveDraft, stepErrors, fillTemplate, speakRequest, tokensIn,
  parseCsv, guessMapping, contactsFromRows, contactsFromLeads, makeContact, mergeContacts, contactProfile, contactValues,
  buildCampaignProject, campaignLinks, siteKey, sitesToCapture, calendarEmbedUrl,
  usesBackground, fallbackShotFor, backgroundShotFor, contactProfileFor, addressesToCapture, mapKey,
  saveToLibrary, listLibrary, libraryDraft, newDynamicVideo, cleanPage,
} from '../lib/outreach/draft.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, { primary = false, small = false } = {}) {
  const b = el('button', [
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
    small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
    primary ? 'bg-primary text-black hover:brightness-95' : 'border border-white/15 text-white hover:border-primary/60',
  ].join(' '), label);
  b.type = 'button';
  return b;
}

function field(labelText, input, hint) {
  const wrap = el('label', 'flex flex-col gap-1.5');
  wrap.appendChild(el('span', 'text-xs font-semibold text-secondary', labelText));
  wrap.appendChild(input);
  if (hint) wrap.appendChild(el('span', 'text-[11px] text-white/45', hint));
  return wrap;
}

function textInput(value, placeholder = '') {
  const i = el('input', 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-primary/60 outline-none');
  i.value = value ?? '';
  i.placeholder = placeholder;
  return i;
}

// Variable chips (Sendspark's "dynamic variables"): click one to insert it where the cursor is.
const VARIABLES = [['{{firstname}}', 'First name'], ['{{company}}', 'Company'], ['{{jobtitle}}', 'Job title'], ['{{lastname}}', 'Last name']];
function variableChips(input, { onInsert, only } = {}) {
  const row = el('div', 'flex flex-wrap items-center gap-1.5');
  row.appendChild(el('span', 'text-[11px] text-white/45', 'Insert:'));
  for (const [token, label] of VARIABLES.filter(([t]) => !only || only.includes(t))) {
    const b = el('button', 'rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20', label);
    b.type = 'button';
    b.setAttribute('data-variable', token);
    // mousedown keeps the input's cursor position.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      const at = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? at;
      input.value = `${input.value.slice(0, at)}${token}${input.value.slice(end)}`;
      input.focus();
      input.setSelectionRange?.(at + token.length, at + token.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      onInsert?.();
    });
    row.appendChild(b);
  }
  return row;
}

function card(title, sub) {
  const c = el('section', 'rounded-2xl border border-white/10 bg-panel-bg p-5 flex flex-col gap-4');
  if (title) c.appendChild(el('h2', 'text-base font-extrabold text-white', title));
  if (sub) c.appendChild(el('p', 'text-sm text-secondary -mt-3', sub));
  return c;
}

const fmtTime = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, '0')}`;
const userId = () => globalThis.window?.Clerk?.user?.id || null;

async function uploadToStorage(file) {
  const { uploadFileToStorage } = await import('../lib/hybrid-supabase.js');
  const out = await uploadFileToStorage(file);
  const url = typeof out === 'string' ? out : out?.url;
  if (!url || url.startsWith('blob:')) throw new Error('Upload failed. Sign in and try again.');
  return url;
}

function videoDuration(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });
}

export function OutreachStudio() {
  const container = el('div', 'w-full h-full flex flex-col overflow-hidden bg-app-bg text-white');
  mountStudioChrome(container, { title: 'Video Outreach', currentRoute: 'outreach' });

  const draft = loadDraft();
  // The last recording stays in memory so its sound can become the voice sample.
  let recordingBlob = null;
  let busy = '';
  let notice = '';
  // Like Sendspark, the studio opens on the Videos library; a draft in progress is one click away.
  let step = STEPS.length;
  const resumeStep = () => { for (let s = 1; s <= SETUP_STEPS + 1; s++) if (stepErrors(draft, s).length) return s; return SETUP_STEPS + 1; };
  // Generation progress per prospect: { total, done, phase }.
  let progress = null;
  // CSV waiting for its columns to be matched, the running generation, and the campaigns list.
  let pendingCsv = null;
  let pendingLeads = null; // { loading, error, leads, picked:Set }
  // Who opened, watched and clicked, per contact, for the links list: { id, loading, byContact }.
  let linkStats = { id: null, loading: false, byContact: null };
  let abort = null;
  const campaigns = { loaded: false, loading: false, rows: [], error: '', openId: null, stats: {} };

  const stepper = el('div', 'flex flex-wrap gap-2 px-4 md:px-8 pt-5');
  const scroll = el('div', 'flex-1 overflow-y-auto');
  // Bottom padding keeps the footer buttons clear of the floating Ask SmartVideo button.
  const inner = el('div', 'max-w-6xl mx-auto w-full px-4 md:px-8 pt-6 pb-28 flex flex-col gap-5');
  scroll.appendChild(inner);
  container.append(stepper, scroll);

  // A generated campaign is also kept in the Videos library, so it can be opened again later.
  const persist = () => { saveDraft(draft); if (draft.campaign) saveToLibrary(draft); };
  const replaceDraft = (next) => { for (const k of Object.keys(draft)) delete draft[k]; Object.assign(draft, next); edit = { trimStart: 0, trimEnd: null, cuts: [], before: null, after: null }; linkStats = { id: null, loading: false, byContact: null }; pendingCsv = null; pendingLeads = null; persist(); };
  const setBusy = (label) => { busy = label; render(); };
  const fail = (err) => { busy = ''; notice = err?.message || String(err); render(); };

  // ---- Step 1: Record ----------------------------------------------------
  async function addVideo(blob, { duration, hasAudio = true, type = 'upload', name = 'outreach.webm' } = {}) {
    notice = '';
    setBusy('Uploading your video…');
    try {
      recordingBlob = blob;
      const file = blob instanceof File ? blob : new File([blob], name, { type: blob.type || 'video/webm' });
      const url = await uploadToStorage(file);
      const seconds = duration || await videoDuration(url);
      draft.video = { url, duration: Math.round(seconds), hasAudio, type };
      // A new recording means new captions, a new voice sample and greeting.
      draft.captions = null;
      edit = { trimStart: 0, trimEnd: null, cuts: [], before: null, after: null };
      draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 };
      persist();
      busy = '';
      render();
    } catch (err) { fail(err); }
  }

  async function openRecorder(type = 'both') {
    const { RecorderModal } = await import('./modals/RecorderModal.jsx');
    const modal = new RecorderModal({
      // The Script card's script shows in the recorder's teleprompter; edits there come back.
      script: draft.script || '',
      onScriptChange: (script) => { draft.script = script; persist(); },
      onComplete: (result) => {
        if (result?.type === 'audio') return voiceSampleFrom(result.blob);
        addVideo(result.blob, { duration: result.duration, hasAudio: result.hasAudio, type: result.type });
      },
    });
    modal.recordingType = type;
    modal.open();
  }

  // The full Remotion Recorder (multi-camera, captions, scenes, B-roll, end card), exported in
  // the browser and brought back as this campaign's video.
  async function openFullRecorder() {
    const { openRecorderStudio } = await import('../features/recorder/mount.tsx');
    openRecorderStudio({
      onUseVideo: (v) => addVideo(v.blob, { duration: v.durationInFrames / v.fps, hasAudio: true, type: 'recorder', name: v.name }),
    });
  }

  // ---- Edit: trim, cut, add a clip before/after (src/lib/outreach/videoEdit.jsx) -------------
  let edit = { trimStart: 0, trimEnd: null, cuts: [], before: null, after: null };
  const fmtS = (n) => `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, '0')}`;

  function renderEditPanel() {
    const box = el('div', 'flex flex-col gap-3 rounded-xl border border-white/10 p-4');
    box.setAttribute('data-outreach-edit', '');
    box.appendChild(el('div', 'text-sm font-bold', 'Edit'));
    const dur = draft.video.duration || 0;
    const end = edit.trimEnd ?? dur;
    const slider = (label, value, onInput, attr) => {
      const row = el('label', 'flex items-center gap-3 text-xs');
      const r = el('input', 'flex-1 accent-[#d9ff00]'); r.type = 'range'; r.min = '0'; r.max = String(dur); r.step = '0.1'; r.value = String(value);
      r.setAttribute(attr, '');
      const v = el('span', 'w-14 text-right tabular-nums text-white/60', fmtS(value));
      r.addEventListener('input', () => { v.textContent = fmtS(Number(r.value)); onInput(Number(r.value)); });
      row.append(el('span', 'w-24 text-secondary', label), r, v);
      return row;
    };
    const seekPreview = (t) => { const v = container.querySelector('[data-outreach-edit-preview] video, .aspect-video video'); if (v) v.currentTime = t; };
    box.append(
      slider('Start at', edit.trimStart, (t) => { edit.trimStart = Math.min(t, (edit.trimEnd ?? dur) - 0.5); seekPreview(t); }, 'data-edit-start'),
      slider('End at', end, (t) => { edit.trimEnd = Math.max(t, edit.trimStart + 0.5); seekPreview(t); }, 'data-edit-end'),
    );
    // Cuts from the middle.
    const cutRow = el('div', 'flex flex-wrap items-center gap-2 text-xs');
    const from = el('input', 'w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-white'); from.type = 'number'; from.step = '0.1'; from.min = '0'; from.placeholder = 'from (s)';
    const to = el('input', 'w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-white'); to.type = 'number'; to.step = '0.1'; to.min = '0'; to.placeholder = 'to (s)';
    from.setAttribute('data-cut-from', ''); to.setAttribute('data-cut-to', '');
    const addCut = button('Cut this part out', { small: true });
    addCut.setAttribute('data-cut-add', '');
    addCut.addEventListener('click', () => {
      const a = Number(from.value); const b = Number(to.value);
      if (!(b > a)) { notice = 'Set where the cut starts and ends (seconds).'; render(); return; }
      edit.cuts = [...edit.cuts, [a, Math.min(b, dur)]]; render();
    });
    cutRow.append(el('span', 'w-24 text-secondary', 'Cut a section'), from, to, addCut);
    box.appendChild(cutRow);
    edit.cuts.forEach(([a, b], i) => {
      const r = el('div', 'flex items-center gap-2 text-xs text-white/70');
      const rm = button('Undo', { small: true });
      rm.addEventListener('click', () => { edit.cuts = edit.cuts.filter((_, j) => j !== i); render(); });
      r.append(el('span', '', `Cut ${fmtS(a)} – ${fmtS(b)}`), rm);
      box.appendChild(r);
    });
    // Combine: a clip before (intro) or after (demo).
    const clipRow = el('div', 'flex flex-wrap items-center gap-2 text-xs');
    clipRow.appendChild(el('span', 'w-24 text-secondary', 'Combine'));
    for (const where of ['before', 'after']) {
      const f = el('input'); f.type = 'file'; f.accept = 'video/*'; f.hidden = true;
      f.addEventListener('change', async () => {
        const file = f.files?.[0]; f.value = '';
        if (!file) return;
        const src = URL.createObjectURL(file);
        edit[where] = { src, duration: await videoDuration(src), name: file.name };
        render();
      });
      const b = button(edit[where] ? `${where === 'before' ? 'Before' : 'After'}: ${edit[where].name.slice(0, 18)} ✕` : `Add a clip ${where}`, { small: true });
      b.setAttribute(`data-edit-${where}`, '');
      b.addEventListener('click', () => { if (edit[where]) { URL.revokeObjectURL(edit[where].src); edit[where] = null; render(); } else f.click(); });
      clipRow.append(b, f);
    }
    box.appendChild(clipRow);
    const total = editSegmentsInfo();
    const applyRow = el('div', 'flex flex-wrap items-center gap-2');
    const apply = button('Apply edits', { primary: !total.unchanged, small: true });
    apply.setAttribute('data-edit-apply', '');
    apply.disabled = total.unchanged || !!busy;
    apply.addEventListener('click', applyEdits);
    applyRow.append(apply, el('span', 'text-xs text-white/50', total.unchanged ? 'No changes yet.' : `New length ${fmtS(total.seconds)} (was ${fmtS(dur)}).`));
    box.appendChild(applyRow);
    return box;
  }

  let editModule = null;
  function editSegmentsInfo() {
    if (!editModule) { import('../lib/outreach/videoEdit.jsx').then((m) => { editModule = m; if (step === 1) render(); }); return { unchanged: true, seconds: 0 }; }
    const main = { src: draft.video.url, duration: draft.video.duration };
    const segs = editModule.buildSegments({ main, edits: edit, before: edit.before, after: edit.after });
    return { segs, unchanged: editModule.isUnchanged(segs, main), seconds: editModule.segmentsDuration(segs) };
  }

  async function applyEdits() {
    const { segs } = editSegmentsInfo();
    abort = new AbortController();
    try {
      setBusy('Applying edits…');
      const out = await editModule.renderSegments(segs, {
        signal: abort.signal,
        onProgress: (p) => { busy = `Applying edits… ${Math.round(p * 100)}%`; const b = container.querySelector('[data-outreach-busy]'); if (b) b.textContent = busy; },
      });
      abort = null; busy = '';
      await addVideo(out.blob, { duration: out.duration, hasAudio: draft.video.hasAudio, type: draft.video.type, name: `edited.${/webm/.test(out.mimeType) ? 'webm' : 'mp4'}` });
      notice = 'Edits applied. Check the voice step: the voice sample comes from the new video.';
      render();
    } catch (err) {
      abort = null;
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped.'; render(); return; }
      fail(err);
    }
  }

  // ---- Captions: Whisper in the browser, free translations (src/lib/outreach/transcript.js) ----
  let captionLang = 'es';
  function renderCaptionsPanel() {
    const box = el('div', 'flex flex-col gap-3 rounded-xl border border-white/10 p-4');
    box.setAttribute('data-outreach-captions', '');
    box.appendChild(el('div', 'text-sm font-bold', 'Captions and transcript'));
    const c = draft.captions;
    if (!c?.lines?.length) {
      box.appendChild(el('p', 'text-xs text-secondary', 'Make captions from your recording. They show as a transcript under the video on each contact\u2019s page. Made in your browser (the speech model downloads once, about 80 MB).'));
      const make = button('Make captions', { small: true, primary: true });
      make.setAttribute('data-captions-make', '');
      make.disabled = !!busy;
      make.addEventListener('click', makeCaptions);
      box.appendChild(make);
      return box;
    }
    const list = el('div', 'max-h-40 overflow-y-auto rounded-lg bg-white/[0.03] p-2 text-xs leading-relaxed text-white/80');
    list.setAttribute('data-captions-list', '');
    c.lines.forEach((l, i) => {
      const row = el('div', 'flex gap-2');
      const inp = el('input', 'flex-1 bg-transparent text-white/85 outline-none focus:text-white');
      inp.value = l.text;
      inp.addEventListener('change', () => { c.lines[i] = { ...l, text: inp.value.trim() || l.text }; persist(); });
      row.append(el('span', 'w-10 shrink-0 tabular-nums text-white/40', `${Math.floor(l.startMs / 60000)}:${String(Math.floor(l.startMs / 1000) % 60).padStart(2, '0')}`), inp);
      list.appendChild(row);
    });
    box.appendChild(list);
    const trRow = el('div', 'flex flex-wrap items-center gap-2 text-xs');
    const sel = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-white');
    for (const [code, label] of TRANSLATE_LANGS) { if (code === c.lang) continue; const o = el('option', 'bg-neutral-900', label); o.value = code; o.selected = code === captionLang; sel.appendChild(o); }
    sel.addEventListener('change', () => { captionLang = sel.value; });
    const tr = button('Add translation', { small: true });
    tr.setAttribute('data-captions-translate', '');
    tr.disabled = !!busy;
    tr.addEventListener('click', () => translateCaptionsTo(sel.value));
    const langs = Object.keys(c.translations || {});
    trRow.append(el('span', 'text-secondary', 'Captions in other languages:'), sel, tr, el('span', 'text-white/50', langs.length ? `Added: ${langs.map((l) => TRANSLATE_LANGS.find(([x]) => x === l)?.[1] || l).join(', ')}` : ''));
    const redo = button('Make again', { small: true });
    redo.addEventListener('click', makeCaptions);
    box.append(trRow, redo);
    return box;
  }

  async function makeCaptions() {
    abort = new AbortController();
    try {
      setBusy('Making captions: reading the audio…');
      const [{ transcribeInBrowser }, { transcriptLines }] = await Promise.all([
        import('../lib/editor/remotion/transcribe.js'),
        import('../lib/outreach/transcript.js'),
      ]);
      const { captions } = await transcribeInBrowser(draft.video.url, {
        signal: abort.signal,
        onProgress: (p) => { busy = p.stage === 'download' ? `Downloading the speech model… ${Math.round((p.progress || 0) * 100)}%` : 'Making captions…'; const b = container.querySelector('[data-outreach-busy]'); if (b) b.textContent = busy; },
      });
      draft.captions = { lang: 'en', lines: transcriptLines(captions), translations: {} };
      persist();
      abort = null; busy = ''; notice = `Captions made: ${draft.captions.lines.length} lines. Fix any word by clicking it.`;
      render();
    } catch (err) {
      abort = null;
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped.'; render(); return; }
      fail(err);
    }
  }

  async function translateCaptionsTo(code) {
    abort = new AbortController();
    try {
      setBusy('Translating captions (in your browser)…');
      const { translateCaptions } = await import('../lib/editor/ml/localAI.js');
      const lines = await translateCaptions(draft.captions.lines.map((l) => ({ text: l.text, startMs: l.startMs, endMs: l.endMs })), code, { src: draft.captions.lang, signal: abort.signal });
      draft.captions = { ...draft.captions, translations: { ...(draft.captions.translations || {}), [code]: lines.map((l) => ({ startMs: l.startMs, endMs: l.endMs, text: l.text })) } };
      persist();
      abort = null; busy = ''; notice = 'Translation added. Viewers can switch language under the video.';
      render();
    } catch (err) {
      abort = null;
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped.'; render(); return; }
      fail(err);
    }
  }

  // Script + AI writer (Sendspark "Scripts & Teleprompter"). The script shows in the recorder's
  // teleprompter; the writer can also draft the email and the landing page text.
  const writer = { open: false, kind: 'script', audience: '', message: '', language: 'English', useName: true, busy: false };
  function renderScriptCard() {
    const box = card('Script', 'Read it from the teleprompter while you record.');
    box.setAttribute('data-outreach-script', '');
    const ta = el('textarea', 'w-full min-h-[130px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60');
    ta.placeholder = '[pause]\nI recorded this for you because…';
    ta.value = draft.script || '';
    ta.addEventListener('input', () => { draft.script = ta.value; persist(); });
    const toggle = button(writer.open ? 'Close AI writer' : 'Write with AI', { small: true });
    toggle.setAttribute('data-outreach-ai-writer', '');
    toggle.addEventListener('click', () => { writer.open = !writer.open; render(); });
    box.append(ta, toggle);
    if (!writer.open) return box;

    const w = el('div', 'flex flex-col gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3');
    const tabs = el('div', 'flex gap-1');
    for (const [k, label] of [['script', 'Script'], ['email', 'Email'], ['page', 'Page']]) {
      const b = button(label, { small: true, primary: writer.kind === k });
      b.setAttribute('data-writer-kind', k);
      b.addEventListener('click', () => { writer.kind = k; render(); });
      tabs.appendChild(b);
    }
    const audience = textInput(writer.audience, 'e.g. heads of sales at B2B software companies');
    audience.addEventListener('input', () => { writer.audience = audience.value; });
    const message = el('textarea', 'w-full min-h-[70px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-primary/60');
    message.placeholder = 'What you want to say, e.g. we cut their reps\u2019 prep time in half; ask for a 15-minute call';
    message.value = writer.message;
    message.addEventListener('input', () => { writer.message = message.value; });
    const lang = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white');
    for (const [l] of WRITER_LANGUAGES) { const o = el('option', 'bg-neutral-900', l); o.value = l; o.selected = l === writer.language; lang.appendChild(o); }
    lang.addEventListener('change', () => { writer.language = lang.value; });
    const nameOn = el('input'); nameOn.type = 'checkbox'; nameOn.checked = writer.useName;
    nameOn.addEventListener('change', () => { writer.useName = nameOn.checked; });
    const nameRow = el('label', 'flex items-center gap-2 text-xs'); nameRow.append(nameOn, el('span', '', 'Use the prospect\u2019s name ({{firstname}})'));
    const go = button(writer.busy ? 'Writing…' : `Write the ${writer.kind === 'page' ? 'landing page' : writer.kind}`, { primary: true, small: true });
    go.setAttribute('data-writer-go', '');
    go.disabled = writer.busy;
    go.addEventListener('click', runWriter);
    w.append(tabs, field('Who it\u2019s for', audience), field('What you want to say', message), field('Language', lang), nameRow, go,
      el('p', 'text-[11px] text-white/45', writer.kind === 'script' ? 'Fills the script above.' : writer.kind === 'email' ? 'Fills the email subject and message (Generate step).' : 'Fills the landing page header, message and button label (Customize step).'),
      el('p', 'text-[11px] text-white/45', 'Uses one small text request on your MuAPI key.'));
    box.appendChild(w);
    return box;
  }

  async function translateCampaign() {
    const language = draft.language || 'English';
    abort = new AbortController();
    try {
      setBusy(`Translating into ${language}…`);
      const { translateTexts, muapiGenerate } = await import('../lib/outreach/aiWriter.js');
      const out = await translateTexts({
        greeting: draft.greeting, header: draft.header, message: draft.message, ctaLabel: draft.cta?.label,
        subject: draft.email?.subject, body: draft.email?.body, thumbText: draft.email?.thumbText,
      }, language, { generate: muapiGenerate, signal: abort.signal });
      if (out.greeting) draft.greeting = out.greeting.slice(0, 70);
      if (out.header) draft.header = out.header;
      if (out.message) draft.message = out.message;
      if (out.ctaLabel) draft.cta = { ...draft.cta, label: out.ctaLabel.slice(0, 40) };
      draft.email = { ...draft.email, ...(out.subject ? { subject: out.subject } : {}), ...(out.body ? { body: out.body } : {}), ...(out.thumbText ? { thumbText: out.thumbText } : {}) };
      draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 };
      draft.campaign = null;
      persist();
      abort = null; busy = ''; notice = `Translated into ${language}. Generate the greeting again to hear it.`;
      render();
    } catch (err) {
      abort = null;
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped.'; render(); return; }
      fail(err);
    }
  }

  async function runWriter() {
    writer.busy = true; notice = ''; render();
    try {
      const { writeWithAI, muapiGenerate } = await import('../lib/outreach/aiWriter.js');
      const seconds = draft.video?.duration || 60;
      const out = await writeWithAI(writer.kind, { ...writer, seconds }, { generate: muapiGenerate });
      if (writer.kind === 'script') draft.script = out.script;
      else if (writer.kind === 'email') draft.email = { ...draft.email, subject: out.subject, body: out.body };
      else {
        draft.header = out.header;
        if (out.message) draft.message = out.message;
        if (out.cta) draft.cta = { ...draft.cta, label: out.cta };
      }
      persist();
      notice = writer.kind === 'script' ? 'Script written. Check it, then record with the teleprompter.' : writer.kind === 'email' ? 'Email written: see it in the Generate step.' : 'Landing page text written: see it in Customize.';
    } catch (err) {
      notice = err?.message || String(err);
    } finally {
      writer.busy = false;
      render();
    }
  }

  function renderRecord() {
    const grid = el('div', 'grid gap-5 lg:grid-cols-[1fr_360px]');
    const main = card('Record your video', 'Screen, camera, or both, with your microphone. Or upload a video you already have.');
    const preview = el('div', 'aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black grid place-items-center');
    if (draft.video?.url) {
      const v = el('video', 'h-full w-full');
      v.src = draft.video.url; v.controls = true; v.playsInline = true;
      preview.appendChild(v);
    } else {
      preview.appendChild(el('span', 'text-sm text-white/40', 'No video yet'));
    }
    const actions = el('div', 'flex flex-wrap gap-2');
    const rec = button(draft.video ? 'Record again' : 'Record', { primary: !draft.video });
    rec.addEventListener('click', () => openRecorder('both'));
    const upload = button('Upload a video');
    const file = el('input'); file.type = 'file'; file.accept = 'video/*'; file.hidden = true;
    file.addEventListener('change', () => { const f = file.files?.[0]; if (f) addVideo(f, { type: 'upload', name: f.name }); file.value = ''; });
    upload.addEventListener('click', () => file.click());
    const pro = button('Full Recorder (captions, scenes, B-roll)');
    pro.setAttribute('data-outreach-full-recorder', '');
    pro.addEventListener('click', openFullRecorder);
    actions.append(rec, upload, pro, file);
    main.append(preview, actions);
    if (draft.video?.url) main.append(renderEditPanel(), renderCaptionsPanel());

    const side = el('div', 'flex flex-col gap-5');
    const info = card('Your recording');
    info.appendChild(el('p', 'text-sm text-secondary', draft.video
      ? `${fmtTime(draft.video.duration)} · ${draft.video.hasAudio ? 'with sound' : 'no sound'} · ${draft.video.type === 'both' ? 'screen + camera' : draft.video.type === 'recorder' ? 'made in the Recorder' : draft.video.type}`
      : 'Nothing recorded yet.'));
    if (draft.video && !draft.video.hasAudio) info.appendChild(el('p', 'text-xs text-amber-300', 'This video has no sound, so it cannot be used as your voice sample. You can still record a separate sample in the next step.'));
    side.appendChild(renderScriptCard());
    const tips = card('Tips');
    tips.appendChild(el('p', 'text-sm text-secondary', 'Leave a two-second pause at the very start: each contact’s personalized greeting (“Hi Mike!”) plays there. Then speak naturally for at least 10 seconds so your voice can be cloned from it.'));
    side.append(info, tips);
    grid.append(main, side);
    return grid;
  }

  // ---- Step 2: Voice -----------------------------------------------------
  async function voiceSampleFrom(blob) {
    if (!draft.voice.consentChecked) { notice = 'Tick “this is my own voice” first.'; render(); return; }
    notice = '';
    try {
      setBusy('Preparing your voice sample…');
      const { extractVoiceSample } = await import('../lib/outreach/voiceSample.js');
      const { file } = await extractVoiceSample(blob);
      setBusy('Uploading your voice sample…');
      const audioUrl = await uploadToStorage(file);
      setBusy('Cloning your voice (this can take a minute)…');
      const { cloneVoice } = await import('../lib/editor/agent/audioGen.js');
      const voiceId = draft.voice.cloneVoiceId || `voice_${Date.now().toString(36)}`;
      await cloneVoice({ audioUrl, voiceId });
      draft.voice = { ...draft.voice, mode: 'clone', cloneVoiceId: voiceId, consent: { at: new Date().toISOString(), userId: userId() }, fallbackUrl: '', fallbackDuration: 0 };
      persist();
      busy = '';
      notice = 'Voice cloned. Now generate the greeting.';
      render();
    } catch (err) { fail(err); }
  }

  async function speak(text) {
    const { generateAudio } = await import('../lib/editor/agent/audioGen.js');
    return generateAudio('tts', speakRequest(draft, text));
  }

  async function generateGreeting() {
    notice = '';
    try {
      setBusy('Generating the greeting…');
      const { persistAudio, probeDuration } = await import('../lib/editor/agent/audioGen.js');
      const line = fillTemplate(draft.greeting, {}, draft.fallbacks);
      const remote = await speak(line);
      const url = await persistAudio(remote, { upload: uploadToStorage, name: 'greeting' });
      draft.voice = { ...draft.voice, fallbackUrl: url, fallbackDuration: (await probeDuration(url)) || 2 };
      persist();
      busy = '';
      render();
    } catch (err) { fail(err); }
  }

  function renderVoice() {
    const grid = el('div', 'grid gap-5 lg:grid-cols-[1fr_400px]');
    const main = card('Choose the voice', 'Each contact hears their own greeting. Clone your voice so it sounds like you, or use a stock voice.');
    const modes = el('div', 'flex gap-2');
    for (const [mode, label] of [['clone', 'My cloned voice'], ['stock', 'Stock voice']]) {
      const b = button(label, { primary: draft.voice.mode === mode, small: true });
      b.addEventListener('click', () => { draft.voice = { ...draft.voice, mode, fallbackUrl: '', fallbackDuration: 0 }; persist(); render(); });
      modes.appendChild(b);
    }
    main.appendChild(modes);

    if (draft.voice.mode === 'clone') {
      const consent = el('label', 'flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm');
      const box = el('input', 'mt-0.5'); box.type = 'checkbox'; box.checked = !!draft.voice.consentChecked;
      box.addEventListener('change', () => { draft.voice.consentChecked = box.checked; persist(); });
      const text = el('span', 'text-white/80');
      text.innerHTML = '<b class="text-white">This is my own voice.</b> I am the person speaking in the sample and I agree to it being cloned for my own outreach. Pages using it are labelled “AI-personalized voice”.';
      consent.append(box, text);
      main.appendChild(consent);

      const status = el('p', 'text-sm', draft.voice.cloneVoiceId && draft.voice.consent
        ? `✓ Cloned voice ready (${draft.voice.cloneVoiceId}).` : 'Not cloned yet.');
      status.className = draft.voice.cloneVoiceId && draft.voice.consent ? 'text-sm text-emerald-300' : 'text-sm text-secondary';
      const sampleActions = el('div', 'flex flex-wrap gap-2');
      const fromRec = button('Clone from my recording', { primary: !draft.voice.cloneVoiceId });
      fromRec.disabled = !recordingBlob || draft.video?.hasAudio === false;
      fromRec.title = recordingBlob ? '' : 'Record or upload in step 1 during this visit, or record a separate sample.';
      fromRec.addEventListener('click', () => voiceSampleFrom(recordingBlob));
      const sample = button('Record a voice sample');
      sample.addEventListener('click', () => (draft.voice.consentChecked ? openRecorder('audio') : (notice = 'Tick “this is my own voice” first.', render())));
      sampleActions.append(fromRec, sample);
      main.append(status, sampleActions, el('p', 'text-[11px] text-white/45', 'Uses 10–60 seconds of your speech. Cloning and speech run on your own MuAPI key (Settings → API keys).'));
    } else {
      const sel = el('select', 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white');
      for (const v of STOCK_VOICES) { const o = el('option', '', v.replace(/_/g, ' ')); o.value = v; o.selected = draft.voice.stockVoice === v; sel.appendChild(o); }
      sel.addEventListener('change', () => { draft.voice = { ...draft.voice, stockVoice: sel.value, fallbackUrl: '', fallbackDuration: 0 }; persist(); render(); });
      main.appendChild(field('Voice', sel));
    }

    const greet = card('The greeting', 'Spoken at the start of the video. Use {{firstname}}, {{company}} or {{jobtitle}} (more than one is fine: "Hi {{firstname}}, a quick idea for {{company}}").');
    const g = textInput(draft.greeting, 'Hi {{firstname}}!');
    g.addEventListener('change', () => { draft.greeting = g.value; draft.voice.fallbackUrl = ''; persist(); render(); });
    greet.append(field('Greeting', g, 'Up to 70 characters.'), variableChips(g, { onInsert: () => g.dispatchEvent(new Event('change')), only: ['{{firstname}}', '{{company}}', '{{jobtitle}}'] }));
    // Output language: the greeting is spoken in it; Translate rewrites the campaign's texts into it.
    const langRow = el('div', 'flex flex-wrap items-center gap-2');
    const lang = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white');
    lang.setAttribute('data-outreach-language', '');
    for (const [l] of WRITER_LANGUAGES) { const o = el('option', 'bg-neutral-900', l); o.value = l; o.selected = (draft.language || 'English') === l; lang.appendChild(o); }
    lang.addEventListener('change', () => { draft.language = lang.value; draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 }; draft.campaign = null; persist(); render(); });
    const tr = button('Translate greeting, page and email', { small: true });
    tr.setAttribute('data-outreach-translate', '');
    tr.disabled = !!busy || (draft.language || 'English') === 'English';
    tr.addEventListener('click', translateCampaign);
    langRow.append(lang, tr);
    greet.appendChild(field('Output language', langRow, 'The greeting is spoken in this language, in your cloned or stock voice. Translate rewrites your greeting, landing page text and email into it (one small text request on your MuAPI key).'));
    const fb = el('div', 'flex flex-wrap gap-2');
    for (const word of FIRST_NAME_FALLBACKS) {
      const b = button(word, { primary: draft.fallbacks.firstname === word, small: true });
      b.addEventListener('click', () => { draft.fallbacks.firstname = word; draft.voice.fallbackUrl = ''; persist(); render(); });
      fb.appendChild(b);
    }
    greet.appendChild(field('If a first name is missing, say', fb));
    const gen = button(draft.voice.fallbackUrl ? 'Regenerate greeting' : 'Generate greeting', { primary: !draft.voice.fallbackUrl });
    gen.addEventListener('click', generateGreeting);
    greet.appendChild(gen);
    if (draft.voice.fallbackUrl) {
      const a = el('audio', 'w-full'); a.controls = true; a.src = draft.voice.fallbackUrl;
      greet.append(el('p', 'text-xs text-secondary', `Fallback: “${fillTemplate(draft.greeting, {}, draft.fallbacks)}”`), a);
    }
    const tryName = textInput('', 'Type a name to hear it, e.g. Mike');
    const tryBtn = button('Preview', { small: true });
    const tryAudio = el('audio', 'w-full'); tryAudio.controls = true; tryAudio.hidden = true;
    tryBtn.addEventListener('click', async () => {
      if (!tryName.value.trim()) return;
      try {
        tryBtn.disabled = true; tryBtn.textContent = 'Generating…';
        tryAudio.src = await speak(fillTemplate(draft.greeting, { firstname: tryName.value.trim() }, draft.fallbacks));
        tryAudio.hidden = false; tryAudio.play().catch(() => {});
      } catch (err) { notice = err.message; render(); return; } finally { tryBtn.disabled = false; tryBtn.textContent = 'Preview'; }
    });
    const tryRow = el('div', 'flex gap-2'); tryRow.append(tryName, tryBtn);
    greet.append(field('Hear it for one contact', tryRow, 'Each preview is one paid speech request.'), tryAudio);

    grid.append(main, greet);
    return grid;
  }

  // ---- Step 3: Customize -------------------------------------------------
  function renderCustomize() {
    const grid = el('div', 'grid gap-5 lg:grid-cols-[1fr_440px]');
    const main = card('Your prospect page', 'Each prospect gets their own page with their video. Use {{firstname}} and {{company}}; fallbacks fill in when a value is missing.');
    main.style.minWidth = '0'; // long page names truncate instead of widening the column
    // Which page prospects land on (like Sendspark, it belongs to this video): the plain video page, or one of
    // your landing page designs, edited here with your recording in it.
    main.appendChild(field('Landing page', pagePicker(),
      'Your page belongs to this video. Choose one of your landing pages, then Edit page to change its words, pictures and sections. Each prospect sees it with their own personal video, and changes reach every link.'));
    const header = textInput(draft.header);
    const message = el('textarea', 'w-full min-h-[90px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60');
    message.value = draft.message;
    const company = textInput(draft.fallbacks.company, 'your company');
    const ctaOn = el('input'); ctaOn.type = 'checkbox'; ctaOn.checked = !!draft.cta.enabled;
    const ctaLabel = textInput(draft.cta.label, 'Schedule a demo');
    const ctaUrl = textInput(draft.cta.url, 'https://cal.com/you/intro');
    const calOn = el('input'); calOn.type = 'checkbox'; calOn.checked = !!draft.cta.embed; calOn.setAttribute('data-outreach-calendar', '');
    const sync = () => {
      draft.header = header.value; draft.message = message.value; draft.fallbacks.company = company.value;
      draft.cta = { enabled: ctaOn.checked, label: ctaLabel.value, url: ctaUrl.value.trim(), embed: calOn.checked };
      persist(); updatePreview();
    };
    [header, message, company, ctaLabel, ctaUrl].forEach((i) => i.addEventListener('input', sync));
    ctaOn.addEventListener('change', sync);
    calOn.addEventListener('change', sync);
    const ctaRow = el('label', 'flex items-center gap-3 text-sm font-bold'); ctaRow.append(ctaOn, el('span', '', 'Call-to-action button'));
    const calRow = el('label', 'flex items-center gap-3 text-sm'); calRow.append(calOn, el('span', '', 'Plain video page only: show the calendar under the video so contacts can book without leaving the page'));
    main.append(field('Header', header, draft.page ? 'For the plain video page. Your landing page keeps its own words; change them with Edit page.' : ''), variableChips(header), field('Message', message), variableChips(message), field('If the company is missing, say', company), ctaRow,
      field('Button label', ctaLabel), field('Booking link', ctaUrl, 'Your Cal.com, Calendly or other booking page (https).'), calRow);


    // Background: the recording as it is, or each contact's own website behind a round camera bubble.
    const bg = el('div', 'flex flex-col gap-3 rounded-xl border border-white/10 p-4');
    bg.appendChild(el('div', 'text-sm font-bold', 'Video background'));
    const bgModes = el('div', 'flex flex-wrap gap-2');
    for (const [mode, label] of [['recording', 'My recording'], ['website', 'Each contact\u2019s website'], ['image', 'An image'], ['map', 'A map of their address']]) {
      const b = button(label, { primary: draft.background.mode === mode, small: true });
      b.setAttribute('data-bg-mode', mode);
      b.addEventListener('click', () => { draft.background = { ...draft.background, mode }; draft.campaign = null; persist(); render(); });
      bgModes.appendChild(b);
    }
    bg.appendChild(bgModes);
    if (draft.background.mode === 'website') {
      bg.appendChild(el('p', 'text-xs text-secondary', 'Your camera appears in a round bubble over a screenshot of each contact\u2019s website (from the Website column). Screenshots are taken when you generate the campaign. Record in Camera mode for this.'));
      const fallback = textInput(draft.background.fallbackSite, 'yourcompany.com');
      fallback.addEventListener('input', () => { draft.background = { ...draft.background, fallbackSite: fallback.value.trim() }; draft.campaign = null; persist(); });
      fallback.addEventListener('change', () => render());
      bg.appendChild(field('Fallback website', fallback, 'Shown for contacts without a website, or whose site could not be captured.'));
      const curOn = el('input'); curOn.type = 'checkbox'; curOn.checked = draft.background.cursor !== false;
      curOn.addEventListener('change', () => { draft.background = { ...draft.background, cursor: curOn.checked }; draft.campaign = null; persist(); });
      const curRow = el('label', 'flex items-center gap-2 text-xs'); curRow.append(curOn, el('span', '', 'Show a pointer moving over their website, as if you were pointing things out'));
      bg.appendChild(curRow);
    }
    if (draft.background.mode === 'image' || draft.background.mode === 'map') {
      bg.appendChild(el('p', 'text-xs text-secondary', draft.background.mode === 'image'
        ? 'Your camera appears in a round bubble over an image: each contact\u2019s own (the Background image column, an https link) or the one below for everyone else.'
        : 'Your camera appears in a round bubble over a map of each contact\u2019s address (the Address column). Maps are made when you generate the campaign; addresses are looked up on OpenStreetMap.'));
      const img = el('div', 'flex flex-wrap items-center gap-3');
      if (draft.background.image) { const th = el('img', 'h-14 w-24 rounded-lg object-cover border border-white/10'); th.src = draft.background.image; img.appendChild(th); }
      const f = el('input'); f.type = 'file'; f.accept = 'image/*'; f.hidden = true;
      f.addEventListener('change', async () => {
        const file = f.files?.[0]; f.value = '';
        if (!file) return;
        try {
          setBusy('Uploading the image…');
          const url = await uploadToStorage(file);
          draft.background = { ...draft.background, image: url }; draft.campaign = null; persist(); busy = ''; render();
        } catch (err) { fail(err); }
      });
      const up = button(draft.background.image ? 'Change image' : 'Upload image', { small: true });
      up.setAttribute('data-bg-image', '');
      up.addEventListener('click', () => f.click());
      img.append(up, f);
      bg.appendChild(field(draft.background.mode === 'image' ? 'Background image (and fallback)' : 'Fallback image', img, draft.background.mode === 'image' ? 'For contacts without their own background image.' : 'For contacts without an address, or whose address could not be found.'));
    }
    main.appendChild(bg);

    const preview = el('div', 'rounded-2xl bg-[#f7f4ee] p-6 text-center text-[#1a1a1a] flex flex-col gap-3 self-start');
    const sample = { firstname: 'Mike', company: 'Acme' };
    const updatePreview = () => {
      preview.replaceChildren();
      if (draft.page) {
        // Your page as it stands, live; each prospect sees it with their own video.
        preview.appendChild(el('div', 'text-[11px] uppercase tracking-wider text-black/50', 'Prospects land on your page'));
        preview.appendChild(el('h3', 'text-xl font-extrabold', pageName()));
        const pic = el('div', 'w-full');
        pic.setAttribute('data-outreach-page-preview', '');
        preview.appendChild(pic);
        pagePreview(pic);
        preview.appendChild(el('p', 'text-sm text-black/70', 'Each prospect sees this page with their own personal video in it.'));
        if (draft.page) { const b = el('button', 'mx-auto rounded-full bg-[#4f46e5] px-6 py-2.5 text-sm font-bold text-white', 'Edit page'); b.type = 'button'; b.addEventListener('click', openPageEditor); preview.appendChild(b); }
        return;
      }
      preview.appendChild(el('div', 'text-[11px] uppercase tracking-wider text-black/50', 'Preview · Mike at Acme'));
      preview.appendChild(el('h3', 'text-xl font-extrabold', fillTemplate(draft.header, sample, draft.fallbacks)));
      const media = el('div', 'relative aspect-video w-full overflow-hidden rounded-xl bg-black');
      const camVideo = () => { const v = el('video', 'h-full w-full object-cover'); v.src = draft.video.url; v.muted = true; v.playsInline = true; return v; };
      if (usesBackground(draft)) {
        // The fallback picture when there is one, else a placeholder page.
        const shot = fallbackShotFor(draft);
        const page = el('div', 'absolute inset-0');
        if (shot) { page.style.backgroundImage = `url(${JSON.stringify(shot)})`; page.style.backgroundSize = 'cover'; page.style.backgroundPosition = 'top center'; } else {
          page.className = 'absolute inset-0 flex flex-col gap-2 bg-gradient-to-br from-slate-200 to-slate-300 p-4';
          page.append(el('div', 'h-3 w-1/3 rounded bg-white/80'), el('div', 'mt-2 h-2 w-3/4 rounded bg-white/70'), el('div', 'h-2 w-2/3 rounded bg-white/70'), el('div', 'mt-auto text-left text-[10px] text-black/40', 'acme.com'));
        }
        const bubble = el('div', 'absolute overflow-hidden rounded-full border-[3px] border-white shadow-lg');
        Object.assign(bubble.style, { left: '3%', bottom: '5.4%', width: '26%', aspectRatio: '1 / 1' });
        if (draft.video?.url) bubble.appendChild(camVideo()); else bubble.classList.add('bg-slate-700');
        media.append(page, bubble);
      } else if (draft.video?.url) media.appendChild(camVideo());
      preview.appendChild(media);
      if (draft.message.trim()) preview.appendChild(el('p', 'text-sm text-black/70', fillTemplate(draft.message, sample, draft.fallbacks)));
      if (draft.cta.enabled && draft.cta.label.trim()) preview.appendChild(el('span', 'mx-auto rounded-full bg-[#4f46e5] px-6 py-2.5 text-sm font-bold text-white', draft.cta.label));
      if (draft.cta.enabled && draft.cta.embed) {
        const cal = el('div', 'grid h-28 place-items-center rounded-xl border border-dashed border-black/20 text-xs text-black/50', calendarEmbedUrl(draft.cta.url) ? 'Your booking calendar shows here' : 'Use a Calendly, Cal.com, Google, HubSpot, SavvyCal or TidyCal link to show the calendar');
        preview.appendChild(cal);
      }
      if (draft.voice.mode === 'clone') preview.appendChild(el('p', 'text-[11px] text-black/45', 'AI-personalized voice'));
    };
    updatePreview();
    grid.append(main, preview);
    return grid;
  }

  // ---- Step 4: Contacts --------------------------------------------------
  function addContacts(list, skipped = 0) {
    const before = draft.contacts.length;
    draft.contacts = mergeContacts(draft.contacts, list).slice(0, MAX_CONTACTS);
    draft.campaign = null; // links must be regenerated for the new list
    persist();
    const added = draft.contacts.length - before;
    notice = `Added ${added} contact${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} row${skipped === 1 ? '' : 's'} without a name or email` : ''}${list.length - added > 0 ? `, ${list.length - added} already in the list` : ''}.`;
    render();
  }

  function downloadText(name, text, type = 'text/csv') {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Prospects saved in Lead Finder (#/leadfinder), picked and added as contacts.
  async function loadLeads() {
    pendingLeads = { loading: true, error: '', leads: [], picked: new Set() };
    render();
    try {
      const { installPersonalizationApiAuth } = await import('../features/personalization/lib/apiAuth.ts');
      installPersonalizationApiAuth();
      const res = await fetch('/api/personalization/leads', { headers: { Accept: 'application/json' } });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('Sign in to use your saved leads.');
      if (!res.ok) throw new Error(body?.error || 'Saved leads are not available right now.');
      const leads = Array.isArray(body?.leads) ? body.leads : [];
      pendingLeads = { loading: false, error: '', leads, picked: new Set(leads.filter((l) => l?.business?.email).map((l) => l.id)) };
    } catch (err) {
      pendingLeads = { loading: false, error: err.message || String(err), leads: [], picked: new Set() };
    }
    render();
  }

  function renderLeadPicker() {
    const box = el('div', 'rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3');
    box.setAttribute('data-outreach-lead-picker', '');
    const close = () => { pendingLeads = null; render(); };
    if (pendingLeads.loading) { box.appendChild(el('p', 'text-sm text-secondary', 'Loading your saved leads…')); return box; }
    if (pendingLeads.error || !pendingLeads.leads.length) {
      box.appendChild(el('p', 'text-sm text-secondary', pendingLeads.error || 'No saved leads yet. Find businesses in Lead Finder and save them first.'));
      const row = el('div', 'flex gap-2');
      const go = button('Open Lead Finder', { small: true });
      go.addEventListener('click', () => { window.location.hash = '#/leadfinder'; });
      const cancel = button('Close', { small: true });
      cancel.addEventListener('click', close);
      row.append(go, cancel); box.appendChild(row);
      return box;
    }
    box.appendChild(el('p', 'text-sm font-bold', `Your saved leads (${pendingLeads.leads.length}). Leads without an email can't be added.`));
    const list = el('div', 'flex max-h-64 flex-col divide-y divide-white/5 overflow-y-auto');
    for (const lead of pendingLeads.leads) {
      const b = lead?.business || {};
      const row = el('label', 'flex items-center gap-3 py-1.5 text-sm');
      const cb = el('input'); cb.type = 'checkbox'; cb.disabled = !b.email; cb.checked = pendingLeads.picked.has(lead.id);
      cb.addEventListener('change', () => { if (cb.checked) pendingLeads.picked.add(lead.id); else pendingLeads.picked.delete(lead.id); render(); });
      const who = el('div', 'min-w-0 flex-1');
      who.append(el('div', 'truncate font-semibold', b.name || 'Unnamed business'), el('div', 'truncate text-xs text-white/50', [b.email || 'no email', b.website].filter(Boolean).join(' · ')));
      row.append(cb, who);
      list.appendChild(row);
    }
    const actions = el('div', 'flex gap-2');
    const add = button(`Add ${pendingLeads.picked.size}`, { primary: true, small: true });
    add.disabled = !pendingLeads.picked.size;
    add.addEventListener('click', () => {
      const picked = pendingLeads.leads.filter((l) => pendingLeads.picked.has(l.id));
      const { contacts, skipped } = contactsFromLeads(picked);
      pendingLeads = null;
      addContacts(contacts, skipped);
    });
    const cancel = button('Cancel', { small: true });
    cancel.addEventListener('click', close);
    actions.append(add, cancel);
    box.append(list, actions);
    return box;
  }

  function renderContacts() {
    const grid = el('div', 'grid gap-5 lg:grid-cols-[1fr_380px]');
    const main = card('Add contacts', 'Upload a CSV, or add people one at a time. Each contact gets their own link.');
    const nameInput = textInput(draft.name, 'Campaign name, e.g. Cold outreach November');
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; persist(); });
    main.appendChild(field('Campaign name', nameInput));

    const csvRow = el('div', 'flex flex-wrap gap-2');
    const upload = button('Upload a .csv', { primary: !draft.contacts.length });
    const file = el('input'); file.type = 'file'; file.accept = '.csv,text/csv'; file.hidden = true;
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; file.value = '';
      if (!f) return;
      const { headers, rows } = parseCsv(await f.text());
      if (!rows.length) { notice = 'That file has no rows under its header line.'; render(); return; }
      pendingCsv = { name: f.name, headers, rows, mapping: guessMapping(headers) };
      notice = ''; render();
    });
    upload.addEventListener('click', () => file.click());
    const template = button('Download template');
    template.addEventListener('click', () => downloadText('contacts-template.csv', CSV_TEMPLATE));
    const fromLeads = button('Add from Lead Finder');
    fromLeads.setAttribute('data-outreach-leads', '');
    fromLeads.addEventListener('click', loadLeads);
    csvRow.append(upload, template, fromLeads, file);
    main.appendChild(csvRow);

    if (pendingLeads) main.appendChild(renderLeadPicker());

    if (pendingCsv) {
      const box = el('div', 'rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3');
      box.appendChild(el('p', 'text-sm font-bold', `${pendingCsv.name}: ${pendingCsv.rows.length} row${pendingCsv.rows.length === 1 ? '' : 's'}. Match your columns:`));
      const table = el('div', 'grid grid-cols-[140px_1fr_1fr] gap-2 items-center text-sm');
      table.append(el('span', 'text-xs text-secondary', 'Field'), el('span', 'text-xs text-secondary', 'Your column'), el('span', 'text-xs text-secondary', 'First row'));
      for (const [key, label] of CONTACT_FIELDS) {
        const sel = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white');
        const none = el('option', '', '(none)'); none.value = ''; sel.appendChild(none);
        for (const h of pendingCsv.headers) { const o = el('option', '', h); o.value = h; o.selected = pendingCsv.mapping[key] === h; sel.appendChild(o); }
        sel.addEventListener('change', () => { pendingCsv.mapping[key] = sel.value || undefined; render(); });
        const sample = pendingCsv.mapping[key] ? pendingCsv.rows[0][pendingCsv.mapping[key]] || '' : '';
        table.append(el('span', '', label), sel, el('span', 'truncate text-white/60', sample || '—'));
      }
      const actions = el('div', 'flex gap-2');
      const imp = button(`Import ${pendingCsv.rows.length}`, { primary: true, small: true });
      imp.disabled = !pendingCsv.mapping.firstName && !pendingCsv.mapping.email;
      imp.title = imp.disabled ? 'Match at least a first name or an email column.' : '';
      imp.addEventListener('click', () => { const { contacts, skipped } = contactsFromRows(pendingCsv.rows, pendingCsv.mapping); pendingCsv = null; addContacts(contacts, skipped); });
      const cancel = button('Cancel', { small: true });
      cancel.addEventListener('click', () => { pendingCsv = null; render(); });
      actions.append(imp, cancel);
      box.append(table, actions);
      main.appendChild(box);
    }

    // Add one contact.
    const one = el('div', 'grid gap-2 sm:grid-cols-2');
    const inputs = {};
    for (const [key, label] of CONTACT_FIELDS) { inputs[key] = textInput('', label); one.appendChild(inputs[key]); }
    const addOne = button('Add contact', { small: true });
    addOne.addEventListener('click', () => {
      const c = makeContact(Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value])));
      if (!c) { notice = 'Give the contact a name or an email.'; render(); return; }
      addContacts([c]);
    });
    one.appendChild(addOne);
    main.appendChild(field('Or add one', one));

    // The list.
    const side = card(`Contacts (${draft.contacts.length})`, draft.contacts.length ? 'Contacts without a first name hear the fallback greeting.' : 'No contacts yet.');
    const list = el('div', 'flex flex-col divide-y divide-white/5 max-h-[460px] overflow-y-auto');
    draft.contacts.forEach((c) => {
      const row = el('div', 'flex items-center gap-3 py-2 text-sm');
      const who = el('div', 'min-w-0 flex-1');
      who.append(el('div', 'truncate font-semibold', [c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)'),
        el('div', 'truncate text-xs text-white/50', [c.email, c.company].filter(Boolean).join(' · ')));
      const rm = button('Remove', { small: true });
      rm.addEventListener('click', () => { draft.contacts = draft.contacts.filter((x) => x.id !== c.id); draft.campaign = null; persist(); render(); });
      row.append(who, rm);
      list.appendChild(row);
    });
    side.appendChild(list);
    if (draft.contacts.length) {
      const clear = button('Remove all', { small: true });
      clear.addEventListener('click', () => { if (window.confirm('Remove every contact from this campaign?')) { draft.contacts = []; draft.campaign = null; persist(); render(); } });
      side.appendChild(clear);
    }
    grid.append(main, side);
    return grid;
  }

  // ---- Step 5: Generate --------------------------------------------------
  async function ownerClient() {
    if (!globalThis.window?.Clerk?.user) throw new Error('Sign in to publish your campaign.');
    const { supabase } = await import('../lib/hybrid-supabase.js');
    await supabase.refreshUserHeader?.();
    if (!supabase.supabase) throw new Error('The video service is unavailable. Check your connection and try again.');
    return supabase.supabase;
  }

  // Website background: one screenshot per unique site (server-side, cached per site). A site that
  // cannot be captured falls back to the fallback website; the fallback itself must work.
  // { requireFallback: false } when only logos are wanted (thumbnails without website backgrounds).
  async function captureSites({ requireFallback = true } = {}) {
    const { installPersonalizationApiAuth } = await import('../features/personalization/lib/apiAuth.ts');
    installPersonalizationApiAuth();
    const todo = sitesToCapture(draft).filter((site) => !draft.siteShots[site]);
    const failed = [];
    for (let i = 0; i < todo.length; i++) {
      if (abort?.signal.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
      setBusy(`Capturing websites: ${i + 1} of ${todo.length} (${todo[i].replace(/^https?:\/\//, '').replace(/\/$/, '')})…`);
      try {
        const res = await fetch('/api/outreach/site-shot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: todo[i] }), signal: abort?.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.imageUrl) throw new Error(body.error || `HTTP ${res.status}`);
        draft.siteShots = { ...draft.siteShots, [todo[i]]: body.imageUrl };
        if (body.logoUrl) draft.siteLogos = { ...draft.siteLogos, [todo[i]]: body.logoUrl };
        persist();
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        failed.push(todo[i]);
      }
    }
    const fallback = siteKey(draft.background.fallbackSite);
    if (requireFallback && !draft.siteShots[fallback]) throw new Error(`The fallback website (${draft.background.fallbackSite}) could not be captured. Check the address, or use another site.`);
    return failed;
  }

  // Map backgrounds: one picture per address (server: /api/outreach/site-shot { map }).
  async function captureMaps() {
    const { installPersonalizationApiAuth } = await import('../features/personalization/lib/apiAuth.ts');
    installPersonalizationApiAuth();
    const todo = addressesToCapture(draft).filter((a) => !draft.mapShots?.[a]);
    for (let i = 0; i < todo.length; i++) {
      if (abort?.signal.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
      setBusy(`Making maps: ${i + 1} of ${todo.length}…`);
      try {
        const res = await fetch('/api/outreach/site-shot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: todo[i] }), signal: abort?.signal });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.imageUrl) { draft.mapShots = { ...draft.mapShots, [todo[i]]: body.imageUrl }; persist(); }
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
      }
    }
  }

  async function generateCampaign() {
    const personal = tokensIn(draft.greeting).length > 0;
    const n = draft.contacts.length;
    const wantSync = personal && !!draft.voice.lipsync;
    if (personal && !window.confirm(`This voices the greeting for up to ${n} contact${n === 1 ? '' : 's'} (repeated names are voiced once). Each one is a paid speech request on your MuAPI key.${wantSync ? ` Lip-sync is on: each distinct greeting is also a paid lip-sync video request (up to ${n}), which costs more and takes about a minute each.` : ''} Continue?`)) return;
    notice = '';
    abort = new AbortController();
    try {
      if (draft.background.mode === 'website') await captureSites();
      if (draft.background.mode === 'map') await captureMaps();
      let variants = {};
      if (personal) {
        const [{ voiceForContacts }, audio] = await Promise.all([
          import('../lib/editor/personalize/perContact.js'),
          import('../lib/editor/agent/audioGen.js'),
        ]);
        progress = { total: n, done: 0, phase: 'Voicing' };
        setBusy(`Voicing greetings: 0 of ${n}…`);
        ({ variants } = await voiceForContacts({
          text: draft.greeting,
          contacts: draft.contacts.map((c) => contactProfile(c)),
          signal: abort.signal,
          onProgress: ({ done, total, name }) => { progress = { total, done, phase: 'Voicing' }; setBusy(`Voicing greetings: ${done} of ${total} (${name})…`); },
          generate: async (line) => {
            const remote = await audio.generateAudio('tts', speakRequest(draft, line), { signal: abort.signal });
            const url = await audio.persistAudio(remote, { upload: uploadToStorage, name: 'greeting' });
            return { url, duration: (await audio.probeDuration(url)) || 2 };
          },
        }));
      }
      let lipsync = null;
      if (wantSync && Object.keys(variants).length) {
        const [{ lipsyncContacts, LIPSYNC_MODEL }, { muapi }] = await Promise.all([
          import('../lib/outreach/lipsync.js'),
          import('../lib/muapi.js'),
        ]);
        setBusy('Lip-syncing greetings: preparing your video…');
        lipsync = await lipsyncContacts({
          draft, variants, upload: uploadToStorage, signal: abort.signal,
          lipSync: ({ video_url, audio_url, signal }) => muapi.processLipSync({ model: LIPSYNC_MODEL, video_url, audio_url }, signal),
          onProgress: ({ done, total }) => { progress = { total, done, phase: 'Lip-syncing' }; setBusy(`Lip-syncing greetings: ${done} of ${total}…`); },
        });
      }
      setBusy('Publishing the campaign…');
      const [{ preparePublishProject, publishVideo, makeSlug, watchUrl }, { personalLink }] = await Promise.all([
        import('../lib/editor/publish/publishClient.js'),
        import('../lib/editor/personalize/perContact.js'),
      ]);
      const built = buildCampaignProject(draft, { variants, lipsync });
      const project = preparePublishProject(built, { title: built.title });
      const id = draft.campaign?.id || makeSlug();
      await publishVideo(await ownerClient(), { id, project });
      const url = watchUrl(id);
      // A landing page chosen earlier keeps showing the campaign; its contact links are rebuilt.
      const page = draft.campaign?.id === id ? draft.campaign.page : null;
      const { landingLink } = await import('../lib/outreach/landingPage.js');
      draft.campaign = {
        id, url, publishedAt: new Date().toISOString(), ...(page ? { page } : {}),
        links: campaignLinks(draft, url, personalLink, variants).map((l) => ({
          ...l,
          ...(lipsync?.clips?.[l.contactId] ? { lipsynced: true } : {}),
          ...(page ? { pageLink: landingLink(page.url, l.link, draft.contacts.find((c) => c.id === l.contactId) || {}) } : {}),
        })),
      };
      persist();
      campaigns.loaded = false; // refresh the Campaigns list next time it opens
      const done = `${draft.campaign.links.length} personal video${draft.campaign.links.length === 1 ? '' : 's'} ready.${lipsync?.failed?.length ? ` Lip-sync failed for ${lipsync.failed.length} contact${lipsync.failed.length === 1 ? '' : 's'}; they hear their greeting without it.` : ''}`;
      // Like Sendspark, one Generate also makes the page and every prospect's thumbnail.
      notice = '';
      if (!(await publishCampaignPage({ quiet: true }))) return; // the page failed: its message stays
      progress = null;
      await makeThumbnails();
      const thumbs = /^Thumbnails ready/.test(notice) ? ' Thumbnails made.' : notice ? ` Thumbnails: ${notice}` : '';
      busy = '';
      notice = `Campaign published: ${done}${draft.campaign.page ? ' Their page is live.' : ''}${thumbs} Share each link below.`;
      render();
    } catch (err) {
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped. Nothing was published.'; render(); return; }
      fail(err);
    } finally {
      abort = null;
      progress = null;
    }
  }

  // Each prospect's state while the campaign is generated (Sendspark-style list).
  function renderProgress() {
    const box = card('Generating your videos', 'Each prospect\u2019s intro is made in turn. Keep this tab open.');
    box.setAttribute('data-outreach-progress', '');
    const { total, done, phase } = progress;
    const bar = el('div', 'h-2 w-full overflow-hidden rounded-full bg-white/10');
    const fill = el('div', 'h-full rounded-full bg-primary transition-all');
    fill.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
    bar.appendChild(fill);
    box.append(bar, el('p', 'text-xs text-secondary', `${phase}: ${done} of ${total}`));
    const rows = el('div', 'flex flex-col divide-y divide-white/5 text-sm');
    draft.contacts.slice(0, 200).forEach((c, i) => {
      const row = el('div', 'flex items-center gap-3 py-2');
      const state = i < done ? ['text-emerald-300', '\u2713 Ready'] : i === done ? ['text-primary', '\u25cf Generating\u2026'] : ['text-white/40', '\u25cb Waiting'];
      row.append(el('span', 'flex-1 truncate', [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email), el('span', 'truncate text-xs text-white/50', c.company || ''), el('span', `w-32 text-right text-xs ${state[0]}`, state[1]));
      rows.appendChild(row);
    });
    box.appendChild(rows);
    return box;
  }

  function renderGenerate() {
    const wrap = el('div', 'flex flex-col gap-5');
    const top = card(draft.campaign ? 'Your campaign is live' : 'Generate the campaign',
      draft.campaign
        ? 'Send each contact their own link. It opens your video with their greeting and your booking button.'
        : 'Each contact’s greeting is voiced, the video is published, and every contact gets a personal link.');
    const facts = el('div', 'grid grid-cols-2 md:grid-cols-4 gap-3');
    const personal = tokensIn(draft.greeting).length > 0;
    const named = draft.contacts.filter((c) => c.firstName).length;
    for (const [label, value] of [
      ['Contacts', draft.contacts.length],
      ['Greeted by name', personal ? named : 0],
      ['Voice', draft.voice.mode === 'clone' ? 'Your cloned voice' : (draft.voice.stockVoice || '').replace(/_/g, ' ')],
      ['Booking button', draft.cta.enabled ? draft.cta.label : 'Off'],
    ]) {
      const f = el('div', 'rounded-xl border border-white/10 bg-white/[0.03] p-3');
      f.append(el('div', 'text-lg font-extrabold truncate', String(value)), el('div', 'text-xs text-secondary', label));
      facts.appendChild(f);
    }
    top.appendChild(facts);
    if (personal) {
      const syncRow = el('label', 'flex items-start gap-3 text-sm');
      const syncOn = el('input'); syncOn.type = 'checkbox'; syncOn.checked = !!draft.voice.lipsync; syncOn.className = 'mt-1';
      syncOn.setAttribute('data-outreach-lipsync', '');
      syncOn.addEventListener('change', () => { draft.voice = { ...draft.voice, lipsync: syncOn.checked }; persist(); });
      const txt = el('span', '');
      txt.append(el('span', 'font-bold', 'Lip-sync the greeting'), el('span', 'block text-xs text-secondary', 'Your mouth says each contact\u2019s name. Paid: one MuAPI lip-sync video per distinct greeting, on top of the voice. Leave a pause at the start of your recording.'));
      syncRow.append(syncOn, txt);
      top.appendChild(syncRow);
    }
    const actions = el('div', 'flex flex-wrap gap-2');
    if (busy && abort) {
      const stop = button('Stop');
      stop.addEventListener('click', () => abort?.abort());
      actions.appendChild(stop);
    } else {
      const gen = button(draft.campaign ? 'Regenerate and republish' : 'Generate campaign', { primary: !draft.campaign });
      gen.disabled = !!busy || [1, 2, 3, 4].some((s) => stepErrors(draft, s).length);
      gen.addEventListener('click', generateCampaign);
      actions.appendChild(gen);
    }
    if (draft.campaign) {
      const csv = button('Download .csv of links');
      csv.addEventListener('click', async () => {
        const { linksCsv } = await import('../lib/editor/personalize/perContact.js');
        downloadText(`${(draft.name || 'campaign').replace(/[^\w-]+/g, '_')}-links.csv`, linksCsv(draft.campaign.links.map((l) => ({ ...l, link: linkOf(l) }))));
      });
      const open = button('Open landing page');
      open.addEventListener('click', () => window.open(draft.campaign.links[0] ? linkOf(draft.campaign.links[0]) : draft.campaign.url, '_blank', 'noopener'));
      actions.append(csv, open);
    }
    top.appendChild(actions);
    wrap.appendChild(top);
    if (busy && progress) wrap.appendChild(renderProgress());

    if (draft.campaign) {
      const list = card('Personal links');
      const rows = el('div', 'flex flex-col divide-y divide-white/5');
      if (linkStats.id !== draft.campaign.id && !linkStats.loading) setTimeout(loadLinkStats, 0);
      draft.campaign.links.forEach((l, i) => {
        const row = el('div', 'flex flex-wrap items-center gap-3 py-2.5 text-sm');
        row.append(el('span', 'w-8 text-white/40 tabular-nums', String(i + 1).padStart(2, '0')));
        const who = el('div', 'min-w-0 flex-1');
        who.append(el('div', 'truncate font-semibold', l.name || '(no name)'), el('div', 'truncate text-xs text-white/50', l.email || ''));
        const state = el('span', `text-xs ${l.voiced ? 'text-emerald-300' : 'text-white/50'}`, l.voiced ? (l.lipsynced ? '● Greeted by name, lip-synced' : '● Greeted by name') : '● Fallback greeting');
        const siteState = l.site ? el('span', `text-xs ${l.site === 'own' ? 'text-emerald-300' : 'text-white/50'}`, l.site === 'own' ? '● Their website' : '● Fallback website') : null;
        const copy = button('Copy link', { small: true });
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(linkOf(l)); copy.textContent = 'Copied'; } catch { window.prompt('Copy this link:', linkOf(l)); }
        });
        const mailBtn = button('Copy email', { small: true });
        mailBtn.setAttribute('data-outreach-copy-email', '');
        mailBtn.addEventListener('click', () => copyEmail(l, mailBtn));
        const mp4 = button('MP4', { small: true });
        mp4.setAttribute('data-outreach-mp4', '');
        mp4.title = 'Download this contact\u2019s video as a file';
        mp4.disabled = !!busy;
        mp4.addEventListener('click', () => downloadContactVideo(l));
        const mailto = el('a', 'text-xs font-bold text-white/70 hover:text-white', 'Email');
        if (l.email) { mailto.href = mailtoUrl(emailOf(l)); } else { mailto.classList.add('hidden'); }
        const gmail = el('a', 'text-xs font-bold text-white/70 hover:text-white', 'Gmail');
        gmail.setAttribute('data-outreach-gmail', '');
        gmail.href = gmailUrl(emailOf(l)); gmail.target = '_blank'; gmail.rel = 'noopener noreferrer';
        const li = button('LinkedIn', { small: true });
        li.setAttribute('data-outreach-linkedin', '');
        li.title = 'Copies a short message with their link and opens LinkedIn so you can paste it';
        li.addEventListener('click', async () => {
          const c = contactOf(l);
          const msg = linkedinMessage({ contact: c, link: linkOf(l), fallbacks: draft.fallbacks });
          window.open(c.linkedin || 'https://www.linkedin.com/messaging/', '_blank', 'noopener');
          try { await navigator.clipboard.writeText(msg); li.textContent = 'Message copied'; } catch { window.prompt('Copy this message:', msg); }
        });
        const extra = [];
        if (l.thumbnailUrl) {
          const gifBtn = button(/\.gif(\?|$)/i.test(l.thumbnailUrl) ? 'Copy GIF' : 'Copy thumbnail', { small: true });
          gifBtn.setAttribute('data-outreach-copy-gif', '');
          gifBtn.addEventListener('click', () => copyGif(l, gifBtn));
          const embed = button('Embed', { small: true });
          embed.setAttribute('data-outreach-embed', '');
          embed.addEventListener('click', () => copyEmbed(l, embed));
          extra.push(gifBtn, embed);
        }
        const st = linkStats.byContact ? (linkStats.byContact[l.contactId] || { views: 0, plays: 0, ctaClicks: 0 }) : null;
        const watch = st ? el('span', `text-xs ${st.ctaClicks ? 'text-primary' : st.plays ? 'text-emerald-300' : 'text-white/40'}`, st.ctaClicks ? '● Clicked' : st.plays ? '● Watched' : st.views ? '● Opened' : '● Not opened') : null;
        row.append(who, state, ...(siteState ? [siteState] : []), ...(watch ? [watch] : []), copy, mailBtn, li, ...extra, mp4, mailto, gmail);
        rows.appendChild(row);
      });
      list.appendChild(rows);
      wrap.appendChild(list);
      wrap.appendChild(renderLandingCard());
      wrap.appendChild(renderEmailCard());
    }
    return wrap;
  }

  async function loadLinkStats() {
    const id = draft.campaign?.id;
    if (!id) return;
    linkStats = { id, loading: true, byContact: null };
    try {
      const { fetchVideoStats } = await import('../lib/editor/publish/publishClient.js');
      const rows = await fetchVideoStats(await ownerClient(), id);
      linkStats = { id, loading: false, byContact: Object.fromEntries(rows.filter((r) => r.contactId).map((r) => [r.contactId, r])) };
      if (step === 5 && !busy) render();
    } catch {
      linkStats = { id, loading: false, byContact: null }; // stats are optional here
    }
  }

  // ---- One contact's video as a file -------------------------------------------
  async function downloadContactVideo(l) {
    const { renderContactVideo, contactVideoName } = await import('../lib/outreach/contactVideo.js');
    const contact = contactOf(l);
    abort = new AbortController();
    try {
      setBusy(`Making ${l.name || 'the contact'}\u2019s video…`);
      const blob = await renderContactVideo({
        campaignId: draft.campaign.id, contact, backgroundUrl: backgroundShotFor(draft, contact), signal: abort.signal,
        onProgress: (p) => { busy = `Making ${l.name || 'the contact'}\u2019s video… ${Math.round((p || 0) * 100)}%`; const b = container.querySelector('[data-outreach-busy]'); if (b) b.textContent = busy; },
      });
      const { downloadBlob } = await import('../lib/editor/remotion/exportClient.js');
      downloadBlob(blob, `${contactVideoName(draft.name, contact)}.${/webm/.test(blob.type) ? 'webm' : 'mp4'}`);
      busy = ''; abort = null; notice = `Downloaded ${l.name || 'the contact'}\u2019s video.`;
      render();
    } catch (err) {
      abort = null;
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped.'; render(); return; }
      fail(err);
    }
  }

  // ---- Landing page (like Sendspark, the page belongs to this dynamic video) -----------------------
  // draft.page = { template, puck } is one of your 33 landing page designs, edited right here (Edit page).
  // Generate publishes it once as the campaign's page, whose video is the campaign's personal player, so each
  // prospect sees their own video in it. Every later change updates that page, so every prospect's link shows it
  // straight away. Nothing is saved in Video Pages (src/lib/outreach/landingPage.js builds the links).
  const designs = { loaded: false, loading: false, list: [], error: '' };
  let tpl = null; // src/lib/landingPages/templates.js, loaded with the designs
  async function loadDesigns() {
    if (designs.loading || designs.loaded) return;
    designs.loading = true;
    try {
      tpl = await import('../lib/landingPages/templates.js');
      designs.list = tpl.TEMPLATES.filter((t) => t.puck);
      await adoptOldPage();
    } catch (err) { designs.error = err?.message || 'Could not load the landing pages.'; }
    designs.loaded = true;
    designs.loading = false;
    render();
  }
  // A draft from before the page belonged to the video pointed at a page saved in Video Pages: take its content.
  async function adoptOldPage() {
    const id = draft.pageId;
    if (!id) return;
    try {
      const { listPages } = await import('../lib/landingPages/client.js');
      const row = (await listPages(await ownerClient())).find((r) => r.id === id);
      if (row?.config?.puck) draft.page = cleanPage({ template: row.config.template, puck: row.config.puck });
    } catch { /* signed out or offline: the plain video page until a design is chosen */ }
    delete draft.pageId;
    persist();
  }
  const designOf = (id) => designs.list.find((t) => t.id === id) || null;
  // The page as it stands: your edits, else the design as it comes.
  const pagePuck = (page = draft.page) => (page ? page.puck || designOf(page.template)?.puckData || null : null);
  const pageName = () => designOf(draft.page?.template)?.name || 'Your landing page';
  const livePage = () => (draft.campaign?.page?.url ? draft.campaign.page : null);

  // Live page previews; dropped whenever the step is drawn again.
  const previewHandles = [];
  const dropPreviewHandles = () => previewHandles.splice(0).forEach((h) => h.destroy());
  const pagePreview = (host, width) => {
    const data = pagePuck();
    if (!data) return;
    import('../lib/landingPages/designPreview.js').then((m) => { previewHandles.push(m.attachDesignPreview(host, data)); if (width) host.style.width = width; });
  };
  const PLAIN_CARD = { id: '', name: 'Plain video page', description: 'Just the personal video, header, message and your booking button.', theme: { bg: '#111318', accent: '#d9ff00' }, layout: 'minimal' };

  // Every change to the page lands on the video; once the campaign is out, its page is updated too.
  async function setPage(page) {
    draft.page = page ? cleanPage(page) : null;
    persist();
    if (draft.campaign?.url && (draft.page || draft.campaign.page)) await publishCampaignPage();
    else render();
  }

  function openPageEditor() {
    if (!draft.page) return;
    const template = draft.page.template;
    import('../lib/landingPages/pickerModal.js').then(({ openLandingPagePicker }) => openLandingPagePicker({
      video: draft.video?.url ? { url: draft.video.url, title: draft.name || 'My outreach video', duration: draft.video.duration, studio: 'outreach' } : null,
      template,
      data: pagePuck(),
      saveLabel: livePage() ? 'Save and update every link' : 'Save page',
      onEdit: (puck) => setPage({ template, puck }),
    }));
  }

  /**
   * The landing page of this video: its live picture, "Choose landing page" (the Video Pages chooser,
   * src/components/landing/TemplateChooser.js, with your 33 designs) and "Edit page" (the visual editor
   * with your recording in it).
   */
  function pagePicker() {
    const wrap = el('div', 'flex min-w-0 flex-col gap-2');
    wrap.setAttribute('data-outreach-my-pages', '');
    if (!designs.loaded) { loadDesigns(); wrap.appendChild(el('p', 'text-xs text-secondary', 'Loading your landing pages…')); return wrap; }
    const page = draft.page;
    const design = designOf(page?.template);
    const row = el('div', 'flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5');
    const sw = el('div', 'h-12 w-20 shrink-0 overflow-hidden rounded-lg p-1.5 flex items-center justify-center');
    if (page && design) { sw.className = 'shrink-0'; pagePreview(sw, '128px'); }
    else {
      sw.style.background = PLAIN_CARD.theme.bg; sw.style.color = PLAIN_CARD.theme.accent;
      if (wireframe) sw.innerHTML = wireframe(PLAIN_CARD.layout); else import('../lib/landingPages/wireframes.js').then((m) => { wireframe = m.wireframeSvg; sw.innerHTML = wireframe(PLAIN_CARD.layout); });
    }
    const name = el('div', 'min-w-0 flex-1');
    name.append(
      el('div', 'truncate text-sm font-bold', design ? design.name : 'Plain video page'),
      el('div', 'truncate text-[11px] text-secondary', design ? (page.puck ? 'Your edited page' : design.description) : 'No landing page: prospects open the personal video page.'),
    );
    const choose = button('Choose landing page', { small: true, primary: !page });
    choose.setAttribute('data-outreach-choose-page', '');
    choose.disabled = !!busy;
    choose.addEventListener('click', async () => {
      const { openTemplateChooser } = await import('./landing/TemplateChooser.js');
      openTemplateChooser({
        title: 'Choose a landing page',
        subtitle: 'The page belongs to this video. After choosing, click Edit page to change its words, pictures and sections; your recording plays in it, and each prospect sees their own video.',
        groups: [['No landing page', [PLAIN_CARD]], ['Your landing pages', designs.list]],
        selected: page?.template || '',
        onPick: (id) => {
          if (id === (page?.template || '')) return;
          if (page?.puck && !window.confirm('Replace your edited page? Your changes to it will be lost.')) return;
          setPage(id ? { template: id, puck: null } : null);
        },
      });
    });
    row.append(sw, name, choose);
    if (page && design) {
      const edit = button('Edit page', { small: true, primary: true });
      edit.setAttribute('data-outreach-edit-page', '');
      edit.title = 'Change the words, pictures and sections; your recording plays in the video';
      edit.disabled = !!busy;
      edit.addEventListener('click', openPageEditor);
      row.appendChild(edit);
    }
    wrap.appendChild(row);
    const live = livePage();
    if (live && page) {
      const links = el('div', 'flex flex-wrap items-center gap-3 px-1');
      const a = el('a', 'text-xs font-bold text-primary underline', 'Open the live page'); a.href = live.url; a.target = '_blank'; a.rel = 'noopener';
      links.append(a, el('span', 'text-[11px] text-secondary', 'Changes update every prospect’s link straight away.'));
      wrap.appendChild(links);
    }
    if (designs.error) wrap.appendChild(el('p', 'text-xs text-amber-300', designs.error));
    return wrap;
  }
  let wireframe = null;

  function renderLandingCard() {
    const box = card('Landing page', 'Every prospect’s link opens this page with their own personal video. Change it here and every link shows the change straight away.');
    box.setAttribute('data-outreach-landing', '');
    box.appendChild(pagePicker());
    return box;
  }

  // Publish (or update) the campaign's page: your page, with the campaign's personal player as its video.
  // With the plain video page chosen, the links go back to the player page. Returns false when it failed.
  async function publishCampaignPage({ quiet = false } = {}) {
    if (!draft.campaign?.url) return true;
    abort = null;
    try {
      const [{ createPage, updatePage, setPagePublished, pageUrl }, { landingLink }] = await Promise.all([
        import('../lib/landingPages/client.js'),
        import('../lib/outreach/landingPage.js'),
      ]);
      const existing = draft.campaign.page;
      if (!draft.page) {
        if (!existing) return true;
        if (!quiet) setBusy('Switching to the plain video page…');
        if (existing.id) { try { await setPagePublished(await ownerClient(), existing.id, false); } catch { /* the links no longer point at it */ } }
        draft.campaign = { ...draft.campaign, page: null, links: draft.campaign.links.map(({ pageLink, ...l }) => l) };
        persist();
        if (!quiet) { busy = ''; notice = 'Every prospect’s link now opens the plain video page.'; render(); }
        return true;
      }
      if (!quiet) setBusy('Updating your landing page…');
      if (!tpl) tpl = await import('../lib/landingPages/templates.js');
      const data = pagePuck();
      if (!data) throw new Error('That landing page design was not found. Choose your landing page again.');
      const client = await ownerClient();
      const title = String(draft.name || '').trim() || pageName();
      const config = { ...tpl.defaultConfig(draft.page.template, { title }), puck: JSON.parse(JSON.stringify(data)) };
      let row;
      if (existing?.id) {
        row = await updatePage(client, existing.id, { config, published: true });
      } else {
        const poster = draft.campaign.links.find((l) => l.thumbnailUrl && !/\.gif(\?|$)/i.test(l.thumbnailUrl))?.thumbnailUrl || null;
        row = await createPage(client, {
          title,
          videoUrl: draft.campaign.url,
          posterUrl: poster,
          duration: draft.video?.duration || null,
          source: { kind: 'outreach', studio: 'outreach', id: draft.campaign.id },
          config,
        });
        await setPagePublished(client, row.id, true);
      }
      const url = pageUrl(row.id);
      draft.campaign = {
        ...draft.campaign,
        page: { id: row.id, url },
        links: draft.campaign.links.map((l) => ({ ...l, pageLink: landingLink(url, l.link, contactOf(l)) })),
      };
      persist();
      if (!quiet) { busy = ''; notice = 'Updated: every prospect’s link shows the new page.'; render(); }
      return true;
    } catch (err) { fail(err); return false; }
  }

  // ---- Email and thumbnails ------------------------------------------------
  // The link a contact is sent: their page on the chosen landing page design, else the player page.
  const linkOf = (l) => l.pageLink || l.link;
  const contactOf = (l) => draft.contacts.find((c) => c.id === l.contactId) || { email: l.email, company: l.company };
  const emailOf = (l) => emailFor({ email: draft.email, fallbacks: draft.fallbacks, contact: contactOf(l), link: linkOf(l), thumbnailUrl: l.thumbnailUrl });

  async function copyEmail(l, btn) {
    const e = emailOf(l);
    try {
      if (globalThis.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([e.html], { type: 'text/html' }),
          'text/plain': new Blob([e.text], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(e.text);
      }
      btn.textContent = 'Copied: paste into your email';
    } catch {
      window.prompt('Copy this email:', e.text);
    }
  }

  // The picture behind the bubble for a contact (website backgrounds), else none.
  const siteShotFor = (c) => (usesBackground(draft) ? backgroundShotFor(draft, c) || fallbackShotFor(draft) : '');

  const logoFor = (c) => (draft.email.thumb?.logo === false ? '' : draft.siteLogos?.[siteKey(c.website)] || '');

  async function makeThumbnails() {
    const T = await import('../lib/outreach/thumbnail.js');
    const settings = T.thumbSettings(draft.email.thumb);
    abort = new AbortController();
    const signal = abort.signal;
    try {
      // Logos come from capturing each contact's website (the same capture as website backgrounds).
      if (settings.logo && sitesToCapture(draft).some((site) => !draft.siteShots[site])) await captureSites({ requireFallback: false });
      setBusy('Reading your video…');
      const duration = draft.video.duration || 0;
      const still = settings.type === 'static';
      const frames = await T.grabFrames(draft.video.url, T.frameTimes(settings, duration || Infinity), still ? { width: T.THUMB_W, height: T.THUMB_H, signal } : { signal });
      const made = new Map();
      const links = draft.campaign.links;
      for (let i = 0; i < links.length; i += 1) {
        if (signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
        const c = contactOf(links[i]);
        const text = T.thumbnailText(draft.email.thumbText, c, draft.fallbacks);
        const site = siteShotFor(c);
        const logo = settings.logo ? logoFor(c) : '';
        const key = T.thumbnailKey(text, site, logo);
        if (!made.has(key)) {
          setBusy(`Making ${still ? 'thumbnails' : 'GIF thumbnails'} ${i + 1} of ${links.length}…`);
          const blob = await T.renderThumbnail({ frames, siteUrl: site, logoUrl: logo, text, settings });
          made.set(key, await uploadToStorage(new File([blob], `thumb-${Date.now()}-${made.size}.${still ? 'jpg' : 'gif'}`, { type: blob.type })));
        }
        links[i] = { ...links[i], thumbnailUrl: made.get(key) };
      }
      persist();
      busy = ''; abort = null;
      notice = `Thumbnails ready: ${made.size} ${still ? 'image' : 'GIF'}${made.size === 1 ? '' : 's'} for ${links.length} contact${links.length === 1 ? '' : 's'}.`;
      render();
    } catch (err) {
      abort = null;
      if (err?.name === 'AbortError') { busy = ''; persist(); notice = 'Stopped. Contacts done so far keep their thumbnails.'; render(); return; }
      fail(/tainted|SecurityError/i.test(String(err?.message || err?.name)) ? new Error('The browser could not read your video to make thumbnails. Upload the video again and retry.') : err);
    }
  }

  async function copyGif(l, btn) {
    const { thumbnailHtml } = await import('../lib/outreach/email.js');
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([thumbnailHtml({ link: linkOf(l), thumbnailUrl: l.thumbnailUrl })], { type: 'text/html' }),
        'text/plain': new Blob([l.thumbnailUrl], { type: 'text/plain' }),
      })]);
      btn.textContent = 'Copied: paste into your email';
    } catch {
      window.prompt('Copy this thumbnail address:', l.thumbnailUrl);
    }
  }

  async function copyEmbed(l, btn) {
    const { embedSnippet } = await import('../lib/outreach/email.js');
    const code = embedSnippet({ link: linkOf(l), thumbnailUrl: l.thumbnailUrl, name: l.name });
    try { await navigator.clipboard.writeText(code); btn.textContent = 'Copied'; } catch { window.prompt('Copy this embed code:', code); }
  }

  function renderEmailCard() {
    const box = card('Email', 'Write the email once. Each contact gets their name, company and personal link, with a personalized thumbnail that opens their page.');
    box.setAttribute('data-outreach-email', '');
    const thumbText = textInput(draft.email.thumbText, 'Hi {{firstname}}, this is for you');
    const subject = textInput(draft.email.subject, 'A quick video for {{firstname}}');
    const body = el('textarea', 'w-full min-h-[150px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60');
    body.value = draft.email.body;
    const canvas = el('canvas', 'w-full rounded-xl border border-white/10 bg-black');
    canvas.width = 960; canvas.height = 540;
    canvas.setAttribute('data-outreach-thumb-preview', '');
    let sample = draft.contacts[0] || {};
    const sampleOut = el('pre', 'whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/80 font-sans');
    const t = () => draft.email.thumb || {};
    const setThumb = (patch) => { draft.email = { ...draft.email, thumb: { ...t(), ...patch } }; persist(); };
    let video = null; let siteImg = null; let logoImg = null; let T = null;
    let loopStart = 0;
    const draw = () => {
      if (!T) return;
      const settings = T.thumbSettings(t());
      // A GIF previews its 3 seconds as they'll loop.
      const progress = settings.type === 'gif' && video ? Math.max(0, Math.min(1, (video.currentTime - loopStart) / T.GIF_SECONDS)) : 0;
      T.drawThumbnail(canvas.getContext('2d'), { frame: video, site: siteImg, logo: settings.logo ? logoImg : null, text: T.thumbnailText(draft.email.thumbText, sample, draft.fallbacks), play: settings.play, progress });
    };
    const updateEmail = () => {
      const l = draft.campaign.links.find((x) => x.contactId === sample.id) || draft.campaign.links[0];
      const e = l ? emailOf(l) : null;
      sampleOut.textContent = e ? `To: ${e.to}\nSubject: ${e.subject}\n\n${e.text}` : '';
    };
    const loadSampleImages = () => {
      siteImg = null; logoImg = null;
      const shot = siteShotFor(sample);
      if (shot) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { siteImg = img; draw(); }; img.src = shot; }
      const logo = draft.siteLogos?.[siteKey(sample.website)];
      if (logo) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { logoImg = img; draw(); }; img.src = logo; }
    };
    // Preview: a still seeks to the chosen second; a GIF plays its 3 seconds in a loop.
    const seekPreview = () => {
      if (!video || !T) return;
      const settings = T.thumbSettings(t());
      const dur = video.duration || draft.video.duration || 0;
      loopStart = settings.type === 'gif' ? Math.max(0, Math.min(settings.start, dur - T.GIF_SECONDS)) : Math.min(settings.start, Math.max(0, dur - 0.05));
      video.currentTime = loopStart;
      if (settings.type === 'gif') video.play().catch(() => {}); else video.pause();
    };
    import('../lib/outreach/thumbnail.js').then((mod) => {
      T = mod;
      if (draft.video?.url) {
        video = el('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
        video.addEventListener('loadedmetadata', seekPreview, { once: true });
        video.addEventListener('seeked', draw);
        video.addEventListener('timeupdate', () => {
          draw();
          if (T.thumbSettings(t()).type === 'gif' && video.currentTime >= loopStart + T.GIF_SECONDS) video.currentTime = loopStart;
        });
        video.src = draft.video.url;
      }
      loadSampleImages();
      draw();
    });
    const syncText = () => {
      draft.email = { ...draft.email, thumbText: thumbText.value, subject: subject.value, body: body.value };
      persist(); draw(); updateEmail();
    };
    [thumbText, subject, body].forEach((i) => i.addEventListener('input', syncText));
    updateEmail();

    // Thumbnail controls (Sendspark: type, preview start, play button, logo).
    const controls = el('div', 'grid gap-3 rounded-xl border border-white/10 p-3');
    controls.setAttribute('data-outreach-thumb-controls', '');
    const typeRow = el('div', 'flex flex-wrap items-center gap-2');
    typeRow.appendChild(el('span', 'text-xs font-semibold text-secondary w-24', 'Thumbnail'));
    for (const [type, label] of [['gif', 'Animated GIF'], ['static', 'Still image']]) {
      const b = button(label, { small: true, primary: (t().type || 'gif') === type });
      b.setAttribute('data-thumb-type', type);
      b.addEventListener('click', () => { setThumb({ type }); render(); });
      typeRow.appendChild(b);
    }
    const start = el('input', 'flex-1 accent-[#d9ff00]');
    start.type = 'range'; start.min = '0'; start.step = '0.1';
    start.max = String(Math.max(0, (draft.video?.duration || 3) - ((t().type || 'gif') === 'gif' ? 3 : 0.1)));
    start.value = String(t().start ?? 1);
    start.setAttribute('aria-label', 'Preview starts at');
    const startLabel = el('span', 'w-12 text-right text-xs tabular-nums text-white/60', `${Number(start.value).toFixed(1)}s`);
    start.addEventListener('input', () => { setThumb({ start: Number(start.value) }); startLabel.textContent = `${Number(start.value).toFixed(1)}s`; seekPreview(); });
    const startRow = el('div', 'flex items-center gap-2');
    startRow.append(el('span', 'text-xs font-semibold text-secondary w-24', (t().type || 'gif') === 'gif' ? 'Select preview' : 'Frame'), start, startLabel);
    const play = t().play || {};
    const playOn = el('input'); playOn.type = 'checkbox'; playOn.checked = play.show !== false;
    const playStyle = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white');
    for (const [v, l] of [['solid', 'Solid'], ['outline', 'Outline'], ['glass', 'Glass']]) { const o = el('option', 'bg-neutral-900', l); o.value = v; o.selected = (play.style || 'solid') === v; playStyle.appendChild(o); }
    const playColor = el('input', 'h-7 w-10 rounded border border-white/10 bg-transparent'); playColor.type = 'color'; playColor.value = play.color || '#4f46e5';
    const playOpacity = el('input', 'w-24 accent-[#d9ff00]'); playOpacity.type = 'range'; playOpacity.min = '0.2'; playOpacity.max = '1'; playOpacity.step = '0.05'; playOpacity.value = String(play.opacity ?? 1);
    playOpacity.setAttribute('aria-label', 'Play button opacity');
    const syncPlay = () => { setThumb({ play: { show: playOn.checked, style: playStyle.value, color: playColor.value, opacity: Number(playOpacity.value) } }); draw(); };
    [playOn, playStyle, playColor, playOpacity].forEach((i) => i.addEventListener('input', syncPlay));
    playOn.addEventListener('change', syncPlay);
    const playRow = el('div', 'flex flex-wrap items-center gap-2 text-xs');
    const playLbl = el('label', 'flex items-center gap-1.5'); playLbl.append(playOn, el('span', '', 'Show'));
    playRow.append(el('span', 'text-xs font-semibold text-secondary w-24', 'Play button'), playLbl, playStyle, playColor, el('span', 'text-white/50', 'Opacity'), playOpacity);
    const logoOn = el('input'); logoOn.type = 'checkbox'; logoOn.checked = t().logo !== false; logoOn.setAttribute('data-thumb-logo', '');
    logoOn.addEventListener('change', () => { setThumb({ logo: logoOn.checked }); draw(); });
    const logoRow = el('label', 'flex items-center gap-2 text-xs');
    logoRow.append(el('span', 'text-xs font-semibold text-secondary w-24', 'Logo'), logoOn, el('span', 'text-white/70', 'Show each prospect\u2019s company logo (found on their website)'));
    controls.append(typeRow, startRow, playRow, logoRow);

    // Which contact the preview shows.
    const who = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white');
    who.setAttribute('aria-label', 'Preview for');
    draft.contacts.slice(0, 200).forEach((c) => { const o = el('option', 'bg-neutral-900', [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email); o.value = c.id; o.selected = c.id === sample.id; who.appendChild(o); });
    who.addEventListener('change', () => { sample = draft.contacts.find((c) => c.id === who.value) || sample; loadSampleImages(); draw(); updateEmail(); });
    const whoRow = el('div', 'flex items-center gap-2 text-xs text-secondary'); whoRow.append(el('span', '', 'Preview for'), who);

    const grid = el('div', 'grid gap-4 lg:grid-cols-2');
    const left = el('div', 'flex flex-col gap-3');
    left.append(field('Thumbnail text', thumbText, 'Shown on the picture. {{firstname}}, {{company}} and {{jobtitle}} work here.'), controls,
      field('Subject', subject), field('Message', body, 'Put {{link}} on its own line: the thumbnail goes there in the copied email.'));
    const right = el('div', 'flex flex-col gap-3');
    right.append(canvas, whoRow, sampleOut);
    grid.append(left, right);
    box.appendChild(grid);
    const actions = el('div', 'flex flex-wrap gap-2');
    if (busy && abort) {
      const stop = button('Stop');
      stop.addEventListener('click', () => abort?.abort());
      actions.appendChild(stop);
    } else {
      const has = draft.campaign.links.some((l) => l.thumbnailUrl);
      const make = button(has ? 'Remake thumbnails' : 'Make thumbnails', { primary: !has });
      make.setAttribute('data-outreach-make-thumbs', '');
      make.disabled = !!busy || !draft.video?.url;
      make.addEventListener('click', makeThumbnails);
      actions.appendChild(make);
    }
    const merge = button('Download mail-merge .csv');
    merge.addEventListener('click', () => {
      const rows = draft.campaign.links.map((l) => ({ ...emailOf(l), contact: contactOf(l), link: linkOf(l), thumbnailUrl: l.thumbnailUrl || '' }));
      downloadText(`${(draft.name || 'campaign').replace(/[^\w-]+/g, '_')}-emails.csv`, mailMergeCsv(rows));
    });
    actions.appendChild(merge);
    box.append(actions, el('p', 'text-[11px] text-white/45', 'Copy email puts the finished email (with the thumbnail) on your clipboard to paste into Gmail or Outlook. Copy GIF copies just the clickable thumbnail; Embed gives HTML for email tools. Email opens it in your mail app as plain text. The .csv works with mail-merge tools.'));
    return box;
  }

  // ---- Step 6: Campaigns -------------------------------------------------
  async function loadCampaigns() {
    campaigns.loading = true; campaigns.error = ''; render();
    try {
      const client = await ownerClient();
      const { data, error } = await client.from('published_videos')
        .select('id, title, updated_at, published, campaign:project->campaign')
        .eq('project->>kind', 'outreach')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      campaigns.rows = data || [];
      const { fetchVideoStats } = await import('../lib/editor/publish/publishClient.js');
      const stats = await Promise.all(campaigns.rows.map((r) => fetchVideoStats(client, r.id).catch(() => null)));
      campaigns.stats = Object.fromEntries(campaigns.rows.map((r, i) => [r.id, stats[i]]));
      campaigns.loaded = true;
    } catch (err) {
      campaigns.error = err?.message || 'Could not load your campaigns.';
    } finally {
      campaigns.loading = false;
      render();
    }
  }

  const summarize = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    return {
      watched: list.filter((r) => r.contactId && r.plays > 0).length,
      views: list.reduce((n, r) => n + r.views, 0),
      clicks: list.reduce((n, r) => n + r.ctaClicks, 0),
    };
  };

  // "+ New dynamic video": a fresh campaign that keeps your voice, details and button.
  function startNew({ from = draft, keepVideo = false } = {}) {
    const inProgress = !draft.campaign && (draft.video || draft.contacts.length);
    if (inProgress && from === draft && !keepVideo && !window.confirm('Start a new dynamic video? The one you are setting up (not generated yet) will be replaced.')) return;
    replaceDraft(newDynamicVideo(from, { keepVideo }));
    step = keepVideo ? 4 : 1; notice = keepVideo ? 'Same video, new prospects: add them below.' : ''; render();
  }

  function openFromLibrary(id) {
    const saved = libraryDraft(id);
    if (!saved) return;
    replaceDraft(saved);
    step = SETUP_STEPS + 1; notice = ''; render();
  }

  // The Videos home: your dynamic videos as cards (like Sendspark's library), then the results table.
  function renderLibrary() {
    const lib = listLibrary();
    const box = el('div', 'flex flex-col gap-4');
    box.setAttribute('data-outreach-library', '');
    const head = el('div', 'flex flex-wrap items-end gap-3');
    const title = el('div', 'flex-1');
    title.append(el('h2', 'text-2xl font-black', 'Your dynamic videos'), el('p', 'text-sm text-secondary', 'Record once. Each prospect gets their own intro, page, thumbnail and link.'));
    const fresh = button('+ New dynamic video', { primary: true });
    fresh.setAttribute('data-outreach-new', '');
    fresh.disabled = !!busy;
    fresh.addEventListener('click', () => startNew());
    head.append(title, fresh);
    box.appendChild(head);

    const grid = el('div', 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3');
    // The one being set up (not generated yet).
    if (!draft.campaign && (draft.video || draft.contacts.length)) {
      const c = el('div', 'flex flex-col gap-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-4');
      c.setAttribute('data-outreach-continue', '');
      c.append(el('div', 'text-xs font-bold uppercase tracking-wider text-primary', 'In progress'), el('div', 'text-lg font-extrabold truncate', draft.name || 'Untitled dynamic video'),
        el('p', 'text-xs text-secondary', `${draft.video ? 'Video recorded' : 'No video yet'} \u00b7 ${draft.contacts.length} prospect${draft.contacts.length === 1 ? '' : 's'}`));
      const go = button('Continue', { primary: true, small: true });
      go.addEventListener('click', () => { step = resumeStep(); notice = ''; render(); });
      c.appendChild(go);
      grid.appendChild(c);
    }
    const statsOf = (id) => summarize(campaigns.stats[id]);
    lib.forEach((e) => {
      const c = el('div', 'flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel-bg');
      c.setAttribute('data-library-item', e.id);
      const media = el('div', 'relative aspect-video bg-black');
      if (e.thumbnailUrl) { const im = el('img', 'h-full w-full object-cover'); im.src = e.thumbnailUrl; im.alt = ''; media.appendChild(im); } else if (e.video) { const v = el('video', 'h-full w-full object-cover'); v.src = `${e.video}#t=1`; v.muted = true; v.preload = 'metadata'; media.appendChild(v); }
      if (draft.campaign?.id === e.id) media.appendChild(el('span', 'absolute bottom-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-black', 'Open now'));
      const body = el('div', 'flex flex-1 flex-col gap-2 p-4');
      const st = statsOf(e.id);
      body.append(el('div', 'truncate font-extrabold', e.name), el('div', 'text-xs text-secondary', `${new Date(e.savedAt).toLocaleDateString()} \u00b7 ${e.contacts} prospect${e.contacts === 1 ? '' : 's'} \u00b7 ${st.watched} watched \u00b7 ${st.clicks} click${st.clicks === 1 ? '' : 's'}`));
      const row = el('div', 'mt-auto flex flex-wrap gap-2 pt-1');
      const open = button('Open', { small: true, primary: true });
      open.disabled = !!busy;
      open.addEventListener('click', () => openFromLibrary(e.id));
      const again = button('New prospects, same video', { small: true });
      again.disabled = !!busy;
      again.addEventListener('click', () => { const saved = libraryDraft(e.id); if (saved) startNew({ from: saved, keepVideo: true }); });
      row.append(open, again);
      body.appendChild(row);
      c.append(media, body);
      grid.appendChild(c);
    });
    if (!grid.children.length) {
      const empty = el('div', 'rounded-2xl border border-white/10 bg-panel-bg p-6 text-sm text-secondary sm:col-span-2 lg:col-span-3');
      empty.textContent = 'No dynamic videos yet. Click "+ New dynamic video": record yourself once, add your prospects, and each one gets a personal intro and page.';
      grid.appendChild(empty);
    }
    box.appendChild(grid);
    return box;
  }

  function renderCampaigns() {
    if (!campaigns.loaded && !campaigns.loading && !campaigns.error) setTimeout(loadCampaigns, 0);
    const wrap = el('div', 'flex flex-col gap-5');
    wrap.appendChild(renderLibrary());
    const all = campaigns.rows.map((r) => ({ r, s: summarize(campaigns.stats[r.id]) }));
    const totals = el('div', 'grid grid-cols-2 md:grid-cols-4 gap-3');
    for (const [label, value] of [
      ['Campaigns', all.length],
      ['Contacts', all.reduce((n, x) => n + (Number(x.r.campaign?.contacts) || 0), 0)],
      ['Watched', all.reduce((n, x) => n + x.s.watched, 0)],
      ['Button clicks', all.reduce((n, x) => n + x.s.clicks, 0)],
    ]) {
      const f = el('div', 'rounded-2xl border border-white/10 bg-panel-bg p-4');
      f.append(el('div', 'text-2xl font-black', String(value)), el('div', 'text-xs text-secondary', label));
      totals.appendChild(f);
    }
    wrap.appendChild(totals);

    const table = card('Results');
    const head = el('div', 'flex flex-wrap gap-2 -mt-2');
    const refresh = button(campaigns.loading ? 'Loading…' : 'Refresh', { small: true });
    refresh.disabled = campaigns.loading;
    refresh.addEventListener('click', loadCampaigns);
    head.append(refresh);
    table.appendChild(head);
    if (campaigns.error) table.appendChild(el('p', 'text-sm text-amber-300', campaigns.error));
    else if (campaigns.loaded && !all.length) table.appendChild(el('p', 'text-sm text-secondary', 'No results yet. They show here once a dynamic video is generated and its links are opened.'));
    if (all.length) {
      const grid = el('div', 'grid grid-cols-[1fr_110px_90px_90px_90px] gap-x-3 text-sm');
      for (const h of ['Campaign', 'Date', 'Videos', 'Watched', 'Clicks']) grid.appendChild(el('div', 'pb-2 text-xs text-white/45', h));
      all.forEach(({ r, s }) => {
        const nameBtn = el('button', 'truncate py-2 text-left font-semibold hover:text-primary', r.campaign?.name || r.title || r.id);
        nameBtn.type = 'button';
        nameBtn.addEventListener('click', () => { campaigns.openId = campaigns.openId === r.id ? null : r.id; render(); });
        grid.append(nameBtn,
          el('div', 'py-2 text-white/60', new Date(r.updated_at).toLocaleDateString()),
          el('div', 'py-2 tabular-nums', String(Number(r.campaign?.contacts) || 0)),
          el('div', 'py-2 tabular-nums', String(s.watched)),
          el('div', 'py-2 tabular-nums', String(s.clicks)));
        if (campaigns.openId === r.id) {
          const detail = el('div', 'col-span-5 mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm');
          const names = Object.fromEntries((draft.campaign?.id === r.id ? draft.campaign.links : []).map((l) => [l.contactId, l.name]));
          const rows = (campaigns.stats[r.id] || []).filter((x) => x.contactId);
          if (!rows.length) detail.appendChild(el('p', 'text-secondary', 'Nobody has opened a personal link yet.'));
          rows.forEach((x) => {
            const line = el('div', 'flex gap-3 py-1');
            line.append(el('span', 'flex-1 truncate', names[x.contactId] || `Contact ${x.contactId}`),
              el('span', 'text-white/60', `${x.views} view${x.views === 1 ? '' : 's'} · ${x.plays} play${x.plays === 1 ? '' : 's'} · ${x.ctaClicks} click${x.ctaClicks === 1 ? '' : 's'}`));
            detail.appendChild(line);
          });
          const link = el('a', 'mt-2 inline-block text-xs text-primary underline', 'Open the video page');
          link.href = `/watch/${encodeURIComponent(r.id)}`; link.target = '_blank'; link.rel = 'noopener';
          detail.appendChild(link);
          grid.appendChild(detail);
        }
      });
      table.appendChild(grid);
    }
    wrap.appendChild(table);
    return wrap;
  }

  // ---- Shell -------------------------------------------------------------
  // A step can be opened once every earlier setup step is complete (Campaigns is always open).
  const reachable = (n) => n === STEPS.length || [...Array(Math.min(n, SETUP_STEPS + 1) - 1).keys()].every((i) => !stepErrors(draft, i + 1).length);

  function renderStepper() {
    stepper.replaceChildren();
    const order = [STEPS.length, ...STEPS.slice(0, -1).map((_, i) => i + 1)];
    order.forEach((n, k) => {
      const name = STEPS[n - 1];
      if (k === 1) stepper.appendChild(el('span', 'mx-1 self-center text-white/20', '|'));
      const open = reachable(n);
      const done = n !== step && n <= SETUP_STEPS + 1 && !stepErrors(draft, n).length;
      const pill = el('button', [
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold',
        n === step ? 'border-primary bg-primary text-black' : 'border-white/10 text-white/60',
        open ? '' : 'opacity-40 cursor-not-allowed',
      ].join(' '));
      pill.type = 'button';
      pill.disabled = !open || !!busy;
      pill.title = open ? name : `${name}: finish the earlier steps first.`;
      pill.append(el('span', 'grid h-5 w-5 place-items-center rounded-full bg-black/20 text-[10px]', n === STEPS.length ? '\u25a6' : done ? '✓' : String(n)), el('span', '', name));
      pill.addEventListener('click', () => { step = n; notice = ''; render(); });
      stepper.appendChild(pill);
    });
  }

  const VIEWS = { 1: () => renderRecord(), 2: () => renderVoice(), 3: () => renderCustomize(), 4: () => renderContacts(), 5: () => renderGenerate(), 6: () => renderCampaigns() };

  function render() {
    dropPreviewHandles();
    renderStepper();
    inner.replaceChildren();
    inner.appendChild(VIEWS[step]());

    const footer = el('div', 'flex flex-wrap items-center gap-3');
    const errors = step <= SETUP_STEPS + 1 ? stepErrors(draft, step) : [];
    const msg = busy || notice || errors[0] || '';
    const status = el('p', `flex-1 text-sm ${busy ? 'text-primary' : notice && !errors.length ? 'text-emerald-300' : 'text-amber-300'}`, msg);
    status.setAttribute('data-outreach-busy', '');
    // Buttons sit on the left so the floating Ask SmartVideo button (bottom right) never covers them.
    if (step > 1 && step < STEPS.length) {
      const back = button('Back'); back.disabled = !!busy;
      back.addEventListener('click', () => { step -= 1; notice = ''; render(); });
      footer.appendChild(back);
    }
    if (step < STEPS.length) {
      const next = button(step === SETUP_STEPS + 1 ? 'Back to my videos' : 'Next', { primary: true });
      next.disabled = !!busy || errors.length > 0;
      next.addEventListener('click', () => { step += 1; notice = ''; render(); });
      footer.appendChild(next);
    }
    footer.appendChild(status);
    inner.appendChild(footer);
  }

  render();
  return container;
}
