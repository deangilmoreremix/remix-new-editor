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
import {
  STEPS, SETUP_STEPS, STOCK_VOICES, FIRST_NAME_FALLBACKS, CONTACT_FIELDS, CSV_TEMPLATE, MAX_CONTACTS,
  loadDraft, saveDraft, stepErrors, fillTemplate, speakRequest, tokensIn,
  parseCsv, guessMapping, contactsFromRows, makeContact, mergeContacts, contactProfile, contactValues,
  buildCampaignProject, campaignLinks,
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
  for (let s = 1; s <= SETUP_STEPS + 1; s++) { step = s; if (stepErrors(draft, s).length) break; }
  // CSV waiting for its columns to be matched, the running generation, and the campaigns list.
  let pendingCsv = null;
  let abort = null;
  const campaigns = { loaded: false, loading: false, rows: [], error: '', openId: null, stats: {} };

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
    csvRow.append(upload, template, file);
    main.appendChild(csvRow);

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

  async function generateCampaign() {
    const personal = tokensIn(draft.greeting).length > 0;
    const n = draft.contacts.length;
    if (personal && !window.confirm(`This voices the greeting for up to ${n} contact${n === 1 ? '' : 's'} (repeated names are voiced once). Each one is a paid speech request on your MuAPI key. Continue?`)) return;
    notice = '';
    abort = new AbortController();
    try {
      let variants = {};
      if (personal) {
        const [{ voiceForContacts }, audio] = await Promise.all([
          import('../lib/editor/personalize/perContact.js'),
          import('../lib/editor/agent/audioGen.js'),
        ]);
        setBusy(`Voicing greetings: 0 of ${n}…`);
        ({ variants } = await voiceForContacts({
          text: draft.greeting,
          contacts: draft.contacts.map(contactProfile),
          signal: abort.signal,
          onProgress: ({ done, total, name }) => setBusy(`Voicing greetings: ${done} of ${total} (${name})…`),
          generate: async (line) => {
            const remote = await audio.generateAudio('tts', speakRequest(draft, line), { signal: abort.signal });
            const url = await audio.persistAudio(remote, { upload: uploadToStorage, name: 'greeting' });
            return { url, duration: (await audio.probeDuration(url)) || 2 };
          },
        }));
      }
      setBusy('Publishing the campaign…');
      const [{ preparePublishProject, publishVideo, makeSlug, watchUrl }, { personalLink }] = await Promise.all([
        import('../lib/editor/publish/publishClient.js'),
        import('../lib/editor/personalize/perContact.js'),
      ]);
      const built = buildCampaignProject(draft, { variants });
      const project = preparePublishProject(built, { title: built.title });
      const id = draft.campaign?.id || makeSlug();
      await publishVideo(await ownerClient(), { id, project });
      const url = watchUrl(id);
      draft.campaign = { id, url, publishedAt: new Date().toISOString(), links: campaignLinks(draft, url, personalLink, variants) };
      persist();
      campaigns.loaded = false; // refresh the Campaigns list next time it opens
      busy = '';
      notice = `Campaign published: ${draft.campaign.links.length} personal link${draft.campaign.links.length === 1 ? '' : 's'} ready.`;
      render();
    } catch (err) {
      if (err?.name === 'AbortError') { busy = ''; notice = 'Stopped. Nothing was published.'; render(); return; }
      fail(err);
    } finally {
      abort = null;
    }
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
        downloadText(`${(draft.name || 'campaign').replace(/[^\w-]+/g, '_')}-links.csv`, linksCsv(draft.campaign.links));
      });
      const open = button('Open landing page');
      open.addEventListener('click', () => window.open(draft.campaign.links[0]?.link || draft.campaign.url, '_blank', 'noopener'));
      actions.append(csv, open);
    }
    top.appendChild(actions);
    wrap.appendChild(top);

    if (draft.campaign) {
      const list = card('Personal links');
      const rows = el('div', 'flex flex-col divide-y divide-white/5');
      draft.campaign.links.forEach((l, i) => {
        const row = el('div', 'flex flex-wrap items-center gap-3 py-2.5 text-sm');
        row.append(el('span', 'w-8 text-white/40 tabular-nums', String(i + 1).padStart(2, '0')));
        const who = el('div', 'min-w-0 flex-1');
        who.append(el('div', 'truncate font-semibold', l.name || '(no name)'), el('div', 'truncate text-xs text-white/50', l.email || ''));
        const state = el('span', `text-xs ${l.voiced ? 'text-emerald-300' : 'text-white/50'}`, l.voiced ? '● Greeted by name' : '● Fallback greeting');
        const copy = button('Copy link', { small: true });
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(l.link); copy.textContent = 'Copied'; } catch { window.prompt('Copy this link:', l.link); }
        });
        row.append(who, state, copy);
        rows.appendChild(row);
      });
      list.appendChild(rows);
      wrap.appendChild(list);
    }
    return wrap;
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

  function renderCampaigns() {
    if (!campaigns.loaded && !campaigns.loading && !campaigns.error) setTimeout(loadCampaigns, 0);
    const wrap = el('div', 'flex flex-col gap-5');
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

    const table = card('Campaigns');
    const head = el('div', 'flex flex-wrap gap-2 -mt-2');
    const refresh = button(campaigns.loading ? 'Loading…' : 'Refresh', { small: true });
    refresh.disabled = campaigns.loading;
    refresh.addEventListener('click', loadCampaigns);
    const fresh = button('+ New campaign', { small: true, primary: true });
    fresh.addEventListener('click', () => {
      if (!window.confirm('Start a new campaign? Your recording, voice and page text stay; the contact list and links are cleared.')) return;
      draft.contacts = []; draft.campaign = null; draft.name = ''; persist(); step = 4; notice = ''; render();
    });
    head.append(refresh, fresh);
    table.appendChild(head);
    if (campaigns.error) table.appendChild(el('p', 'text-sm text-amber-300', campaigns.error));
    else if (campaigns.loaded && !all.length) table.appendChild(el('p', 'text-sm text-secondary', 'No campaigns yet. Generate one in step 5.'));
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
    STEPS.forEach((name, i) => {
      const n = i + 1;
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
      pill.append(el('span', 'grid h-5 w-5 place-items-center rounded-full bg-black/20 text-[10px]', done ? '✓' : String(n)), el('span', '', name));
      pill.addEventListener('click', () => { step = n; notice = ''; render(); });
      stepper.appendChild(pill);
    });
  }

  const VIEWS = { 1: () => renderRecord(), 2: () => renderVoice(), 3: () => renderCustomize(), 4: () => renderContacts(), 5: () => renderGenerate(), 6: () => renderCampaigns() };

  function render() {
    renderStepper();
    inner.replaceChildren();
    inner.appendChild(VIEWS[step]());

    const footer = el('div', 'flex flex-wrap items-center gap-3');
    const errors = step <= SETUP_STEPS + 1 ? stepErrors(draft, step) : [];
    const msg = busy || notice || errors[0] || '';
    const status = el('p', `flex-1 text-sm ${busy ? 'text-primary' : notice && !errors.length ? 'text-emerald-300' : 'text-amber-300'}`, msg);
    // Buttons sit on the left so the floating Ask SmartVideo button (bottom right) never covers them.
    if (step > 1) {
      const back = button('Back'); back.disabled = !!busy;
      back.addEventListener('click', () => { step -= 1; notice = ''; render(); });
      footer.appendChild(back);
    }
    if (step < STEPS.length) {
      const next = button(step === SETUP_STEPS + 1 ? 'See campaigns' : 'Next', { primary: true });
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
