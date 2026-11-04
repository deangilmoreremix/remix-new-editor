/**
 * Voiceover and music for the AI Agent: submit a job to /api/agent-audio,
 * poll until it's done, copy the audio into the user's storage (provider
 * links can expire) and read its duration.
 */
import { apiKeyManager } from '../../apiKeyManager.js';

export const AUDIO_ENDPOINT = '/api/agent-audio';

export const VOICES = [
  ['Wise_Woman', 'Warm, mature female'], ['Calm_Woman', 'Calm female'], ['Inspirational_girl', 'Upbeat young female'],
  ['Lively_Girl', 'Lively female'], ['Friendly_Person', 'Friendly, neutral'], ['Casual_Guy', 'Casual male'],
  ['Deep_Voice_Man', 'Deep male'], ['Elegant_Man', 'Polished male'], ['Determined_Man', 'Confident male'],
  ['Patient_Man', 'Patient male'], ['Young_Knight', 'Young energetic male'], ['Imposing_Manner', 'Dramatic male'],
];

// OpenAI text-to-speech voices (gpt-4o-mini-tts). marin and cedar are OpenAI's recommended voices.
export const OPENAI_VOICES = [
  ['marin', 'Marin — natural, warm'], ['cedar', 'Cedar — natural, grounded'], ['alloy', 'Alloy — neutral'], ['ash', 'Ash — clear male'],
  ['ballad', 'Ballad — soft, expressive'], ['coral', 'Coral — bright female'], ['echo', 'Echo — calm male'], ['fable', 'Fable — storyteller'],
  ['nova', 'Nova — upbeat female'], ['onyx', 'Onyx — deep male'], ['sage', 'Sage — gentle'], ['shimmer', 'Shimmer — light female'], ['verse', 'Verse — dynamic'],
];

export const TTS_PROVIDERS = [
  ['minimax', 'MiniMax Speech HD'],
  ['openai', 'OpenAI (gpt-4o-mini-tts)'],
];

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })); }, { once: true });
});

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * BYOK: requests run on the user's own keys from Settings → API keys, sent as
 * X-MuAPI-Key (MiniMax voices, music) and X-OpenAI-Key (OpenAI voices).
 */
export function byokHeaders(manager = apiKeyManager) {
  const h = {};
  const muapi = manager?.getMuapiKey?.();
  const openai = manager?.getOpenAIKey?.();
  if (muapi && muapi !== 'dev') h['X-MuAPI-Key'] = muapi;
  if (openai) h['X-OpenAI-Key'] = openai;
  return h;
}

/** Which key a request needs, and whether the user has added it. */
export function missingKeyMessage(kind, params = {}, manager = apiKeyManager) {
  if (kind === 'tts' && params.provider === 'openai') {
    return manager?.getOpenAIKey?.() ? null : 'OpenAI voices use your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).';
  }
  const muapi = manager?.getMuapiKey?.();
  return muapi && muapi !== 'dev' ? null : `${kind === 'music' ? 'Music' : 'MiniMax voices'} use your own MuAPI key. Add it in Settings → API keys (MuAPI API Key).`;
}

async function call(body, { fetchImpl = fetch, signal, keyManager = apiKeyManager } = {}) {
  const res = await fetchImpl(AUDIO_ENDPOINT, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...byokHeaders(keyManager) }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (res.status === 401) throw new Error(data?.error?.message || 'Sign in to generate voiceovers and music.');
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `The audio service is unavailable (HTTP ${res.status}).`);
  return data;
}

/**
 * @param {'tts'|'music'} kind
 * @param {object} params   tts: { text, voice, speed, provider?, pitch?, instructions? } · music: { prompt, genre, mood, duration }
 * @returns {Promise<string>} audio URL from the provider
 */
export async function generateAudio(kind, params, { fetchImpl, signal, pollMs = 3000, timeoutMs = 6 * 60_000, onProgress, keyManager = apiKeyManager } = {}) {
  const missing = missingKeyMessage(kind, params, keyManager);
  if (missing) throw new Error(missing);
  const first = await call({ action: 'submit', kind, ...params }, { fetchImpl, signal, keyManager });
  if (first.status === 'done' && first.url) return first.url;
  const started = Date.now();
  for (;;) {
    if (Date.now() - started > timeoutMs) throw new Error('Audio generation timed out — try again');
    await sleep(pollMs, signal);
    onProgress?.({ elapsedSec: Math.round((Date.now() - started) / 1000) });
    const res = await call({ action: 'status', requestId: first.requestId }, { fetchImpl, signal, keyManager });
    if (res.status === 'done' && res.url) return res.url;
    if (res.status === 'failed') throw new Error(res.error || 'Audio generation failed');
  }
}

/** Copy remote audio into storage (falls back to the provider URL). */
export async function persistAudio(url, { upload, name = 'audio', fetchImpl = fetch } = {}) {
  if (!upload) return url;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    const ext = /wav/.test(blob.type) ? 'wav' : /ogg/.test(blob.type) ? 'ogg' : 'mp3';
    const file = new File([blob], `${name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'audio'}.${ext}`, { type: blob.type || 'audio/mpeg' });
    const out = await upload(file);
    const stored = typeof out === 'string' ? out : out?.url;
    return stored && !stored.startsWith('blob:') ? stored : url;
  } catch {
    return url;
  }
}

/** Duration in seconds via an <audio> element (null if unknown). */
export function probeDuration(url, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined') { resolve(null); return; }
    const a = new Audio();
    const done = (v) => { clearTimeout(t); a.removeAttribute('src'); resolve(v); };
    const t = setTimeout(() => done(null), timeoutMs);
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
    a.crossOrigin = 'anonymous';
    a.src = url;
  });
}

/**
 * Volume keyframes (multipliers) for a music clip: fade in, duck under the
 * voiceover ranges, fade out. Times are seconds from the music clip start.
 */
export function duckingKeyframes(musicStart, musicEnd, voiceRanges = [], { duck = 0.35, ramp = 0.3, fadeIn = 1, fadeOut = 1.5 } = {}) {
  const len = Math.max(0, musicEnd - musicStart);
  if (!len) return [];
  // Voice ranges relative to the music clip, clipped and merged.
  const ranges = voiceRanges
    .map(([s, e]) => [Math.max(0, s - musicStart - ramp), Math.min(len, e - musicStart + ramp)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
    .reduce((acc, r) => {
      const last = acc[acc.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else acc.push([...r]);
      return acc;
    }, []);
  const pts = new Map();
  const put = (t, v) => { const k = Math.round(Math.max(0, Math.min(len, t)) * 1000) / 1000; if (!pts.has(k)) pts.set(k, v); };
  const fi = Math.min(fadeIn, len / 3);
  const fo = Math.min(fadeOut, len / 3);
  put(0, 0);
  ranges.forEach(([s, e]) => {
    put(s, 1);
    put(Math.min(e, s + ramp), duck);
    put(Math.max(s, e - ramp), duck);
    put(e, 1);
  });
  // Fade in / out (don't override duck points that fall inside the fades).
  if (!ranges.some(([s]) => s < fi)) put(fi, 1);
  if (!ranges.some(([, e]) => e > len - fo)) put(len - fo, 1);
  pts.set(Math.round(len * 1000) / 1000, 0);
  return [...pts.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v, easing: 'ease-in-out' }));
}
