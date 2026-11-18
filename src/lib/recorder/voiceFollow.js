// src/lib/recorder/voiceFollow.js
//
// Teleprompter "Follow my voice" (as in PromptMe, larsbaunwall.github.io/promptme-ai): the script
// scrolls to where you are as you speak, instead of at a fixed speed. Speech is recognised in the
// browser with Moonshine (Transformers.js, in voiceFollow.worker.js; nothing leaves the device).
// Here: matching what was heard to the script, and the microphone → recogniser loop.

const norm = (w) => String(w).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9']/g, '');

/** The script as words, with the line each word is on (lines as scriptLines() gives them). */
export function scriptWords(lines) {
  const out = [];
  lines.forEach((line, li) => {
    if (/^\[pause\]$/i.test(line.trim())) return;
    for (const w of line.split(/\s+/)) { const n = norm(w); if (n) out.push({ w: n, line: li }); }
  });
  return out;
}

const close = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b.slice(0, -1)) || b.startsWith(a.slice(0, -1))));

/**
 * Where the speaker is: given the word index reached so far and the words just heard, the new
 * index (never moving back, and never jumping more than `ahead` words). The last heard words are
 * matched as a sequence, so a common word on its own doesn't jump the prompter.
 */
export function advance(words, at, heard, { ahead = 40, min = 2 } = {}) {
  const h = String(heard || '').split(/\s+/).map(norm).filter(Boolean).slice(-6);
  if (!h.length) return at;
  let best = at;
  let bestScore = 0;
  const end = Math.min(words.length, at + ahead);
  for (let i = at; i < end; i += 1) {
    // How many of the heard words, ending here, match the script ending at word i.
    let score = 0;
    for (let k = 0; k < h.length && i - k >= 0; k += 1) {
      if (close(words[i - k].w, h[h.length - 1 - k])) score += 1;
      else break;
    }
    if (score > bestScore || (score === bestScore && score > 0 && i < best)) { best = i + 1; bestScore = score; }
  }
  // At least `min` words in a row must match: one common word ("the") never moves the prompter.
  return bestScore >= min ? Math.max(at, best) : at;
}

/** The line to highlight for a word index. */
export const lineForWord = (words, i) => (words.length ? words[Math.min(Math.max(0, i - 1), words.length - 1)].line : 0);

let worker = null;
let seq = 0;
const getWorker = () => {
  if (!worker) worker = new Worker(new URL('./voiceFollow.worker.js', import.meta.url), { type: 'module' });
  return worker;
};

/** Start downloading the speech model early (e.g. when the recorder opens with Follow on). */
export function preloadFollow() {
  try { getWorker().postMessage({ type: 'load' }); } catch { /* workers unavailable */ }
}

/**
 * Listen to a microphone track and call onHeard(text) about every `everyMs` with what was said
 * in the last few seconds. Returns { stop }. The model downloads once (about 50 MB) and is cached.
 */
export async function listen(track, { onHeard, onStatus, everyMs = 1200, windowSec = 4 } = {}) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16000 });
  const src = ctx.createMediaStreamSource(new globalThis.MediaStream([track.clone()]));
  const max = windowSec * 16000;
  let buf = new Float32Array(0);
  // ScriptProcessor keeps this dependency-free; the audio is tiny (16 kHz mono).
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  proc.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const next = new Float32Array(Math.min(max, buf.length + input.length));
    const keep = next.length - input.length;
    next.set(buf.subarray(buf.length - keep), 0);
    next.set(input.subarray(Math.max(0, input.length - next.length)), keep);
    buf = next;
  };
  src.connect(proc);
  proc.connect(ctx.destination);
  const w = getWorker();
  let busy = false;
  let stopped = false;
  const onMsg = ({ data }) => {
    if (data?.type === 'progress') onStatus?.({ stage: 'download', progress: data.progress });
    if (data?.type === 'ready') onStatus?.({ stage: 'ready' });
    if (data?.type === 'text') { busy = false; if (!stopped) onHeard?.(data.text); }
    if (data?.type === 'error') { busy = false; onStatus?.({ stage: 'error', message: data.message }); }
  };
  w.addEventListener('message', onMsg);
  w.postMessage({ type: 'load' });
  const timer = setInterval(() => {
    if (busy || buf.length < 16000 * 0.8) return;
    busy = true;
    const audio = buf.slice();
    w.postMessage({ type: 'hear', id: ++seq, audio }, [audio.buffer]);
  }, everyMs);
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      w.removeEventListener('message', onMsg);
      try { proc.disconnect(); src.disconnect(); } catch { /* already */ }
      ctx.close().catch(() => {});
    },
  };
}
