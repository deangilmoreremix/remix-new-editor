// src/lib/outreach/editTools.js
//
// The Video Outreach editor's recipe (draft.edit) and how it becomes a video. Everything here is
// plain data and pure functions; the browser-only work (silence detection, background effects,
// picture tools, FFmpeg) is in mediaTools.js.
//
// The recipe is turned into the editor timeline's project format (tracks of clips), so it is
// previewed and rendered by the same Remotion composition as the main timeline editor
// (src/lib/editor/remotion/TimelineComposition.jsx): captions, text, lower thirds, logos, animated
// stickers, colour effects (@remotion/effects), transforms, transitions and music all export
// in the browser exactly as they preview.
//
// Two kinds of additions:
//   - burned in: rendered into the video by "Apply edits" (colour, captions, plain text, logos…)
//   - personal: anything that says {{firstname}}, {{company}}… or shows the prospect's website. These
//     are never burned in; they ride on the published campaign (personalTracks) and are filled in for
//     each prospect when their link plays.
import { buildSegments, keptRanges, normalizeCuts } from './videoEdit.jsx';
// Registers the overlay add-ons (text, image, sticker, lower third, transitions) the timeline renderer looks up.
import '../editor/addons/index.js';

const round = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const ASPECTS = [['auto', 'Same as recording'], ['16:9', 'Landscape 16:9'], ['1:1', 'Square 1:1'], ['9:16', 'Vertical 9:16']];
export const CAPTION_STYLES = [['classic', 'Classic subtitles'], ['tiktok', 'Word highlight'], ['box', 'Boxed words'], ['karaoke', 'Karaoke'], ['minimal', 'Minimal']];
export const TRANSITIONS = [['none', 'None'], ['fade', 'Fade'], ['slide', 'Slide'], ['wipeLeft', 'Wipe'], ['CrossZoom', 'Zoom'], ['dissolve', 'Dissolve']];
export const QUALITY = [['small', 'Small file', 1_500_000], ['standard', 'Standard', 0], ['high', 'High quality', 8_000_000]];
// Animated stickers (Lottie), from the editor's animated emoji set (public/assets/sticker/animated-emoji).
export const STICKERS = ['wave', 'thumbs up', 'clap', 'rocket', 'fire', 'party popper', 'red heart', 'check mark', 'light bulb', 'trophy', 'eyes', 'sparkles', 'hundred', 'raised hands', 'star struck', 'sunglasses']
  .map((name) => ({ name, src: `/assets/sticker/animated-emoji/${name.replace(/ /g, '-')}.json` }));
export const LOWER_THIRD_TEMPLATE = 'classic-bar';

export const LOOK = Object.freeze({ aspect: 'auto', rotate: 0, flipH: false, flipV: false, zoom: 1, brightness: 0, contrast: 1, saturation: 1, warmth: 0, vignette: 0 });
export const AUDIO = Object.freeze({ volume: 1, louder: false, music: null });
export const CAPTIONS = Object.freeze({ burn: false, preset: 'classic', position: 'bottom', color: '#FFFFFF', size: 5.5 });
export const BACKGROUND = Object.freeze({ mode: 'none', blur: 0.6, image: 'office', color: '#20232a' });

/** A fresh recipe. before/after clips are local files, kept for this session only. */
export function blankEdit() {
  return {
    trimStart: 0, trimEnd: null, cuts: [], before: null, after: null,
    look: { ...LOOK }, audio: { ...AUDIO }, captions: { ...CAPTIONS }, background: { ...BACKGROUND },
    overlays: [], broll: [], transition: 'none', quality: 'standard', v: 2,
  };
}

const okUrl = (u) => /^(https:\/\/|blob:|data:image\/|\/)/.test(String(u || ''));

/** A saved or partial recipe with every field valid (older drafts had only trim/cuts). */
export function normalizeEdit(e = {}) {
  const b = blankEdit();
  const look = { ...b.look, ...(e.look || {}) };
  // Recipes before "Same as recording" saved 16:9 as the default: they mean the recording's own shape.
  if (!e.v && look.aspect === '16:9') look.aspect = 'auto';
  return {
    ...b,
    trimStart: clamp(e.trimStart, 0, 1e6, 0),
    trimEnd: e.trimEnd == null ? null : clamp(e.trimEnd, 0, 1e6, null),
    cuts: Array.isArray(e.cuts) ? e.cuts.filter((c) => Array.isArray(c) && c.length === 2).map(([a, z]) => [Number(a), Number(z)]) : [],
    before: e.before || null,
    after: e.after || null,
    look: {
      aspect: ASPECTS.some(([k]) => k === look.aspect) ? look.aspect : 'auto',
      rotate: [0, 90, 180, 270].includes(Number(look.rotate)) ? Number(look.rotate) : 0,
      flipH: !!look.flipH, flipV: !!look.flipV,
      zoom: clamp(look.zoom, 1, 3, 1),
      brightness: clamp(look.brightness, -1, 1, 0),
      contrast: clamp(look.contrast, 0.5, 1.5, 1),
      saturation: clamp(look.saturation, 0, 2, 1),
      warmth: clamp(look.warmth, -1, 1, 0),
      vignette: clamp(look.vignette, 0, 1, 0),
    },
    audio: {
      volume: clamp(e.audio?.volume, 0, 1, 1),
      louder: !!e.audio?.louder,
      music: e.audio?.music && okUrl(e.audio.music.src) ? { src: e.audio.music.src, name: String(e.audio.music.name || 'Music').slice(0, 80), volume: clamp(e.audio.music.volume, 0, 1, 0.15), duration: clamp(e.audio.music.duration, 0, 1e5, 0) } : null,
    },
    captions: { ...b.captions, ...(e.captions || {}), burn: !!e.captions?.burn, size: clamp(e.captions?.size, 2, 12, 5.5) },
    background: { ...b.background, ...(e.background || {}) },
    overlays: Array.isArray(e.overlays) ? e.overlays.filter((o) => o && o.id && o.kind) : [],
    broll: Array.isArray(e.broll) ? e.broll.filter((o) => o && o.id && (o.src || o.kind === 'website')) : [],
    transition: TRANSITIONS.some(([k]) => k === e.transition) ? e.transition : 'none',
    quality: QUALITY.some(([k]) => k === e.quality) ? e.quality : 'standard',
    v: 2,
  };
}

/** Is this addition filled in per prospect (so it must not be burned into the video)? */
export const isPersonal = (o) => o?.kind === 'website' || /\{\{\s*\w+\s*\}\}/.test(`${o?.text || ''} ${o?.title || ''}`);

const lookChanged = (l) => Object.keys(LOOK).some((k) => l[k] !== LOOK[k]);

/** Does "Apply edits" have anything to render? */
export function hasRenderableEdits(edit, main) {
  const e = normalizeEdit(edit);
  const segs = buildSegments({ main, edits: e, before: e.before, after: e.after });
  const cut = !(segs.length === 1 && segs[0].src === main.src && segs[0].from === 0 && Math.abs(segs[0].to - main.duration) < 0.05);
  return cut || lookChanged(e.look) || e.background.mode !== 'none' || e.captions.burn || e.audio.volume !== 1 || e.audio.louder || !!e.audio.music
    || e.overlays.some((o) => !isPersonal(o)) || e.broll.some((o) => !isPersonal(o)) || e.quality !== 'standard';
}

// ---------------------------------------------------------------- silences, captions, chapters

/**
 * Silent stretches → cuts. Keeps `pad` seconds of air either side so speech isn't clipped, drops
 * silences shorter than `minSec`, and leaves the opening pause alone (`keepStart`: the AI greeting
 * plays there).
 */
export function silencesToCuts(silences = [], { pad = 0.15, minSec = 0.7, keepStart = 0, duration = Infinity } = {}) {
  return normalizeCuts(silences
    .filter((s) => s.end - s.start >= minSec)
    .map((s) => [round(Math.max(s.start + pad, keepStart)), round(Math.min(s.end - pad, duration))])
    .filter(([a, b]) => b - a >= 0.2), duration);
}

/** Where a moment of the main video lands in the edited video (seconds), or null when it was cut. */
export function toOutputTime(t, segs, mainSrc) {
  let at = 0;
  for (const s of segs) {
    if (s.src === mainSrc && t >= s.from && t < s.to) return round(at + (t - s.from));
    at += s.to - s.from;
  }
  return null;
}

/** Transcript lines (times in the main video) → lines in the edited video; lines inside a cut are dropped. */
export function remapLines(lines = [], segs, mainSrc) {
  const out = [];
  for (const l of lines) {
    const a = toOutputTime(l.startMs / 1000, segs, mainSrc);
    const zIn = toOutputTime(Math.max(l.startMs, l.endMs - 1) / 1000, segs, mainSrc);
    const z = zIn == null ? null : zIn + 0.001;
    if (a == null && z == null) continue;
    const start = a ?? Math.max(0, z - (l.endMs - l.startMs) / 1000);
    const end = z != null && z >= start ? z : start + (l.endMs - l.startMs) / 1000;
    out.push({ ...l, startMs: Math.round(start * 1000), endMs: Math.round(end * 1000) });
  }
  return out;
}

/** Caption lines → word captions (word times spread over the line by length), for burned-in captions. */
export function linesToWords(lines = []) {
  const words = [];
  for (const l of lines) {
    const parts = String(l.text || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const total = parts.reduce((n, w) => n + w.length + 1, 0);
    let at = l.startMs;
    const span = Math.max(1, l.endMs - l.startMs);
    parts.forEach((w, i) => {
      const len = Math.round(span * ((w.length + 1) / total));
      words.push({ text: `${i ? ' ' : ''}${w}`, startMs: Math.round(at), endMs: Math.round(i === parts.length - 1 ? l.endMs : at + len), timestampMs: Math.round(at), confidence: 1 });
      at += len;
    });
  }
  return words;
}

/**
 * Chapters from the transcript: a new chapter starts after a pause of `gapMs` once the current one is
 * at least `minSec` long; at most `max`. Titles are the first words of the chapter (editable).
 */
export function chaptersFromLines(lines = [], { gapMs = 1200, minSec = 15, max = 8 } = {}) {
  const sorted = [...lines].sort((a, b) => a.startMs - b.startMs);
  if (!sorted.length) return [];
  const title = (t) => { const w = String(t || '').replace(/[.!?,;:]+$/, '').split(/\s+/).slice(0, 6).join(' '); return w.charAt(0).toUpperCase() + w.slice(1); };
  const out = [{ startMs: 0, title: title(sorted[0].text) || 'Intro' }];
  for (let i = 1; i < sorted.length && out.length < max; i += 1) {
    const gap = sorted[i].startMs - sorted[i - 1].endMs;
    if (gap >= gapMs && sorted[i].startMs - out[out.length - 1].startMs >= minSec * 1000) out.push({ startMs: sorted[i].startMs, title: title(sorted[i].text) });
  }
  return out.length > 1 ? out : [];
}

// ---------------------------------------------------------------- overlays

/** A new addition with sensible placement. kind: text | lower | logo | image | sticker. */
export function newOverlay(kind, { start = 0, end = 5, ...rest } = {}) {
  const base = { id: uid('ov'), kind, start: round(start), end: round(Math.max(start + 0.5, end)) };
  if (kind === 'text') return { ...base, text: 'Your text', color: '#FFFFFF', size: 5, background: true, left: 15, top: 11, width: 70, height: 12, ...rest };
  // Lottie strap drawn at 1000×250: height is 4/9 of its width in a 16:9 frame (it keeps its own ratio).
  if (kind === 'lower') return { ...base, text: 'Your name', title: 'Your job title', color: '#d9ff00', left: 3, top: 54, width: 40, height: 17.8, ...rest };
  if (kind === 'logo') return { ...base, src: '', left: 82, top: 5, width: 14, height: 14, ...rest };
  if (kind === 'image') return { ...base, src: '', left: 60, top: 10, width: 35, height: 35, ...rest };
  if (kind === 'sticker') return { ...base, src: STICKERS[0].src, name: STICKERS[0].name, left: 78, top: 60, width: 16, height: 16, ...rest };
  throw new Error(`Unknown addition: ${kind}`);
}

/** A B-roll piece: full screen or picture-in-picture, a clip, a picture, or the prospect's website. */
export function newBroll(kind, { start = 0, end = 4, src = '', name = '', mode = 'full' } = {}) {
  return { id: uid('br'), kind, src, name, mode, start: round(start), end: round(Math.max(start + 0.5, end)) };
}

const geometry = (o) => ({ left: clamp(o.left, -50, 150, 0), top: clamp(o.top, -50, 150, 0), width: clamp(o.width, 1, 200, 20), height: clamp(o.height, 1, 200, 20) });
const ANIM = { in: 'fadeInUp', idle: null, out: 'fadeOut' };

/** One addition → a timeline clip (the editor's overlay add-ons). */
export function overlayClip(o) {
  const at = { id: o.id, start: o.start, end: o.end };
  if (o.kind === 'text') {
    return {
 ...at, type: 'overlay-text', addon: {
      text: String(o.text || ''), position: 'custom', alignment: 'center', fontFamily: 'Montserrat', fontSize: clamp(o.size, 2, 20, 5), fontColor: o.color || '#FFFFFF',
      fontDecorations: { bold: true, italics: false, responsive: true }, shadow: !o.background, shadowColor: '#000000', background: !!o.background, backgroundColor: 'rgba(0,0,0,0.55)',
      stroke: false, strokeColor: '#000000', rotation: 0, opacity: 100, blendMode: 'normal', geometry: geometry(o), animation: ANIM, linkMode: 'url', linkUrl: '', linkTarget: '_blank',
    } 
};
  }
  if (o.kind === 'lower') {
    return { ...at, type: 'overlay-lower-third', addon: { template: o.template || LOWER_THIRD_TEMPLATE, name: String(o.text || ''), title: String(o.title || ''), fontFamily: 'Montserrat', accentColor: o.color || '#d9ff00', barColor: '#0b0c10', textColor: '#FFFFFF', subTextColor: '#d6d6d6', geometry: geometry(o), opacity: 100, blendMode: 'normal' } };
  }
  if (o.kind === 'logo' || o.kind === 'image') {
    return { ...at, type: 'overlay-image', addon: { src: o.src, title: '', cornerRadius: o.kind === 'image', fill: false, rotation: 0, transition: 'popcorn-fade', geometry: geometry(o), opacity: 100, blendMode: 'normal', animation: { in: null, idle: null, out: null } } };
  }
  if (o.kind === 'sticker') {
    return { ...at, type: 'overlay-sticker', addon: { src: o.src, kind: /\.json$/i.test(o.src) ? 'lottie' : 'image', name: o.name || '', geometry: geometry(o), rotation: 0, opacity: 100, blendMode: 'normal' } };
  }
  return null;
}

export const PIP_SCALE = 0.34;
// Picture-in-picture corners as offsets of the centre (% of the frame); top right is kept for the player's labels.
export const PIP_SPOTS = [{ x: -30, y: -30 }, { x: 30, y: 30 }, { x: -30, y: 30 }, { x: -30, y: 5 }, { x: 30, y: 5 }, { x: 30, y: -24 }];

/** One B-roll piece → a clip on the B-roll track. `fallbackShot` stands in for a prospect without a website. */
export function brollClip(b, { fallbackShot = '' } = {}) {
  const spot = Number.isFinite(b.x) && Number.isFinite(b.y) ? { x: b.x, y: b.y } : PIP_SPOTS[0];
  const at = { id: b.id, start: b.start, end: b.end, ...(b.mode === 'pip' ? { transform: { ...spot, scale: PIP_SCALE, rotation: 0 } } : {}) };
  if (b.kind === 'website') return { ...at, type: 'image', src: '{{websiteShotUrl}}', fallbackSrc: fallbackShot || undefined, fit: 'cover', scroll: true, cursor: true };
  if (b.kind === 'image') return { ...at, type: 'image', src: b.src, fit: 'cover' };
  return { ...at, type: 'video', src: b.src, trimIn: 0, volume: 0, fit: 'cover' };
}

// ---------------------------------------------------------------- placement

// Where the watch page draws its own labels ("AI-generated voice"), and the captions bands.
export const LABEL_ZONE = { left: 76, top: 0, width: 24, height: 10 };
const CAPTION_ZONE = { bottom: { left: 4, top: 72, width: 92, height: 20 }, middle: { left: 4, top: 40, width: 92, height: 20 }, top: { left: 4, top: 0, width: 92, height: 20 } };
const MARGIN = 3;

/** The box an addition covers (% of the frame); null for full-screen B-roll (it is the picture). */
export function boxOf(item) {
  if (!item) return null;
  if (item.mode === 'full' && 'mode' in item) return null;
  if (item.mode === 'pip') {
    const s = PIP_SCALE * 100;
    const { x, y } = Number.isFinite(item.x) ? item : PIP_SPOTS[0];
    return { left: 50 + x - s / 2, top: 50 + y - s / 2, width: s, height: s };
  }
  return { left: item.left, top: item.top, width: item.width, height: item.height };
}

const meet = (a, b) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
const sameTime = (a, b) => a.start < b.end && b.start < a.end;

export function itemLabel(item) {
  if (!item) return '';
  if ('mode' in item) return item.kind === 'website' ? 'their website' : item.kind === 'video' ? 'a B-roll clip' : 'a B-roll picture';
  if (item.kind === 'text') return `the text “${String(item.text || '').slice(0, 24)}”`;
  return { lower: 'the name strap', logo: 'the logo', image: 'a picture', sticker: `the ${item.name || ''} sticker` }[item.kind] || 'another item';
}

/** What else is on screen while `item` shows: [{ label, box }]. */
function blockers(item, edit) {
  const e = edit;
  const out = [{ label: 'the player’s label (top right)', box: LABEL_ZONE }];
  if (e.captions?.burn) out.push({ label: 'the captions', box: CAPTION_ZONE[e.captions.position] || CAPTION_ZONE.bottom });
  [...(e.overlays || []), ...(e.broll || [])].forEach((o) => {
    if (o.id === item.id || !sameTime(o, item)) return;
    const box = boxOf(o);
    if (box) out.push({ label: itemLabel(o), box });
  });
  return out;
}

/** The things `item` covers (labels), for the card's warning. */
export function overlapsOf(item, edit) {
  const box = boxOf(item);
  if (!box) return [];
  const min = box.width * box.height * 0.04;
  return blockers(item, edit).filter((b) => meet(box, b.box) > min).map((b) => b.label);
}

function spots(item) {
  const w = item.width; const h = item.height;
  const centre = (100 - w) / 2;
  if ('mode' in item) return PIP_SPOTS.map((p) => ({ x: p.x, y: p.y }));
  // Texts start just under the player's label band, then step down (the captions band is below 72%).
  if (item.kind === 'text') return [11, 26, 41, 56].map((top) => ({ left: centre, top })).concat([{ left: MARGIN, top: 11 }, { left: 100 - w - MARGIN, top: 26 }]);
  if (item.kind === 'lower') return [54, 40, 22, 10].map((top) => ({ left: MARGIN, top }));
  // Logos, pictures, stickers: corners (top right sits below the player's label), then the sides.
  return [
    { left: MARGIN, top: MARGIN }, { left: 100 - w - MARGIN, top: 100 - h - 22 }, { left: MARGIN, top: 100 - h - 22 },
    { left: 100 - w - MARGIN, top: LABEL_ZONE.height + 2 }, { left: 100 - w - MARGIN, top: (100 - h) / 2 }, { left: MARGIN, top: (100 - h) / 2 },
  ];
}

/**
 * The item moved to the first spot where it covers nothing else on screen at the same time (other
 * additions, the website picture-in-picture, the captions, the player's label). With no free spot,
 * the one that covers least. Full-screen B-roll is left as it is.
 */
export function placeItem(item, edit) {
  if (item.mode === 'full') return item;
  const others = blockers(item, edit);
  let best = null;
  for (const spot of spots(item)) {
    const moved = { ...item, ...spot };
    const box = boxOf(moved);
    const hit = others.reduce((n, b) => n + meet(box, b.box), 0);
    if (!best || hit < best.hit) best = { moved, hit };
    if (hit === 0) break;
  }
  return { ...best.moved, ...('left' in best.moved ? { left: round(best.moved.left), top: round(best.moved.top) } : {}) };
}

/** "16:9", "1:1", "9:16", or for 'auto' the recording's own shape ("W:H"). */
export function resolveAspect(aspect, main = {}) {
  if (aspect !== 'auto') return aspect;
  const w = Math.round(Number(main.width)); const h = Math.round(Number(main.height));
  if (!(w > 0 && h > 0)) return '16:9';
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(w, h);
  return `${w / d}:${h / d}`;
}

// ---------------------------------------------------------------- the project

/** Colour, vignette (@remotion/effects) for the look. */
export function lookEffects(look) {
  const fx = [];
  if (look.brightness || look.contrast !== 1 || look.saturation !== 1 || look.warmth) {
    fx.push({ uid: 'fx-look', id: 'color-correction', enabled: true, params: { exposure: round(look.brightness), contrast: round(look.contrast), pivot: 0.5, shadows: 0, highlights: 0, whites: 0, blacks: 0, temperature: round(look.warmth), tint: 0, saturation: round(look.saturation), vibrance: 0 } });
  }
  if (look.vignette > 0) fx.push({ uid: 'fx-vignette', id: 'vignette', enabled: true, params: { amount: round(look.vignette), radius: 0.65, feather: 0.35, roundness: 1, color: '#000000', mode: 'color', center: [0.5, 0.5] } });
  return fx;
}

/** Rotation and zoom as a clip transform (rotating a side-on phone video scales it to fit). */
export function lookTransform(look, aspect = 16 / 9) {
  const quarter = look.rotate === 90 || look.rotate === 270;
  const scale = round((quarter ? Math.min(aspect, 1 / aspect) : 1) * look.zoom);
  return look.rotate || scale !== 1 ? { x: 0, y: 0, rotation: look.rotate, scale } : null;
}

const aspectRatio = (a) => { const [w, h] = String(a).split(':').map(Number); return w / h || 16 / 9; };

/**
 * The edit as a timeline project (what timelineToComposition reads), everything burned in.
 * @param o.main { src, duration, width?, height? }   the original recording (edits are always made from it)
 * @param o.lines  caption lines in the main video's time (draft.captions.lines), for burned-in captions
 * @returns {{ project, segs, seconds, aspect }}
 */
export function editProject({ main, edit, lines = [] }) {
  const e = normalizeEdit(edit);
  const segs = buildSegments({ main, edits: e, before: e.before, after: e.after });
  if (!segs.length) throw new Error('Nothing is left to keep. Undo a cut or the trim.');
  const fx = lookEffects(e.look);
  const aspect = resolveAspect(e.look.aspect, main);
  const transform = lookTransform(e.look, aspectRatio(aspect));
  const flip = { ...(e.look.flipH ? { flipH: true } : {}), ...(e.look.flipV ? { flipV: true } : {}) };
  let at = 0;
  const videoItems = segs.map((s, i) => {
    const len = s.to - s.from;
    // Same as recording: the frame is the recording's shape, so the whole picture fills it (clips before/after of
    // another shape fit inside). A chosen shape fills the frame, cropping the middle.
    const item = { id: `seg-${i}`, type: 'video', src: s.src, trimIn: s.from, start: round(at), end: round(at + len), volume: e.audio.volume, fit: e.look.aspect === 'auto' ? 'contain' : 'cover', effects: fx, ...flip, ...(transform ? { transform } : {}) };
    at += len;
    return item;
  });
  const seconds = round(at);
  const tracks = [{ id: 'track-main', type: 'video', name: 'Video', muted: false, solo: false, items: videoItems }];
  // Transitions where the pieces meet (half a second, centred on the join).
  if (e.transition !== 'none' && videoItems.length > 1) {
    tracks.push({
 id: 'track-transitions', type: 'video', name: 'Transitions', muted: true, solo: false,
      items: videoItems.slice(1).map((v, i) => ({ id: `tr-${i}`, type: 'overlay-video-transition', addon: { transition: e.transition }, start: round(Math.max(0, v.start - 0.25)), end: round(v.start + 0.25) })) 
});
  }
  const broll = e.broll.filter((b) => !isPersonal(b)).map((b) => brollClip(b)).filter((c) => c.start < seconds);
  if (broll.length) tracks.push({ id: 'track-broll', type: 'video', name: 'B-roll', muted: true, solo: false, items: broll });
  const overlays = e.overlays.filter((o) => !isPersonal(o)).map(overlayClip).filter(Boolean).filter((c) => c.start < seconds);
  if (overlays.length) tracks.push({ id: 'track-overlays', type: 'video', name: 'Text and graphics', muted: false, solo: false, items: overlays });
  if (e.captions.burn && lines.length) {
    const words = linesToWords(remapLines(lines, segs, main.src));
    if (words.length) {
      tracks.push({
 id: 'track-captions', type: 'video', name: 'Captions', muted: false, solo: false,
        items: [{ id: 'captions', type: 'captions', start: 0, end: seconds, captions: words, captionStyle: { preset: e.captions.preset, position: e.captions.position, color: e.captions.color, fontSize: e.captions.size } }] 
});
    }
  }
  if (e.audio.music?.src) {
    const len = e.audio.music.duration > 0 ? Math.min(seconds, e.audio.music.duration) : seconds;
    tracks.push({ id: 'track-music', type: 'audio', name: 'Music', muted: false, solo: false, items: [{ id: 'music', type: 'audio', src: e.audio.music.src, start: 0, end: round(len), volume: e.audio.music.volume }] });
  }
  return { project: { title: 'Outreach edit', timelineSeconds: seconds, tracks }, segs, seconds, aspect };
}

/**
 * The personal additions as tracks for the published campaign (positions as % of `T`, like every
 * campaign clip). Text with {{tokens}} is filled in, and website B-roll shows, per prospect.
 */
export function personalTracks(edit, T, { fallbackShot = '' } = {}) {
  const e = normalizeEdit(edit);
  const pct = (c) => { const { start, end, ...rest } = c; return { ...rest, left: (start / T) * 100, width: ((Math.min(end, T) - start) / T) * 100 }; };
  const tracks = [];
  const broll = e.broll.filter(isPersonal).filter((b) => b.start < T).map((b) => pct(brollClip(b, { fallbackShot })));
  if (broll.length) tracks.push({ id: 'track-personal-broll', type: 'video', name: 'Their website', muted: true, solo: false, items: broll });
  const overlays = e.overlays.filter(isPersonal).filter((o) => o.start < T).map((o) => pct(overlayClip(o)));
  if (overlays.length) tracks.push({ id: 'track-personal-text', type: 'video', name: 'Personal text', muted: false, solo: false, items: overlays });
  return tracks;
}

/** A key for the recipe as rendered: when it equals the last applied key, the video is up to date. */
export function recipeKey(edit, sourceUrl) {
  const e = normalizeEdit(edit);
  return JSON.stringify([sourceUrl, e.trimStart, e.trimEnd, e.cuts, e.look, e.audio, e.captions, e.background, e.overlays.filter((o) => !isPersonal(o)), e.broll.filter((o) => !isPersonal(o)), e.transition, e.quality, e.before?.src || null, e.after?.src || null]);
}

/** The background pass's cache key (the MediaPipe pass is redone only when these change). */
export const backgroundKey = (sourceUrl, b) => (b?.mode && b.mode !== 'none' ? JSON.stringify([sourceUrl, b.mode, b.blur, b.image, b.color]) : '');

export { keptRanges };
