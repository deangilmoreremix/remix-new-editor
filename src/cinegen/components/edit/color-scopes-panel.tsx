// [Stage 3] CineGen host for the shared colour scopes (src/lib/editor/colorScopes.js: histogram, luma waveform, RGB parade,
// vectorscope). Reads the frame the preview is showing — the GL effect canvas when the clip has effects (so scopes reflect the
// grade), otherwise the visible <video> — downsampled to <= 320 px wide.
import { useEffect, useRef } from 'react';
import { mountColorScopes } from '../../../lib/editor/colorScopes.js';

/** The picture the preview is currently showing, or null. Exported for tests. */
export function previewFrameSource(root: ParentNode = document): CanvasImageSource | null {
  const gl = root.querySelector<HTMLCanvasElement>('canvas[data-testid="gl-clip-layer"]');
  if (gl && gl.style.visibility === 'visible' && gl.width > 0) return gl;
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video'));
  return videos.find((v) => v.readyState >= 2 && v.videoWidth > 0 && v.style.opacity !== '0' && v.style.visibility !== 'hidden') ?? null;
}

export function ColorScopesPanel() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const m = mountColorScopes(host.current, {
      getFrame: async () => {
        const src = previewFrameSource();
        if (!src) return null;
        const sw = (src as HTMLVideoElement).videoWidth || (src as HTMLCanvasElement).width;
        const sh = (src as HTMLVideoElement).videoHeight || (src as HTMLCanvasElement).height;
        const scale = Math.min(1, 320 / sw);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(src, 0, 0, c.width, c.height);
        return ctx.getImageData(0, 0, c.width, c.height);
      },
    }) as { destroy: () => void };
    return () => m.destroy();
  }, []);
  return <div ref={host} data-testid="color-scopes" style={{ fontSize: 11 }} />;
}
