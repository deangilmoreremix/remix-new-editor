/**
 * Smart Speech (upstream toolbar "Smart Speech"): type a line, pick a
 * voice, preview it and add it to the Voiceover track. Lines can be
 * personalized with {{tokens}} plus a fallback line. This file holds the
 * logic; the window is smartSpeechModal.js.
 *
 * Upstream used Google Cloud TTS with 150 / 70 (personalized) character
 * limits, pitch and speed. Here: MiniMax Speech HD (MuAPI, default) or
 * OpenAI gpt-4o-mini-tts, on the user's own MuAPI / OpenAI keys (BYOK, Settings → API keys)
 * via /api/agent-audio.
 */
import { VOICES, OPENAI_VOICES, TTS_PROVIDERS } from './audioGen.js';

export const LIMIT = 150;
export const PERSONAL_LIMIT = 70;
export const SAVED_KEY = 'remix.smartSpeech.voices';

export const PROVIDER_SETTINGS = {
  minimax: { voices: VOICES, defaultVoice: 'Wise_Woman', speed: [0.5, 2], pitch: true, instructions: false },
  openai: { voices: OPENAI_VOICES, defaultVoice: 'marin', speed: [0.25, 4], pitch: false, instructions: true },
};

export const hasTokens = (text) => /\{\{[^}]+\}\}/.test(String(text || ''));

/** Problems with a draft, in display order (empty when it can be generated). */
export function validateSpeech(d) {
  const errors = [];
  const text = String(d.text || '').trim();
  const personal = hasTokens(text);
  if (!text) errors.push('Type what the voice should say.');
  if (text.length > (personal ? PERSONAL_LIMIT : LIMIT)) {
    errors.push(personal ? `Personalized lines can be up to ${PERSONAL_LIMIT} characters.` : `Lines can be up to ${LIMIT} characters.`);
  }
  if (personal) {
    const fb = String(d.fallback || '').trim();
    if (!fb) errors.push('Add a fallback line for viewers without personal details.');
    else if (hasTokens(fb)) errors.push('The fallback line can’t contain {{tokens}}.');
    else if (fb.length > LIMIT) errors.push(`The fallback line can be up to ${LIMIT} characters.`);
  }
  if (!PROVIDER_SETTINGS[d.provider]) errors.push('Pick a voice provider.');
  return errors;
}

/** Request for /api/agent-audio from a draft (the text actually spoken). */
export function speechRequest(d, spokenText) {
  const p = PROVIDER_SETTINGS[d.provider] || PROVIDER_SETTINGS.minimax;
  const [lo, hi] = p.speed;
  const req = {
    provider: d.provider,
    text: spokenText,
    voice: p.voices.some(([v]) => v === d.voice) ? d.voice : p.defaultVoice,
    speed: Math.max(lo, Math.min(hi, Number(d.speed) || 1)),
  };
  if (p.pitch) req.pitch = Math.max(-12, Math.min(12, Math.round(Number(d.pitch) || 0)));
  if (p.instructions && String(d.instructions || '').trim()) req.instructions = String(d.instructions).trim().slice(0, 500);
  return req;
}

/** What a viewer's line becomes in the editor preview (the profile's values, else the fallback). */
export function previewLine(d, resolve) {
  if (!hasTokens(d.text)) return String(d.text || '').trim();
  const resolved = resolve ? String(resolve(d.text) || '') : '';
  return resolved && !hasTokens(resolved) ? resolved.trim() : String(d.fallback || '').trim();
}

/** Clip metadata stored on the timeline (and read by watch-voice). */
export function ttsMeta(d) {
  const req = speechRequest(d, '');
  return {
    provider: req.provider,
    voice: req.voice,
    speed: req.speed,
    ...(req.pitch !== undefined ? { pitch: req.pitch } : {}),
    ...(req.instructions ? { instructions: req.instructions } : {}),
    text: String(d.text || '').trim(),
    fallback: hasTokens(d.text) ? String(d.fallback || '').trim() : '',
    personalized: hasTokens(d.text),
  };
}

export function loadSavedVoices(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(SAVED_KEY) || '[]');
    return Array.isArray(list) ? list.filter((v) => v && PROVIDER_SETTINGS[v.provider]) : [];
  } catch {
    return [];
  }
}

export function saveVoice(entry, storage = globalThis.localStorage) {
  const list = loadSavedVoices(storage).filter((v) => v.name !== entry.name);
  list.unshift(entry);
  try { storage?.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20))); } catch { /* storage full or blocked */ }
  return list.slice(0, 20);
}

// The UI is the Smart Speech window: smartSpeechModal.js.
