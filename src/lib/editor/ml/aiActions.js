/**
 * Timeline actions for the free, in-browser AI features. Used by the clip
 * editor's "Free AI" section, the Local AI panel and the Video Agent tools.
 *
 * `editor` is the page's contract (see TimelineEditorPage.jsx localAIEditor()):
 *   timelineSeconds(), playheadSec(), clipStart(clip), clipDuration(clip),
 *   setClipTimes(clip, start, end), allClips(), assets(), getClip(id),
 *   trackOf(clip), ensureTrack(name, type), insertClip(clip, trackName),
 *   addToTrack(track, clip), removeClip(id), mediaSrc(clip), setMediaSrc(clip, url),
 *   snapshot(), commit(), refresh(clipId), storeBlob(blob, name) → url,
 *   growTimeline(sec), toast(msg, type)
 */
import * as ai from './localAI.js';
import { grabFrame, clipSourceIn, clipSpeed } from './frameGrab.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const fileName = (clip, suffix, ext) => `${String(clip?.name || 'clip').replace(/[^\w-]+/g, '_').slice(0, 40)}-${suffix}.${ext}`;

export const VISUAL_TYPES = new Set(['video', 'image', 'overlay-image']);
export const isVisual = (clip) => VISUAL_TYPES.has(clip?.type);
export const isImageClip = (clip) => clip?.type === 'image' || clip?.type === 'overlay-image';
export const hasAudio = (clip) => clip?.type === 'video' || clip?.type === 'audio';

/** Source range (seconds in the media file) that the clip shows. */
export function sourceRange(editor, clip) {
  const fromSec = clipSourceIn(clip);
  return { fromSec, toSec: fromSec + editor.clipDuration(clip) * clipSpeed(clip) };
}

/** Frame of a clip at the playhead (or its middle when the playhead is outside it). */
export async function frameAtPlayhead(editor, clip, { maxSize = 1024, signal } = {}) {
  const src = editor.mediaSrc(clip);
  if (!src) throw new Error('This clip has no media yet');
  if (isImageClip(clip)) return grabFrame(src, 0, { maxSize, image: true, signal });
  const start = editor.clipStart(clip);
  const dur = editor.clipDuration(clip);
  const ph = editor.playheadSec();
  const local = ph >= start && ph <= start + dur ? ph - start : dur / 2;
  return grabFrame(src, clipSourceIn(clip) + local * clipSpeed(clip), { maxSize, signal });
}

/**
 * Replace a clip's media with a processed file, keeping the original so the
 * change can be undone from the panel (and with Undo).
 */
export async function replaceMedia(editor, clip, blob, { op, ext, resetTrim = false, message }) {
  const url = await editor.storeBlob(blob, fileName(clip, op, ext));
  editor.snapshot();
  const prev = clip.localAI?.originalSrc ? clip.localAI : null;
  clip.localAI = {
    op,
    originalSrc: prev?.originalSrc ?? editor.mediaSrc(clip),
    originalTrimIn: prev ? prev.originalTrimIn : (clip.trimIn ?? null),
    originalType: prev?.originalType ?? clip.type,
    at: new Date().toISOString(),
  };
  editor.setMediaSrc(clip, url);
  if (resetTrim) clip.trimIn = 0;
  editor.commit();
  editor.refresh?.(clip.id);
  if (message) editor.toast(message, 'success');
  return url;
}

/** Put back the media a local-AI action replaced. */
export function restoreMedia(editor, clip) {
  const info = clip?.localAI;
  if (!info?.originalSrc) return false;
  editor.snapshot();
  editor.setMediaSrc(clip, info.originalSrc);
  if (info.originalTrimIn !== undefined) clip.trimIn = info.originalTrimIn ?? clip.trimIn;
  if (info.originalType && info.originalType !== clip.type) clip.type = info.originalType;
  delete clip.localAI;
  editor.commit();
  editor.refresh?.(clip.id);
  editor.toast('Original restored', 'success');
  return true;
}

// ---------------------------------------------------------------- masking

/**
 * Mask an object. prompt: { points: [[x,y]...] (frame px), labels, box: [x1,y1,x2,y2] } or { query }.
 * mode: 'cutout' (replace media with the object only) | 'mask' (store a mask PNG on the clip).
 * For videos, 'cutout' follows the object through the clip.
 */
export async function maskObject(editor, clip, { prompt = {}, mode = 'cutout', frame, onProgress, signal } = {}) {
  const canvas = frame || await frameAtPlayhead(editor, clip, { signal });
  let res;
  if (prompt.query) {
    res = await ai.maskFromText(canvas, prompt.query, { onProgress, signal });
    if (!res?.alpha) throw new Error(`Couldn't find "${prompt.query}" in this frame`);
  } else {
    if (!prompt.points?.length && !prompt.box) throw new Error('Click the object (or drag a box around it) first');
    res = await ai.maskFromPrompt(canvas, { points: prompt.points, labels: prompt.labels, box: prompt.box, onProgress, signal });
  }
  if (!res?.bbox) throw new Error('No object was found there — try clicking its centre');

  if (mode === 'mask') {
    const png = await ai.alphaToMaskPng(res.alpha, res.width, res.height);
    const url = await editor.storeBlob(png, fileName(clip, 'mask', 'png'));
    editor.snapshot();
    clip.metadata = { ...(clip.metadata || {}), maskUrl: url, maskSource: 'local-sam' };
    editor.commit();
    editor.toast('Mask saved on the clip', 'success');
    return { maskUrl: url, score: res.score };
  }

  if (isImageClip(clip)) {
    const png = await ai.cutoutPng(canvas, res.alpha);
    await replaceMedia(editor, clip, png, { op: 'object-cutout', ext: 'png', message: 'Object cut out' });
    return { score: res.score };
  }

  // Video: follow the object from the clicked frame's bounding box.
  const { fromSec, toSec } = sourceRange(editor, clip);
  const [x1, y1, x2, y2] = res.bbox;
  const boxNorm = [x1 / res.width, y1 / res.height, x2 / res.width, y2 / res.height];
  const webm = await ai.maskWholeClip(editor.mediaSrc(clip), { fromSec, toSec, boxNorm, every: 2, maxSize: 960, onProgress, signal });
  await replaceMedia(editor, clip, webm, { op: 'object-cutout', ext: 'webm', resetTrim: true, message: 'Object cut out of the whole clip' });
  return { score: res.score };
}

// ---------------------------------------------------------------- describe

export async function describeClip(editor, clip, { detail = 'more', onProgress, signal } = {}) {
  const canvas = await frameAtPlayhead(editor, clip, { maxSize: 768, signal });
  const text = await ai.describeCanvas(canvas, { detail, onProgress, signal });
  clip.metadata = { ...(clip.metadata || {}), description: text };
  return text;
}

// ---------------------------------------------------------------- depth

export async function depthBlur(editor, clip, { focus = 0.55, radius = 10, onProgress, signal } = {}) {
  const src = editor.mediaSrc(clip);
  if (isImageClip(clip)) {
    const png = await ai.depthBlurImage(src, { focus, radius, onProgress, signal });
    return replaceMedia(editor, clip, png, { op: 'depth-blur', ext: 'png', message: 'Background blurred' });
  }
  const { fromSec, toSec } = sourceRange(editor, clip);
  const webm = await ai.depthBlurVideo(src, { fromSec, toSec, focus, radius, onProgress, signal });
  return replaceMedia(editor, clip, webm, { op: 'depth-blur', ext: 'webm', resetTrim: true, message: 'Background blurred' });
}

/** Turn an image clip into a short 2.5D parallax video clip. */
export async function parallax(editor, clip, { style = 'orbit', amount = 24, onProgress, signal } = {}) {
  if (!isImageClip(clip) || clip.type !== 'image') throw new Error('Parallax works on image clips');
  const seconds = Math.max(1, Math.min(20, editor.clipDuration(clip) || 5));
  const webm = await ai.parallaxFromImage(editor.mediaSrc(clip), { seconds, style, amount, onProgress, signal });
  await replaceMedia(editor, clip, webm, { op: 'parallax', ext: 'webm', resetTrim: true, message: '3D parallax added' });
  clip.type = 'video';
  clip.volume = 0;
  editor.commit();
  editor.refresh?.(clip.id);
}

// ---------------------------------------------------------------- upscale

export async function upscale(editor, clip, { onProgress, signal } = {}) {
  if (!isImageClip(clip)) throw new Error('Free upscaling works on images. For video, use MuAPI upscaling.');
  const png = await ai.upscaleImage(editor.mediaSrc(clip), { onProgress, signal });
  return replaceMedia(editor, clip, png, { op: 'upscale-2x', ext: 'png', message: 'Image upscaled 2×' });
}

// ---------------------------------------------------------------- audio

export async function analyzeClipAudio(editor, clip, { onProgress, signal } = {}) {
  if (!hasAudio(clip)) throw new Error('This clip has no audio');
  const { fromSec, toSec } = sourceRange(editor, clip);
  const windows = await ai.analyzeAudio(editor.mediaSrc(clip), { fromSec, toSec, onProgress, signal });
  const speed = clipSpeed(clip);
  const regions = windows.map((w) => ({ ...w, start: w.start / speed, end: w.end / speed }));
  clip.metadata = { ...(clip.metadata || {}), audioLabels: regions.map(({ start, end, label, score }) => ({ start, end, label, score })) };
  let mood = null;
  if (clip.role === 'music' || regions.filter((r) => r.label === 'music').length > regions.length / 2) {
    mood = await ai.musicMood(editor.mediaSrc(clip), { fromSec, toSec, signal }).catch(() => null);
    if (mood) clip.metadata.mood = mood;
  }
  editor.commit();
  return { regions, mood };
}

/**
 * Kept (non-silent) ranges in clip-local seconds, merging tiny gaps and
 * leaving `pad` seconds of air around speech.
 */
export function keptRanges(silences, clipDuration, { pad = 0.12, minKeep = 0.25 } = {}) {
  const cuts = silences
    .map((s) => ({ start: s.start + pad, end: s.end - pad }))
    .filter((s) => s.end - s.start > 0.05)
    .sort((a, b) => a.start - b.start);
  const keep = [];
  let t = 0;
  for (const c of cuts) {
    if (c.start > t) keep.push({ start: t, end: Math.min(c.start, clipDuration) });
    t = Math.max(t, c.end);
  }
  if (t < clipDuration) keep.push({ start: t, end: clipDuration });
  return keep.filter((k) => k.end - k.start >= minKeep);
}

/**
 * Cut the silent parts out of a clip and close the gaps (ripple).
 * Later clips on the same track move left by the time removed.
 */
export async function removeSilences(editor, clip, { thresholdDb = -42, minSec = 0.6, signal } = {}) {
  if (!hasAudio(clip)) throw new Error('This clip has no audio');
  const { fromSec, toSec } = sourceRange(editor, clip);
  const speed = clipSpeed(clip);
  const silences = (await ai.detectSilences(editor.mediaSrc(clip), { fromSec, toSec, thresholdDb, minSec, signal }))
    .map((s) => ({ start: s.start / speed, end: s.end / speed }));
  const dur = editor.clipDuration(clip);
  const keep = keptRanges(silences, dur);
  const removed = dur - keep.reduce((a, k) => a + (k.end - k.start), 0);
  if (!silences.length || removed < 0.2) {
    editor.toast('No silences long enough to remove', 'info');
    return { removedSec: 0, pieces: 1 };
  }
  const track = editor.trackOf(clip);
  const start = editor.clipStart(clip);
  const baseIn = clipSourceIn(clip);
  editor.snapshot();
  const later = (track?.items || []).filter((c) => c.id !== clip.id && editor.clipStart(c) >= start + dur - 0.001);
  editor.removeClip(clip.id);
  let cursor = start;
  keep.forEach((k, i) => {
    const piece = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `${clip.id}-k${i}-${Date.now().toString(36)}`,
      name: `${clip.name || 'Clip'} (${i + 1}/${keep.length})`,
      trimIn: baseIn + k.start * speed,
    };
    delete piece.keyframes; // keyframe times no longer line up after cutting
    editor.setClipTimes(piece, cursor, cursor + (k.end - k.start));
    editor.addToTrack(track, piece);
    cursor += k.end - k.start;
  });
  later.forEach((c) => {
    const s = editor.clipStart(c);
    editor.setClipTimes(c, s - removed, s - removed + editor.clipDuration(c));
  });
  editor.commit();
  editor.toast(`Removed ${removed.toFixed(1)} s of silence`, 'success');
  return { removedSec: removed, pieces: keep.length };
}

// ---------------------------------------------------------------- captions

const captionSource = (editor, captionsClip) => {
  const src = captionsClip?.sourceClipId ? editor.getClip(captionsClip.sourceClipId) : null;
  if (!src || !editor.mediaSrc(src)) throw new Error('Transcribe these captions from a clip first (pick the source clip in Captions)');
  return src;
};

/** Label which speaker says each caption. */
export async function labelSpeakers(editor, captionsClip, { onProgress, signal } = {}) {
  if (captionsClip?.type !== 'captions' || !captionsClip.captions?.length) throw new Error('Select a captions clip with captions');
  const source = captionSource(editor, captionsClip);
  const { fromSec, toSec } = sourceRange(editor, source);
  const turns = await ai.diarize(editor.mediaSrc(source), { fromSec, toSec, onProgress, signal });
  const speed = clipSpeed(source);
  const adjusted = turns.map((t) => ({ ...t, start: t.start / speed, end: t.end / speed }));
  editor.snapshot();
  captionsClip.captions = ai.assignSpeakers(captionsClip.captions, adjusted);
  const speakers = new Set(captionsClip.captions.map((c) => c.speaker).filter(Boolean));
  captionsClip.speakers = [...speakers].sort().map((n) => ({ id: n, name: `Speaker ${n}` }));
  editor.commit();
  editor.refresh?.(captionsClip.id);
  editor.toast(`${speakers.size || 1} speaker${speakers.size === 1 ? '' : 's'} found`, 'success');
  return captionsClip.speakers;
}

/** New captions clip in another language, lined up with the original. */
export async function translateCaptionsClip(editor, captionsClip, tgt, { src = 'en', onProgress, signal } = {}) {
  if (captionsClip?.type !== 'captions' || !captionsClip.captions?.length) throw new Error('Select a captions clip with captions');
  const lines = await ai.translateCaptions(captionsClip.captions, tgt, { src, onProgress, signal });
  const copy = {
    ...JSON.parse(JSON.stringify(captionsClip)),
    id: `captions-${tgt}-${Date.now().toString(36)}`,
    name: `Captions (${tgt})`,
    captions: lines,
    lang: tgt,
    translatedFrom: captionsClip.id,
  };
  editor.snapshot();
  const track = editor.trackOf(captionsClip);
  editor.addToTrack(track, copy);
  editor.commit();
  editor.toast(`Translated ${lines.length} lines`, 'success');
  return copy;
}

// ---------------------------------------------------------------- search + tags

/** Media the editor can index: timeline clips plus library assets, de-duplicated by URL. */
export function indexableMedia(editor) {
  const seen = new Map();
  for (const c of editor.allClips()) {
    const url = editor.mediaSrc(c);
    if (!url || !isVisual(c) || seen.has(url)) continue;
    seen.set(url, { id: `url:${url}`, url, type: isImageClip(c) ? 'image' : 'video', duration: num(c.mediaDuration || c.sourceDuration || editor.clipDuration(c)), name: c.name, clipId: c.id });
  }
  for (const a of editor.assets?.() || []) {
    const url = a.url || a.src;
    if (!url || seen.has(url) || !/^(video|image)/.test(a.type || a.mimeType || '')) continue;
    seen.set(url, { id: `url:${url}`, url, type: String(a.type || a.mimeType).startsWith('image') ? 'image' : 'video', duration: num(a.duration), name: a.name, assetId: a.id });
  }
  return [...seen.values()];
}

export async function indexAll(editor, { onProgress, signal } = {}) {
  const media = indexableMedia(editor);
  let done = 0;
  for (const m of media) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    const { getIndex } = await import('./mlIndex.js');
    if (!(await getIndex(m.id))) {
      try { await ai.indexAsset(m, { signal }); } catch (err) { if (err?.name === 'AbortError') throw err; }
    }
    done += 1;
    onProgress?.({ stage: 'index', progress: done / Math.max(1, media.length), done, total: media.length });
  }
  return media;
}

/** Search timeline media by description. Results include where the moment is on the timeline, if placed. */
export async function searchTimelineMedia(editor, query, { signal } = {}) {
  const media = indexableMedia(editor);
  const hits = await ai.searchFootage(query, media, { signal });
  return hits.map((h) => {
    const m = media.find((x) => x.id === h.assetId);
    const clip = m?.clipId ? editor.getClip(m.clipId) : null;
    let timelineSec = null;
    if (clip && !isImageClip(clip)) {
      const local = (h.t - clipSourceIn(clip)) / clipSpeed(clip);
      if (local >= 0 && local <= editor.clipDuration(clip)) timelineSec = editor.clipStart(clip) + local;
    } else if (clip) timelineSec = editor.clipStart(clip);
    return { ...h, name: m?.name || 'Media', url: m?.url, type: m?.type, clipId: m?.clipId || null, assetId: m?.assetId || null, timelineSec };
  });
}

export async function tagClip(editor, clip, { signal } = {}) {
  const url = editor.mediaSrc(clip);
  if (!url || !isVisual(clip)) throw new Error('Tags work on video and image clips');
  const asset = { id: `url:${url}`, url, type: isImageClip(clip) ? 'image' : 'video', duration: num(clip.mediaDuration || editor.clipDuration(clip) + clipSourceIn(clip)) };
  const { tags, objects } = await ai.tagsForAsset(asset, { signal });
  clip.metadata = { ...(clip.metadata || {}), tags: tags.map((t) => t.label), objects: objects.map((o) => o.label) };
  editor.commit();
  return { tags, objects };
}

// ---------------------------------------------------------------- free voice

export async function addFreeVoiceover(editor, { text, voice = 'af_heart', speed = 1, start, onProgress, signal } = {}) {
  const script = String(text || '').trim();
  if (!script) throw new Error('Type the script to speak');
  if (script.length > 3000) throw new Error('Script is too long (max 3000 characters)');
  const { wav, duration } = await ai.speakFree(script, { voice, speed, onProgress, signal });
  const url = await editor.storeBlob(wav, `voiceover-${Date.now().toString(36)}.wav`);
  const s = Math.max(0, num(start, editor.playheadSec()));
  const len = Math.max(0.5, num(duration, script.split(/\s+/).length / 2.6));
  editor.snapshot();
  editor.growTimeline(s + len);
  editor.ensureTrack('Voiceover', 'audio');
  const clip = editor.insertClip({
    id: `vo-free-${Date.now().toString(36)}`, type: 'audio', role: 'voiceover',
    name: `Voiceover: ${script.slice(0, 40)}${script.length > 40 ? '…' : ''}`,
    src: url, volume: 1, script, voice, voiceEngine: 'kokoro-local', start: s, end: s + len,
  }, 'Voiceover');
  editor.commit();
  editor.toast('Voiceover added', 'success');
  return clip;
}

// ---------------------------------------------------------------- prompts for paid tools

export async function promptForGap(editor, beforeClip, afterClip, opts = {}) {
  return ai.fillGapPrompt(beforeClip, afterClip, editor.timelineSeconds(), opts);
}

export async function promptForMusic(editor, clips, opts = {}) {
  return ai.musicPromptForClips(clips, editor.timelineSeconds(), opts);
}
