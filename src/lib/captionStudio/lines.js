/**
 * Line-level editing over word-level captions. Whisper returns one caption per word; people edit whole lines. A "line" is
 * what the viewer sees at once (a caption page), and editing it keeps each word's timing where the word count is unchanged.
 */
import { captionPages, sortCaptions, normalizeCaption } from './model.js';

/** @returns {{ from: number, to: number, startMs: number, endMs: number, text: string }[]}  from/to index the sorted captions, `to` exclusive */
export function captionLines(captions, style = {}) {
  const sorted = sortCaptions(captions);
  let at = 0;
  return captionPages(sorted, style).map((p) => {
    const from = at;
    at += p.tokens.length;
    return { from, to: at, startMs: p.startMs, endMs: sorted[at - 1]?.endMs ?? p.startMs + p.durationMs, text: p.text.trim() };
  });
}

/** Replace a line's text. Same word count → words keep their timing; otherwise words are spread over the line by length. */
export function setLineText(captions, line, text) {
  const sorted = sortCaptions(captions);
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return removeLine(sorted, line);
  const slice = sorted.slice(line.from, line.to);
  const lead = (i) => (line.from + i === 0 ? '' : ' ');
  let next;
  if (words.length === slice.length) {
    next = slice.map((c, i) => normalizeCaption({ ...c, text: lead(i) + words[i] }));
  } else {
    const start = slice[0]?.startMs ?? line.startMs;
    const end = slice.length ? slice[slice.length - 1].endMs : line.endMs;
    const total = words.reduce((n, w) => n + w.length + 1, 0);
    let t = start;
    next = words.map((w, i) => {
      const dur = Math.max(30, Math.round(((end - start) * (w.length + 1)) / total));
      const c = normalizeCaption({ text: lead(i) + w, startMs: t, endMs: i === words.length - 1 ? Math.max(end, t + 30) : t + dur });
      t = c.endMs;
      return c;
    });
  }
  return [...sorted.slice(0, line.from), ...next, ...sorted.slice(line.to)];
}

export function removeLine(captions, line) {
  const sorted = sortCaptions(captions);
  return [...sorted.slice(0, line.from), ...sorted.slice(line.to)];
}

/** Retime a whole line (all its words scaled into the new range). */
export function setLineTiming(captions, line, startMs, endMs) {
  const sorted = sortCaptions(captions);
  const slice = sorted.slice(line.from, line.to);
  if (!slice.length) return sorted;
  const s0 = slice[0].startMs;
  const span = Math.max(1, slice[slice.length - 1].endMs - s0);
  const newSpan = Math.max(slice.length * 30, endMs - startMs);
  const moved = slice.map((c) => normalizeCaption({
    ...c, timestampMs: null,
    startMs: startMs + ((c.startMs - s0) / span) * newSpan,
    endMs: startMs + ((c.endMs - s0) / span) * newSpan,
  }));
  return [...sorted.slice(0, line.from), ...moved, ...sorted.slice(line.to)];
}

/** Shift one line earlier/later (e.g. ±100 ms nudge buttons). */
export function nudgeLine(captions, line, deltaMs) {
  return setLineTiming(captions, line, Math.max(0, line.startMs + deltaMs), Math.max(30, line.endMs + deltaMs));
}

/** Find & replace over the transcript. Matches are found per line, so a phrase that spans two words still matches. */
export function findReplace(captions, find, replace = '', { matchCase = false } = {}) {
  const needle = String(find || '');
  let out = sortCaptions(captions);
  if (!needle) return { captions: out, count: 0 };
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
  let count = 0;
  const lines = captionLines(out, { combineMs: 2600 });
  // From the last line to the first so the indexes of earlier lines stay valid.
  for (let k = lines.length - 1; k >= 0; k -= 1) {
    const hits = lines[k].text.match(re);
    if (!hits) continue;
    count += hits.length;
    out = setLineText(out, lines[k], lines[k].text.replace(re, () => replace));
  }
  return { captions: out, count };
}

const titleCase = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
/** Change the case of every word: 'upper' | 'lower' | 'title'. Timing and leading spaces are kept. */
export function changeCase(captions, mode) {
  const fn = mode === 'upper' ? (t) => t.toUpperCase() : mode === 'lower' ? (t) => t.toLowerCase() : titleCase;
  return sortCaptions(captions).map((c) => normalizeCaption({ ...c, text: c.text.replace(/\S+/g, fn) }));
}

/** The whole transcript as plain text (for copy). */
export const captionsToPlain = (captions) => sortCaptions(captions).map((c) => c.text).join('').replace(/\s+/g, ' ').trim();
