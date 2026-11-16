// src/lib/recorder/teleprompter.js
//
// Teleprompter (Sendspark "Scripts & Teleprompter"): the script near the camera, scrolling at a
// reading speed, with the current line highlighted, so you keep eye contact. Pure helpers here;
// the overlay is drawn by RecorderModal and the full Recorder's webcam view (DOM over the
// preview, so it is never recorded).

export const TELEPROMPTER_KEY = 'recorder-teleprompter';
export const DEFAULTS = { on: false, script: '', wpm: 140, fontSize: 24, follow: false };

export function teleprompterSettings(t = {}) {
  return {
    on: !!t.on,
    script: String(t.script ?? '').slice(0, 6000),
    wpm: Math.max(60, Math.min(260, Math.round(Number(t.wpm) || DEFAULTS.wpm))),
    fontSize: Math.max(14, Math.min(48, Math.round(Number(t.fontSize) || DEFAULTS.fontSize))),
    // Scroll to where you are as you speak (src/lib/recorder/voiceFollow.js) instead of at `wpm`.
    follow: !!t.follow,
  };
}

export function loadTeleprompter(storage = globalThis.localStorage) {
  try { return teleprompterSettings(JSON.parse(storage?.getItem(TELEPROMPTER_KEY) || '{}')); } catch { return teleprompterSettings(); }
}

export function saveTeleprompter(t, storage = globalThis.localStorage) {
  try { storage?.setItem(TELEPROMPTER_KEY, JSON.stringify(teleprompterSettings(t))); } catch { /* blocked */ }
}

/** Script → lines to show: one per line of the script; long lines split at ~maxChars. */
export function scriptLines(script, maxChars = 48) {
  const out = [];
  for (const raw of String(script || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let cur = '';
    for (const w of line.split(/\s+/)) {
      if (cur && (cur + ' ' + w).length > maxChars) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) out.push(cur);
  }
  return out;
}

const wordsIn = (line) => (/^\[pause\]$/i.test(line) ? 4 : line.split(/\s+/).filter(Boolean).length); // a pause ≈ 2 s

/**
 * Where the reading is after `elapsedMs` at `wpm`: { index, progress } — the current line and how
 * far into it (0..1). Past the end: index = lines.length.
 */
export function readingPosition(lines, elapsedMs, wpm) {
  const msPerWord = 60000 / Math.max(1, wpm);
  let t = Math.max(0, elapsedMs);
  for (let i = 0; i < lines.length; i += 1) {
    const d = Math.max(1, wordsIn(lines[i])) * msPerWord;
    if (t < d) return { index: i, progress: t / d };
    t -= d;
  }
  return { index: lines.length, progress: 0 };
}

/** How long the whole script takes to read, in seconds. */
export const readingSeconds = (lines, wpm) => lines.reduce((n, l) => n + Math.max(1, wordsIn(l)), 0) * (60 / Math.max(1, wpm));

/**
 * A small controller for an overlay: start/pause/reset follow the recording; `onFrame` is called
 * with the reading position on every animation frame while running.
 */
const defaultRaf = (f) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(f) : setTimeout(f, 16));
const defaultCaf = (id) => (globalThis.cancelAnimationFrame ? globalThis.cancelAnimationFrame(id) : clearTimeout(id));

export function createTeleprompterClock({ now = () => globalThis.performance.now(), raf = defaultRaf, caf = defaultCaf } = {}) {
  let startedAt = null; let carried = 0; let id = null; let listener = null;
  const elapsed = () => carried + (startedAt == null ? 0 : now() - startedAt);
  const tick = () => { listener?.(elapsed()); id = raf(tick); };
  return {
    onFrame(f) { listener = f; },
    start() { if (startedAt != null) return; startedAt = now(); if (id == null) id = raf(tick); },
    pause() { if (startedAt == null) return; carried = elapsed(); startedAt = null; if (id != null) { caf(id); id = null; } listener?.(carried); },
    reset() { carried = 0; startedAt = null; if (id != null) { caf(id); id = null; } listener?.(0); },
    elapsed,
  };
}
