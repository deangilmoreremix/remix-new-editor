/**
 * Live captions from the microphone with the Web Speech API. Chrome/Edge only; recognition runs on-device when the browser has
 * the language pack ("on-device"), otherwise the browser sends the audio to its speech service ("browser-cloud") — the UI says which.
 * The API gives no word times, so each phrase's words are spread across the time it took to say them.
 */
import { normalizeCaption } from './model.js';

const RecClass = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const liveSpeechSupported = () => !!RecClass();

/** Spread `text` over [startMs, endMs] by word length → word captions with Remotion's leading-space convention. */
export function spreadWords(text, startMs, endMs, first = false) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const total = words.reduce((n, w) => n + w.length + 1, 0);
  const span = Math.max(words.length * 120, endMs - startMs);
  let t = startMs;
  return words.map((w, i) => {
    const end = i === words.length - 1 ? startMs + span : t + (span * (w.length + 1)) / total;
    const c = normalizeCaption({ text: (first && i === 0 ? '' : ' ') + w, startMs: t, endMs: end });
    t = c.endMs;
    return c;
  });
}

/**
 * @param {{ lang?: string, onUpdate: (state: { captions: object[], interim: string }) => void, onError?: (e: Error) => void, onMode?: (m: string) => void }} opts
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startLiveCaptions({ lang = 'en-US', onUpdate, onError, onMode } = {}) {
  const Rec = RecClass();
  if (!Rec) throw new Error('Live speech recognition is not available in this browser. Use Chrome or Edge, or generate captions from a video file instead.');
  const rec = new Rec();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;

  let mode = 'browser-cloud';
  try {
    if (typeof Rec.available === 'function') {
      let status = await Rec.available({ langs: [lang], processLocally: true });
      if (status === 'downloadable' && typeof Rec.install === 'function') { await Rec.install({ langs: [lang], processLocally: true }); status = 'available'; }
      if (status === 'available') { rec.processLocally = true; mode = 'on-device'; }
    }
  } catch { /* stay on the browser's default service */ }
  onMode?.(mode);

  const t0 = performance.now();
  const now = () => performance.now() - t0;
  let finals = [];
  let phraseStart = null;
  let stopped = false;

  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const r = ev.results[i];
      const text = r[0]?.transcript || '';
      if (phraseStart == null) phraseStart = now();
      if (r.isFinal) {
        finals = finals.concat(spreadWords(text, phraseStart, now(), finals.length === 0));
        phraseStart = null;
      } else interim += text;
    }
    onUpdate?.({ captions: finals, interim });
  };
  rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') onError?.(new Error(e.error === 'not-allowed' ? 'Microphone permission was denied.' : `Speech recognition error: ${e.error}`)); };
  // The service ends the session after silence; keep going until the user stops.
  rec.onend = () => { if (!stopped) { try { rec.start(); } catch { /* already restarting */ } } };
  rec.start();

  return { stop: () => { stopped = true; try { rec.stop(); } catch { /* ignore */ } }, elapsedMs: now };
}
