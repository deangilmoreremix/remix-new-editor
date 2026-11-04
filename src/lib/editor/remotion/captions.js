/**
 * Captions for the timeline editor (@remotion/captions).
 *
 * A captions clip stores `clip.captions` as Remotion `Caption[]` with times
 * in milliseconds relative to the clip's own start, plus `clip.captionStyle`.
 * The composition groups them into pages (createTikTokStyleCaptions) and
 * renders them identically in the Player preview and the exported video.
 */
import { parseSrt, parseVtt, serializeSrt, createTikTokStyleCaptions } from '@remotion/captions';

export const CAPTION_PRESETS = {
  tiktok: { label: 'Word highlight', fontFamily: 'Montserrat', bold: true, uppercase: true, color: '#FFFFFF', highlightColor: '#FFE14D', stroke: true, background: false, combineMs: 900 },
  classic: { label: 'Classic subtitles', fontFamily: 'Inter', bold: false, uppercase: false, color: '#FFFFFF', highlightColor: '#FFFFFF', stroke: false, background: true, combineMs: 2600 },
  box: { label: 'Boxed words', fontFamily: 'Poppins', bold: true, uppercase: false, color: '#FFFFFF', highlightColor: '#EB5054', stroke: false, background: true, combineMs: 1200 },
  karaoke: { label: 'Karaoke', fontFamily: 'Anton', bold: false, uppercase: true, color: 'rgba(255,255,255,0.55)', highlightColor: '#FFFFFF', stroke: true, background: false, combineMs: 1600 },
  minimal: { label: 'Minimal', fontFamily: 'Inter', bold: false, uppercase: false, color: '#FFFFFF', highlightColor: '#FFFFFF', stroke: false, background: false, combineMs: 2000 },
};

export const CAPTION_POSITIONS = ['bottom', 'middle', 'top'];

export function defaultCaptionStyle(preset = 'tiktok') {
  const p = CAPTION_PRESETS[preset] || CAPTION_PRESETS.tiktok;
  const { label, ...rest } = p;
  return { preset: CAPTION_PRESETS[preset] ? preset : 'tiktok', ...rest, fontSize: 6, position: 'bottom', backgroundColor: 'rgba(0,0,0,0.6)', highlightActive: preset !== 'classic' && preset !== 'minimal' };
}

const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);

/** Normalise any caption-like object into a valid Remotion Caption. */
export function normalizeCaption(c) {
  const startMs = Math.max(0, Math.round(num(c.startMs)));
  const endMs = Math.max(startMs + 1, Math.round(num(c.endMs, startMs + 500)));
  return {
    text: String(c.text ?? ''),
    startMs,
    endMs,
    timestampMs: c.timestampMs == null ? Math.round((startMs + endMs) / 2) : Math.round(num(c.timestampMs)),
    confidence: c.confidence == null ? null : num(c.confidence),
  };
}

export const sortCaptions = (list) => (list || []).map(normalizeCaption).sort((a, b) => a.startMs - b.startMs);

/**
 * Word-level captions from transcription chunks
 * ([{ text, timestamp: [startSec, endSec] }]), keeping Remotion's
 * convention of a leading space on every word but the first.
 */
export function chunksToCaptions(chunks = [], { offsetSec = 0 } = {}) {
  const out = [];
  chunks.forEach((ch) => {
    const text = String(ch.text ?? '').trim();
    if (!text) return;
    const [s, e] = Array.isArray(ch.timestamp) ? ch.timestamp : [ch.start, ch.end];
    const start = num(s) - offsetSec;
    const end = (e == null ? num(s) + 0.3 : num(e)) - offsetSec;
    if (end <= 0) return;
    out.push(normalizeCaption({ text: (out.length ? ' ' : '') + text, startMs: Math.max(0, start) * 1000, endMs: Math.max(0.05, end) * 1000, confidence: ch.confidence ?? null }));
  });
  return out;
}

// ------------------------------------------------------------------ import / export

export function captionsFromFile(text, fileName = '') {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const isVtt = /\.vtt$/i.test(fileName) || /^WEBVTT/.test(src.trim());
  const { captions } = isVtt ? parseVtt({ input: src }) : parseSrt({ input: src });
  return sortCaptions(captions);
}

/** One SRT cue per page (the way they're shown), or per caption. */
export function captionsToSrt(captions, { combineMs } = {}) {
  const sorted = sortCaptions(captions);
  if (!combineMs) return serializeSrt({ lines: sorted.map((c) => [{ ...c, text: c.text.trim() }]) });
  return serializeSrt({ lines: groupLines(sorted, combineMs) });
}

function groupLines(sorted, combineMs) {
  const { pages } = createTikTokStyleCaptions({ captions: sorted, combineTokensWithinMilliseconds: combineMs });
  return pages.map((p) => [{ text: p.text.trim(), startMs: p.startMs, endMs: p.startMs + p.durationMs, timestampMs: null, confidence: null }]);
}

const vttTime = (ms) => {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const r = t % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};

export function captionsToVtt(captions, { combineMs } = {}) {
  const sorted = sortCaptions(captions);
  const cues = combineMs ? groupLines(sorted, combineMs).map((l) => l[0]) : sorted;
  return `WEBVTT\n\n${cues.map((c) => `${vttTime(c.startMs)} --> ${vttTime(c.endMs)}\n${c.text.trim()}`).join('\n\n')}\n`;
}

// ------------------------------------------------------------------ editing

/** Split a caption at its middle word boundary (or in half by time). */
export function splitCaption(captions, index) {
  const list = sortCaptions(captions);
  const c = list[index];
  if (!c) return list;
  const words = c.text.trim().split(/\s+/);
  const lead = c.text.startsWith(' ') ? ' ' : '';
  const cut = Math.max(1, Math.floor(words.length / 2));
  const mid = Math.round(c.startMs + (c.endMs - c.startMs) * (words.length > 1 ? cut / words.length : 0.5));
  const a = normalizeCaption({ text: lead + (words.length > 1 ? words.slice(0, cut).join(' ') : c.text.trim()), startMs: c.startMs, endMs: mid, confidence: c.confidence });
  const b = normalizeCaption({ text: ' ' + (words.length > 1 ? words.slice(cut).join(' ') : ''), startMs: mid, endMs: c.endMs, confidence: c.confidence });
  list.splice(index, 1, a, ...(b.text.trim() ? [b] : []));
  return list;
}

/** Merge caption `index` with the next one. */
export function mergeCaptions(captions, index) {
  const list = sortCaptions(captions);
  const a = list[index];
  const b = list[index + 1];
  if (!a || !b) return list;
  list.splice(index, 2, normalizeCaption({ text: `${a.text.replace(/\s+$/, '')} ${b.text.trim()}`, startMs: a.startMs, endMs: Math.max(a.endMs, b.endMs), confidence: a.confidence }));
  return list;
}

export function shiftCaptions(captions, deltaMs) {
  return sortCaptions(captions).map((c) => normalizeCaption({ ...c, startMs: c.startMs + deltaMs, endMs: c.endMs + deltaMs, timestampMs: null }))
    .filter((c) => c.endMs > 0);
}

// ------------------------------------------------------------------ rendering helpers

export function captionPages(captions, style = {}) {
  const sorted = sortCaptions(captions);
  if (!sorted.length) return [];
  // Word-level captions are grouped into pages; sentence-level ones (from
  // SRT/VTT or typed in) are one page each.
  const prepared = sorted.map((c, i) => {
    const sentence = /\S\s+\S/.test(c.text.trim());
    const text = i === 0 ? c.text : (c.text.startsWith(' ') ? c.text : ` ${c.text}`);
    return sentence ? { ...c, text, pageBreakAfter: true } : { ...c, text };
  });
  // A sentence must also start its own page.
  prepared.forEach((c, i) => { if (c.pageBreakAfter && i > 0) prepared[i - 1].pageBreakAfter = true; });
  return createTikTokStyleCaptions({ captions: prepared, combineTokensWithinMilliseconds: Math.max(100, num(style.combineMs, 900)) }).pages;
}

/** The page showing at `ms` (relative to the clip start), or null. */
export function pageAt(pages, ms, holdMs = 600) {
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const p = pages[i];
    if (ms >= p.startMs) {
      const lastToken = p.tokens.length ? p.tokens[p.tokens.length - 1].toMs : p.startMs;
      const end = Math.min(p.startMs + p.durationMs, lastToken + holdMs);
      return ms < Math.max(end, lastToken) ? p : null;
    }
  }
  return null;
}

/** Captions → the editor's subtitle lines (seconds, absolute) for legacy consumers. */
export const captionsToLines = (captions, clipStartSec = 0) => sortCaptions(captions)
  .map((c) => ({ text: c.text.trim(), start: clipStartSec + c.startMs / 1000, end: clipStartSec + c.endMs / 1000 }));
