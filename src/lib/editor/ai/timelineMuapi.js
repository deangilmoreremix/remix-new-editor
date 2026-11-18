/**
 * Paid Timeline AI on MuAPI (no fal): Fill Gap, Extend before/after, layer
 * decomposition and watermark removal. Talks to /api/timeline-ai (submit, then
 * poll status) with the user's Clerk session and their own MuAPI key.
 *
 * Boundary frames are grabbed in the browser (frameGrab.js) — the real last
 * frame before a gap and first frame after it — and uploaded so MuAPI can
 * fetch them.
 */
import { byokHeaders } from '../agent/audioGen.js';
import { boundaryFrameUrls, grabFrame, canvasToBlob, frameToPublicUrl, clipSourceIn, clipSpeed } from '../ml/frameGrab.js';
import { DEFAULT_FILL_GAP_MODEL, DEFAULT_EXTEND_MODEL, DEFAULT_LAYER_MODEL, DEFAULT_WATERMARK_MODEL, FIRST_LAST_FRAME_MODELS } from '../../muapi/frameModels.js';

export const TIMELINE_AI_ENDPOINT = '/api/timeline-ai';

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener?.('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })); }, { once: true });
});

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function post(body, { fetchImpl = fetch, signal, keyManager } = {}) {
  const res = await fetchImpl(TIMELINE_AI_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...byokHeaders(keyManager) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) throw new Error(data?.error?.message || 'Sign in, and add your MuAPI key in Settings → API keys.');
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `Timeline AI is unavailable (HTTP ${res.status}).`);
  return data;
}

/**
 * Run one MuAPI tool to completion.
 * @returns {Promise<{ url: string, urls: string[], model?: string }>}
 */
export async function runTimelineMuapi(tool, params, { fetchImpl, signal, keyManager, pollMs = 4000, timeoutMs = 12 * 60_000, onProgress } = {}) {
  onProgress?.({ stage: 'submit' });
  const first = await post({ action: 'submit', tool, params }, { fetchImpl, signal, keyManager });
  if (first.status === 'done') return { url: first.url, urls: first.urls || [first.url], model: first.model };
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await sleep(pollMs, signal);
    onProgress?.({ stage: 'generating', elapsedSec: Math.round((Date.now() - started) / 1000) });
    const s = await post({ action: 'status', requestId: first.requestId }, { fetchImpl, signal, keyManager });
    if (s.status === 'done') return { url: s.url, urls: s.urls || [s.url], model: first.model };
    if (s.status === 'failed') throw new Error(s.error || 'Generation failed');
  }
  throw new Error('MuAPI took too long. Try a faster model.');
}

// ---------------------------------------------------------------- timeline helpers

/** The gap next to `clip` on its track: { before, after, start, end } or null. */
export function gapNextTo(editor, clip, { side = 'after' } = {}) {
  const track = editor.trackOf(clip);
  const items = (track?.items || [])
    .filter((c) => editor.clipDuration(c) > 0)
    .sort((a, b) => editor.clipStart(a) - editor.clipStart(b));
  const i = items.findIndex((c) => c.id === clip.id);
  if (i < 0) return null;
  const end = (c) => editor.clipStart(c) + editor.clipDuration(c);
  if (side === 'after') {
    const next = items.slice(i + 1).find((c) => editor.clipStart(c) >= end(clip) - 0.01);
    const gapEnd = next ? editor.clipStart(next) : null;
    if (gapEnd == null || gapEnd - end(clip) < 0.2) return null;
    return { before: clip, after: next, start: end(clip), end: gapEnd };
  }
  const prev = items.slice(0, i).reverse().find((c) => end(c) <= editor.clipStart(clip) + 0.01);
  const gapStart = prev ? end(prev) : 0;
  if (editor.clipStart(clip) - gapStart < 0.2) return null;
  return { before: prev || null, after: clip, start: gapStart, end: editor.clipStart(clip) };
}

/** Every gap on the clip's track (for a picker). */
export function gapsOnTrack(editor, track) {
  const items = (track?.items || []).filter((c) => editor.clipDuration(c) > 0).sort((a, b) => editor.clipStart(a) - editor.clipStart(b));
  const out = [];
  let t = 0;
  let prev = null;
  for (const c of items) {
    const s = editor.clipStart(c);
    if (s - t >= 0.2) out.push({ before: prev, after: c, start: t, end: s });
    t = Math.max(t, s + editor.clipDuration(c));
    prev = c;
  }
  return out;
}

const uploader = (editor) => (file) => editor.storeBlob(file, file.name, { requireRemote: true });

function videoClipFrom(editor, url, { name, start, end, like }) {
  return {
    id: `ai-${Date.now().toString(36)}`,
    type: 'video',
    name,
    src: url,
    volume: like?.volume ?? 1,
    trimIn: 0,
    start,
    end,
    generatedBy: 'muapi',
  };
}

/**
 * Fill the gap: grab the boundary frames, generate a bridging clip on MuAPI
 * and place it in the gap on the same track.
 */
export async function fillGap(editor, gap, { model = DEFAULT_FILL_GAP_MODEL, prompt, onProgress, signal, run = runTimelineMuapi } = {}) {
  if (!gap) throw new Error('No gap found next to this clip');
  onProgress?.({ stage: 'frames' });
  const T = editor.timelineSeconds();
  // frameGrab works in timeline seconds for left/width clips.
  const { firstFrameUrl, lastFrameUrl } = await boundaryFrameUrls(gap.before, gap.after, { timelineSeconds: T, upload: uploader(editor), signal });
  if (!firstFrameUrl && !lastFrameUrl) throw new Error('Could not read frames from the clips next to the gap');
  const info = FIRST_LAST_FRAME_MODELS[model] || FIRST_LAST_FRAME_MODELS[DEFAULT_FILL_GAP_MODEL];
  const gapLen = gap.end - gap.start;
  const duration = Math.min(info.durations[1], Math.max(info.durations[0], Math.ceil(gapLen)));
  const { url } = await run('fill_gap', { model, firstFrameUrl, lastFrameUrl, prompt, duration }, { signal, onProgress });
  const track = editor.trackOf(gap.after || gap.before);
  const clip = videoClipFrom(editor, url, { name: 'AI Fill Gap', start: gap.start, end: gap.end, like: gap.before || gap.after });
  // The generated clip may be longer than the gap; play it sped up to fit exactly.
  clip.playbackRate = Math.max(0.25, Math.min(4, duration / gapLen));
  editor.snapshot();
  editor.addToTrack(track, clip, { start: gap.start, end: gap.end });
  editor.commit();
  editor.toast('Gap filled', 'success');
  return clip;
}

/** Extend a clip forward (MuAPI video-extend) or backward (lead-in into its first frame). */
export async function extendClip(editor, clip, { direction = 'after', seconds = 5, model, prompt, onProgress, signal, run = runTimelineMuapi } = {}) {
  const src = editor.mediaSrc(clip);
  if (!src || clip.type !== 'video') throw new Error('Extend works on video clips');
  const track = editor.trackOf(clip);
  const start = editor.clipStart(clip);
  const dur = editor.clipDuration(clip);
  let url;
  if (direction === 'after') {
    if (!/^https:\/\//.test(src)) throw new Error('This clip is only stored in this browser — save the project (sign in) so MuAPI can read it');
    ({ url } = await run('extend_after', { model: model || DEFAULT_EXTEND_MODEL, videoUrl: src, prompt, duration: seconds }, { signal, onProgress }));
  } else {
    onProgress?.({ stage: 'frames' });
    const canvas = await grabFrame(src, clipSourceIn(clip), { maxSize: 1280, signal });
    const firstFrameUrl = await frameToPublicUrl(await canvasToBlob(canvas), uploader(editor), 'extend-start');
    ({ url } = await run('extend_before', { model, firstFrameUrl, prompt, duration: seconds }, { signal, onProgress }));
  }
  editor.snapshot();
  const s = direction === 'after' ? start + dur : Math.max(0, start - seconds);
  const piece = videoClipFrom(editor, url, { name: `AI Extend (${direction})`, start: s, end: s + seconds, like: clip });
  if (direction === 'after') {
    // Push later clips right to make room.
    (track?.items || []).filter((c) => c.id !== clip.id && editor.clipStart(c) >= start + dur - 0.01).forEach((c) => {
      const cs = editor.clipStart(c);
      editor.setClipTimes(c, cs + seconds, cs + seconds + editor.clipDuration(c));
    });
  } else if (start < seconds) {
    // Not enough room before the clip: shift the whole track right.
    const shift = seconds - start;
    (track?.items || []).forEach((c) => {
      const cs = editor.clipStart(c);
      editor.setClipTimes(c, cs + shift, cs + shift + editor.clipDuration(c));
    });
    editor.setClipTimes(piece, 0, seconds);
  }
  editor.growTimeline(editor.clipStart(clip) + editor.clipDuration(clip) + (direction === 'after' ? seconds : 0));
  editor.addToTrack(track, piece);
  editor.commit();
  editor.toast(`Clip extended ${direction === 'after' ? 'forward' : 'backward'} by ${seconds}s`, 'success');
  return piece;
}

/** Split an image clip into layers; each layer goes on its own overlay above the clip. */
export async function decomposeLayers(editor, clip, { model = DEFAULT_LAYER_MODEL, prompt, onProgress, signal, run = runTimelineMuapi } = {}) {
  let src = editor.mediaSrc(clip);
  if (!src) throw new Error('This clip has no media');
  if (clip.type === 'video' || !/^https:\/\//.test(src)) {
    // Use the frame at the playhead (and upload it) for videos and local images.
    const t = clip.type === 'video' ? clipSourceIn(clip) + Math.max(0, editor.playheadSec() - editor.clipStart(clip)) * clipSpeed(clip) : 0;
    const canvas = await grabFrame(src, t, { maxSize: 1600, image: clip.type !== 'video', signal });
    src = await frameToPublicUrl(await canvasToBlob(canvas, 'image/png'), uploader(editor), 'layers-source');
  }
  const { urls } = await run('layers', { model, imageUrl: src, prompt }, { signal, onProgress });
  if (!urls?.length) throw new Error('MuAPI returned no layers');
  const start = editor.clipStart(clip);
  const end = start + editor.clipDuration(clip);
  editor.snapshot();
  const layers = urls.map((url, i) => {
    const layer = { id: `layer-${i}-${Date.now().toString(36)}`, type: 'image', name: `Layer ${i + 1}`, src: url, start, end, metadata: { layerOf: clip.id, layerIndex: i, generatedBy: 'muapi' } };
    editor.insertClip(layer, 'overlay');
    return layer;
  });
  editor.commit();
  editor.toast(`${layers.length} layers added`, 'success');
  return layers;
}

/** Sources whose footage the user may not have rights to strip a watermark from. */
export function isStockClip(clip) {
  const s = `${clip?.source || ''} ${clip?.provider || ''} ${clip?.stockSource || ''} ${clip?.src || ''}`.toLowerCase();
  return /pexels|pixabay|shutterstock|getty|istock|adobestock|storyblocks/.test(s);
}

/**
 * Remove a watermark from a video clip the user owns or generated. The
 * original is kept (clip.localAI.originalSrc) so it can be restored.
 */
export async function removeWatermark(editor, clip, { model = DEFAULT_WATERMARK_MODEL, rightsConfirmed = false, onProgress, signal, run = runTimelineMuapi } = {}) {
  if (clip?.type !== 'video') throw new Error('Watermark removal works on video clips');
  if (isStockClip(clip)) throw new Error('Watermark removal is not available for stock footage');
  if (!rightsConfirmed) throw new Error('Confirm that you own or have the rights to this footage');
  const src = editor.mediaSrc(clip);
  if (!/^https:\/\//.test(String(src || ''))) throw new Error('This clip is only stored in this browser — save the project (sign in) so MuAPI can read it');
  const { url } = await run('watermark_remove', { model, videoUrl: src }, { signal, onProgress });
  editor.snapshot();
  const prev = clip.localAI?.originalSrc ? clip.localAI : null;
  clip.localAI = { op: 'watermark-removed', originalSrc: prev?.originalSrc ?? src, originalTrimIn: prev ? prev.originalTrimIn : (clip.trimIn ?? null), originalType: clip.type, at: new Date().toISOString(), rightsConfirmed: true };
  editor.setMediaSrc(clip, url);
  editor.commit();
  editor.refresh?.(clip.id);
  editor.toast('Watermark removed. The original is kept.', 'success');
  return url;
}
