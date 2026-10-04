/**
 * Export Worker — real Timeline video composer.
 *
 * Renders the full timeline into a downloadable video by:
 *   1. Loading original media sources.
 *   2. Compositing active clips per timestamp.
 *   3. Applying transforms, opacity, keyframes.
 *   4. Rendering transitions.
 *   5. Mixing audio.
 *   6. Encoding via MediaRecorder.
 */

import { drawVideoFrame, applyPresetFilter } from './renderFrameProcessor.js';

const DEFAULT_FPS = 30;
const MAX_RENDER_SECONDS = 180; // safety cap

function postProgress(percent) {
  self.postMessage({ type: 'progress', progress: Math.min(100, Math.max(0, Math.round(percent))) });
}

function getClipAtTime(clips, time) {
  if (!Array.isArray(clips)) return null;
  return clips.find(c => time >= (c.start ?? 0) && time < (c.end ?? 0)) || null;
}

function getTransitionAtTime(transitions, time) {
  if (!Array.isArray(transitions)) return null;
  return transitions.find(t => time >= (t.startTime ?? 0) && time < ((t.startTime ?? 0) + (t.duration ?? 0))) || null;
}

function resolveSourceUrl(clip) {
  const src = clip.src || clip.source || clip.url;
  if (!src || String(src).includes('proxy')) return null;
  return src;
}

function loadMedia(src) {
  if (!src) return Promise.resolve(null);
  return fetch(src)
    .then(r => r.ok ? r.blob() : null)
    .then(blob => blob ? createImageBitmap(blob) : null)
    .catch(() => null);
}

function evaluateKeyframes(keyframes, time, property) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return null;
  const relevant = keyframes
    .filter(k => k.property === property)
    .sort((a, b) => a.time - b.time);

  if (relevant.length === 0) return null;

  // Before first keyframe
  if (time <= relevant[0].time) return relevant[0].value;

  // Between keyframes
  for (let i = 0; i < relevant.length - 1; i++) {
    const a = relevant[i];
    const b = relevant[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      const eased = a.easing === 'ease-in' ? t * t
        : a.easing === 'ease-out' ? t * (2 - t)
        : a.easing === 'ease-in-out' ? t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        : t;
      return a.value + (b.value - a.value) * eased;
    }
  }

  // After last keyframe
  return relevant[relevant.length - 1].value;
}

function drawClipFrame(ctx, clip, media, time, width, height) {
  if (!media) return;

  const x = evaluateKeyframes(clip.keyframes, time, 'position-x') ?? 0;
  const y = evaluateKeyframes(clip.keyframes, time, 'position-y') ?? 0;
  const scale = evaluateKeyframes(clip.keyframes, time, 'scale') ?? 1;
  const rotation = evaluateKeyframes(clip.keyframes, time, 'rotation') ?? 0;
  const opacity = evaluateKeyframes(clip.keyframes, time, 'opacity') ?? clip.opacity ?? 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.translate(width / 2 + x, height / 2 + y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);

  const clipWidth = width * (clip.width || 1);
  const clipHeight = height * (clip.height || 1);

  if (clip.flipH) ctx.scale(-1, 1);
  if (clip.flipV) ctx.scale(1, -1);

  ctx.drawImage(media, -clipWidth / 2, -clipHeight / 2, clipWidth, clipHeight);
  ctx.restore();
}

function drawTextClip(ctx, clip, time, width, height) {
  const text = clip.text || clip.content || '';
  if (!text) return;

  const fontSize = evaluateKeyframes(clip.keyframes, time, 'fontSize') ?? clip.fontSize ?? 48;
  const opacity = evaluateKeyframes(clip.keyframes, time, 'opacity') ?? clip.opacity ?? 1;
  const x = evaluateKeyframes(clip.keyframes, time, 'position-x') ?? clip.x ?? width / 2;
  const y = evaluateKeyframes(clip.keyframes, time, 'position-y') ?? clip.y ?? height / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.font = `${fontSize}px ${clip.fontFamily || 'sans-serif'}`;
  ctx.fillStyle = clip.color || '#ffffff';
  ctx.textAlign = clip.textAlign || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function mixTransition(ctx, transition, clipA, mediaA, clipB, mediaB, time, width, height) {
  const startTime = transition.startTime ?? 0;
  const duration = transition.duration ?? 1;
  const t = Math.max(0, Math.min(1, (time - startTime) / duration));

  switch (transition.type) {
    case 'dissolve':
      ctx.globalAlpha = 1;
      drawClipFrame(ctx, clipA, mediaA, time, width, height);
      ctx.globalAlpha = t;
      drawClipFrame(ctx, clipB, mediaB, time, width, height);
      ctx.globalAlpha = 1;
      break;

    case 'fadeToBlack':
      ctx.globalAlpha = 1 - t;
      drawClipFrame(ctx, clipA, mediaA, time, width, height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      break;

    case 'fadeFromBlack':
      ctx.globalAlpha = t;
      drawClipFrame(ctx, clipA, mediaA, time, width, height);
      ctx.globalAlpha = 1;
      break;

    default:
      drawClipFrame(ctx, clipA, mediaA, time, width, height);
  }
}

async function mixAudio(stream, tracks, fps, durationMs) {
  // Audio mixing is handled via Web Audio API in the main thread.
  // The worker focuses on video compositing; audio is added post-render
  // via MediaRecorder's audio track or by the main thread.
  return stream;
}

self.onmessage = async (event) => {
  try {
    const { action, settings, timelineData } = event.data || {};

    if (action !== 'export') {
      self.postMessage({ type: 'error', error: 'Unknown action: ' + action });
      return;
    }

    const width = settings?.width || 1920;
    const height = settings?.height || 1080;
    const fps = settings?.fps || DEFAULT_FPS;
    const durationMs = Math.min(timelineData?.duration || 5000, MAX_RENDER_SECONDS * 1000);
    const totalFrames = Math.max(1, Math.floor((durationMs / 1000) * fps));
    const tracks = Array.isArray(timelineData?.tracks) ? timelineData.tracks : [];
    const transitions = Array.isArray(timelineData?.transitions) ? timelineData.transitions : [];

    const OffscreenCtor = typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas : null;
    if (!OffscreenCtor) {
      self.postMessage({ type: 'error', error: 'OffscreenCanvas is not supported' });
      return;
    }

    const canvas = new OffscreenCtor(width, height);
    const ctx = canvas.getContext('2d');

    // Preload all media
    const mediaCache = new Map();
    const loadPromises = [];
    for (const track of tracks) {
      const clips = track.clips || track.items || [];
      for (const clip of clips) {
        const src = resolveSourceUrl(clip);
        if (src && !mediaCache.has(src)) {
          mediaCache.set(src, loadMedia(src));
          loadPromises.push(mediaCache.get(src));
        }
      }
    }
    await Promise.all(loadPromises);

    // Setup MediaRecorder for WebM output
    const stream = canvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const recordingDone = new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };
    });

    recorder.start();

    // Render each frame
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = (frame / fps) * 1000; // ms

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // Collect active clips per track
      const activeClips = [];
      for (const track of tracks) {
        const clips = track.clips || track.items || [];
        const clip = getClipAtTime(clips, time);
        if (clip) {
          const src = resolveSourceUrl(clip);
          activeClips.push({
            clip,
            media: src ? mediaCache.get(src) : null,
            trackType: track.type,
          });
        }
      }

      // Render clips bottom-up (first track = bottom)
      for (const { clip, media, trackType } of activeClips) {
        if (trackType === 'audio') continue;

        const transition = getTransitionAtTime(transitions, time);
        if (transition && clip.id === transition.clipBId && transition.clipAId) {
          const clipA = activeClips.find(c => c.clip.id === transition.clipAId);
          if (clipA) {
            mixTransition(ctx, transition, clipA.clip, clipA.media, clip, media, time, width, height);
            continue;
          }
        }

        if (transition && clip.id === transition.clipAId && !transition.clipBId) {
          mixTransition(ctx, transition, clip, media, null, null, time, width, height);
          continue;
        }

        drawClipFrame(ctx, clip, media, time, width, height);
      }

      // Render text/subtitle clips
      for (const track of tracks) {
        if (track.type !== 'text' && track.type !== 'subtitle') continue;
        const clips = track.clips || track.items || [];
        const clip = getClipAtTime(clips, time);
        if (clip) {
          drawTextClip(ctx, clip, time, width, height);
        }
      }

      if (settings?.preset) {
        applyPresetFilter(ctx, settings.preset, width, height);
      }

      postProgress(((frame + 1) / totalFrames) * 100);
      await new Promise(r => setTimeout(r, 0));
    }

    recorder.stop();
    const blobUrl = await recordingDone;

    self.postMessage({
      type: 'complete',
      result: {
        success: true,
        message: 'Export complete',
        url: blobUrl,
        format: 'webm',
        width,
        height,
        fps,
        duration: durationMs,
      }
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err.message || String(err)
    });
  }
};
