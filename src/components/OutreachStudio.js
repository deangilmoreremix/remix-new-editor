// src/components/OutreachStudio.js
//
// Video Outreach studio (route: #/outreach): record one video, give it a
// greeting spoken in your own (cloned) voice for each contact, set up the
// landing page, then hand it to the timeline editor, which already does the
// per-contact links, sharing and analytics.
//
// Steps 1-3 (Record, Voice, Customize) live here. Contacts, Generate and
// Campaigns show in the stepper and come next; until then the editor's
// Personalization and Share panels cover them.
//
// The logic (draft, validation, the editor project) is in
// src/lib/outreach/draft.js; this file is the page.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { navigate } from '../lib/router.js';
import {
  STEPS, READY_STEPS, STOCK_VOICES, FIRST_NAME_FALLBACKS, EDITOR_PROJECT_KEY, EDITOR_ROUTE,
  loadDraft, saveDraft, stepErrors, fillTemplate, speakRequest, buildEditorProject,
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
  let step = 1;
  for (let s = 1; s <= READY_STEPS; s++) { step = s; if (stepErrors(draft, s).length) break; }

  const stepper = el('div', 'flex flex-wrap gap-2 px-4 md:px-8 pt-5');
  const scroll = el('div', 'flex-1 overflow-y-auto');
  // Bottom padding keeps the footer buttons clear of the floating Ask SmartVideo button.
  const inner = el('div', 'max-w-6xl mx-auto w-full px-4 md:px-8 pt-6 pb-28 flex flex-col gap-5');
  scroll.appendChild(inner);
  container.append(stepper, scroll);

  const persist = () => saveDraft(draft);
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
      // A new recording means a new voice sample and greeting.
      draft.voice = { ...draft.voice, fallbackUrl: '', fallbackDuration: 0 };
      persist();
      busy = '';
      render();
    } catch (err) { fail(err); }
  }

  async function openRecorder(type = 'both') {
    const { RecorderModal } = await import('./modals/RecorderModal.jsx');
    const modal = new RecorderModal({
      onComplete: (result) => {
        if (result?.type === 'audio') return voiceSampleFrom(result.blob);
        addVideo(result.blob, { duration: result.duration, hasAudio: result.hasAudio, type: result.type });
      },
    });
    modal.recordingType = type;
    modal.open();
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
    actions.append(rec, upload, file);
    main.append(preview, actions);

    const side = el('div', 'flex flex-col gap-5');
    const info = card('Your recording');
    info.appendChild(el('p', 'text-sm text-secondary', draft.video
      ? `${fmtTime(draft.video.duration)} · ${draft.video.hasAudio ? 'with sound' : 'no sound'} · ${draft.video.type === 'both' ? 'screen + camera' : draft.video.type}`
      : 'Nothing recorded yet.'));
    if (draft.video && !draft.video.hasAudio) info.appendChild(el('p', 'text-xs text-amber-300', 'This video has no sound, so it cannot be used as your voice sample. You can still record a separate sample in the next step.'));
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

    const greet = card('The greeting', 'Spoken at the start of the video. Use {{firstname}} or {{company}}.');
    const g = textInput(draft.greeting, 'Hi {{firstname}}!');
    g.addEventListener('change', () => { draft.greeting = g.value; draft.voice.fallbackUrl = ''; persist(); render(); });
    greet.appendChild(field('Greeting', g, 'Up to 70 characters.'));
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
    const main = card('Customize the landing page', 'Use {{firstname}} and {{company}}. Fallbacks fill in when a value is missing.');
    const header = textInput(draft.header);
    const message = el('textarea', 'w-full min-h-[90px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60');
    message.value = draft.message;
    const company = textInput(draft.fallbacks.company, 'your company');
    const ctaOn = el('input'); ctaOn.type = 'checkbox'; ctaOn.checked = !!draft.cta.enabled;
    const ctaLabel = textInput(draft.cta.label, 'Schedule a demo');
    const ctaUrl = textInput(draft.cta.url, 'https://cal.com/you/intro');
    const sync = () => {
      draft.header = header.value; draft.message = message.value; draft.fallbacks.company = company.value;
      draft.cta = { enabled: ctaOn.checked, label: ctaLabel.value, url: ctaUrl.value.trim() };
      persist(); updatePreview();
    };
    [header, message, company, ctaLabel, ctaUrl].forEach((i) => i.addEventListener('input', sync));
    ctaOn.addEventListener('change', sync);
    const ctaRow = el('label', 'flex items-center gap-3 text-sm font-bold'); ctaRow.append(ctaOn, el('span', '', 'Call-to-action button'));
    main.append(field('Header', header), field('Message', message), field('If the company is missing, say', company), ctaRow,
      field('Button label', ctaLabel), field('Booking link', ctaUrl, 'Your Cal.com, Calendly or other booking page (https).'));

    const preview = el('div', 'rounded-2xl bg-[#f7f4ee] p-6 text-center text-[#1a1a1a] flex flex-col gap-3 self-start');
    const sample = { firstname: 'Mike', company: 'Acme' };
    const updatePreview = () => {
      preview.replaceChildren();
      preview.appendChild(el('div', 'text-[11px] uppercase tracking-wider text-black/50', 'Preview · Mike at Acme'));
      preview.appendChild(el('h3', 'text-xl font-extrabold', fillTemplate(draft.header, sample, draft.fallbacks)));
      const media = el('div', 'aspect-video w-full overflow-hidden rounded-xl bg-black');
      if (draft.video?.url) { const v = el('video', 'h-full w-full object-cover'); v.src = draft.video.url; v.muted = true; v.playsInline = true; media.appendChild(v); }
      preview.appendChild(media);
      if (draft.message.trim()) preview.appendChild(el('p', 'text-sm text-black/70', fillTemplate(draft.message, sample, draft.fallbacks)));
      if (draft.cta.enabled && draft.cta.label.trim()) preview.appendChild(el('span', 'mx-auto rounded-full bg-[#4f46e5] px-6 py-2.5 text-sm font-bold text-white', draft.cta.label));
      if (draft.voice.mode === 'clone') preview.appendChild(el('p', 'text-[11px] text-black/45', 'AI-personalized voice'));
    };
    updatePreview();
    grid.append(main, preview);
    return grid;
  }

  function openInEditor() {
    let project;
    try { project = buildEditorProject(draft); } catch (err) { notice = err.message; render(); return; }
    // The editor restores whatever is under this key, so don't silently replace someone's open timeline.
    if (localStorage.getItem(EDITOR_PROJECT_KEY) && !window.confirm('This opens your outreach video in the Timeline Editor and replaces the timeline that is open there now (saved projects are kept). Continue?')) return;
    localStorage.setItem(EDITOR_PROJECT_KEY, JSON.stringify(project));
    navigate(EDITOR_ROUTE);
  }

  // ---- Shell -------------------------------------------------------------
  function renderStepper() {
    stepper.replaceChildren();
    STEPS.forEach((name, i) => {
      const n = i + 1;
      const ready = n <= READY_STEPS;
      const done = ready && n < step && !stepErrors(draft, n).length;
      const pill = el('button', [
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold',
        n === step ? 'border-primary bg-primary text-black' : 'border-white/10 text-white/60',
        ready ? '' : 'opacity-40 cursor-not-allowed',
      ].join(' '));
      pill.type = 'button';
      pill.disabled = !ready || busy;
      pill.title = ready ? name : `${name}: coming next. Use the Timeline Editor’s Personalization and Share panels for now.`;
      pill.append(el('span', 'grid h-5 w-5 place-items-center rounded-full bg-black/20 text-[10px]', done ? '✓' : String(n)), el('span', '', name));
      pill.addEventListener('click', () => { step = n; notice = ''; render(); });
      stepper.appendChild(pill);
    });
  }

  function render() {
    renderStepper();
    inner.replaceChildren();
    inner.appendChild(step === 1 ? renderRecord() : step === 2 ? renderVoice() : renderCustomize());

    const footer = el('div', 'flex flex-wrap items-center gap-3');
    const errors = stepErrors(draft, step);
    const msg = busy || notice || errors[0] || '';
    const status = el('p', `flex-1 text-sm ${busy ? 'text-primary' : notice && !errors.length ? 'text-emerald-300' : 'text-amber-300'}`, msg);
    footer.appendChild(status);
    if (step > 1) {
      const back = button('Back'); back.disabled = !!busy;
      back.addEventListener('click', () => { step -= 1; notice = ''; render(); });
      footer.appendChild(back);
    }
    const next = button(step < READY_STEPS ? 'Next' : 'Open in Timeline Editor', { primary: true });
    next.disabled = !!busy || errors.length > 0;
    next.addEventListener('click', () => {
      if (step < READY_STEPS) { step += 1; notice = ''; render(); } else openInEditor();
    });
    footer.appendChild(next);
    inner.appendChild(footer);
  }

  render();
  return container;
}
