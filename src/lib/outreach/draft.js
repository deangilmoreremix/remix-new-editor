/**
 * Video Outreach studio (route: #/outreach) — the draft behind its steps and
 * the hand-off into the timeline editor. Pure logic, no DOM, so it is tested
 * on its own (src/lib/outreach/__tests__/draft.test.js).
 *
 *   Record    → draft.video   { url, duration, hasAudio, type, tracks }
 *   Voice     → draft.voice   { mode: 'clone' | 'stock', cloneVoiceId?, stockVoice?, consent?, fallbackUrl?, fallbackDuration? }
 *   Customize → draft.header, draft.message, draft.fallbacks, draft.cta
 *
 * buildEditorProject() turns a finished draft into the project data the
 * classic editor (#/timeline-classic) restores from
 * localStorage['timeline-editor-project'] (see loadProjectFromStorage in TimelineEditorPage.jsx): the recording on the
 * Main Video track, the personalized greeting on the Voiceover track as a
 * Smart Speech clip (the same `tts` shape smartSpeech.ttsMeta writes, read by
 * watch-voice), and a CTA button (the click-to-call addon) on the Text track.
 */
import { createAddonClip } from '../editor/addons/registry.js';
import '../editor/addons/interactiveAddons.js'; // registers the CTA addon used below

export const DRAFT_KEY = 'outreach-draft-v1';
export const EDITOR_PROJECT_KEY = 'timeline-editor-project';
// The classic Timeline Editor reads EDITOR_PROJECT_KEY and has Smart Speech, personal links and
// Share. (#/timeline now opens the CineGen editor, which does not read this key.)
export const EDITOR_ROUTE = 'timeline-classic';
export const STEPS = ['Record', 'Voice', 'Customize', 'Contacts', 'Generate', 'Campaigns'];
/** Steps built so far; the rest show in the stepper as coming next. */
export const READY_STEPS = 3;

// Mirrors smartSpeech.PERSONAL_LIMIT: a personalized spoken line may be up to 70 characters.
export const GREETING_LIMIT = 70;
export const HEADER_LIMIT = 120;
export const MESSAGE_LIMIT = 500;
export const CTA_LIMIT = 40;
// Same rule as agent-audio's CLONE_VOICE_ID.
export const CLONE_VOICE_ID = /^[A-Za-z][A-Za-z0-9_-]{7,63}$/;
export const STOCK_VOICES = ['Wise_Woman', 'Calm_Woman', 'Friendly_Person', 'Casual_Guy', 'Deep_Voice_Man', 'Elegant_Man'];
export const FIRST_NAME_FALLBACKS = ['there', 'friend'];

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function defaultDraft() {
  return {
    version: 1,
    video: null,
    voice: { mode: 'clone', cloneVoiceId: '', stockVoice: 'Wise_Woman', consent: null, fallbackUrl: '', fallbackDuration: 0 },
    greeting: 'Hi {{firstname}}!',
    header: 'Hi {{firstname}}, I made this for you',
    message: 'Excited to show how we can help {{company}}.',
    fallbacks: { firstname: 'there', company: 'your company' },
    cta: { enabled: true, label: 'Schedule a demo', url: '' },
  };
}

/** The saved draft merged over defaults, so older or partial drafts still load. */
export function loadDraft(storage = globalThis.localStorage) {
  const base = defaultDraft();
  try {
    const saved = JSON.parse(storage?.getItem(DRAFT_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return base;
    return {
      ...base,
      ...saved,
      voice: { ...base.voice, ...(saved.voice || {}) },
      fallbacks: { ...base.fallbacks, ...(saved.fallbacks || {}) },
      cta: { ...base.cta, ...(saved.cta || {}) },
    };
  } catch {
    return base;
  }
}

export function saveDraft(draft, storage = globalThis.localStorage) {
  try { storage?.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full or blocked: the draft stays in memory */ }
}

export function clearDraft(storage = globalThis.localStorage) {
  try { storage?.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/** Token keys used in a template, lower-cased: 'Hi {{firstName}}' → ['firstname']. */
export function tokensIn(template) {
  return [...new Set([...String(template || '').matchAll(TOKEN_RE)].map((m) => m[1].toLowerCase()))];
}

/** Fill {{tokens}} from a contact, then from the fallbacks; unknown tokens become ''. */
export function fillTemplate(template, contact = {}, fallbacks = {}) {
  const values = {};
  for (const [k, v] of Object.entries(contact || {})) values[k.toLowerCase()] = v;
  const fb = {};
  for (const [k, v] of Object.entries(fallbacks || {})) fb[k.toLowerCase()] = v;
  return String(template || '').replace(TOKEN_RE, (_, key) => {
    const k = key.toLowerCase();
    const value = String(values[k] ?? '').trim();
    return value || String(fb[k] ?? '').trim();
  }).replace(/\s{2,}/g, ' ').trim();
}

export function isHttpsUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Problems that stop each step from completing, keyed by step number (1-based). */
export function stepErrors(draft, step) {
  const errors = [];
  if (step === 1) {
    if (!draft.video?.url) errors.push('Record or upload a video first.');
    else if (draft.video.url.startsWith('blob:')) errors.push('The video has not finished uploading.');
  }
  if (step === 2) {
    const v = draft.voice || {};
    if (v.mode === 'clone') {
      if (!CLONE_VOICE_ID.test(v.cloneVoiceId || '')) errors.push('Clone your voice, or choose a stock voice.');
      if (!v.consent?.at) errors.push('Confirm the voice is your own before using it.');
    } else if (!STOCK_VOICES.includes(v.stockVoice)) {
      errors.push('Choose a stock voice.');
    }
    const greeting = String(draft.greeting || '').trim();
    if (!greeting) errors.push('Write the greeting each contact will hear.');
    else if (greeting.length > GREETING_LIMIT) errors.push(`The spoken greeting can be up to ${GREETING_LIMIT} characters.`);
    if (!String(draft.fallbacks?.firstname || '').trim()) errors.push('Add a fallback for contacts without a first name.');
    if (!v.fallbackUrl) errors.push('Generate the voice so contacts without details still hear a greeting.');
  }
  if (step === 3) {
    const header = String(draft.header || '').trim();
    if (!header) errors.push('Write a header for the landing page.');
    if (header.length > HEADER_LIMIT) errors.push(`The header can be up to ${HEADER_LIMIT} characters.`);
    if (String(draft.message || '').length > MESSAGE_LIMIT) errors.push(`The message can be up to ${MESSAGE_LIMIT} characters.`);
    if (draft.cta?.enabled) {
      const label = String(draft.cta.label || '').trim();
      if (!label) errors.push('Give the button a label.');
      else if (label.length > CTA_LIMIT) errors.push(`The button label can be up to ${CTA_LIMIT} characters.`);
      if (!isHttpsUrl(draft.cta.url)) errors.push('The booking link must be an https:// address.');
    }
  }
  return errors;
}

/** The voice the greeting is spoken in, as Smart Speech / agent-audio understand it. */
export function voiceSettings(draft) {
  const v = draft.voice || {};
  if (v.mode === 'clone' && CLONE_VOICE_ID.test(v.cloneVoiceId || '')) {
    return { provider: 'minimax', voice: v.cloneVoiceId, cloneVoiceId: v.cloneVoiceId };
  }
  return { provider: 'minimax', voice: STOCK_VOICES.includes(v.stockVoice) ? v.stockVoice : 'Wise_Woman' };
}

/** The request body for /api/agent-audio that speaks `text` in the chosen voice. */
export function speakRequest(draft, text) {
  const s = voiceSettings(draft);
  return { provider: 'minimax', text, voice: s.voice, speed: 1, ...(s.cloneVoiceId ? { cloneVoiceId: s.cloneVoiceId } : {}) };
}

/**
 * Project data for the timeline editor. Times use the editor's own models:
 * left/width percentages for the Main Video clip (as addVideoToTimeline
 * writes them) and start/end seconds for the speech and CTA clips (as Smart
 * Speech and addAddon write them).
 */
export function buildEditorProject(draft, { now = Date.now() } = {}) {
  for (const step of [1, 2, 3]) {
    const errors = stepErrors(draft, step);
    if (errors.length) throw new Error(errors[0]);
  }
  const id = now.toString(36);
  const videoSeconds = Math.max(1, Math.round(Number(draft.video.duration) || 30));
  const greetingSeconds = Math.max(0.5, Number(draft.voice.fallbackDuration) || 2);
  const T = Math.max(videoSeconds, Math.ceil(greetingSeconds + 1));
  const voice = voiceSettings(draft);
  const greeting = String(draft.greeting).trim();
  const tokens = tokensIn(greeting);
  const fallbackLine = fillTemplate(greeting, {}, draft.fallbacks);

  const tts = {
    provider: 'minimax',
    voice: voice.voice,
    ...(voice.cloneVoiceId ? { cloneVoiceId: voice.cloneVoiceId } : {}),
    speed: 1,
    text: greeting,
    fallback: tokens.length ? fallbackLine : '',
    personalized: tokens.length > 0,
  };

  const textItems = [];
  if (draft.cta?.enabled) {
    const cta = createAddonClip('click-to-call', { startSec: Math.max(0, T - 6), timelineSeconds: T, id: `outreach-cta-${id}` });
    // The CTA stays up for the last stretch of the video and opens the booking link.
    cta.end = T;
    cta.linkMode = 'url';
    cta.linkUrl = draft.cta.url;
    cta.linkTarget = '_blank';
    cta.buttonText = String(draft.cta.label).trim();
    cta.name = cta.buttonText;
    textItems.push(cta);
  }

  const tracks = [
    // The personalized greeting plays over the first seconds of the recording, which is why the
    // Record step asks for a short pause at the start.
    { id: `track-video-${id}`, type: 'video', name: 'Main Video', muted: false, solo: false, locked: false,
      items: [{ id: `outreach-video-${id}`, name: 'Outreach recording', type: 'video', src: draft.video.url, left: 0, width: (videoSeconds / T) * 100 }] },
    { id: `track-voiceover-${id}`, type: 'audio', name: 'Voiceover', muted: false, solo: false, locked: false,
      items: [{ id: `speech-outreach-${id}`, type: 'audio', role: 'voiceover', name: `Greeting: ${greeting}`.slice(0, 80), src: draft.voice.fallbackUrl, volume: 1, tts, start: 0, end: greetingSeconds }] },
    { id: `track-text-${id}`, type: 'text', name: 'Text', muted: false, solo: false, locked: false, items: textItems },
  ];
  // The editor keeps `clips` as an alias of `items` and saves both; parts of it read `clips`
  // before re-linking them, so the project carries both, like the editor's own saves.
  for (const t of tracks) t.clips = t.items;

  return {
    projectTitle: 'Video outreach',
    timelineSeconds: T,
    playheadPercent: 0,
    tracks,
    // Landing-page copy for the Share panel / watch page (read by later steps of the studio).
    outreach: {
      header: String(draft.header).trim(),
      message: String(draft.message || '').trim(),
      fallbacks: { ...draft.fallbacks },
      cta: draft.cta?.enabled ? { label: String(draft.cta.label).trim(), url: draft.cta.url } : null,
      aiVoice: voice.cloneVoiceId ? 'cloned' : 'stock',
    },
  };
}
