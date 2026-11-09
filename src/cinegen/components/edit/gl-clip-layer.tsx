// [remix] Draws the visible preview <video> through OpenChatCut's GL pipeline when the clip under the playhead has
// effects / a LUT. The engine's own <video> stays in place (it owns audio + timing); while a canvas is showing it
// we hide only that element's pixels, and restore it the moment the effects are removed.
import { useEffect, useRef } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import { createGlRuntime } from '../../../openchatcut/gl/runtime';
import type { GlRuntime } from '../../../openchatcut/gl/runtimeTypes';
import { clipFxPasses, clipHasFx, primeClipLuts } from '@cinegen/lib/occ/clip-fx';
import { resolveTransition } from '@cinegen/lib/occ/plugins';
import { GLSL_TRANSITIONS } from '../../../openchatcut/gl/transitions';
import type { GlslTransitionType } from '../../../openchatcut/types';

export interface GlTransitionState { glType: string; glDef?: import('../../../openchatcut/gl/customTransitions').CustomTransitionDef; outClipId: string; inClipId: string; progress: number }

interface Props {
  container: HTMLElement | null;
  clip: Clip | null;
  assetId: string | null;
  /** [remix] active OpenChatCut GL transition at the playhead (two clips overlap) */
  transition?: GlTransitionState | null;
}

export function GlClipLayer({ container, clip, assetId, transition = null }: Props) {
  const trRef = useRef(transition);
  trRef.current = transition;
  const hasTransition = !!transition;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const active = clipHasFx(clip);
  const luts = clip ? JSON.stringify([clip.lut?.id, ...(clip.fx ?? []).map((f) => f.id)]) : '';

  useEffect(() => { if (clip && active) void primeClipLuts(clip); }, [luts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !container || !(active || hasTransition)) return;
    let runtime: GlRuntime | null = null;
    try { runtime = createGlRuntime(canvas); } catch { return; }
    let raf = 0;
    let hidden: HTMLVideoElement[] = [];
    const restore = () => { hidden.forEach((v) => { v.style.visibility = ''; }); hidden = []; };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = clipRef.current;
      const tr = trRef.current;
      if (tr) {
        const find = (id: string) => container.querySelector(`video[data-clip-id="${id}"]`) as HTMLVideoElement | null;
        const a = find(tr.outClipId); const b = find(tr.inClipId);
        if (!a || !b || a.readyState < 2 || b.readyState < 2 || !a.videoWidth) { canvas.style.visibility = 'hidden'; restore(); return; }
        const def = resolveTransition(tr.glType, tr.glDef);
        if (!def) { canvas.style.visibility = 'hidden'; restore(); return; }
        if (canvas.width !== a.videoWidth || canvas.height !== a.videoHeight) { canvas.width = a.videoWidth; canvas.height = a.videoHeight; }
        try {
          const time = performance.now() / 1000;
          runtime!.render(def.frag, a, b, tr.progress, def.uniforms({ time, aspect: canvas.width / canvas.height }));
        } catch { canvas.style.visibility = 'hidden'; restore(); return; }
        canvas.style.visibility = 'visible';
        for (const v of [a, b]) { if (!hidden.includes(v)) hidden.push(v); v.style.visibility = 'hidden'; }
        return;
      }
      const assetVideo = assetId;
      const video = Array.from(container.querySelectorAll('video')).find(
        (v) => v.dataset.assetId === assetVideo && v.style.opacity !== '0',
      ) as HTMLVideoElement | undefined;
      if (!c || !video || video.readyState < 2 || !video.videoWidth || !clipHasFx(c)) { canvas.style.visibility = 'hidden'; restore(); return; }
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      }
      try { runtime!.renderFxChain(clipFxPasses(c, video.currentTime), video); } catch { canvas.style.visibility = 'hidden'; restore(); return; }
      canvas.style.visibility = 'visible';
      if (hidden[0] !== video) { restore(); hidden = [video]; }
      video.style.visibility = 'hidden';
      canvas.style.mixBlendMode = c.blendMode && c.blendMode !== 'normal' ? c.blendMode : '';
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); restore(); runtime?.dispose(); };
  }, [container, assetId, active, hasTransition]);

  if (!active && !hasTransition) return null;
  return (
    <canvas
      ref={canvasRef}
      data-testid="gl-clip-layer"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', visibility: 'hidden' }}
    />
  );
}
