/**
 * Live captions while someone speaks (the voice-over recorder): the browser's Web Speech API.
 *
 * Two modes:
 *   'on-device'  `processLocally`: the audio stays on this device. Needs a browser that supports it (Chrome 139+) and the language pack for the
 *                language (`SpeechRecognition.available()` says `available`, `downloadable` or `unavailable`; `install()` downloads the pack).
 *   'browser'    the browser's own speech service. In Chrome this SENDS THE AUDIO to the browser vendor's servers, so it is only used after the user
 *                asked for it; the UI says so. Never chosen automatically.
 * The Web Speech API gives no reliable word timing, so this is a live PREVIEW. Timed captions come from Whisper afterwards (the clip's "Generate
 * captions", `src/lib/editor/remotion/transcribe.js`).
 */

export const LIVE_CAPTION_LANGUAGES = [['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['es-ES', 'Spanish'], ['fr-FR', 'French'], ['de-DE', 'German'], ['pt-BR', 'Portuguese (Brazil)'], ['it-IT', 'Italian'], ['hi-IN', 'Hindi'], ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['cmn-Hans-CN', 'Chinese']];

/** The browser's recognizer class, or null (Firefox has none; Safari/Chrome expose it, Chrome under the webkit name on older versions). */
export const speechRecognitionCtor = (win = globalThis) => win?.SpeechRecognition || win?.webkitSpeechRecognition || null;

/**
 * What this browser can do for `lang`: `{ supported, onDevice }` where `onDevice` is 'available' | 'downloadable' | 'downloading' | 'unavailable' |
 * 'unknown' (the browser has no on-device check, so on-device cannot be promised).
 */
export async function liveCaptionSupport({ lang = 'en-US', win = globalThis } = {}) {
  const Ctor = speechRecognitionCtor(win);
  if (!Ctor) return { supported: false, onDevice: 'unavailable' };
  if (typeof Ctor.available !== 'function') return { supported: true, onDevice: 'unknown' };
  try {
    const r = await Ctor.available({ langs: [lang], processLocally: true });
    const state = typeof r === 'string' ? r : (r?.[lang] || r?.status || 'unknown');
    return { supported: true, onDevice: ['available', 'downloadable', 'downloading', 'unavailable'].includes(state) ? state : 'unknown' };
  } catch {
    return { supported: true, onDevice: 'unknown' };
  }
}

/** Download the on-device language pack. Resolves true when it is ready. */
export async function installOnDevice({ lang = 'en-US', win = globalThis } = {}) {
  const Ctor = speechRecognitionCtor(win);
  if (!Ctor || typeof Ctor.install !== 'function') return false;
  try { return !!(await Ctor.install({ langs: [lang], processLocally: true })); } catch { return false; }
}

/**
 * A live session. `onUpdate({ text, final, interim, segments })` fires on every result: `final` is the finished text so far, `interim` the
 * words still being decided, `segments` the finished phrases `[{ text, startMs, endMs }]` (times from the start of the session, approximate).
 * Chrome ends a session after a pause in speech, so it is restarted while the session is running.
 * `mode` 'on-device' refuses to start unless the browser can really process locally (never falls back to the online service by itself).
 */
export function createLiveCaptions({ lang = 'en-US', mode = 'on-device', onUpdate, onError, win = globalThis, now = () => Date.now() } = {}) {
  const Ctor = speechRecognitionCtor(win);
  let rec = null;
  let running = false;
  let t0 = 0;
  let lastEnd = 0;
  const segments = [];
  let interim = '';

  const text = () => `${segments.map((s) => s.text).join(' ')}${interim ? ` ${interim}` : ''}`.trim();
  const emit = () => onUpdate?.({ text: text(), final: segments.map((s) => s.text).join(' '), interim, segments: segments.map((s) => ({ ...s })) });

  const wire = () => {
    rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    if (mode === 'on-device') rec.processLocally = true;
    rec.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        const said = String(r[0]?.transcript || '').trim();
        if (!said) continue;
        if (r.isFinal) {
          const end = now() - t0;
          segments.push({ text: said, startMs: Math.min(lastEnd, end), endMs: end });
          lastEnd = end;
        } else interim = `${interim} ${said}`.trim();
      }
      emit();
    };
    rec.onerror = (e) => {
      const code = e?.error || 'error';
      if (code === 'no-speech' || code === 'aborted') return;       // silence, or our own stop: not a problem
      if (code === 'not-allowed' || code === 'service-not-allowed') { running = false; onError?.({ code, message: 'The microphone or speech recognition is not allowed in this browser.' }); return; }
      if (code === 'language-not-supported') { running = false; onError?.({ code, message: 'This language is not available for live captions here.' }); return; }
      onError?.({ code, message: 'Live captions stopped.' });
    };
    rec.onend = () => { if (running) { try { wire(); rec.start(); } catch { running = false; } } };   // a pause in speech ends the session: carry on
  };

  return {
    start() {
      if (!Ctor) { onError?.({ code: 'unsupported', message: 'This browser has no speech recognition.' }); return false; }
      if (running) return true;
      running = true; t0 = now(); lastEnd = 0; segments.length = 0; interim = '';
      try { wire(); rec.start(); } catch (err) { running = false; onError?.({ code: 'start-failed', message: err?.message || 'Live captions could not start.' }); return false; }
      return true;
    },
    /** Stop and return what was said: `{ text, segments }`. */
    stop() {
      running = false;
      try { rec?.stop(); } catch { /* already stopped */ }
      interim = '';
      return { text: segments.map((s) => s.text).join(' '), segments: segments.map((s) => ({ ...s })) };
    },
    get running() { return running; },
  };
}
