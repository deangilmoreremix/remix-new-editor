// [remix] Draws the visible preview <video> through OpenChatCut's GL pipeline when the clip under the playhead has
// effects / a LUT. The engine's own <video> stays in place (it owns audio + timing); while a canvas is showing it
// we hide only that element's pixels, and restore it the moment the effects are removed.
import { useEffect, useRef } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import { createGlRuntime } from '../../../openchatcut/gl/runtime';
import type { GlRuntime } from '../../../openchatcut/gl/runtimeTypes';
import { clipFxPasses, clipHasFx, primeClipLuts } from '@cinegen/lib/occ/clip-fx';

interface Props {
  container: HTMLElement | null;
  clip: Clip | null;
  assetId: string | null;
}

export function GlClipLayer({ container, clip, assetId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const active = clipHasFx(clip);
  const luts = clip ? JSON.stringify([clip.lut?.id, ...(clip.fx ?? []).map((f) => f.id)]) : '';

  useEffect(() => { if (clip && active) void primeClipLuts(clip); }, [luts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !container || !assetId || !active) return;
    let runtime: GlRuntime | null = null;
    try { runtime = createGlRuntime(canvas); } catch { return; }
    let raf = 0;
    let hidden: HTMLVideoElement | null = null;
    const restore = () => { if (hidden) { hidden.style.visibility = ''; hidden = null; } };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = clipRef.current;
      const video = Array.from(container.querySelectorAll('video')).find(
        (v) => v.dataset.assetId === assetId && v.style.opacity !== '0',
      ) as HTMLVideoElement | undefined;
      if (!c || !video || video.readyState < 2 || !video.videoWidth) { canvas.style.visibility = 'hidden'; restore(); return; }
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      }
      try { runtime!.renderFxChain(clipFxPasses(c, video.currentTime), video); } catch { canvas.style.visibility = 'hidden'; restore(); return; }
      canvas.style.visibility = 'visible';
      if (hidden !== video) { restore(); hidden = video; }
      video.style.visibility = 'hidden';
      canvas.style.mixBlendMode = c.blendMode && c.blendMode !== 'normal' ? c.blendMode : '';
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); restore(); runtime?.dispose(); };
  }, [container, assetId, active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      data-testid="gl-clip-layer"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', visibility: 'hidden' }}
    />
  );
}
