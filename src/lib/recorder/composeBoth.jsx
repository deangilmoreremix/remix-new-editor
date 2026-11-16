// Combine a "Both" take (screen and camera recorded as separate files, as Remotion Recorder does)
// into one video in the browser: the screen full frame with the camera as a bubble, bottom-left.
// Rendered locally with @remotion/web-renderer (same approach as
// src/features/personalization/shared/personalization/webExport.ts); nothing is sent to a server.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Video } from '@remotion/media';

const REMOTION_LICENSE_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REMOTION_LICENSE_KEY) || 'free-license';

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
const BUBBLE = Math.round(WIDTH * 0.2);
const MARGIN = Math.round(WIDTH * 0.03);

const SPOTLIGHT_SIZE = Math.round(HEIGHT * 0.72);
const RAMP = 0.35; // seconds to grow or shrink

/**
 * Camera spotlight (Sendspark "Record Videos"): how far the bubble has grown at second `t`, 0..1,
 * given the times you held Spotlight while recording ([{ start, end }] in seconds).
 */
export function spotlightAmount(t, spotlights = []) {
  let a = 0;
  for (const { start, end } of spotlights) {
    const e = Number.isFinite(end) ? end : Infinity;
    if (t < start - RAMP || t > e + RAMP) continue;
    const grow = Math.min(1, (t - (start - RAMP)) / RAMP);
    const shrink = Math.min(1, (e + RAMP - t) / RAMP);
    a = Math.max(a, Math.max(0, Math.min(grow, shrink)));
  }
  return a * a * (3 - 2 * a); // smoothstep
}

/** Where the camera bubble is: bottom-left normally, large and centred in a spotlight. */
export function bubbleBox(amount) {
  const size = BUBBLE + (SPOTLIGHT_SIZE - BUBBLE) * amount;
  return {
    size: Math.round(size),
    left: Math.round(MARGIN + ((WIDTH - size) / 2 - MARGIN) * amount),
    bottom: Math.round(MARGIN + ((HEIGHT - size) / 2 - MARGIN) * amount),
  };
}

export function ScreenWithBubble({ screenSrc, cameraSrc, shape = 'circle', spotlights = [] }) {
  const frame = useCurrentFrame();
  const amount = spotlightAmount(frame / FPS, spotlights);
  const { size, left, bottom } = bubbleBox(amount);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* The screen take has no sound of its own; the microphone is on the camera take. */}
      <Video src={screenSrc} muted objectFit="contain" style={{ width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute', left, bottom, width: size, height: size,
          borderRadius: shape === 'circle' ? '50%' : Math.round(size * 0.1), overflow: 'hidden',
          border: `${Math.max(3, Math.round(size * 0.02))}px solid #fff`, boxShadow: '0 8px 30px rgba(0,0,0,.45)',
        }}
      >
        <Video src={cameraSrc} objectFit="cover" style={{ width: '100%', height: '100%' }} />
      </div>
    </AbsoluteFill>
  );
}

/** Duration (s) of a media blob, from its metadata; 0 when unknown. */
export function blobDuration(blob) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(blob);
    const done = (d) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? d : 0); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      // WebM from MediaRecorder often reports Infinity until seeked to the end.
      if (Number.isFinite(v.duration)) return done(v.duration);
      v.ontimeupdate = () => { v.ontimeupdate = null; done(v.duration); };
      v.currentTime = 1e9;
    };
    v.onerror = () => done(0);
    v.src = url;
  });
}

// MP4 where the browser can encode it, else WebM.
const PROFILES = [
  { container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', mimeType: 'video/mp4' },
  { container: 'webm', videoCodec: 'vp8', audioCodec: 'opus', mimeType: 'video/webm' },
];

/**
 * screen, camera: Blobs. Resolves to { blob, mimeType } or throws with a readable message.
 * `renderer` is injectable for tests.
 */
export async function composeBoth({ screen, camera, shape, spotlights = [], seconds, onProgress, signal, renderer }) {
  const r = renderer || await import('@remotion/web-renderer');
  let profile = null;
  for (const p of PROFILES) {
    const check = await r.canRenderMediaOnWeb({ container: p.container, videoCodec: p.videoCodec, audioCodec: p.audioCodec, width: WIDTH, height: HEIGHT, muted: false });
    if (check.canRender) { profile = p; break; }
  }
  if (!profile) throw new Error('This browser cannot combine screen and camera into one video. Use Chrome or Edge, or record Camera or Screen on its own.');
  const duration = seconds || Math.max(await blobDuration(screen), await blobDuration(camera));
  if (!duration) throw new Error('Could not read the length of the recording.');
  const screenSrc = URL.createObjectURL(screen);
  const cameraSrc = URL.createObjectURL(camera);
  try {
    const inputProps = { screenSrc, cameraSrc, shape, spotlights };
    const result = await r.renderMediaOnWeb({
      composition: { id: 'outreach-both', component: ScreenWithBubble, width: WIDTH, height: HEIGHT, fps: FPS, durationInFrames: Math.max(1, Math.round(duration * FPS)), defaultProps: inputProps },
      inputProps,
      container: profile.container,
      videoCodec: profile.videoCodec,
      audioCodec: profile.audioCodec,
      muted: false,
      // Same rule as the app's other in-browser renders (src/export-runner/main.jsx,
      // motion-director/webRenderer.ts): a company license key when set, else the free license.
      licenseKey: REMOTION_LICENSE_KEY,
      signal,
      onProgress: (p) => onProgress?.(Math.max(0, Math.min(1, p?.progress ?? 0))),
    });
    const blob = await result.getBlob();
    return { blob: blob.type ? blob : new Blob([blob], { type: profile.mimeType }), mimeType: profile.mimeType };
  } finally {
    URL.revokeObjectURL(screenSrc);
    URL.revokeObjectURL(cameraSrc);
  }
}
