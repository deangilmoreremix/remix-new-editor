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
import { emailFor, mailtoUrl, mailMergeCsv, gmailUrl, outlookUrl, linkedinMessage } from '../lib/outreach/email.js';
import { WRITER_LANGUAGES } from '../lib/outreach/aiWriter.js';
import { renderProspectTable } from './outreach/ProspectTable.js';
import { hasPaidAccess } from '../lib/clerkEntitlements.js';

// Caption translation languages (src/lib/editor/ml/modelRegistry.js TRANSLATE_LANGUAGES).
const TRANSLATE_LANGS = [['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['pl', 'Polish'], ['ru', 'Russian'], ['tr', 'Turkish'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['sv', 'Swedish'], ['en', 'English']];
import {
  STEPS, SETUP_STEPS, STOCK_VOICES, FIRST_NAME_FALLBACKS, CONTACT_FIELDS, CSV_TEMPLATE, MAX_CONTACTS,
  loadDraft, saveDraft, stepErrors, fillTemplate, speakRequest, tokensIn,
  parseCsv, guessMapping, contactsFromRows, contactsFromLeads, makeContact, mergeContacts, contactProfile, contactValues,
  buildCampaignProject, campaignLinks, siteKey, sitesToCapture, calendarEmbedUrl,
  SITE_ERROR, siteErrorFor, MISSING_MODES, onMissingOf, siteStatus, backgroundProblems,
  usesBackground, fallbackShotFor, backgroundShotFor, contactProfileFor, addressesToCapture, mapKey,
  saveToLibrary, listLibrary, libraryDraft, newDynamicVideo, cleanPage, DYNAMIC_KINDS,
  BUBBLE_CORNERS, bubbleOf, cardSide,
} from '../lib/outreach/draft.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Buttons are never filled, like the prompt bar in the studios (src/styles/global.css .btn-action-secondary,
// .btn-personalize, .btn-primary-modern): outlined; the main action has a lime left edge (like Generate) and a
// selected option a light lime tint (like Personalize).
const BTN_LOOK = {
  plain: 'border border-white/[0.08] bg-transparent text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.18]',
  primary: 'border border-white/[0.12] border-l-2 border-l-primary bg-transparent text-white/90 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.2] hover:border-l-primary',
  selected: 'border border-primary/25 bg-primary/[0.08] text-white/90 hover:text-white hover:bg-primary/[0.14] hover:border-primary/45',
};
function button(label, { primary = false, selected = false, small = false } = {}) {
  const b = el('button', [
    'inline-flex items-center justify-center gap-2 rounded-[10px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
    small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
    BTN_LOOK[selected ? 'selected' : primary ? 'primary' : 'plain'],
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
  return videoMeta(url).then((m) => m.duration);
}

/** Length and picture size of a video (0s when it can't be read). */
function videoMeta(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({ duration: Number.isFinite(v.duration) ? v.duration : 0, width: v.videoWidth || 0, height: v.videoHeight || 0 });
    v.onerror = () => resolve({ duration: 0, width: 0, height: 0 });
    v.src = url;
  });
}

export function OutreachStudio() {
  const container = el('div', 'relative w-full h-full flex flex-col overflow-hidden bg-app-bg text-white');
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
  let captureTab = null; // "Capture with my browser": the tab we opened, waiting for Start capturing
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
  // The edit recipe (src/lib/outreach/editTools.js) is saved with the draft; clips added before/after are local files,
  // kept for this session only.
  const persist = () => { draft.edit = { ...edit, before: null, after: null }; saveDraft(draft); if (draft.campaign) saveToLibrary(draft); };
  const replaceDraft = (next) => { for (const k of Object.keys(draft)) delete draft[k]; Object.assign(draft, next); edit = startEdit(draft.edit); stopPreview(); linkStats = { id: null, loading: false, byContact: null }; pendingCsv = null; pendingLeads = null; persist(); };
  const setBusy = (label) => { busy = label; render(); };
  const fail = (err) => { busy = ''; notice = err?.message || String(err); render(); };
  // Everyone can look around Video Outreach; recording, generating and sharing need SmartVideo full access.
  // Without it the upgrade screen (Clerk's pricing table) opens; a purchase there carries on with the action.
  const paid = () => hasPaidAccess();
  async function gate(what) {
    if (paid()) return true;
    const { default: UpgradePrompt } = await import('./UpgradePrompt.js');
    const ok = await UpgradePrompt({ feature: what });
    render();
    return ok;
  }

  // ---- Step 1: Record ----------------------------------------------------
  // A new recording (or upload, or a video picked from the library) becomes the original that every edit is made
  // from (draft.sourceVideo) and, until edits are applied, the campaign video itself (draft.video).
  async function addVideo(blob, { duration, hasAudio = true, type = 'upload', name = 'outreach.webm' } = {}) {
    if (!(await gate('Video Outreach'))) return;
    notice = '';
    setBusy('Uploading your video…');
    try {
      recordingBlob = blob;
      const file = blob instanceof File ? blob : new File([blob], name, { type: blob.type || 'video/webm' });
      const url = await uploadToStorage(file);
      const meta = await videoMeta(url);
      const seconds = duration || meta.duration;
      draft.video = { url, duration: Math.round(seconds), hasAudio, type };
      draft.video = { ...draft.video, width: meta.width, height: meta.height };
      draft.sourceVideo = { ...draft.video };
      draft.videoSegs = null; draft.appliedKey = null; draft.bgCache = null;
      // A new recording means new captions, a new voice sample and greeting. Your look, text and graphics stay;
      // trims and cuts belonged to the old recording.
      draft.captions = null; draft.chapters = [];
      edit = { ...edit, trimStart: 0, trimEnd: null, cuts: [] };
      waveCache = null;
      draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 };
      persist();
      busy = '';
      render();
    } catch (err) { fail(err); }
  }

  async function openRecorder(type = 'both') {
    if (!(await gate('Video Outreach'))) return;
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
    if (!(await gate('Video Outreach'))) return;
    const { openRecorderStudio } = await import('../features/recorder/mount.tsx');
    openRecorderStudio({
      onUseVideo: (v) => addVideo(v.blob, { duration: v.durationInFrames / v.fps, hasAudio: true, type: 'recorder', name: v.name }),
    });
  }

  // ---- Edit: trim, cut, add a clip before/after (src/lib/outreach/videoEdit.jsx) -------------
  let tools = null; // src/lib/outreach/editTools.js, loaded with the editor
  let toolsUi = null; // src/components/outreach/EditorTools.js
  const startEdit = (saved) => (tools ? tools.normalizeEdit(saved || {}) : { ...{ trimStart: 0, trimEnd: null, cuts: [], before: null, after: null }, ...(saved || {}), before: null, after: null });
  let edit = startEdit(draft.edit);
  // Drafts from before editing kept the original: their video is the original.
  if (draft.video?.url && !draft.sourceVideo?.url) draft.sourceVideo = { ...draft.video };
  const source = () => draft.sourceVideo || draft.video;
  const sourceMain = () => { const v = source(); return { src: v.url, duration: v.duration, width: v.width, height: v.height }; };
  // Captions and chapters are kept on the original's timeline; what prospects see follows the applied cuts.
  const outLines = (lines) => (draft.videoSegs && tools ? tools.remapLines(lines || [], draft.videoSegs, 'source') : (lines || []));
  const outputCaptions = () => {
    const c = draft.captions;
    if (!c?.lines?.length || !draft.videoSegs || !tools) return c;
    return { ...c, lines: outLines(c.lines), translations: Object.fromEntries(Object.entries(c.translations || {}).map(([k, v]) => [k, outLines(v)])) };
  };
  const outputChapters = () => (draft.chapters || []).map((c) => {
    if (!draft.videoSegs || !tools) return c;
    const t = tools.toOutputTime(c.startMs / 1000, draft.videoSegs, 'source');
    return t == null ? null : { ...c, startMs: Math.round(t * 1000) };
  }).filter(Boolean);
  let editTab = 'cut';
  let waveCache = null;
  const fmtS = (n) => `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, '0')}`;

  function renderEditPanel() {
    const box = el('div', 'flex flex-col gap-3 rounded-xl border border-white/10 p-4');
    box.setAttribute('data-outreach-edit', '');
    box.appendChild(el('div', 'text-sm font-bold', 'Trim and cut'));
    const dur = source().duration || 0;
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
    const seekPreview = (t) => { if (preview?.engine) { persist(); refreshPreview(); return; } const v = container.querySelector('[data-editor-video] video'); if (v) v.currentTime = t; };
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
      edit.cuts = [...edit.cuts, [a, Math.min(b, dur)]]; persist(); render();
    });
    cutRow.append(el('span', 'w-24 text-secondary', 'Cut a section'), from, to, addCut);
    box.appendChild(cutRow);
    edit.cuts.forEach(([a, b], i) => {
      const r = el('div', 'flex items-center gap-2 text-xs text-white/70');
      const rm = button('Undo', { small: true });
      rm.addEventListener('click', () => { edit.cuts = edit.cuts.filter((_, j) => j !== i); persist(); render(); });
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
    return box;
  }

  // The Apply bar under every editor tool: what will change, and Apply edits.
  function renderApplyBar() {
    const dur = source().duration || 0;
    const total = editSegmentsInfo();
    const row = el('div', 'flex flex-wrap items-center gap-2');
    const apply = button('Apply edits', { primary: total.changed, small: true });
    apply.setAttribute('data-edit-apply', '');
    apply.disabled = !total.changed || !!busy;
    apply.addEventListener('click', applyEdits);
    const personal = tools ? edit.overlays.filter(tools.isPersonal).length + edit.broll.filter(tools.isPersonal).length : 0;
    row.append(apply, el('span', 'text-xs text-white/50', [
      total.changed ? `Renders your recording with these edits: ${fmtS(total.seconds)} long (the recording is ${fmtS(dur)}).` : (draft.appliedKey ? 'Your edits are applied. Change anything and apply again: edits are always made from your original recording.' : 'No changes to render yet.'),
      personal ? `${personal} personal addition${personal === 1 ? '' : 's'} added to each prospect’s video (not burned in).` : '',
    ].filter(Boolean).join(' ')));
    return row;
  }

  let editModule = null;
  // The original as the editor uses it: with the background pass when one is applied and still matches.
  const editBase = () => {
    const main = sourceMain();
    const key = tools?.backgroundKey(main.src, edit.background);
    return key && draft.bgCache?.key === key ? { ...main, src: draft.bgCache.url } : main;
  };
  function editSegmentsInfo() {
    if (!editModule || !tools) {
      Promise.all([import('../lib/outreach/videoEdit.jsx'), import('../lib/outreach/editTools.js'), import('./outreach/EditorTools.js')]).then(([m, t, ui]) => {
        editModule = m; toolsUi = ui; if (!tools) { tools = t; edit = { ...t.normalizeEdit(edit), before: edit.before, after: edit.after }; }
        if (step === 1) render();
      });
      return { unchanged: true, changed: false, seconds: 0 };
    }
    // Recordings saved before their size was kept: measure it once (the shape "Same as recording" needs it).
    const src = source();
    if (src?.url && !src.width && !measuring) {
      measuring = true;
      videoMeta(src.url).then((m) => { if (m.width) { draft.sourceVideo = { ...source(), width: m.width, height: m.height }; persist(); if (step === 1) render(); } });
    }
    const main = editBase();
    const segs = editModule.buildSegments({ main, edits: edit, before: edit.before, after: edit.after });
    const upToDate = tools.hasRenderableEdits(edit, main) ? draft.appliedKey === tools.recipeKey(edit, sourceMain().src) : draft.video?.url === src.url;
    return { segs, changed: !upToDate, seconds: editModule.segmentsDuration(segs) };
  }
  let measuring = false;

  // Only trims, cuts and clips before/after: the quick segment render. Anything else (look, captions, text, music,
  // B-roll, transitions): the timeline renderer (the same composition the preview shows), then FFmpeg when asked.
  const onlyCuts = () => {
    const b = tools.blankEdit();
    return JSON.stringify([edit.look, edit.audio, edit.captions.burn, edit.transition, edit.quality]) === JSON.stringify([b.look, b.audio, false, 'none', 'standard'])
      && !edit.overlays.some((o) => !tools.isPersonal(o)) && !edit.broll.some((o) => !tools.isPersonal(o));
  };
  const busyText = (t) => { busy = t; const b = container.querySelector('[data-outreach-busy]'); if (b) b.textContent = busy; };

  // Apply edits: always from the original recording, so changing or removing a text later replaces it instead of
  // adding a second one. 1) the background (MediaPipe, kept for next time), 2) everything else on top, so text,
  // captions and graphics stay sharp.
  async function applyEdits() {
    if (!editModule || !tools) return;
    abort = new AbortController();
    stopPreview();
    try {
      setBusy('Applying edits…');
      const original = sourceMain();
      const key = tools.recipeKey(edit, original.src);
      // Nothing to render: the campaign uses the original as it is.
      if (!tools.hasRenderableEdits(edit, original) && !tools.backgroundKey(original.src, edit.background)) {
        await setEditedVideo(null, { key });
        return;
      }
      const bgKey = tools.backgroundKey(original.src, edit.background);
      if (bgKey && draft.bgCache?.key !== bgKey) {
        busyText('Changing the background: loading MediaPipe…');
        const { backgroundVideo } = await import('../lib/outreach/mediaTools.js');
        const blob = await backgroundVideo(original.src, edit.background, { signal: abort.signal, onProgress: (p) => busyText(`Changing the background… ${Math.round(p * 100)}%`) });
        const url = await uploadToStorage(new File([blob], 'background.webm', { type: 'video/webm' }));
        draft.bgCache = { key: bgKey, url };
        persist();
      }
      const main = editBase();
      const segs = editModule.buildSegments({ main, edits: edit, before: edit.before, after: edit.after });
      const { frameForAspect } = await import('../lib/editor/remotion/timelineToComposition.js');
      let blob; let duration;
      const size = frameForAspect('1080p', tools.resolveAspect(edit.look.aspect, original));
      if (onlyCuts() && editModule.segmentsDuration(segs) > 0) {
        const out = await editModule.renderSegments(segs, { ...size, signal: abort.signal, onProgress: (p) => busyText(`Applying edits… ${Math.round(p * 100)}%`) });
        ({ blob, duration } = out);
      } else {
        const [{ timelineToComposition }, { exportModel }, media] = await Promise.all([
          import('../lib/editor/remotion/timelineToComposition.js'),
          import('../lib/editor/remotion/exportClient.js'),
          import('../lib/outreach/mediaTools.js'),
        ]);
        const { project, seconds, aspect } = tools.editProject({ main, edit, lines: draft.captions?.lines || [] });
        const model = timelineToComposition(project, { quality: '1080p', aspect });
        blob = await exportModel(model, { container: 'mp4', signal: abort.signal, onProgress: (p) => busyText(`Rendering your edits… ${Math.round((p || 0) * 100)}%`) });
        if (media.needsFinish({ louder: edit.audio.louder, quality: edit.quality })) {
          busyText('Finishing with FFmpeg…');
          blob = await media.finishVideo(blob, { louder: edit.audio.louder, quality: edit.quality, signal: abort.signal, onProgress: (p) => busyText(`Finishing with FFmpeg… ${Math.round(p * 100)}%`) });
        }
        duration = seconds;
      }
      // Captions and chapters stay on the original's timeline; these segments map them onto the new video.
      const videoSegs = segs.map((x) => ({ ...x, src: x.src === main.src ? 'source' : 'clip' }));
      await setEditedVideo(blob, { key, duration, videoSegs, size });
    } catch (err) {
      abort = null;
      if (err?.name === 'AbortError' || /Stopped|cancel/i.test(err?.message || '')) { busy = ''; notice = 'Stopped.'; render(); return; }
      fail(err);
    }
  }

  // The campaign video becomes the rendered edit (or the original again when blob is null).
  async function setEditedVideo(blob, { key, duration = 0, videoSegs = null, size = null }) {
    const original = source();
    if (blob) {
      const name = `edited.${/webm/.test(blob.type) ? 'webm' : 'mp4'}`;
      const url = await uploadToStorage(new File([blob], name, { type: blob.type || 'video/mp4' }));
      draft.video = { url, duration: Math.round(duration || original.duration), hasAudio: original.hasAudio, type: original.type, ...(size || {}) };
    } else {
      draft.video = { url: original.url, duration: original.duration, hasAudio: original.hasAudio, type: original.type, width: original.width, height: original.height };
    }
    draft.videoSegs = videoSegs;
    draft.appliedKey = key;
    // The voice sample and greeting come from the campaign video.
    draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 };
    abort = null; busy = '';
    persist();
    notice = blob ? 'Edits applied. Check the voice step: the voice sample comes from the new video.' : 'Back to your original recording.';
    render();
  }

  // What a preview can't show: the per-prospect greeting (and lips) are made when you generate.
  function finalNotice({ light = false } = {}) {
    if (draft.kind === 'same' || !tokensIn(draft.greeting || '').length) return null;
    const p = el('p', `text-[11px] ${light ? 'text-black/50' : 'text-white/50'}`, `Preview: in the final videos each prospect hears their own greeting in your voice${draft.voice.lipsync ? ', and your lips move with it' : ''}.`);
    p.setAttribute('data-outreach-final-notice', '');
    return p;
  }

  // ---- The editor's other tools (src/components/outreach/EditorTools.js) -------------------------
  let preview = null; // { engine, host, frame }
  function stopPreview() { try { preview?.engine?.destroy(); } catch { /* gone */ } preview = null; }
  const previewTime = () => (preview ? preview.frame / 30 : 0);
  // The sample prospect the preview shows personal text for: your first prospect, else the fallbacks.
  const previewProfile = () => contactProfile(draft.contacts[0] || { id: 'preview', firstName: draft.fallbacks.firstname || 'there', company: draft.fallbacks.company || '' }, draft.siteShots || {});

  async function previewModel() {
    const { timelineToComposition } = await import('../lib/editor/remotion/timelineToComposition.js');
    const main = editBase();
    const { project, seconds, aspect } = tools.editProject({ main, edit, lines: draft.captions?.lines || [] });
    // Personal additions preview for the first prospect.
    project.tracks.push(...tools.personalTracks(edit, seconds, { fallbackShot: Object.values(draft.siteShots || {})[0] || '' }));
    return timelineToComposition(project, { quality: '720p', aspect, profile: previewProfile() });
  }

  let previewSeq = 0;
  async function refreshPreview(stage) {
    if (!tools || !draft.video?.url) return;
    const seq = ++previewSeq;
    let model;
    try { model = await previewModel(); } catch (err) { notice = err?.message || String(err); return; }
    if (seq !== previewSeq) return;
    if (!preview) {
      const host = el('div', 'h-full w-full');
      host.setAttribute('data-edit-preview', '');
      const { createPreviewEngine } = await import('../lib/editor/remotion/previewEngine.jsx');
      if (seq !== previewSeq) return;
      preview = { host, frame: 0, engine: null };
      preview.engine = createPreviewEngine(host, { model, onFrame: (f) => { if (preview) { preview.frame = f; const t = container.querySelector('[data-edit-time]'); if (t) t.textContent = fmtS(f / 30); } } });
    } else preview.engine.update(model);
    const target = stage || container.querySelector('[data-editor-video]');
    if (target && preview.host.parentNode !== target) target.replaceChildren(preview.host);
  }

  const editUpdate = (fn, { soft = false } = {}) => {
    fn(edit);
    if (tools) edit = { ...tools.normalizeEdit(edit), before: edit.before, after: edit.after };
    persist();
    if (soft) refreshPreview(); else render();
  };

  async function uploadPicked(file) {
    try { setBusy('Uploading…'); const url = await uploadToStorage(file); busy = ''; render(); return url; } catch (err) { fail(err); return null; }
  }

  const SILENCE = { light: { thresholdDb: -45, minSec: 1.5 }, normal: { thresholdDb: -40, minSec: 0.7 }, tight: { thresholdDb: -36, minSec: 0.4 } };
  const editActions = {
    upload: uploadPicked,
    mediaDuration: (file) => videoDuration(URL.createObjectURL(file)).catch(() => 0),
    picture: async (file, opts = {}) => {
      try {
        setBusy(opts.removeBackground ? 'Removing the picture’s background (in your browser)…' : 'Preparing the picture…');
        const { preparePicture } = await import('../lib/outreach/mediaTools.js');
        const png = await preparePicture(file, { ...opts, onProgress: (p) => { if (p?.stage === 'background' && p.progress != null) busyText(`Removing the background… ${Math.round(p.progress * 100)}%`); } });
        const url = await uploadToStorage(new File([png], `${(file.name || 'picture').replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }));
        busy = ''; render();
        return url;
      } catch (err) { fail(err); return null; }
    },
    waveform: async () => {
      const src = source().url;
      if (waveCache?.src !== src) { const { waveformBars } = await import('../lib/outreach/mediaTools.js'); waveCache = { src, bars: await waveformBars(src) }; }
      return waveCache.bars;
    },
    removeSilences: async (level) => {
      abort = new AbortController();
      try {
        setBusy('Finding the pauses…');
        const { detectSilencesIn } = await import('../lib/outreach/mediaTools.js');
        const { speechStart } = await import('../lib/outreach/lipsync.js');
        const opt = SILENCE[level] || SILENCE.normal;
        const silences = await detectSilencesIn(source().url, { thresholdDb: opt.thresholdDb, signal: abort.signal });
        // The greeting plays in the opening pause: keep it.
        const keepStart = draft.kind === 'same' ? 0 : speechStart(silences);
        const cuts = tools.silencesToCuts(silences, { minSec: opt.minSec, keepStart, duration: source().duration });
        edit.cuts = editModule.normalizeCuts([...edit.cuts, ...cuts], source().duration);
        abort = null; busy = '';
        notice = cuts.length ? `Cut ${cuts.length} pause${cuts.length === 1 ? '' : 's'} (${fmtS(cuts.reduce((n, [a, b]) => n + b - a, 0))}). Undo any of them in the list.` : 'No long pauses found.';
        persist(); render();
      } catch (err) { abort = null; if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped.'; render(); return; } fail(err); }
    },
    makeCaptions: () => makeCaptions(),
    captionsFile: async (fmt) => {
      const { captionsToSrt, captionsToVtt } = await import('../lib/editor/remotion/captions.js');
      const lines = outLines(draft.captions?.lines || []);
      const text = fmt === 'vtt' ? captionsToVtt(lines) : captionsToSrt(lines);
      const a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: fmt === 'vtt' ? 'text/vtt' : 'application/x-subrip' }));
      a.download = `${(draft.name || 'captions').replace(/[^\w-]+/g, '-')}.${fmt}`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
    makeChapters: () => {
      draft.chapters = tools.chaptersFromLines(draft.captions?.lines || []);
      notice = draft.chapters.length ? `${draft.chapters.length} chapters made. Rename them as you like.` : 'This video is too short or has no clear pauses for chapters.';
      persist(); render();
    },
  };

  function renderTools() {
    const wrap = el('div', 'flex flex-col gap-3');
    if (!tools || !toolsUi) { editSegmentsInfo(); wrap.appendChild(el('p', 'text-xs text-white/50', 'Loading the editor…')); return wrap; }
    wrap.appendChild(toolsUi.renderEditorTools({
      tab: editTab, setTab: (t) => { editTab = t; render(); },
      edit, update: editUpdate, now: previewTime, seconds: editSegmentsInfo().seconds || source().duration,
      sender: draft.sender || {},
      lines: draft.captions?.lines || [], chapters: draft.chapters || [], setChapters: (list) => { draft.chapters = list; persist(); render(); },
      actions: editActions, cutPanel: renderEditPanel(),
    }));
    wrap.appendChild(renderApplyBar());
    return wrap;
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
      const { captions } = await transcribeInBrowser(source().url, {
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
      const b = button(label, { small: true, selected: writer.kind === k });
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
    if (!(await gate('AI writing in Video Outreach'))) return;
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

  // ---- Step 1: the video editor (like Sendspark's): add the video on the left (camera, screen, both, upload or one
  // you made), the landing page template and what the page says; the video on the right; tools along the top.
  let editorTool = ''; // '' | 'captions' | 'script' | 'trim' | 'language'
  const ICONS = {
    cc: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10.5 10.2a2.3 2.3 0 1 0 0 3.6M16.5 10.2a2.3 2.3 0 1 0 0 3.6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    cut: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8.2 20 18M8 15.8 20 6"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-4.5-4.5L8 20"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    screen: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
    both: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><circle cx="8" cy="12.5" r="2.4"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    megaphone: '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    lines: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  };
  const icon = (k, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
  // An on/off switch: outlined, the "on" side tinted lime (never filled).
  function toggle(on, onChange, { label, disabled = false } = {}) {
    const b = el('button', `relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-35 ${on ? 'border-primary/50 bg-primary/[0.18]' : 'border-white/15 bg-white/[0.04]'}`);
    b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on)); b.disabled = disabled;
    if (label) b.setAttribute('aria-label', label);
    b.appendChild(el('span', `absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all ${on ? 'left-[22px] bg-primary' : 'left-0.5 bg-white/50'}`));
    b.addEventListener('click', () => onChange(!on));
    return b;
  }

  function renderRecord() {
    const wrap = el('div', 'flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel-bg');
    wrap.setAttribute('data-outreach-editor', '');

    // ---- Tools along the top.
    const bar = el('div', 'flex flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-3');
    const title = el('div', 'mr-auto min-w-0 truncate text-sm font-bold text-white/80', draft.name || 'Untitled dynamic video');
    bar.appendChild(title);
    const tool = (key, k, tip, onClick, { active = false, disabled = false } = {}) => {
      const b = el('button', `grid h-9 w-9 place-items-center rounded-[10px] border transition-colors disabled:opacity-30 ${active ? 'border-primary/40 bg-primary/[0.1] text-white' : 'border-transparent text-white/65 hover:border-white/15 hover:text-white'}`);
      b.type = 'button'; b.innerHTML = icon(k); b.title = tip; b.setAttribute('aria-label', tip); b.disabled = disabled;
      b.setAttribute('data-editor-tool', key);
      if (active) b.setAttribute('aria-pressed', 'true');
      b.addEventListener('click', onClick);
      bar.appendChild(b);
      return b;
    };
    const flip = (t) => () => { editorTool = editorTool === t ? '' : t; render(); };
    const has = !!draft.video?.url;
    tool('captions', 'cc', 'Captions and transcript', flip('captions'), { active: editorTool === 'captions', disabled: !has });
    tool('language', 'globe', `Language: ${draft.language || 'English'}`, flip('language'), { active: editorTool === 'language' });
    tool('script', 'doc', 'Script and teleprompter', flip('script'), { active: editorTool === 'script' });
    tool('trim', 'cut', 'Edit: cut, look, background, audio, captions, text, B-roll, chapters', flip('trim'), { active: editorTool === 'trim', disabled: !has });
    tool('thumbnail', 'image', 'Thumbnail for your emails', openThumbnails);
    const live = draft.campaign?.links?.[0];
    tool('link', 'link', live ? 'Copy a prospect link' : 'Links are made when you generate', async () => {
      try { await navigator.clipboard.writeText(live.pageLink || live.link); notice = 'Link copied.'; } catch { notice = 'Copy failed.'; }
      render();
    }, { disabled: !live });
    tool('preview', 'eye', 'Preview the prospect page', () => { step = 3; notice = ''; render(); });
    const share = button('Share video', { primary: true, small: true });
    share.setAttribute('data-editor-share', '');
    share.disabled = !has || !!busy;
    share.addEventListener('click', () => { step = draft.kind === 'same' ? 3 : 2; notice = ''; render(); });
    const close = button('Close', { small: true });
    close.setAttribute('data-editor-close', '');
    close.addEventListener('click', () => { step = STEPS.length; notice = ''; render(); });
    bar.append(share, close);

    // ---- Left: the video, the template and what the page says.
    const body = el('div', 'grid lg:grid-cols-[380px_1fr]');
    const side = el('div', 'flex flex-col gap-6 border-b border-white/10 p-5 lg:border-b-0 lg:border-r');
    const modes = el('div', 'grid grid-cols-3 gap-2');
    [['camera', 'user', 'Camera'], ['screen', 'screen', 'Screen'], ['both', 'both', 'Both']].forEach(([mode, k, label]) => {
      const b = el('button', 'flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-4 text-xs font-bold text-white/80 hover:border-primary/40 hover:text-white disabled:opacity-40');
      b.type = 'button'; b.disabled = !!busy;
      b.setAttribute('data-editor-record', mode);
      b.innerHTML = `<span class="text-primary">${icon(k, 20)}</span><span>${label}</span>`;
      b.addEventListener('click', () => openRecorder(mode));
      modes.appendChild(b);
    });
    const file = el('input'); file.type = 'file'; file.accept = 'video/*'; file.hidden = true;
    file.addEventListener('change', () => { const f = file.files?.[0]; if (f) addVideo(f, { type: 'upload', name: f.name }); file.value = ''; });
    const drop = el('div', 'flex flex-wrap items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 px-3 py-3 text-sm text-white/70');
    const up = el('button', 'font-semibold text-primary hover:underline', 'Upload');
    up.type = 'button'; up.setAttribute('data-editor-upload', ''); up.addEventListener('click', () => file.click());
    const pick = el('button', 'font-semibold text-primary hover:underline', 'select a video you made');
    pick.type = 'button'; pick.setAttribute('data-editor-select', ''); pick.addEventListener('click', selectMadeVideo);
    drop.append(up, el('span', '', 'or'), pick, file);
    const pro = el('button', 'text-left text-xs text-white/50 hover:text-white', 'Or open the Full Recorder (captions, scenes, B-roll) →');
    pro.type = 'button'; pro.setAttribute('data-outreach-full-recorder', ''); pro.addEventListener('click', openFullRecorder);
    const addBlock = el('div', 'flex flex-col gap-3');
    addBlock.append(modes, drop, pro);

    // Template: the landing page prospects open.
    const tpl = el('div', 'flex flex-col gap-2');
    tpl.appendChild(el('div', 'text-[15px] font-bold', 'Template'));
    const apply = el('button', 'flex items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/85 hover:border-primary/40');
    apply.type = 'button'; apply.setAttribute('data-editor-template', '');
    if (draft.page && !designs.loaded) loadDesigns();
    const tplName = draft.page ? (designs.list.find((t) => t.id === draft.page.template)?.name || 'Your landing page') : '';
    apply.innerHTML = `<span class="truncate">${draft.page ? '' : 'Apply template…'}</span><span class="text-primary">${icon('plus', 18)}</span>`;
    if (draft.page) apply.firstChild.textContent = `Template: ${tplName}${draft.page.puck ? ' (edited)' : ''}`;
    apply.addEventListener('click', chooseLandingPage);
    tpl.appendChild(apply);
    if (draft.page) { const ed = el('button', 'self-start text-xs font-semibold text-primary hover:underline', 'Edit page'); ed.type = 'button'; ed.addEventListener('click', openPageEditor); tpl.appendChild(ed); }

    // Customize: what the page says, its button, calendar and transcript.
    const cz = el('div', 'flex flex-col gap-4');
    cz.appendChild(el('div', 'text-[15px] font-bold', 'Customize'));
    const UNDER = 'w-full border-0 border-b border-white/15 bg-transparent px-0 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60';
    const line = (label, value, onInput, { area = false, ph = '' } = {}) => {
      const w = el('label', 'flex flex-col gap-1');
      w.appendChild(el('span', 'text-xs text-white/50', label));
      const i = el(area ? 'textarea' : 'input', `${UNDER} ${area ? 'min-h-[56px] resize-y' : ''}`);
      i.value = value || ''; i.placeholder = ph;
      i.addEventListener('input', () => { onInput(i.value); persist(); });
      w.appendChild(i);
      return w;
    };
    cz.append(
      line('Header', draft.header, (v) => { draft.header = v; }, { ph: 'Hi {{firstname}}, I made this for you' }),
      line('Message', draft.message, (v) => { draft.message = v; }, { area: true, ph: 'A short note under the video' }),
    );
    const row = (k, name, help, sw, extra = null) => {
      const r = el('div', 'flex flex-col gap-3 border-t border-white/10 pt-4');
      const top = el('div', 'flex items-start gap-3');
      const ic = el('span', 'mt-0.5 text-white/50'); ic.innerHTML = icon(k);
      const words = el('div', 'min-w-0 flex-1');
      words.append(el('div', 'text-sm font-semibold', name), el('div', 'text-xs text-white/50', help));
      top.append(ic, words, sw);
      r.appendChild(top);
      if (extra) r.appendChild(extra);
      return r;
    };
    const setCta = (patch) => { draft.cta = { ...draft.cta, ...patch }; persist(); render(); };
    const ctaFields = draft.cta.enabled ? el('div', 'flex flex-col gap-3 pl-8') : null;
    if (ctaFields) ctaFields.append(line('Button label', draft.cta.label, (v) => { draft.cta.label = v; }, { ph: 'Book a call' }), line('Link (https)', draft.cta.url, (v) => { draft.cta.url = v.trim(); }, { ph: 'https://cal.com/you/intro' }));
    const ctaSw = toggle(!!draft.cta.enabled, (on) => setCta({ enabled: on }), { label: 'Call-to-action' });
    ctaSw.setAttribute('data-editor-cta', '');
    const calSw = toggle(!!draft.cta.embed, (on) => setCta({ embed: on, enabled: on ? true : draft.cta.enabled }), { label: 'Calendar embed' });
    calSw.setAttribute('data-editor-calendar', '');
    const hasCaptions = !!draft.captions?.lines?.length;
    const trSw = toggle(hasCaptions && draft.showTranscript !== false, (on) => { draft.showTranscript = on; persist(); render(); }, { label: 'Transcript', disabled: !hasCaptions });
    trSw.setAttribute('data-editor-transcript', '');
    const trNote = hasCaptions ? null : el('p', 'pl-8 text-[11px] italic text-white/40', 'Available once captions are made (the CC tool above).');
    cz.append(
      row('megaphone', 'Call-to-action', 'Give your prospects their next step.', ctaSw, ctaFields),
      row('calendar', 'Calendar embed', 'Show your booking calendar with your video (plain video page).', calSw),
      row('lines', 'Transcript', 'Show a transcript on the page.', trSw, trNote),
    );
    side.append(addBlock, tpl, cz);

    // ---- Right: the video, and the open tool under it.
    const main = el('div', 'flex min-w-0 flex-col items-center gap-4 p-5 md:p-8');
    const stage = el('div', 'grid aspect-video w-full max-w-3xl place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black');
    stage.setAttribute('data-editor-video', '');
    const editing = editorTool === 'trim' && has;
    if (!editing && preview) stopPreview();
    if (editing && preview?.host) stage.appendChild(preview.host);
    else if (has) { const v = el('video', 'h-full w-full'); v.src = draft.video.url; v.controls = true; v.playsInline = true; stage.appendChild(v); }
    // While editing, the stage plays the edited video (Remotion Player): every change shows straight away.
    if (editing) refreshPreview(stage);
    else {
      const ph = el('div', 'flex flex-col items-center gap-2 text-white/35');
      ph.innerHTML = '<svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
      ph.appendChild(el('span', 'text-sm', 'Record or upload your video'));
      stage.appendChild(ph);
    }
    main.appendChild(stage);
    if (editing) {
      const ctl = el('div', 'flex items-center gap-2 text-xs text-white/60');
      ctl.setAttribute('data-edit-controls', '');
      const pp = button('▶ / ❚❚ Play', { small: true });
      pp.setAttribute('data-edit-play', '');
      pp.addEventListener('click', () => { const e = preview?.engine; if (!e) return; if (e.isPlaying()) e.pause(); else e.play(); });
      const t = el('span', 'tabular-nums', fmtS(previewTime())); t.setAttribute('data-edit-time', '');
      ctl.append(pp, t, el('span', 'text-white/40', '· preview of your edits (personal text shows for your first prospect)'));
      main.appendChild(ctl);
      const fin = finalNotice();
      if (fin) main.appendChild(fin);
    }
    if (has) main.appendChild(el('p', 'text-xs text-white/45', `${fmtTime(draft.video.duration)} · ${draft.video.hasAudio ? 'with sound' : 'no sound'}${draft.kind !== 'same' ? ' · the greeting plays over the first seconds' : ''}`));
    const brand = el('p', 'flex items-center gap-1.5 text-xs text-white/40');
    brand.innerHTML = '<span>Video message by</span><span class="font-extrabold text-white/70">SmartVideo</span>';
    main.appendChild(brand);
    const drawer = el('div', 'w-full max-w-3xl');
    if (editorTool === 'captions' && has) drawer.appendChild(renderCaptionsPanel());
    if (editorTool === 'trim' && has) drawer.appendChild(renderTools());
    if (editorTool === 'script') drawer.appendChild(renderScriptCard());
    if (editorTool === 'language') {
      const box = el('div', 'flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-4');
      box.setAttribute('data-editor-language', '');
      box.appendChild(el('span', 'text-sm font-bold', 'Language'));
      const sel = el('select', 'rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white');
      import('../lib/outreach/aiWriter.js').then(({ WRITER_LANGUAGES: langs }) => langs.forEach(([n]) => { const o = el('option', '', n); o.value = n; o.selected = n === (draft.language || 'English'); sel.appendChild(o); }));
      sel.addEventListener('change', () => { draft.language = sel.value; persist(); render(); });
      box.append(sel, el('span', 'text-xs text-white/50', 'The greeting is spoken in this language; captions and AI writing use it too.'));
      drawer.appendChild(box);
    }
    if (draft.video && !draft.video.hasAudio) drawer.appendChild(el('p', 'mt-3 text-xs text-amber-300', 'This video has no sound, so it cannot be used as your voice sample. You can still record a separate sample in the next step.'));
    main.appendChild(drawer);
    body.append(side, main);
    wrap.append(bar, body);
    return wrap;
  }

  // A video you already made in any studio (src/lib/landingPages/sourceRegistry.js).
  async function selectMadeVideo() {
    if (!(await gate('Video Outreach'))) return;
    const overlay = el('div', 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4');
    overlay.setAttribute('data-editor-videos', '');
    const box = el('div', 'flex max-h-[85vh] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c10] p-5 text-white');
    const head = el('div', 'flex items-center justify-between');
    const x = el('button', 'px-2 text-xl text-white/60 hover:text-white', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    head.append(el('h2', 'text-lg font-extrabold', 'Select a video you made'), x);
    const grid = el('div', 'grid gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3');
    grid.appendChild(el('p', 'text-sm text-white/50', 'Loading your videos…'));
    box.append(head, grid);
    overlay.appendChild(box);
    const close = () => overlay.remove();
    x.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    try {
      const { loadVideoSources } = await import('../lib/landingPages/sourceRegistry.js');
      const list = (await loadVideoSources()).filter((v) => /^https:\/\//i.test(v.url));
      grid.replaceChildren();
      if (!list.length) grid.appendChild(el('p', 'text-sm text-white/50', 'No videos found yet. Record or upload one instead.'));
      list.slice(0, 60).forEach((v) => {
        const t = el('button', 'flex flex-col overflow-hidden rounded-xl border border-white/10 text-left hover:border-primary/40');
        t.type = 'button';
        const media = el('div', 'aspect-video bg-black');
        if (v.posterUrl) { const i = el('img', 'h-full w-full object-cover'); i.src = v.posterUrl; i.alt = ''; media.appendChild(i); } else { const m = el('video', 'h-full w-full object-cover'); m.src = `${v.url}#t=0.5`; m.muted = true; m.preload = 'metadata'; media.appendChild(m); }
        t.append(media, el('div', 'truncate p-2 text-xs font-bold', v.title));
        t.addEventListener('click', async () => {
          close();
          // Its real length (the video's own metadata) when the library does not know it.
          const seconds = v.duration || await new Promise((res) => { const m = document.createElement('video'); m.preload = 'metadata'; m.onloadedmetadata = () => res(Number.isFinite(m.duration) ? m.duration : 0); m.onerror = () => res(0); m.src = v.url; setTimeout(() => res(0), 8000); });
          draft.video = { url: v.url, duration: seconds || 0, hasAudio: true, type: 'upload' };
          draft.campaign = null; persist(); render();
        });
        grid.appendChild(t);
      });
    } catch (err) { grid.replaceChildren(el('p', 'text-sm text-amber-300', err?.message || 'Could not load your videos.')); }
  }

  // ---- Step 2: Voice -----------------------------------------------------
  async function voiceSampleFrom(blob) {
    if (!(await gate('voice cloning'))) return;
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
    if (!(await gate('AI greetings'))) return;
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
    if (draft.kind === 'same') {
      // Same audio (Create Dynamic Videos): no AI voice; prospects are personalized by their website and page.
      const box = card('Same audio for everyone', 'Everyone hears your recording as it is, without an AI voice. Each prospect still gets their website behind you, their own landing page and link.');
      box.setAttribute('data-outreach-same-audio', '');
      const row = el('div', 'flex flex-wrap gap-2');
      for (const k of DYNAMIC_KINDS.filter((x) => x.id !== 'same')) {
        const b = button(`Use ${k.title.toLowerCase()} instead`, { small: true });
        b.addEventListener('click', () => { draft.kind = k.id; draft.greeting = k.greeting; draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 }; persist(); render(); });
        row.appendChild(b);
      }
      box.appendChild(row);
      return box;
    }
    // The dynamic-video editor (Sendspark's Script / Voice / Background, with a live preview per prospect).
    const page = el('div', 'flex flex-col gap-5');
    page.setAttribute('data-outreach-dynamic-editor', '');
    // Header: where you are, Preview and Generate Videos.
    const head = el('div', 'flex flex-wrap items-center gap-3');
    const crumbs = el('div', 'mr-auto flex min-w-0 items-center gap-2 text-sm');
    crumbs.append(el('span', 'text-white/45', 'Dynamic Videos'), el('span', 'text-white/30', '/'), el('span', 'truncate font-bold text-white', draft.name || 'Untitled dynamic video'));
    const prev = button('Preview', { small: true });
    prev.setAttribute('data-editor-preview-page', '');
    prev.title = draft.campaign ? 'Open this prospect\u2019s page' : 'Generate first: each prospect\u2019s page is made then';
    prev.addEventListener('click', () => {
      const c = previewContact();
      const l = draft.campaign?.links?.find((x) => x.contactId === c?.id) || draft.campaign?.links?.[0];
      if (l) window.open(linkOf(l), '_blank', 'noopener'); else { notice = 'Generate first: each prospect\u2019s page is made then.'; render(); }
    });
    const genBtn = button('Generate Videos', { primary: true, small: true });
    genBtn.setAttribute('data-editor-generate', '');
    genBtn.disabled = !!busy;
    genBtn.addEventListener('click', goGenerate);
    head.append(crumbs, prev, genBtn);

    const grid = el('div', 'grid gap-5 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]');
    const left = el('div', 'flex min-w-0 flex-col gap-4');
    const sectionCard = (title, attr) => {
      const c = el('div', 'flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5');
      c.setAttribute(attr, '');
      c.appendChild(el('div', 'text-xs font-extrabold uppercase tracking-[0.14em] text-primary', title));
      return c;
    };

    // SCRIPT: what each prospect hears, with the variables shown as chips.
    const script = sectionCard('Script', 'data-editor-script');
    const shown = el('p', 'text-[15px] leading-relaxed text-white/90');
    shown.setAttribute('data-editor-script-text', '');
    String(draft.greeting || '').split(/(\{\{\s*\w+\s*\}\})/).forEach((part) => {
      if (/^\{\{\s*\w+\s*\}\}$/.test(part)) shown.appendChild(el('span', 'mx-0.5 rounded-md bg-primary/15 px-1.5 py-0.5 text-sm font-bold text-primary', part.replace(/\{\{\s*(\w+)\s*\}\}/, '{$1}')));
      else if (part) shown.appendChild(document.createTextNode(part));
    });
    const g = textInput(draft.greeting, 'Hi {{firstname}}!');
    g.setAttribute('data-editor-greeting', '');
    g.addEventListener('change', () => { draft.greeting = g.value; draft.voice.fallbackUrl = ''; persist(); render(); });
    const fb = el('div', 'flex flex-wrap items-center gap-2');
    fb.appendChild(el('span', 'text-xs text-white/50', 'No first name? Say'));
    for (const word of FIRST_NAME_FALLBACKS) {
      const b = button(word, { selected: draft.fallbacks.firstname === word, small: true });
      b.addEventListener('click', () => { draft.fallbacks.firstname = word; draft.voice.fallbackUrl = ''; persist(); render(); });
      fb.appendChild(b);
    }
    script.append(shown, g, variableChips(g, { onInsert: () => g.dispatchEvent(new Event('change')), only: ['{{firstname}}', '{{company}}', '{{jobtitle}}'] }), el('p', 'text-[11px] text-white/45', 'Spoken at the start of your video, up to 70 characters. Use more than one variable if you like.'), fb);

    // VOICE: whose voice, ready or not, lip sync, language, and a preview.
    const voice = sectionCard('Voice', 'data-editor-voice');
    const modes = el('div', 'flex gap-2');
    for (const [mode, label] of [['clone', 'My cloned voice'], ['stock', 'Stock voice']]) {
      const b = button(label, { selected: draft.voice.mode === mode, small: true });
      b.setAttribute('data-voice-mode', mode);
      b.addEventListener('click', () => { draft.voice = { ...draft.voice, mode, fallbackUrl: '', fallbackDuration: 0 }; persist(); render(); });
      modes.appendChild(b);
    }
    const cloneReady = !!(draft.voice.cloneVoiceId && draft.voice.consent);
    const ready = draft.voice.mode === 'stock' || cloneReady;
    const who = draft.voice.mode === 'clone' ? `${(draft.sender?.name || 'Your').split(' ')[0]}${draft.sender?.name ? '\u2019s' : ''} cloned voice` : `${draft.voice.stockVoice.replace(/_/g, ' ')} (stock voice)`;
    const vrow = el('div', 'flex items-center gap-2.5 text-[15px]');
    vrow.setAttribute('data-voice-status', ready ? 'ready' : 'needs-sample');
    vrow.append(el('span', `h-2.5 w-2.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-amber-400'}`), el('span', 'flex-1', who), el('span', 'text-xs text-white/45', ready ? 'Ready' : 'Needs a voice sample'));
    voice.append(modes, vrow);
    if (draft.voice.mode === 'clone' && !cloneReady) {
      const consent = el('label', 'flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm');
      const box = el('input', 'mt-0.5'); box.type = 'checkbox'; box.checked = !!draft.voice.consentChecked;
      box.addEventListener('change', () => { draft.voice.consentChecked = box.checked; persist(); });
      const text = el('span', 'text-white/80');
      text.innerHTML = '<b class="text-white">This is my own voice.</b> I am the person speaking in the sample and I agree to it being cloned for my own outreach. Pages using it are labelled “AI-personalized voice”.';
      consent.append(box, text);
      const sampleActions = el('div', 'flex flex-wrap gap-2');
      const fromRec = button('Clone from my recording', { primary: true, small: true });
      fromRec.disabled = !recordingBlob || draft.video?.hasAudio === false;
      fromRec.title = recordingBlob ? '' : 'Record or upload in step 1 during this visit, or record a separate sample.';
      fromRec.addEventListener('click', () => voiceSampleFrom(recordingBlob));
      const sample = button('Record a voice sample', { small: true });
      sample.addEventListener('click', () => (draft.voice.consentChecked ? openRecorder('audio') : (notice = 'Tick “this is my own voice” first.', render())));
      sampleActions.append(fromRec, sample);
      voice.append(consent, sampleActions, el('p', 'text-[11px] text-white/45', 'Uses 10–60 seconds of your speech. Cloning and speech run on your own MuAPI key (Settings → API keys).'));
    }
    if (draft.voice.mode === 'stock') {
      const sel = el('select', 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white');
      for (const v of STOCK_VOICES) { const o = el('option', 'bg-neutral-900', v.replace(/_/g, ' ')); o.value = v; o.selected = draft.voice.stockVoice === v; sel.appendChild(o); }
      sel.addEventListener('change', () => { draft.voice = { ...draft.voice, stockVoice: sel.value, fallbackUrl: '', fallbackDuration: 0 }; persist(); render(); });
      voice.appendChild(sel);
    }
    const lipRow = el('div', 'flex items-center gap-3 text-[15px]');
    const lipSw = toggle(!!draft.voice.lipsync, (on) => { draft.voice = { ...draft.voice, lipsync: on }; persist(); render(); }, { label: 'Lip sync' });
    lipSw.setAttribute('data-editor-lipsync', '');
    lipRow.append(el('span', 'flex-1', 'Lip sync'), lipSw);
    voice.appendChild(lipRow);
    if (draft.voice.lipsync) voice.appendChild(el('p', 'text-[11px] text-white/45', 'Your mouth says each prospect\u2019s name: one paid MuAPI lip-sync request per different greeting (about $0.05). Leave a pause at the start of your recording.'));
    const langRow = el('div', 'flex flex-wrap items-center gap-2 text-[15px]');
    langRow.appendChild(el('span', 'flex-1', 'Language'));
    const lang = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white');
    lang.setAttribute('data-outreach-language', '');
    for (const [l] of WRITER_LANGUAGES) { const o = el('option', 'bg-neutral-900', l === 'English' ? 'English (source)' : l); o.value = l; o.selected = (draft.language || 'English') === l; lang.appendChild(o); }
    lang.addEventListener('change', () => { draft.language = lang.value; draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 }; draft.campaign = null; persist(); render(); });
    langRow.appendChild(lang);
    voice.appendChild(langRow);
    if ((draft.language || 'English') !== 'English') {
      const tr = button('Translate greeting, page and email', { small: true });
      tr.setAttribute('data-outreach-translate', '');
      tr.disabled = !!busy;
      tr.addEventListener('click', translateCampaign);
      voice.append(tr, el('p', 'text-[11px] text-white/45', 'The greeting is spoken in this language. Your recording stays as you recorded it.'));
    }
    // AI voice preview for the prospect being previewed, and the greeting itself (needed before generating).
    const pv = el('div', 'flex flex-wrap items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm');
    pv.setAttribute('data-editor-voice-preview', '');
    const pc = previewContact();
    const line = fillTemplate(draft.greeting, contactValues(pc || {}), draft.fallbacks);
    pv.appendChild(el('span', 'flex-1 min-w-0 truncate', `AI voice preview: “${line}”`));
    const tryAudio = el('audio', 'hidden');
    const play = button('▶ Play', { small: true });
    play.setAttribute('data-editor-voice-play', '');
    play.addEventListener('click', async () => {
      try {
        play.disabled = true; play.textContent = 'Making…';
        tryAudio.src = await speak(line);
        await tryAudio.play().catch(() => {});
      } catch (err) { notice = err.message; render(); return; } finally { play.disabled = false; play.textContent = '▶ Play'; }
    });
    const dislike = el('button', 'text-xs font-semibold text-white/50 hover:text-primary', 'Don\u2019t like it?');
    dislike.type = 'button';
    dislike.addEventListener('click', () => { draft.voice = { ...draft.voice, mode: draft.voice.mode === 'clone' ? 'stock' : 'clone', fallbackUrl: '', fallbackDuration: 0 }; persist(); render(); });
    pv.append(dislike, play, tryAudio);
    voice.append(pv, el('p', 'text-[11px] text-white/45', 'Each preview is one small paid speech request.'));
    const gen = button(draft.voice.fallbackUrl ? 'Regenerate the fallback greeting' : 'Make the fallback greeting', { primary: !draft.voice.fallbackUrl, small: true });
    gen.setAttribute('data-editor-make-greeting', '');
    gen.addEventListener('click', generateGreeting);
    voice.appendChild(gen);
    if (draft.voice.fallbackUrl) {
      const a = el('audio', 'w-full'); a.controls = true; a.src = draft.voice.fallbackUrl;
      voice.append(el('p', 'text-xs text-secondary', `For anyone without a name: “${fillTemplate(draft.greeting, {}, draft.fallbacks)}”`), a);
    }

    left.append(script, voice, renderBackgroundCard());
    grid.append(left, renderLivePreview());
    page.append(head, grid);
    return page;
  }

  // ---- Live preview of one prospect's video (AI intro step) ------------------------------
  let previewContactId = null;
  const previewContact = () => draft.contacts.find((c) => c.id === previewContactId) || draft.contacts[0] || null;
  const initialsOf = (name) => { const p = String(name || '').trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'; };
  const AVATAR_COLORS = ['#6366f1', '#f97316', '#eab308', '#10b981', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444'];
  const avatarColor = (s) => AVATAR_COLORS[[...String(s || '')].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];
  function avatar(name, size = 'h-9 w-9 text-xs') {
    const a = el('span', `grid ${size} shrink-0 place-items-center rounded-full font-extrabold text-white`, initialsOf(name));
    a.style.background = avatarColor(name);
    return a;
  }

  // Where the camera bubble sits in a 16:9 box, as CSS (the same places the published player uses).
  function bubbleCss() {
    const b = bubbleOf(draft);
    if (b.mode === 'spotlight') return { width: '40%', left: '30%', bottom: '5.4%' };
    const h = b.corner.startsWith('top') ? { top: '5.4%' } : { bottom: '5.4%' };
    const w = b.corner.endsWith('left') ? { left: '3%' } : { right: '3%' };
    return { width: '26%', ...h, ...w };
  }

  function renderLivePreview() {
    // Stays in view while you scroll the cards (bubble, scrolling and cursor changes show straight away).
    const wrap = el('div', 'flex min-w-0 flex-col gap-3 self-start lg:sticky lg:top-2');
    wrap.setAttribute('data-editor-live-preview', '');
    const c = previewContact();
    const values = contactValues(c || {});
    const frame = el('div', 'overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115]');
    // A browser bar with their company, like their own site.
    const bar = el('div', 'flex items-center gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-2.5');
    bar.append(el('span', 'h-6 w-6 rounded-md bg-white/80'), el('span', 'truncate text-sm font-bold', c?.company || draft.fallbacks.company || 'Their company'), el('span', 'ml-auto truncate text-xs text-white/40', c?.website ? String(c.website).replace(/^https?:\/\//, '') : ''));
    const media = el('div', 'relative aspect-video w-full overflow-hidden bg-black');
    media.setAttribute('data-editor-preview-media', '');
    const camVideo = () => { const v = el('video', 'h-full w-full object-cover'); v.src = draft.video?.url || ''; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; return v; };
    if (usesBackground(draft)) {
      const shot = (c && backgroundShotFor(draft, c)) || fallbackShotFor(draft);
      const bgEl = el('div', 'absolute inset-0');
      bgEl.setAttribute('data-preview-background', shot ? 'image' : 'placeholder');
      if (shot) {
        Object.assign(bgEl.style, { backgroundImage: `url(${JSON.stringify(shot)})`, backgroundSize: 'cover', backgroundPosition: 'top center' });
        // Scroll the page (and back up), like the finished video.
        if (draft.background.mode === 'website' && draft.background.scroll !== false) bgEl.animate([{ backgroundPosition: 'center 0%' }, { backgroundPosition: 'center 100%' }, ...(draft.background.scrollBack ? [{ backgroundPosition: 'center 0%' }] : [])], { duration: 12000, iterations: Infinity, easing: 'linear' });
      } else {
        bgEl.className = 'absolute inset-0 flex flex-col gap-3 bg-gradient-to-br from-slate-100 to-slate-200 p-[6%]';
        bgEl.append(el('div', 'h-[7%] w-2/5 rounded bg-slate-300'), el('div', 'h-[6%] w-1/3 rounded bg-slate-300'), el('div', 'mt-2 h-[3%] w-1/2 rounded bg-slate-300/80'), el('div', 'h-[3%] w-2/5 rounded bg-slate-300/80'));
        bgEl.appendChild(el('div', 'absolute right-[4%] top-[6%] max-w-[45%] text-right text-[11px] text-slate-500', draft.background.mode === 'website' ? 'Their website appears here (captured when you generate)' : 'Their picture appears here (made when you generate)'));
      }
      const bubble = el('div', 'absolute aspect-square overflow-hidden rounded-full border-[3px] border-white shadow-2xl');
      bubble.setAttribute('data-preview-bubble', bubbleOf(draft).mode === 'spotlight' ? 'spotlight' : bubbleOf(draft).corner);
      Object.assign(bubble.style, bubbleCss());
      if (draft.video?.url) bubble.appendChild(camVideo()); else bubble.classList.add('bg-slate-700');
      media.append(bgEl, bubble);
    } else if (draft.video?.url) media.appendChild(camVideo());
    else media.appendChild(el('div', 'grid h-full place-items-center text-sm text-white/40', 'Record your video first'));
    // What they hear, as a caption bubble.
    if (draft.kind !== 'same') {
      const cap = el('div', 'absolute left-[4%] top-[6%] flex max-w-[60%] items-center gap-2.5 rounded-xl bg-[#14161c]/90 px-3.5 py-2.5 text-[13px] text-white shadow-xl');
      cap.setAttribute('data-preview-caption', '');
      const playDot = el('span', 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs text-black', '▶');
      cap.append(playDot, el('span', '', `“${fillTemplate(draft.greeting, values, draft.fallbacks)}”`));
      media.appendChild(cap);
    }
    frame.append(bar, media);
    wrap.appendChild(frame);
    wrap.appendChild(finalNotice() || el('span'));
    // Prospect switcher.
    const list = draft.contacts.slice(0, 6);
    const chips = el('div', 'grid gap-2 sm:grid-cols-3');
    chips.setAttribute('data-editor-prospects', '');
    if (!list.length) chips.appendChild(el('p', 'text-xs text-white/45 sm:col-span-3', `No prospects yet: the preview uses your fallbacks (“${draft.fallbacks.firstname}”, “${draft.fallbacks.company}”). Add prospects in step 4.`));
    list.forEach((p) => {
      const on = p.id === c?.id;
      const chip = el('button', `flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-primary/40 bg-primary/[0.08]' : 'border-white/10 hover:border-white/25'}`);
      chip.type = 'button';
      chip.setAttribute('data-preview-prospect', p.id);
      if (on) chip.setAttribute('aria-pressed', 'true');
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Prospect';
      const words = el('div', 'min-w-0 flex-1');
      words.append(el('div', 'truncate text-sm font-bold', name), el('div', 'truncate text-xs text-white/50', p.company || ''));
      chip.append(avatar(name), words, ...(on ? [el('span', 'text-[11px] font-bold text-primary', 'Previewing')] : []));
      chip.addEventListener('click', () => { previewContactId = p.id; render(); });
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);
    return wrap;
  }

  // Generate Videos (editor header): straight to Generate & share when everything is set, else to what is missing.
  function goGenerate() {
    for (let s2 = 1; s2 <= SETUP_STEPS; s2 += 1) {
      const errs = stepErrors(draft, s2);
      if (errs.length) { step = s2; notice = errs[0]; render(); return; }
    }
    step = SETUP_STEPS + 1; notice = ''; render();
  }

  // Error handling (Sendspark's settings wheel): a prospect without a working website gets the fallback, or stops Generate.
  function renderErrorHandling() {
    const box = el('div', 'flex flex-col gap-1.5');
    box.setAttribute('data-bg-on-missing', '');
    box.appendChild(el('div', 'text-xs font-semibold text-white/70', 'Error handling'));
    MISSING_MODES.forEach(([k, label]) => {
      const row = el('label', 'flex items-center gap-2 text-sm text-white/80');
      const r = el('input'); r.type = 'radio'; r.name = 'outreach-on-missing'; r.value = k; r.checked = onMissingOf(draft) === k;
      r.setAttribute('data-on-missing', k);
      r.addEventListener('change', () => { draft.background = { ...draft.background, onMissing: k }; persist(); render(); });
      row.append(r, el('span', '', label));
      box.appendChild(row);
    });
    box.appendChild(el('p', 'text-[11px] text-white/45', 'When a prospect has no website, or theirs can\u2019t be loaded.'));
    return box;
  }

  function renderBackgroundCard() {
    // Background: the recording as it is, or each contact's own website behind a round camera bubble.
    const bg = el('div', 'flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5');
    bg.setAttribute('data-outreach-background-card', '');
    bg.appendChild(el('div', 'text-xs font-extrabold uppercase tracking-[0.14em] text-primary', 'Background'));
    const bgModes = el('div', 'flex flex-wrap gap-2');
    for (const [mode, label] of [['website', 'Website'], ['profile', 'Profile card'], ['map', 'Maps'], ['image', 'Image'], ['recording', 'None']]) {
      const b = button(label, { selected: draft.background.mode === mode, small: true });
      b.setAttribute('data-bg-mode', mode);
      b.addEventListener('click', () => { draft.background = { ...draft.background, mode }; draft.campaign = null; persist(); render(); });
      bgModes.appendChild(b);
    }
    bg.appendChild(bgModes);
    if (draft.background.mode === 'website') {
      bg.appendChild(el('p', 'text-xs text-secondary', 'Your camera appears in a round bubble over a screenshot of each contact\u2019s website or social page (the Website or social page column). Screenshots are taken when you generate the campaign. Record in Camera mode for this.'));
      const social = el('p', 'text-[11px] text-white/45', 'Social pages: YouTube channels and TikTok profiles work. Facebook, Instagram and X usually show a login page to visitors, so those prospects get the error below. LinkedIn isn\u2019t captured: use Profile card.');
      social.setAttribute('data-bg-social-note', '');
      bg.appendChild(social);
      const fallback = textInput(draft.background.fallbackSite, 'yourcompany.com');
      fallback.addEventListener('input', () => { draft.background = { ...draft.background, fallbackSite: fallback.value.trim() }; draft.campaign = null; persist(); });
      fallback.addEventListener('change', () => render());
      bg.appendChild(field('Fallback URL', fallback, 'Shown for contacts without a website, or whose site could not be captured.'));
      bg.appendChild(renderErrorHandling());
    }
    if (draft.background.mode === 'profile') {
      const p = el('p', 'text-xs text-secondary', 'Your camera appears in a round bubble over a card with each contact\u2019s name, job title, company, their logo (or initials) and their LinkedIn address, from your prospect list. Cards are drawn when you generate the campaign. (LinkedIn pages themselves can\u2019t be captured: they need a login.)');
      p.setAttribute('data-bg-profile-note', '');
      bg.appendChild(p);
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
    if (usesBackground(draft)) {
      // Where your camera sits over their background.
      const b = bubbleOf(draft);
      const setBubble = (patch) => { draft.background = { ...draft.background, bubble: { ...b, ...patch } }; draft.campaign = null; persist(); render(); };
      const bubbleRow = el('div', 'flex flex-wrap items-center gap-2 text-sm');
      bubbleRow.setAttribute('data-bg-bubble', '');
      bubbleRow.appendChild(el('span', 'mr-2 font-semibold', 'Camera bubble'));
      const spot = button('Spotlight', { selected: b.mode === 'spotlight', small: true });
      spot.setAttribute('data-bubble-mode', 'spotlight');
      spot.title = 'A bigger bubble at the bottom centre: you are the focus';
      spot.addEventListener('click', () => setBubble({ mode: 'spotlight' }));
      const fixed = button('Fixed', { selected: b.mode === 'fixed', small: true });
      fixed.setAttribute('data-bubble-mode', 'fixed');
      fixed.addEventListener('click', () => setBubble({ mode: 'fixed' }));
      const corner = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white disabled:opacity-40');
      corner.setAttribute('data-bubble-corner', ''); corner.setAttribute('aria-label', 'Bubble corner');
      corner.disabled = b.mode !== 'fixed';
      for (const [k, label] of BUBBLE_CORNERS) { const o = el('option', 'bg-neutral-900', label); o.value = k; o.selected = b.corner === k; corner.appendChild(o); }
      corner.addEventListener('change', () => setBubble({ mode: 'fixed', corner: corner.value }));
      bubbleRow.append(spot, fixed, corner);
      bg.appendChild(bubbleRow);
    }
    if (draft.background.mode === 'website') {
      const set = (patch) => { draft.background = { ...draft.background, ...patch }; draft.campaign = null; persist(); render(); };
      const line = (label, attr, on, onChange, extra = null) => {
        const r = el('div', 'flex items-center gap-3 text-sm');
        const sw = toggle(on, onChange, { label });
        sw.setAttribute(attr, '');
        r.append(el('span', 'flex-1 font-semibold', label), ...(extra ? [extra] : []), sw);
        return r;
      };
      const back = el('label', 'flex items-center gap-1.5 text-xs text-white/70');
      const backBox = el('input'); backBox.type = 'checkbox'; backBox.checked = !!draft.background.scrollBack; backBox.disabled = draft.background.scroll === false;
      backBox.setAttribute('data-bg-scroll-back', '');
      backBox.addEventListener('change', () => set({ scrollBack: backBox.checked }));
      back.append(backBox, el('span', '', 'Scroll back up'));
      bg.append(
        line('Scroll the page', 'data-bg-scroll', draft.background.scroll !== false, (on) => set({ scroll: on }), back),
        line('Mouse cursor', 'data-bg-cursor', draft.background.cursor !== false, (on) => set({ cursor: on })),
      );
    }
    return bg;
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


    // Video background: on the AI intro step for AI voices; here for Same audio (which has no AI intro step).
    if (draft.kind === 'same') main.appendChild(renderBackgroundCard());
    else {
      const note = el('p', 'text-xs text-white/50', 'Video background, camera bubble and scrolling are on the AI intro step.');
      note.setAttribute('data-outreach-bg-moved', '');
      main.appendChild(note);
    }


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
        if (draft.page) { const b = el('button', 'mx-auto rounded-[10px] border border-black/15 border-l-2 border-l-[#4f46e5] bg-transparent px-5 py-2 text-sm font-bold text-black/80 hover:bg-black/5', 'Edit page'); b.type = 'button'; b.addEventListener('click', openPageEditor); preview.appendChild(b); }
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
        Object.assign(bubble.style, { ...bubbleCss(), aspectRatio: '1 / 1' });
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
      const fin = finalNotice({ light: true });
      if (fin) preview.appendChild(fin);
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

  // Website backgrounds on the Prospects step: each prospect's status, and a free check of every website.
  function siteBadge(c) {
    const st = siteStatus(draft, c);
    const then = onMissingOf(draft) === 'error' ? 'Fix or remove before generating.' : 'Their video uses the fallback.';
    const [cls, text] = {
      uploaded: ['text-emerald-300', '\u2713 Screenshot uploaded'],
      own: ['text-emerald-300', '\u2713 Website ready'],
      error: ['text-orange-300', `${siteErrorFor(draft, c)} ${then}`],
      none: ['text-orange-300', `No website. ${then}`],
      pending: ['text-white/40', 'Website not checked yet'],
    }[st];
    const b = el('div', `text-[11px] ${cls}`, text);
    b.setAttribute('data-outreach-site-status', st);
    return b;
  }

  // The screenshot behind this prospect's bubble, small (so a wrong capture is easy to spot and replace).
  function shotPreview(c) {
    const shot = backgroundShotFor(draft, c);
    const box = el('div', 'h-9 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.03]');
    box.setAttribute('data-outreach-shot-preview', shot ? 'yes' : 'no');
    if (shot) { const img = el('img', 'h-full w-full object-cover object-top'); img.src = shot; img.alt = ''; img.loading = 'lazy'; box.appendChild(img); }
    return box;
  }

  // Upload screenshot: the user's own picture of this prospect's page (any page, no capture needed).
  function uploadShotButton(c) {
    const wrap = el('div', 'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1');
    const f = el('input'); f.type = 'file'; f.accept = 'image/png,image/jpeg,image/webp'; f.hidden = true;
    const up = el('button', 'text-[11px] font-semibold text-primary hover:underline disabled:opacity-40', c.backgroundShot ? 'Replace screenshot' : 'Upload screenshot');
    up.type = 'button';
    up.setAttribute('data-outreach-upload-shot', c.id);
    up.disabled = !!busy;
    up.addEventListener('click', () => f.click());
    f.addEventListener('change', async () => {
      const file = f.files?.[0]; f.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type) || file.size > 10 * 1024 * 1024) { notice = 'Choose a PNG, JPEG or WebP picture under 10 MB.'; render(); return; }
      if (!(await gate('screenshots for your prospects'))) return;
      setBusy(`Uploading the screenshot for ${c.firstName || c.email || 'this prospect'}…`);
      try {
        const url = await uploadToStorage(file);
        draft.contacts = draft.contacts.map((x) => (x.id === c.id ? { ...x, backgroundShot: url } : x));
        draft.campaign = null; busy = ''; notice = ''; persist();
      } catch (err) { busy = ''; notice = err.message; }
      render();
    });
    wrap.append(up, f);
    if (c.backgroundShot) {
      const clear = el('button', 'text-[11px] text-white/45 hover:text-white', 'Use their link instead');
      clear.type = 'button';
      clear.setAttribute('data-outreach-clear-shot', c.id);
      clear.addEventListener('click', () => { draft.contacts = draft.contacts.map((x) => (x.id === c.id ? { ...x, backgroundShot: '' } : x)); draft.campaign = null; persist(); render(); });
      wrap.appendChild(clear);
    }
    return wrap;
  }

  // Capture with my browser: pages the user can see signed in (Facebook, Instagram, X…), shot in their own
  // browser through Chrome's tab sharing (src/lib/outreach/browserCapture.js). LinkedIn is never captured.
  const browserTodo = () => sitesToCapture(draft).filter((k) => !draft.siteShots[k] && !/linkedin\.com/i.test(k));
  function renderBrowserCapture() {
    const box = el('div', 'flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3');
    box.setAttribute('data-outreach-browser-capture', '');
    const todo = browserTodo();
    box.appendChild(el('div', 'text-xs font-semibold text-white/80', 'Capture with my browser'));
    if (!globalThis.navigator?.mediaDevices?.getDisplayMedia) {
      box.appendChild(el('p', 'text-[11px] text-white/45', 'Needs Chrome or Edge on a computer. Or upload a screenshot on each prospect.'));
      return box;
    }
    if (!captureTab || captureTab.closed) {
      captureTab = null;
      box.appendChild(el('p', 'text-[11px] text-white/45', 'For pages that need you signed in (Facebook, Instagram, X): they\u2019re captured in your own browser, where you\u2019re already signed in. We never see your password. Your own name and photo at the top of the page are cut off. About 6 seconds a page; keep the tab open.'));
      const open = button(todo.length ? `Capture with my browser (${todo.length})` : 'Nothing left to capture', { small: true });
      open.setAttribute('data-outreach-browser-open', '');
      open.disabled = !todo.length || !!busy;
      open.addEventListener('click', async () => {
        if (!(await gate('screenshots for your prospects'))) return;
        try {
          const { openCaptureTab } = await import('../lib/outreach/browserCapture.js');
          captureTab = openCaptureTab(); notice = '';
        } catch (err) { notice = err.message; }
        render();
      });
      box.appendChild(open);
      return box;
    }
    box.appendChild(el('p', 'text-[11px] text-white/70', 'A tab named \u201cSmartVideo capture tab\u201d is open. Click Start capturing, then choose that tab in Chrome\u2019s window and click Share.'));
    const row = el('div', 'flex flex-wrap gap-2');
    const start = button(`Start capturing (${todo.length})`, { primary: true, small: true });
    start.setAttribute('data-outreach-browser-start', '');
    start.disabled = !!busy || !todo.length;
    start.addEventListener('click', () => runBrowserCapture(todo));
    const cancel = button('Cancel', { small: true });
    cancel.addEventListener('click', () => { try { captureTab?.close(); } catch { /* gone */ } captureTab = null; render(); });
    row.append(start, cancel);
    box.appendChild(row);
    return box;
  }

  async function runBrowserCapture(urls) {
    const bc = await import('../lib/outreach/browserCapture.js');
    let share = null;
    abort = new AbortController();
    try {
      share = await bc.startTabShare(captureTab);
      const { shots, failed } = await bc.captureInTab({
        tab: captureTab, share, urls, signal: abort.signal,
        upload: (blob, i) => uploadToStorage(new File([blob], `prospect-page-${i + 1}.jpg`, { type: 'image/jpeg' })),
        onShot: (url, imageUrl) => {
          draft.siteShots = { ...draft.siteShots, [url]: imageUrl };
          if (draft.siteErrors?.[url]) { const { [url]: _gone, ...rest } = draft.siteErrors; draft.siteErrors = rest; }
          draft.campaign = null; persist();
        },
        onProgress: (i, n, url) => setBusy(i < n ? `Capturing in your browser: ${i + 1} of ${n} (${url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')})\u2026 Keep the capture tab open.` : 'Saving\u2026'),
      });
      draft.siteErrors = { ...draft.siteErrors, ...Object.fromEntries(failed.map((k) => [k, SITE_ERROR])) };
      persist();
      const n = Object.keys(shots).length;
      notice = `${n} page${n === 1 ? '' : 's'} captured in your browser.${failed.length ? ` ${failed.length} did not load.` : ''} Check the small pictures: if one shows a login or the wrong page, upload a screenshot for that prospect.`;
    } catch (err) {
      notice = err?.name === 'AbortError' ? 'Stopped. Pages captured so far are kept.' : err?.name === 'NotAllowedError' ? 'Tab sharing was cancelled. Click Start capturing and choose the SmartVideo capture tab.' : err.message;
    } finally {
      share?.stop();
      if (!/wasn\u2019t the SmartVideo capture tab|cancelled/.test(notice)) { try { captureTab?.close(); } catch { /* gone */ } captureTab = null; }
      busy = ''; abort = null;
      render();
    }
  }

  function renderSiteCheck() {
    const box = el('div', 'flex flex-wrap items-center gap-2');
    // A LinkedIn link already refused is not checked again (it never can be captured).
    const todo = sitesToCapture(draft).filter((s) => !draft.siteShots[s] && !(/linkedin\.com/i.test(s) && draft.siteErrors?.[s])).length;
    const check = button(todo ? `Check websites (${todo})` : 'Websites checked', { small: true });
    check.setAttribute('data-outreach-check-sites', '');
    check.disabled = !todo || !!busy;
    check.addEventListener('click', async () => {
      abort = new AbortController();
      try { await captureSites({ requireFallback: false }); busy = ''; notice = ''; } catch (err) { busy = ''; if (err?.name !== 'AbortError') notice = err.message; }
      render();
    });
    const bad = draft.contacts.filter((c) => ['error', 'none'].includes(siteStatus(draft, c))).length;
    box.append(check, el('span', 'text-[11px] text-white/45', bad ? `${bad} without a working website (${onMissingOf(draft) === 'error' ? 'they stop Generate' : 'they get the fallback'}).` : 'Screenshots are taken now and reused when you generate.'));
    const wrap = el('div', 'flex flex-col gap-3 border-t border-white/5 pt-3');
    wrap.append(box);
    if (busy && abort && /^Capturing in your browser/.test(busy)) {
      const stop = button('Stop capturing', { small: true });
      stop.setAttribute('data-outreach-browser-stop', '');
      stop.addEventListener('click', () => abort?.abort());
      wrap.append(el('p', 'text-[11px] text-primary', busy), stop);
    }
    wrap.append(renderBrowserCapture(), renderErrorHandling());
    return wrap;
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
      const row = el('div', `flex ${draft.background.mode === 'website' ? 'items-start' : 'items-center'} gap-3 py-2 text-sm`);
      const who = el('div', 'min-w-0 flex-1');
      who.append(el('div', 'truncate font-semibold', [c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)'),
        el('div', 'truncate text-xs text-white/50', [c.email, c.company].filter(Boolean).join(' · ')));
      if (draft.background.mode === 'website') who.appendChild(siteBadge(c));
      const rm = button('Remove', { small: true });
      rm.addEventListener('click', () => { draft.contacts = draft.contacts.filter((x) => x.id !== c.id); draft.campaign = null; persist(); render(); });
      if (draft.background.mode === 'website') { row.appendChild(shotPreview(c)); who.appendChild(uploadShotButton(c)); }
      row.append(who, rm);
      list.appendChild(row);
    });
    side.appendChild(list);
    if (draft.background.mode === 'website' && draft.contacts.length) side.appendChild(renderSiteCheck());
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
  async function captureSites({ requireFallback = true, onProgress = () => {} } = {}) {
    const { installPersonalizationApiAuth } = await import('../features/personalization/lib/apiAuth.ts');
    installPersonalizationApiAuth();
    const todo = sitesToCapture(draft).filter((site) => !draft.siteShots[site]);
    const failed = [];
    for (let i = 0; i < todo.length; i++) {
      if (abort?.signal.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
      onProgress(i / todo.length);
      setBusy(`Capturing websites: ${i + 1} of ${todo.length} (${todo[i].replace(/^https?:\/\//, '').replace(/\/$/, '')})…`);
      try {
        const res = await fetch('/api/outreach/site-shot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: todo[i] }), signal: abort?.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.imageUrl) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { code: body.code });
        draft.siteShots = { ...draft.siteShots, [todo[i]]: body.imageUrl };
        if (draft.siteErrors?.[todo[i]]) { const { [todo[i]]: _gone, ...rest } = draft.siteErrors; draft.siteErrors = rest; }
        if (body.logoUrl) draft.siteLogos = { ...draft.siteLogos, [todo[i]]: body.logoUrl };
        persist();
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        failed.push(todo[i]);
        // A login wall (most social networks) and LinkedIn get the server's own message; anything else Sendspark's.
        draft.siteErrors = { ...draft.siteErrors, [todo[i]]: ['CONTENT_RESTRICTED', 'LINKEDIN_NOT_SUPPORTED'].includes(err?.code) ? err.message : SITE_ERROR };
        persist();
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

  // Profile-card backgrounds: one card per prospect (and one for the fallbacks), drawn in the browser and stored.
  async function captureProfiles() {
    const { cardDetails, cardKey, renderProfileCard } = await import('../lib/outreach/profileCard.js');
    const side = cardSide(draft);
    const people = [...draft.contacts, {}];
    const todo = [];
    const seen = new Set();
    for (const c of people) {
      const d = cardDetails(c, draft.fallbacks);
      const k = cardKey(d, side);
      if (seen.has(k) || draft.profileShots?.[k]) continue;
      seen.add(k); todo.push({ c, d, k });
    }
    for (let i = 0; i < todo.length; i++) {
      if (abort?.signal.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
      setBusy(`Drawing profile cards: ${i + 1} of ${todo.length}…`);
      const { c, d, k } = todo[i];
      const logoUrl = c.website ? draft.siteLogos?.[siteKey(c.website)] || '' : '';
      const blob = await renderProfileCard(d, { logoUrl, side });
      const url = await uploadToStorage(new File([blob], 'profile-card.jpg', { type: 'image/jpeg' }));
      draft.profileShots = { ...(draft.profileShots || {}), [k]: url };
      persist();
    }
  }

  // Returns true when the campaign is published. `confirmed` skips the cost question (the caller asked already);
  // onStage(stage, part) follows the real work, part = 0..1 of that stage: 'site' (website screenshots), 'voice'
  // (greetings), 'render' (publishing the personal videos and rendering their thumbnails), 'page' (the landing
  // page), 'done'. On failure the reason is in `notice`.
  async function generateCampaign({ confirmed = false, onStage = () => {} } = {}) {
    if (!(await gate('Video Outreach campaigns'))) return false;
    const personal = draft.kind !== 'same' && tokensIn(draft.greeting).length > 0;
    const n = draft.contacts.length;
    const wantSync = personal && !!draft.voice.lipsync;
    // Lip-sync is cut from the uploaded video: edits not applied yet would not be in the lips.
    if (wantSync && editModule && tools && editSegmentsInfo().changed) {
      notice = 'Apply your edits first (Trim, then Apply edits): lip-sync uses the finished video.';
      render();
      return false;
    }
    const names = new Set(draft.contacts.map((c) => fillTemplate(draft.greeting, contactValues(c), draft.fallbacks).trim().toLowerCase())).size;
    if (personal && !confirmed && !window.confirm(`This voices the greeting for ${n} contact${n === 1 ? '' : 's'} (${names} different greeting${names === 1 ? '' : 's'}; repeated names are voiced once). Each one is a paid speech request on your MuAPI key.${wantSync ? ` Lip-sync is on: each different greeting is also a paid lip-sync video request (up to ${names}; ones made before are reused for free), which costs more and takes about a minute each, 3 at a time.` : ''} Continue?`)) return false;
    notice = '';
    abort = new AbortController();
    try {
      onStage('site');
      if (draft.background.mode === 'website') await captureSites({ onProgress: (part) => onStage('site', part) });
      // Error handling "show an error": nothing is made (or paid for) until every prospect has a working website.
      const problems = backgroundProblems(draft);
      if (problems.length) {
        busy = ''; progress = null;
        notice = `${problems.length} prospect${problems.length === 1 ? ' has' : 's have'} no working website: ${problems.slice(0, 5).map((c) => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email).join(', ')}${problems.length > 5 ? '…' : ''}. Fix or remove them on Prospects, or set Error handling to use the fallback. Nothing was generated.`;
        render();
        return false;
      }
      if (draft.background.mode === 'map') await captureMaps();
      if (draft.background.mode === 'profile') await captureProfiles();
      let variants = {};
      if (personal) {
        const [{ voiceForContacts }, audio] = await Promise.all([
          import('../lib/editor/personalize/perContact.js'),
          import('../lib/editor/agent/audioGen.js'),
        ]);
        onStage('voice');
        progress = { total: n, done: 0, phase: 'Voicing' };
        setBusy(`Voicing greetings: 0 of ${n}…`);
        ({ variants } = await voiceForContacts({
          text: draft.greeting,
          contacts: draft.contacts.map((c) => contactProfile(c)),
          signal: abort.signal,
          onProgress: ({ done, total, name }) => { progress = { total, done, phase: 'Voicing' }; onStage('voice', total ? done / total : 1); setBusy(`Voicing greetings: ${done} of ${total} (${name})…`); },
          generate: async (line) => {
            const remote = await audio.generateAudio('tts', speakRequest(draft, line), { signal: abort.signal });
            const url = await audio.persistAudio(remote, { upload: uploadToStorage, name: 'greeting' });
            return { url, duration: (await audio.probeDuration(url)) || 2 };
          },
        }));
      }
      let lipsync = null;
      if (wantSync && Object.keys(variants).length) {
        const [{ lipsyncContacts, LIPSYNC_MODEL, introSeconds, speechStart, pauseWarning, paidJobCount }, { muapi }] = await Promise.all([
          import('../lib/outreach/lipsync.js'),
          import('../lib/muapi.js'),
        ]);
        // Does the greeting window run into your first words? (Measured on the recording's audio.)
        let warn = null;
        try {
          const { detectSilences } = await import('../lib/editor/ml/localAI.js');
          warn = pauseWarning(introSeconds(draft, variants), speechStart(await detectSilences(draft.video.url, { toSec: 8, minSec: 0.2, signal: abort.signal })));
        } catch { /* no audio or not decodable: go on */ }
        const jobs = paidJobCount(draft, variants, draft.lipsyncCache || {});
        if (warn && !confirmed && !window.confirm(`${warn}\n\nLip-sync ${jobs} greeting${jobs === 1 ? '' : 's'} anyway?`)) {
          notice = warn; progress = null; busy = ''; render(); return false;
        }
        setBusy('Lip-syncing greetings: preparing your video…');
        if (!draft.lipsyncCache || typeof draft.lipsyncCache !== 'object') draft.lipsyncCache = {};
        lipsync = await lipsyncContacts({
          draft, variants, upload: uploadToStorage, signal: abort.signal, cache: draft.lipsyncCache,
          lipSync: ({ video_url, audio_url, signal }) => muapi.processLipSync({ model: LIPSYNC_MODEL, video_url, audio_url }, signal),
          deps: {
            // When the quick cut can't read the recording (e.g. WebM in Safari): render the window as MP4.
            renderIntro: async (src, seconds) => {
              const m = editModule || (editModule = await import('../lib/outreach/videoEdit.jsx'));
              return (await m.renderSegments([{ src, from: 0, to: seconds }], { width: 1280, height: 720, signal: abort.signal })).blob;
            },
          },
          onProgress: ({ done, total }) => { progress = { total, done, phase: 'Lip-syncing' }; setBusy(`Lip-syncing greetings: ${done} of ${total}…`); },
        });
        persist(); // keep what was paid for, even if a later step fails
      }
      onStage('render');
      setBusy('Publishing the campaign…');
      const [{ preparePublishProject, publishVideo, makeSlug, watchUrl }, { personalLink }] = await Promise.all([
        import('../lib/editor/publish/publishClient.js'),
        import('../lib/editor/personalize/perContact.js'),
      ]);
      // Personal text and "their website" B-roll from the editor ride on every prospect's video.
      const t = tools || await import('../lib/outreach/editTools.js');
      if (!tools) tools = t;
      const extraTracks = draft.edit ? (T) => t.personalTracks(draft.edit, T, { fallbackShot: Object.values(draft.siteShots || {})[0] || '' }) : null;
      // The transcript and chapters as they fall in the edited video (they are kept on the original's timeline).
      if (draft.video?.url && !draft.video.width) { const m = await videoMeta(draft.video.url); if (m.width) draft.video = { ...draft.video, width: m.width, height: m.height }; }
      const aspect = draft.video?.width ? t.resolveAspect('auto', draft.video) : '';
      const built = buildCampaignProject({ ...draft, captions: outputCaptions(), chapters: outputChapters() }, { variants, lipsync, extraTracks, aspect });
      const project = preparePublishProject(built, { title: built.title });
      const id = draft.campaign?.id || makeSlug();
      await publishVideo(await ownerClient(), { id, project });
      // Who each link belongs to, kept in your own account, so a "watched" alert can name them.
      saveProspects(id).catch(() => {});
      alerts.loaded = false;
      const url = watchUrl(id);
      // A landing page chosen earlier keeps showing the campaign; its contact links are rebuilt.
      const page = draft.campaign?.id === id ? draft.campaign.page : null;
      const { landingLink } = await import('../lib/outreach/landingPage.js');
      draft.campaign = {
        id, url, publishedAt: new Date().toISOString(), ...(page ? { page } : {}),
        links: campaignLinks(draft, url, personalLink, variants).map((l) => ({
          ...l,
          ...(lipsync?.clips?.[l.contactId] ? { lipsynced: true } : {}),
          ...(lipsync?.errors?.[l.contactId] ? { lipsyncError: lipsync.errors[l.contactId] } : {}),
          ...(page ? { pageLink: landingLink(page.url, l.link, draft.contacts.find((c) => c.id === l.contactId) || {}) } : {}),
        })),
      };
      persist();
      campaigns.loaded = false; // refresh the Campaigns list next time it opens
      const done = `${draft.campaign.links.length} personal video${draft.campaign.links.length === 1 ? '' : 's'} ready.${lipsync?.error ? ` ${lipsync.error}` : lipsync?.failed?.length ? ` Lip-sync failed for ${lipsync.failed.length} contact${lipsync.failed.length === 1 ? '' : 's'}; they hear their greeting without it.` : ''}`;
      // Like Sendspark, one Generate also makes the page and every prospect's thumbnail.
      notice = '';
      progress = null;
      onStage('render', 0.4);
      await makeThumbnails({ onProgress: (part) => onStage('render', 0.4 + 0.6 * part) });
      const thumbs = /^Thumbnails ready/.test(notice) ? ' Thumbnails made.' : notice ? ` Thumbnails: ${notice}` : '';
      notice = '';
      onStage('page');
      if (!(await publishCampaignPage({ quiet: true }))) return false; // the page failed: its message stays
      busy = '';
      notice = `Campaign published: ${done}${draft.campaign.page ? ' Their page is live.' : ''}${thumbs} Share each link below.`;
      onStage('done');
      render();
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped. Nothing was published.'; render(); return false; }
      fail(err);
      return false;
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
    const personal = draft.kind !== 'same' && tokensIn(draft.greeting).length > 0;
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
      gen.addEventListener('click', () => generateCampaign());
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
      if (linkStats.id !== draft.campaign.id && !linkStats.loading) setTimeout(loadLinkStats, 0);
      // The prospect table (src/components/outreach/ProspectTable.js), like Sendspark's dynamic-video prospect list.
      const list = card('Prospects', 'Each prospect\u2019s own video, thumbnail and page. Share or send it from their row; you\u2019ll see who watched and how much.');
      const contactOfLink = (l) => draft.contacts.find((c) => c.id === l.contactId) || {};
      const links = draft.campaign.links.map((l) => ({ ...l, heard: l.voiced ? fillTemplate(draft.greeting, contactValues(contactOfLink(l)), draft.fallbacks).trim() : '' }));
      list.appendChild(renderProspectTable({
        links, contacts: draft.contacts, total: draft.contacts.length,
        stats: linkStats.byContact, filter: prospectFilter,
        setFilter: (k) => { prospectFilter = k; render(); },
        onAddProspects: () => { step = 4; notice = ''; render(); },
        share: (l) => openShare(l),
        remove: (l) => removeProspect(l),
        menu: (l) => {
          const c = contactOfLink(l);
          const sent = () => markSent(l);
          return [
            { label: 'Copy link', attr: 'data-outreach-copy-link', onClick: async (_e, item) => { try { await navigator.clipboard.writeText(linkOf(l)); item.textContent = 'Copied'; } catch { window.prompt('Copy this link:', linkOf(l)); } sent(); } },
            { label: 'Copy email', attr: 'data-outreach-copy-email', onClick: (_e, item) => { copyEmail(l, item); sent(); } },
            { label: 'Gmail', attr: 'data-outreach-gmail', href: gmailUrl(emailOf(l)), onClick: sent },
            { label: 'Outlook', attr: 'data-outreach-outlook', href: outlookUrl(emailOf(l)), onClick: sent },
            ...(l.email ? [{ label: 'Email app', attr: 'data-outreach-mailto', href: mailtoUrl(emailOf(l)), onClick: sent }] : []),
            { label: 'LinkedIn', attr: 'data-outreach-linkedin', onClick: async (_e, item) => {
              const msg = linkedinMessage({ contact: c, link: linkOf(l), fallbacks: draft.fallbacks });
              window.open(c.linkedin || 'https://www.linkedin.com/messaging/', '_blank', 'noopener');
              try { await navigator.clipboard.writeText(msg); item.textContent = 'Message copied'; } catch { window.prompt('Copy this message:', msg); }
              sent();
            } },
            { label: 'Download MP4', attr: 'data-outreach-mp4', disabled: !!busy, onClick: () => downloadContactVideo(l) },
          ];
        },
      }));
      wrap.appendChild(list);
      wrap.appendChild(renderLandingCard());
      wrap.appendChild(renderEmailCard());
      wrap.appendChild(renderAlertsCard());
    }
    return wrap;
  }

  // Delete a prospect from a generated campaign (a test or sample contact): their row, link and thumbnail go.
  function removeProspect(l) {
    if (!window.confirm(`Delete ${l.name || 'this prospect'} from this campaign? Their row and link are removed here.`)) return;
    draft.contacts = draft.contacts.filter((c) => c.id !== l.contactId);
    draft.campaign = { ...draft.campaign, links: draft.campaign.links.filter((x) => x.contactId !== l.contactId) };
    persist();
    notice = `${l.name || 'Prospect'} deleted.`;
    render();
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

  // The landing page chooser (src/components/landing/TemplateChooser.js): your designs, or the plain video page.
  async function chooseLandingPage() {
    if (!designs.loaded) await loadDesigns();
    const page = draft.page;
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
    choose.addEventListener('click', chooseLandingPage);
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
    if (!(await gate('landing pages'))) return false;
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
      // The design straight from the templates: the Page step (which loads the list) may not have been opened.
      const design = tpl.TEMPLATES.find((t) => t.puck && t.id === draft.page.template);
      const data = draft.page.puck || design?.puckData || null;
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

  let prospectFilter = 'all';
  // "Sent" (prospect table): you sent this prospect their video (copied their email or link, opened Gmail…).
  function markSent(l) {
    const link = draft.campaign?.links?.find((x) => x.contactId === l.contactId);
    if (!link || link.sentAt) return;
    link.sentAt = new Date().toISOString();
    persist();
    setTimeout(() => { if (step === 5 && !busy) render(); }, 400);
  }

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

  // The prospect's own logo, found on their website (the thumbnail's logo setting decides whether it is used).
  const logoFor = (c) => draft.siteLogos?.[siteKey(c.website)] || '';

  async function makeThumbnails({ onProgress = () => {} } = {}) {
    const T = await import('../lib/outreach/thumbnail.js');
    const settings = T.thumbSettings(draft.email.thumb);
    abort = new AbortController();
    const signal = abort.signal;
    try {
      // Logos come from capturing each contact's website (the same capture as website backgrounds).
      if (settings.logoMode === 'prospect' && sitesToCapture(draft).some((site) => !draft.siteShots[site])) await captureSites({ requireFallback: false });
      setBusy('Reading your video…');
      onProgress(0.05);
      const duration = draft.video.duration || 0;
      const still = settings.type === 'static';
      const frames = await T.grabFrames(draft.video.url, T.frameTimes(settings, duration || Infinity), still ? { width: T.THUMB_W, height: T.THUMB_H, signal } : { signal });
      const made = new Map();
      const links = draft.campaign.links;
      for (let i = 0; i < links.length; i += 1) {
        if (signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
        onProgress(0.15 + (0.85 * i) / links.length);
        const c = contactOf(links[i]);
        const text = T.thumbnailText(draft.email.thumbText, c, draft.fallbacks);
        const site = T.thumbBackground(settings, siteShotFor(c));
        const logo = T.thumbLogo(settings, logoFor(c));
        const key = T.thumbnailKey(text, site, logo);
        if (!made.has(key)) {
          setBusy(`Making ${still ? 'thumbnails' : 'GIF thumbnails'} ${i + 1} of ${links.length}…`);
          // A GIF also gets its first frame as a still, for Outlook on Windows (which shows only that frame).
          const set = await T.renderThumbnailSet({ frames, siteUrl: site, logoUrl: logo, text, settings, seconds: duration });
          const stamp = `${Date.now()}-${made.size}`;
          const mainUrl = await uploadToStorage(new File([set.main], `thumb-${stamp}.${still ? 'jpg' : 'gif'}`, { type: set.main.type }));
          const stillUrl = set.still ? await uploadToStorage(new File([set.still], `thumb-${stamp}-still.jpg`, { type: 'image/jpeg' })) : mainUrl;
          made.set(key, { mainUrl, stillUrl });
        }
        links[i] = { ...links[i], thumbnailUrl: made.get(key).mainUrl, stillUrl: made.get(key).stillUrl };
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

  async function downloadThumbnail(l, btn, isGif, url = l.thumbnailUrl, suffix = 'thumbnail') {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Downloading\u2026';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const name = `${String(l.name || 'prospect').replace(/[^\w-]+/g, '_')}-${suffix}.${isGif ? 'gif' : 'jpg'}`;
      const { downloadBlob } = await import('../lib/editor/remotion/exportClient.js');
      downloadBlob(await res.blob(), name);
      btn.textContent = label;
    } catch { window.open(url, '_blank', 'noopener'); btn.textContent = label; }
    btn.disabled = false;
  }

  // Share one prospect's video: Link, GIF and Embed (src/components/outreach/ShareModal.js).
  async function openShare(l, tab = 'link') {
    const { openShareModal } = await import('./outreach/ShareModal.js');
    openShareModal({
      name: l.name || '', link: linkOf(l), thumbnailUrl: l.thumbnailUrl || '', stillUrl: l.stillUrl || '', tab,
      // The embed's muted preview: the campaign video (the GIF stays the poster and the fallback).
      videoUrl: draft.video?.url || '',
      actions: {
        sent: () => markSent(l),
        download: (kind, btn) => (kind === 'still'
          ? downloadThumbnail(l, btn, false, l.stillUrl, 'outlook-still')
          : downloadThumbnail(l, btn, /\.gif(\?|$)/i.test(l.thumbnailUrl))),
      },
    });
  }

  // The thumbnail designer (src/components/outreach/ThumbnailDesigner.js): from the editor toolbar and the Email card.
  async function openThumbnails() {
    const { openThumbnailDesigner } = await import('./outreach/ThumbnailDesigner.js');
    const links = draft.campaign?.links || [];
    openThumbnailDesigner({
      draft,
      save: persist,
      websiteFor: (c) => siteShotFor(c),
      logoFor: (c) => draft.siteLogos?.[siteKey(c.website)] || '',
      // One logo for everyone: the logo found on a website you name (the same capture as website backgrounds).
      findLogo: async (site) => {
        const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;
        const { installPersonalizationApiAuth } = await import('../features/personalization/lib/apiAuth.ts');
        installPersonalizationApiAuth();
        const res = await fetch('/api/outreach/site-shot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'That website could not be checked.');
        return body.logoUrl || '';
      },
      upload: uploadToStorage,
      onMake: links.length ? async () => { if (await gate('personalized thumbnails')) makeThumbnails(); } : null,
      makeLabel: links.some((l) => l.thumbnailUrl) ? 'Remake thumbnails' : `Make thumbnails for ${links.length} prospect${links.length === 1 ? '' : 's'}`,
      onClose: () => render(),
    });
  }

  async function saveProspects(videoId) {
    const db = await ownerClient();
    const rows = draft.contacts.map((c) => ({
      video_id: videoId, contact_id: String(c.id),
      name: [c.firstName, c.lastName].filter(Boolean).join(' ').slice(0, 120) || null,
      company: String(c.company || '').slice(0, 120) || null, email: String(c.email || '').slice(0, 200) || null,
    })).filter((r) => /^[A-Za-z0-9_-]{1,80}$/.test(r.contact_id));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from('outreach_prospects').upsert(rows.slice(i, i + 200), { onConflict: 'video_id,contact_id' });
      if (error) throw error;
    }
  }

  // Alerts when a prospect watches or clicks (supabase/functions/outreach-alerts): always in the notification bell,
  // and by email and Slack when set here.
  const alerts = { loaded: false, loading: false, row: null, error: '', saved: false, activity: [] };
  async function loadAlerts() {
    alerts.loading = true;
    try {
      const db = await ownerClient();
      // Recent activity on this campaign (the same alerts the bell counts).
      if (draft.campaign?.id) {
        const act = await db.from('owner_notifications').select('id, title, created_at, read_at').eq('video_id', draft.campaign.id)
          .in('type', ['prospect_watched', 'prospect_clicked']).order('created_at', { ascending: false }).limit(10);
        alerts.activity = act.error ? [] : act.data || [];
      }
      const { data, error } = await db.from('outreach_alert_settings').select('enabled, on_watch, on_click, email, slack_webhook').maybeSingle();
      if (error) throw error;
      alerts.row = data || null; alerts.error = '';
    } catch (err) { alerts.error = err?.message || 'Could not load your alert settings.'; }
    alerts.loaded = true; alerts.loading = false;
    if (step === 5 && !busy) render();
  }

  function renderAlertsCard() {
    const box = card('Alerts', 'Know the moment a prospect watches or clicks. Alerts always show in the bell at the top; add your email or a Slack channel to get them there too.');
    box.setAttribute('data-outreach-alerts', '');
    if (!alerts.loaded && !alerts.loading) setTimeout(loadAlerts, 0);
    if (!alerts.loaded) { box.appendChild(el('p', 'text-xs text-white/50', 'Loading…')); return box; }
    const r = alerts.row || { enabled: true, on_watch: true, on_click: true, email: '', slack_webhook: '' };
    const on = el('input'); on.type = 'checkbox'; on.checked = r.enabled !== false; on.setAttribute('data-alerts-enabled', '');
    const onRow = el('label', 'flex items-center gap-2 text-sm'); onRow.append(on, el('span', '', 'Send alerts by email or Slack'));
    const watch = el('input'); watch.type = 'checkbox'; watch.checked = r.on_watch !== false;
    const click = el('input'); click.type = 'checkbox'; click.checked = r.on_click !== false;
    const which = el('div', 'flex flex-wrap gap-4 text-xs text-white/75');
    const lab = (i, t) => { const l = el('label', 'flex items-center gap-2'); l.append(i, el('span', '', t)); return l; };
    which.append(lab(watch, 'When they watch (starts, and 75%)'), lab(click, 'When they click your button'));
    const email = textInput(r.email || '', 'you@company.com'); email.type = 'email'; email.setAttribute('data-alerts-email', '');
    const slack = textInput(r.slack_webhook || '', 'https://hooks.slack.com/services/…'); slack.setAttribute('data-alerts-slack', '');
    const save = button(alerts.saved ? 'Saved' : 'Save alerts', { primary: true, small: true });
    save.setAttribute('data-alerts-save', '');
    const msg = el('p', 'text-xs text-amber-300');
    if (alerts.error) msg.textContent = /outreach_alert_settings|relation|schema cache/i.test(alerts.error) ? 'Email and Slack alerts aren\u2019t switched on for this account yet. The bell still shows who watched.' : alerts.error;
    save.addEventListener('click', async () => {
      const e = email.value.trim(); const sl = slack.value.trim();
      if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { msg.textContent = 'That email address doesn\u2019t look right.'; return; }
      if (sl && !/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{10,200}$/.test(sl)) { msg.textContent = 'Paste a Slack incoming-webhook link (https://hooks.slack.com/services/…).'; return; }
      save.disabled = true; msg.textContent = '';
      try {
        const db = await ownerClient();
        const row = { clerk_user_id: globalThis.window?.Clerk?.user?.id, enabled: on.checked, on_watch: watch.checked, on_click: click.checked, email: e || null, slack_webhook: sl || null, updated_at: new Date().toISOString() };
        const { error } = await db.from('outreach_alert_settings').upsert(row, { onConflict: 'clerk_user_id' });
        if (error) throw error;
        alerts.row = row; alerts.saved = true; alerts.error = '';
        render();
        setTimeout(() => { alerts.saved = false; }, 2000);
      } catch (err) { save.disabled = false; msg.textContent = /outreach_alert_settings|relation|schema cache/i.test(err?.message || '') ? 'Email and Slack alerts aren\u2019t switched on for this account yet.' : (err?.message || 'Could not save.'); }
    });
    box.append(onRow, which, field('Email me at', email), field('Slack', slack, 'In Slack: Apps → Incoming Webhooks → add to a channel, then paste the link here.'), save, msg);
    if (alerts.activity?.length) {
      const list = el('div', 'flex flex-col gap-1 border-t border-white/10 pt-3');
      list.setAttribute('data-alerts-activity', '');
      list.appendChild(el('div', 'text-xs font-bold text-white/70', 'Recent activity'));
      alerts.activity.forEach((a) => {
        const when = new Date(a.created_at);
        list.appendChild(el('div', `text-xs ${a.read_at ? 'text-white/50' : 'text-white/85'}`, `${a.title} · ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`));
      });
      box.appendChild(list);
    }
    return box;
  }

  function renderEmailCard() {
    const box = card('Email', 'Write the email once. Each contact gets their name, company and personal link, with a personalized thumbnail that opens their page.');
    box.setAttribute('data-outreach-email', '');
    const subject = textInput(draft.email.subject, 'A quick video for {{firstname}}');
    const body = el('textarea', 'w-full min-h-[150px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60');
    body.value = draft.email.body;
    const canvas = el('canvas', 'w-full rounded-xl border border-white/10 bg-black');
    canvas.width = 960; canvas.height = 540;
    canvas.setAttribute('data-outreach-thumb-preview', '');
    let sample = draft.contacts[0] || {};
    const sampleOut = el('pre', 'whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/80 font-sans');
    const t = () => draft.email.thumb || {};
    let video = null; let siteImg = null; let logoImg = null; let T = null;
    let loopStart = 0;
    const draw = () => {
      if (!T) return;
      const settings = T.thumbSettings(t());
      // A GIF previews its 3 seconds as they'll loop.
      const progress = settings.type === 'gif' && video ? Math.max(0, Math.min(1, (video.currentTime - loopStart) / T.GIF_SECONDS)) : 0;
      T.drawThumbnail(canvas.getContext('2d'), { frame: video, site: siteImg, logo: settings.logo ? logoImg : null, text: T.thumbnailText(draft.email.thumbText, sample, draft.fallbacks), play: settings.play, progress, textColor: settings.textColor, bannerColor: settings.bannerColor, duration: settings.duration, seconds: draft.video?.duration || 0 });
    };
    const updateEmail = () => {
      const l = draft.campaign.links.find((x) => x.contactId === sample.id) || draft.campaign.links[0];
      const e = l ? emailOf(l) : null;
      sampleOut.textContent = e ? `To: ${e.to}\nSubject: ${e.subject}\n\n${e.text}` : '';
    };
    const loadSampleImages = () => {
      siteImg = null; logoImg = null;
      const shot = T ? T.thumbBackground(T.thumbSettings(t()), siteShotFor(sample)) : siteShotFor(sample);
      if (shot) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { siteImg = img; draw(); }; img.src = shot; }
      const logo = T ? T.thumbLogo(T.thumbSettings(t()), logoFor(sample)) : logoFor(sample);
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
      draft.email = { ...draft.email, subject: subject.value, body: body.value };
      persist(); draw(); updateEmail();
    };
    [subject, body].forEach((i) => i.addEventListener('input', syncText));
    updateEmail();

    // Which contact the preview shows.
    const who = el('select', 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white');
    who.setAttribute('aria-label', 'Preview for');
    draft.contacts.slice(0, 200).forEach((c) => { const o = el('option', 'bg-neutral-900', [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email); o.value = c.id; o.selected = c.id === sample.id; who.appendChild(o); });
    who.addEventListener('change', () => { sample = draft.contacts.find((c) => c.id === who.value) || sample; loadSampleImages(); draw(); updateEmail(); });
    const whoRow = el('div', 'flex items-center gap-2 text-xs text-secondary'); whoRow.append(el('span', '', 'Preview for'), who);

    const grid = el('div', 'grid gap-4 lg:grid-cols-2');
    const left = el('div', 'flex flex-col gap-3');
    // The thumbnail is designed in the thumbnail designer; here a summary and the button to open it.
    const thumbRow = el('div', 'flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-3');
    thumbRow.setAttribute('data-outreach-thumb-summary', '');
    const ts = t();
    thumbRow.append(
      el('div', 'min-w-0 flex-1 text-xs text-white/70', `${(ts.type || 'gif') === 'static' ? 'Still image' : 'Animated GIF'} \u00b7 \u201c${draft.email.thumbText || ''}\u201d${ts.logo === false ? '' : ' \u00b7 their logo'}`),
    );
    const editThumb = button('Design thumbnail', { small: true, primary: true });
    editThumb.setAttribute('data-outreach-design-thumb', '');
    editThumb.addEventListener('click', openThumbnails);
    thumbRow.appendChild(editThumb);
    left.append(field('Thumbnail', thumbRow, 'The picture each prospect sees in your email: their name, their website and their logo.'),
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
      const rows = draft.campaign.links.map((l) => ({ ...emailOf(l), contact: contactOf(l), link: linkOf(l), thumbnailUrl: l.thumbnailUrl || '', stillUrl: l.stillUrl || l.thumbnailUrl || '' }));
      downloadText(`${(draft.name || 'campaign').replace(/[^\w-]+/g, '_')}-emails.csv`, mailMergeCsv(rows));
    });
    actions.appendChild(merge);
    box.append(actions, el('p', 'text-[11px] text-white/45', 'Copy email puts the finished email (with the thumbnail) on your clipboard to paste into Gmail or Outlook. Share opens each prospect\u2019s Link, GIF (Copy GIF, Download GIF, Outlook still) and Embed code for email tools. GIFs play in Gmail, Apple Mail and Outlook on the web and Mac; Outlook on Windows shows the first frame, so for Outlook-heavy lists use Still image or the .csv\u2019s Outlook still URL. The .csv works with mail-merge tools.'));
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
    // Like Sendspark's Dynamic Videos page: who you are, what it does, and Create Dynamic Video.
    const head = el('div', 'flex flex-wrap items-center gap-4 border-b border-white/10 pb-5');
    const me = globalThis.window?.Clerk?.user || null;
    const face = el('div', 'grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-lg font-black text-primary');
    if (me?.imageUrl && /^https:\/\//.test(me.imageUrl)) { const im = el('img', 'h-full w-full object-cover'); im.src = me.imageUrl; im.alt = ''; face.appendChild(im); }
    else face.textContent = (me?.firstName || 'S').slice(0, 1).toUpperCase();
    const title = el('div', 'min-w-0 flex-1');
    title.append(el('h2', 'text-2xl font-black', 'Dynamic Videos'), el('p', 'text-sm text-secondary', 'Scale yourself: record once, and each prospect gets their own intro, page, thumbnail and link.'));
    const fresh = button('Create Dynamic Video', { primary: true });
    fresh.setAttribute('data-outreach-new', '');
    fresh.disabled = !!busy;
    fresh.addEventListener('click', () => openCreateDynamic());
    head.append(face, title, fresh);
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
      if (draft.campaign?.id === e.id) media.appendChild(el('span', 'absolute bottom-2 right-2 rounded-full border border-primary/40 bg-black/70 px-2 py-0.5 text-[10px] font-bold text-primary', 'Open now'));
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
      // Nothing yet: the sample presenter explains it, like Sendspark's "Turn one video into thousands".
      const empty = el('div', 'flex flex-col items-center gap-5 py-6 text-center sm:col-span-2 lg:col-span-3');
      empty.setAttribute('data-outreach-empty', '');
      const wrap = el('div', 'relative w-full max-w-2xl');
      const v = el('video', 'aspect-video w-full rounded-2xl border border-white/10 bg-black object-cover');
      v.src = '/media/outreach-sample/presenter.mp4'; v.poster = '/media/outreach-sample/presenter.jpg'; v.controls = true; v.preload = 'metadata'; v.playsInline = true;
      wrap.append(v, el('span', 'pointer-events-none absolute -right-2 -top-6 rotate-[-4deg] text-lg font-bold italic text-primary md:-right-28 md:top-6', 'Turn one video into thousands'));
      empty.append(wrap, el('p', 'max-w-2xl text-sm leading-relaxed text-white/60', 'Imagine if you could turn one video into thousands. With SmartVideo\u2019s dynamic videos you record one video, and SmartVideo puts each prospect\u2019s website behind you, says their name and builds their own landing page.'));
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
        n === step ? 'border-primary/45 bg-primary/[0.08] text-white' : 'border-white/10 text-white/60',
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
    if (!paid()) {
      // Preview: everything can be seen; recording, generating and sharing ask for the upgrade.
      const bar = el('div', 'flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm');
      bar.setAttribute('data-outreach-preview', '');
      const up = button('Upgrade', { primary: true, small: true });
      up.setAttribute('data-outreach-upgrade', '');
      up.addEventListener('click', () => gate('Video Outreach'));
      bar.append(el('span', 'flex-1 text-white/85', 'You\u2019re previewing Video Outreach. Upgrade to SmartVideo full access to record, generate and share.'), up);
      inner.appendChild(bar);
    }
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
      const next = button(step === SETUP_STEPS + 1 ? 'Back to my videos' : 'Continue', { primary: true });
      next.setAttribute('data-outreach-continue-step', '');
      next.disabled = !!busy || errors.length > 0;
      next.addEventListener('click', () => { step += 1; notice = ''; render(); });
      footer.appendChild(next);
    }
    if (step <= SETUP_STEPS) {
      // Everything is already saved as you go; this just takes you back to your videos.
      const close = button('Save & Close');
      close.setAttribute('data-outreach-save-close', '');
      close.disabled = !!busy;
      close.addEventListener('click', () => { persist(); step = STEPS.length; notice = 'Saved. Pick it up any time from your videos.'; render(); });
      footer.appendChild(close);
    }
    footer.appendChild(status);
    inner.appendChild(footer);
  }

  // ---- SmartVideo welcome (the first time Video Outreach opens) ---------------------------
  // Five questions (src/components/outreach/OutreachWelcome.js). Each answer is kept in this browser at once and
  // saved to Supabase (public.user_onboarding) for the signed-in user; a finished welcome never shows again, on any
  // device. The answers fill your company, title and website here and open what you chose first.
  let ob = null; // src/lib/outreach/onboarding.js, loaded with the welcome
  const welcomeUser = () => globalThis.window?.Clerk?.user || null;
  async function saveWelcome(a) {
    const uid = welcomeUser()?.id || '';
    ob.saveLocalOnboarding(uid, a);
    if (!uid) return;
    try { await ob.saveOnboarding(await ownerClient(), a, uid); } catch { /* kept in this browser; saved next time */ }
  }
  async function startWelcome() {
    ob = await import('../lib/outreach/onboarding.js');
    const user = welcomeUser();
    const uid = user?.id || '';
    let remote = null;
    if (uid) { try { remote = await ob.fetchOnboarding(await ownerClient()); } catch { /* offline or signed out */ } }
    const best = ob.newerOnboarding(ob.loadLocalOnboarding(uid), remote);
    if (best) ob.saveLocalOnboarding(uid, best);
    if (ob.isDone(best)) {
      if (!ob.isDone(remote) || remote.firstVideo !== best.firstVideo) saveWelcome(best);
      if (!best.firstVideo) showFirstVideo(best); // finished the questions, not the first video yet
      return;
    }
    const { mountOutreachWelcome } = await import('./outreach/OutreachWelcome.js');
    let timer = null;
    mountOutreachWelcome(container, {
      name: String(user?.firstName || '').trim().slice(0, 40),
      initial: best,
      onChange: (a) => { ob.saveLocalOnboarding(uid, a); clearTimeout(timer); timer = setTimeout(() => saveWelcome(a), 500); },
      onAcademy: () => { globalThis.location.hash = '#/academy'; },
      onFinish: (a) => {
        clearTimeout(timer);
        saveWelcome(a);
        ob.applyToDraft(draft, a);
        persist();
        showFirstVideo(a);
      },
    });
  }

  // ---- Your first video (src/components/outreach/OutreachFirstVideo.js) ------------------
  // Like Sendspark, the person is the first prospect: Video Outreach's own Generate makes their personal video
  // from the SmartVideo sample presenter, with their website behind it and a landing page, on their MuAPI key.
  const SAMPLE_PAGE = 'puck-enterprise';
  const SAMPLE_SECONDS = 26.5;
  async function showFirstVideo(a) {
    const [{ mountFirstVideo, SAMPLE_PRESENTER }] = await Promise.all([import('./outreach/OutreachFirstVideo.js')]);
    const mark = (firstVideo) => { a = { ...a, firstVideo }; saveWelcome(a); };
    mountFirstVideo(container, {
      name: String(welcomeUser()?.firstName || '').trim().slice(0, 40),
      company: a.company,
      website: a.website,
      make: async (d, onStage) => {
        if (!(await gate('your personalized video'))) return { ok: false, error: 'Making your video needs SmartVideo full access. Upgrade, then click Make my video again.' };
        const res = await makeSample(d, SAMPLE_PRESENTER, onStage);
        if (res.ok) mark('made');
        return res;
      },
      onLater: () => { mark('later'); openChoice(a.goal); },
      onProspects: () => { if (!a.firstVideo) mark('made'); openCreateDynamic(); },
    });
  }
  // What the person picked first: personal videos open the recorder; dynamic videos the library.
  function openChoice(goal) {
    if (goal === 'personal') { startNew(); if (step === 1) openRecorder('both'); return; }
    step = STEPS.length; notice = ''; render();
  }
  async function makeSample(d, presenter, onStage) {
    const keep = !draft.campaign && (draft.video || draft.contacts.length) ? JSON.parse(JSON.stringify(draft)) : null;
    const origin = globalThis.location.origin;
    const me = makeContact({ firstName: d.firstName, company: d.company, website: d.website });
    if (!me) return { ok: false, error: 'Add your first name.' };
    const next = newDynamicVideo(draft);
    Object.assign(next, {
      name: 'Your sample video',
      video: { url: `${origin}${presenter.video}`, duration: SAMPLE_SECONDS, hasAudio: true, type: 'camera' },
      // The presenter's own voice; the "Hi there!" fallback ships with the sample, so only your name is voiced.
      voice: { ...next.voice, mode: 'stock', stockVoice: 'Wise_Woman', cloneVoiceId: '', fallbackUrl: `${origin}${presenter.hiThere}`, fallbackDuration: 1.58, lipsync: false },
      kind: 'greeting',
      greeting: 'Hi {{firstname}}!',
      fallbacks: { ...next.fallbacks, firstname: 'there' },
      header: 'Hi {{firstname}}, I made this for you',
      message: 'A personal video for {{company}}, made with SmartVideo.',
      cta: { enabled: true, label: 'Make my first campaign', url: `${origin}/#/outreach`, embed: false },
      contacts: [me],
      background: { ...next.background, mode: 'website', fallbackSite: d.website, cursor: true },
      page: { template: SAMPLE_PAGE, puck: null },
    });
    replaceDraft(next);
    const ok = await generateCampaign({ confirmed: true, onStage });
    if (!ok || !draft.campaign?.links?.length) {
      const error = notice || 'The video could not be made.';
      if (keep) replaceDraft(keep);
      notice = ''; render();
      return { ok: false, error };
    }
    const l = draft.campaign.links[0];
    return { ok: true, link: l.link, pageLink: l.pageLink || '', embed: `${l.link}${l.link.includes('?') ? '&' : '?'}embed=1` };
  }
  // How to record for the kind picked (src/components/outreach/DynamicGuidelines.js); the new dynamic video is
  // made when you choose how to add the video: record (camera, screen, both), upload, or the sample presenter.
  async function openRecordingGuidelines({ name, kind, language }) {
    const [{ openGuidelines }, { WRITER_LANGUAGES: langs }, { SAMPLE_PRESENTER }] = await Promise.all([
      import('./outreach/DynamicGuidelines.js'), import('../lib/outreach/aiWriter.js'), import('./outreach/OutreachFirstVideo.js'),
    ]);
    let lang = language || draft.language || 'English';
    const begin = () => {
      const k = DYNAMIC_KINDS.find((d) => d.id === kind);
      const next = newDynamicVideo(draft);
      // Same audio has no greeting at all.
      Object.assign(next, { name, kind, language: lang, greeting: k ? k.greeting : next.greeting });
      replaceDraft(next);
      step = 1; notice = ''; render();
    };
    openGuidelines({
      kind,
      language: lang,
      languages: langs,
      onLanguage: (v) => { lang = v; },
      onRecord: (mode) => { begin(); openRecorder(mode); },
      onUpload: (f) => { begin(); addVideo(f, { type: 'upload', name: f.name }); },
      onSample: async () => {
        if (!(await gate('the sample video'))) return;
        begin();
        // The SmartVideo sample presenter, with her own voice and "Hi there!" so it can be tried end to end.
        const origin = globalThis.location.origin;
        draft.video = { url: `${origin}${SAMPLE_PRESENTER.video}`, duration: SAMPLE_SECONDS, hasAudio: true, type: 'camera' };
        draft.voice = { ...draft.voice, mode: 'stock', stockVoice: 'Wise_Woman', cloneVoiceId: '', fallbackUrl: kind === 'same' ? '' : `${origin}${SAMPLE_PRESENTER.hiThere}`, fallbackDuration: kind === 'same' ? 0 : 1.58 };
        persist(); render();
      },
      onBack: () => openCreateDynamic({ name, kind, language: lang }),
    });
  }

  // Create Dynamic Videos: name the campaign and pick its kind (Multiple variables, AI greeting, Same audio),
  // then a new dynamic video starts on the Record step.
  function openCreateDynamic(prefill = {}) {
    const inProgress = !draft.campaign && (draft.video || draft.contacts.length);
    const overlay = el('div', 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4');
    overlay.setAttribute('data-outreach-create', '');
    const box = el('div', 'flex w-full max-w-3xl flex-col gap-5 rounded-2xl border border-white/10 bg-[#0b0c10] p-6 text-white shadow-2xl');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Create Dynamic Videos');
    const head = el('div', 'flex items-center justify-between');
    const x = el('button', 'rounded-lg px-2 py-1 text-xl leading-none text-white/60 hover:text-white', '\u00d7');
    x.type = 'button'; x.setAttribute('aria-label', 'Close');
    head.append(el('h2', 'text-lg font-extrabold', 'Create Dynamic Videos'), x);
    const name = el('input', 'w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-primary/50');
    name.placeholder = 'Name your campaign'; name.setAttribute('aria-label', 'Campaign name'); name.maxLength = 120;
    name.value = prefill.name || '';
    let kind = prefill.kind || '';
    const kinds = el('div', 'grid gap-3 sm:grid-cols-3');
    const cards = DYNAMIC_KINDS.map((k) => {
      const b = el('button', 'flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center transition-colors');
      b.type = 'button';
      b.setAttribute('data-create-kind', k.id);
      const dot = el('span', 'mt-2 grid h-4 w-4 place-items-center rounded-full border border-white/30');
      b.append(el('span', 'text-[17px] font-bold', k.title), el('span', 'text-[13px] leading-snug text-white/55', k.text), dot);
      b.addEventListener('click', () => { kind = k.id; paint(); });
      kinds.appendChild(b);
      return { k, b, dot };
    });
    const go = el('button', 'inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.14] border-l-2 border-l-primary bg-transparent py-3.5 text-[15px] font-bold text-white hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35', 'Get started \u2192');
    go.type = 'button'; go.setAttribute('data-create-start', '');
    const paint = () => {
      cards.forEach(({ k, b, dot }) => {
        const on = k.id === kind;
        b.className = `flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center transition-colors ${on ? 'border-primary/45 bg-primary/[0.07]' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'}`;
        b.setAttribute('aria-pressed', String(on));
        dot.innerHTML = on ? '<span class="h-2 w-2 rounded-full bg-primary"></span>' : '';
        dot.className = `mt-2 grid h-4 w-4 place-items-center rounded-full border ${on ? 'border-primary' : 'border-white/30'}`;
      });
      go.disabled = !kind || !name.value.trim();
    };
    name.addEventListener('input', paint);
    box.append(head, name, kinds);
    if (inProgress) box.appendChild(el('p', 'text-xs text-amber-300', 'The dynamic video you are setting up (not generated yet) will be replaced.'));
    box.appendChild(go);
    overlay.appendChild(box);
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    x.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    go.addEventListener('click', () => {
      const k = DYNAMIC_KINDS.find((d) => d.id === kind);
      if (!k || !name.value.trim()) return;
      close();
      if (!paid()) { gate('dynamic videos').then((ok) => { if (ok) openRecordingGuidelines({ name: name.value.trim().slice(0, 120), kind: k.id, language: prefill.language }); }); return; }
      openRecordingGuidelines({ name: name.value.trim().slice(0, 120), kind: k.id, language: prefill.language });
    });
    document.body.appendChild(overlay);
    paint();
    name.focus();
  }

  render();
  // Draw again when sign-in or the plan changes (the preview banner and locks follow it).
  let wasPaid = paid();
  try { globalThis.window?.Clerk?.addListener?.(() => { if (paid() !== wasPaid && container.isConnected) { wasPaid = paid(); render(); } }); } catch { /* Clerk not ready */ }
  startWelcome().catch(() => { /* the studio works without the welcome */ });
  return container;
}
