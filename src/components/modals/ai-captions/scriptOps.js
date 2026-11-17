/**
 * AI Captions — the "Script & Words" model: pure helpers, no DOM.
 * Words are `{ text, start, end }` (ms, as `captionsToWords` returns them). A *segment* is one line of the script: `{ id, words }`.
 * Every edit returns a new array, so the modal can keep an undo list by holding on to the old one.
 * Features follow ai-video-captions / Capite's Studio: timed lines, click-to-fix words, find & replace, casing, nudge, split, merge, add, delete.
 */

export const MAX_WORDS_PER_SEGMENT = 9;
export const SEGMENT_GAP_MS = 700;
export const NUDGE_MS = 100;
const MIN_WORD_MS = 40;

let seq = 0;
const nextId = () => { seq += 1; return `seg-${seq}`; };
const cleanWord = (w) => ({ text: String(w.text ?? ''), start: Math.max(0, Math.round(w.start)), end: Math.max(Math.round(w.start) + MIN_WORD_MS, Math.round(w.end)) });
const mk = (words) => ({ id: nextId(), words: words.map(cleanWord) });

/** Words → script lines: a new line after sentence-ending punctuation, a pause, or too many words. */
export function segmentWords(words = [], { maxWords = MAX_WORDS_PER_SEGMENT, gapMs = SEGMENT_GAP_MS } = {}) {
  const out = [];
  let cur = [];
  const flush = () => { if (cur.length) out.push(mk(cur)); cur = []; };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const endsSentence = /[.!?…]["')\]]?$/.test(String(w.text).trim());
    if (endsSentence || cur.length >= maxWords || (next && next.start - w.end > gapMs)) flush();
  });
  flush();
  return out;
}

export const flattenSegments = (segments = []) => segments.flatMap((s) => s.words).sort((a, b) => a.start - b.start);
export const segmentStart = (s) => (s.words.length ? s.words[0].start : 0);
export const segmentEnd = (s) => (s.words.length ? s.words[s.words.length - 1].end : 0);
export const segmentText = (s) => s.words.map((w) => w.text).join(' ');
export const countWords = (segments = []) => segments.reduce((n, s) => n + s.words.length, 0);

/** Move a whole line earlier or later (−0.1 s / +0.1 s). Never before 0, never over the neighbouring line. */
export function nudgeSegment(segments, index, deltaMs) {
  const s = segments[index];
  if (!s || !s.words.length) return segments;
  const prevEnd = index > 0 ? segmentEnd(segments[index - 1]) : 0;
  const nextStart = index < segments.length - 1 ? segmentStart(segments[index + 1]) : Infinity;
  const lo = prevEnd - segmentStart(s);
  const hi = nextStart - segmentEnd(s);
  const d = Math.min(Math.max(deltaMs, Math.min(lo, 0)), Math.max(hi, 0));
  if (!d) return segments;
  return segments.map((x, i) => (i === index ? { ...x, words: x.words.map((w) => ({ ...w, start: w.start + d, end: w.end + d })) } : x));
}

/** Fix one word (spelling, punctuation). Empty text removes the word. */
export function editWord(segments, segIndex, wordIndex, text) {
  const s = segments[segIndex];
  if (!s || !s.words[wordIndex]) return segments;
  const t = String(text ?? '').trim();
  const words = t ? s.words.map((w, i) => (i === wordIndex ? { ...w, text: t } : w)) : s.words.filter((_, i) => i !== wordIndex);
  return words.length ? segments.map((x, i) => (i === segIndex ? { ...x, words } : x)) : segments.filter((_, i) => i !== segIndex);
}

/** Split a line before word `wordIndex` (1…n-1). */
export function splitSegment(segments, segIndex, wordIndex) {
  const s = segments[segIndex];
  if (!s || wordIndex < 1 || wordIndex >= s.words.length) return segments;
  const out = segments.slice();
  out.splice(segIndex, 1, { id: s.id, words: s.words.slice(0, wordIndex) }, { id: nextId(), words: s.words.slice(wordIndex) });
  return out;
}

/** Join line `index` with the next one. */
export function mergeSegments(segments, index) {
  const a = segments[index];
  const b = segments[index + 1];
  if (!a || !b) return segments;
  const out = segments.slice();
  out.splice(index, 2, { id: a.id, words: [...a.words, ...b.words] });
  return out;
}

export const deleteSegment = (segments, index) => segments.filter((_, i) => i !== index);

/** Add a line after `index` (or at the end) at the gap between lines, `text` spread evenly over `durationMs`. */
export function addSegment(segments, text = 'New line', { after = segments.length - 1, durationMs = 1500 } = {}) {
  const parts = String(text).split(/\s+/).filter(Boolean);
  if (!parts.length) return segments;
  const start = after >= 0 && segments[after] ? segmentEnd(segments[after]) : 0;
  const nextStart = segments[after + 1] ? segmentStart(segments[after + 1]) : Infinity;
  const dur = Math.max(parts.length * MIN_WORD_MS, Math.min(durationMs, nextStart - start));
  const step = dur / parts.length;
  const seg = mk(parts.map((t, i) => ({ text: t, start: start + i * step, end: start + (i + 1) * step })));
  const out = segments.slice();
  out.splice(after + 1, 0, seg);
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How many words match `find` (whole word text, ignoring case unless `matchCase`). */
export function countMatches(segments, find, { matchCase = false } = {}) {
  if (!find) return 0;
  const re = new RegExp(escapeRe(find), matchCase ? 'g' : 'gi');
  return segments.reduce((n, s) => n + s.words.reduce((m, w) => m + ((w.text.match(re) || []).length), 0), 0);
}

/** Find & Replace over every word. A word that becomes empty is removed; one that gains spaces stays one timed word. */
export function replaceAll(segments, find, replacement = '', { matchCase = false } = {}) {
  if (!find) return segments;
  const re = new RegExp(escapeRe(find), matchCase ? 'g' : 'gi');
  const out = segments.map((s) => ({ ...s, words: s.words.map((w) => ({ ...w, text: w.text.replace(re, () => replacement) })).filter((w) => w.text.trim()) })).filter((s) => s.words.length);
  return out;
}

const titleCase = (t) => t.toLowerCase().replace(/(^|[\s"'(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
/** UPPERCASE · Title Case · lowercase for the whole script. */
export function convertCase(segments, mode) {
  const f = mode === 'upper' ? (t) => t.toUpperCase() : mode === 'lower' ? (t) => t.toLowerCase() : mode === 'title' ? titleCase : (t) => t;
  return segments.map((s) => ({ ...s, words: s.words.map((w) => ({ ...w, text: f(w.text) })) }));
}

// ------------------------------------------------------------------ exports (one cue per line, the way the script shows)

const p = (n, w = 2) => String(n).padStart(w, '0');
const stamp = (ms, sep) => { const t = Math.max(0, Math.round(ms)); return `${p(Math.floor(t / 3600000))}:${p(Math.floor((t % 3600000) / 60000))}:${p(Math.floor((t % 60000) / 1000))}${sep}${p(t % 1000, 3)}`; };
const cueEnd = (s) => Math.max(segmentEnd(s), segmentStart(s) + 200);
const vttEscape = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const segmentsToSrt = (segments) => `${segments.map((s, i) => `${i + 1}\n${stamp(segmentStart(s), ',')} --> ${stamp(cueEnd(s), ',')}\n${segmentText(s)}`).join('\n\n')}${segments.length ? '\n' : ''}`;
export const segmentsToVtt = (segments) => `WEBVTT\n\n${segments.map((s, i) => `${i + 1}\n${stamp(segmentStart(s), '.')} --> ${stamp(cueEnd(s), '.')}\n${vttEscape(segmentText(s))}`).join('\n\n')}${segments.length ? '\n' : ''}`;
/** Plain text, one line per script line. */
export const segmentsToTxt = (segments) => `${segments.map(segmentText).join('\n')}${segments.length ? '\n' : ''}`;

/** "00:04.28" (minutes:seconds.hundredths) for the line cards. */
export const clock = (ms) => { const t = Math.max(0, Math.round(ms)); return `${p(Math.floor(t / 60000))}:${p(Math.floor((t % 60000) / 1000))}.${p(Math.floor((t % 1000) / 10))}`; };
export const lineLabel = (s) => `${clock(segmentStart(s))} - ${clock(segmentEnd(s))}`;
