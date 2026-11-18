// src/lib/outreach/transcript.js
//
// Captions and transcript for the outreach video (Sendspark: auto captions, captions in other
// languages, a timestamped transcript on the landing page, downloadable). Made in the browser:
// Whisper for the words (src/lib/editor/remotion/transcribe.js), M2M100 for translations
// (src/lib/editor/ml/localAI.js translateCaptions). Stored on the draft, published with the
// campaign as project.transcript, shown by the watch page.

export const MAX_LINES = 400;
export const MAX_TEXT = 300;

/** Word captions → readable lines (end of sentence, or about 12 words). */
export function transcriptLines(captions = []) {
  const lines = [];
  let cur = null;
  for (const c of captions) {
    const text = String(c.text ?? '');
    if (!text.trim()) continue;
    if (!cur) cur = { startMs: Math.round(c.startMs), endMs: Math.round(c.endMs), text: '' };
    cur.text += text;
    cur.endMs = Math.round(c.endMs);
    const words = cur.text.trim().split(/\s+/).length;
    if (/[.!?]["')\]]?$/.test(text.trim()) || words >= 12) { lines.push({ ...cur, text: cur.text.trim() }); cur = null; }
  }
  if (cur?.text.trim()) lines.push({ ...cur, text: cur.text.trim() });
  return lines;
}

const cleanLines = (lines) => (Array.isArray(lines) ? lines : [])
  .slice(0, MAX_LINES)
  .map((l) => ({ startMs: Math.max(0, Math.round(Number(l.startMs) || 0)), endMs: Math.max(0, Math.round(Number(l.endMs) || 0)), text: String(l.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) }))
  .filter((l) => l.text);

/** The transcript as published: { lang, lines, translations: { [code]: lines } }, size-capped. */
export function cleanTranscript(t) {
  if (!t || typeof t !== 'object') return null;
  const lines = cleanLines(t.lines);
  if (!lines.length) return null;
  const translations = {};
  Object.entries(t.translations || {}).slice(0, 12).forEach(([code, l]) => {
    if (/^[a-z]{2}$/.test(code)) { const c = cleanLines(l); if (c.length) translations[code] = c; }
  });
  return { lang: /^[a-z]{2}$/.test(t.lang || '') ? t.lang : 'en', lines, translations };
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
export const clock = (ms) => `${Math.floor(ms / 60000)}:${pad(Math.floor(ms / 1000) % 60)}`;

/** Plain-text transcript for download: "[0:04] line". */
export function transcriptText(lines) {
  return `${lines.map((l) => `[${clock(l.startMs)}] ${l.text}`).join('\n')}\n`;
}

/** SRT for download. */
export function transcriptSrt(lines) {
  const t = (ms) => `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  return lines.map((l, i) => `${i + 1}\n${t(l.startMs)} --> ${t(Math.max(l.endMs, l.startMs + 500))}\n${l.text}\n`).join('\n');
}

/** The line being spoken at `ms` (or -1). */
export function lineAt(lines, ms) {
  for (let i = lines.length - 1; i >= 0; i -= 1) if (ms >= lines[i].startMs) return ms <= lines[i].endMs + 1500 ? i : -1;
  return -1;
}
