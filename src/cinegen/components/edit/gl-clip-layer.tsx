// [remix] Draws the visible preview <video> through OpenChatCut's GL pipeline when the clip under the playhead has
// effects / a LUT. The engine's own <video> stays in place (it owns audio + timing); while a canvas is showing it
// we hide only that element's pixels, and restore it the moment the effects are removed.
import { useEffect, useRef } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import { createGlRuntime } from '../../../openchatcut/gl/runtime';
import type { GlRuntime } from '../../../openchatcut/gl/runtimeTypes';
import { clipFxPasses, clipHasFx, primeClipLuts } from '@cinegen/lib/occ/clip-fx';
import { resolveTransition } from '@cinegen/lib/occ/plugins';
import { drawStyledFrame } from '../../../openchatcut/gl/styledFrame';
import { interpolateProperty } from '@cinegen/lib/editor/timeline-operations';
import { warnGlFxSkipped } from '../../../openchatcut/gl/fx/glSupport';
import { GLSL_TRANSITIONS } from '../../../openchatcut/gl/transitions';
import type { GlslTransitionType } from '../../../openchatcut/types';

export interface GlTransitionState { glType: string; glDef?: import('../../../openchatcut/gl/customTransitions').CustomTransitionDef; glParams?: Record<string, number | boolean | number[]>; outClipId: string; inClipId: string; progress: number;
  /** [remix] Fix A: timeline time and the two clips, so each side is drawn with its own transform / keys / effects / opacity */
  time?: number; outClip?: Clip; inClip?: Clip }

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
  const trLuts = transition ? `${transition.outClipId}|${transition.inClipId}` : '';
  useEffect(() => { if (transition?.outClip) void primeClipLuts(transition.outClip); if (transition?.inClip) void primeClipLuts(transition.inClip); }, [trLuts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !container || !(active || hasTransition)) return;
    let runtime: GlRuntime | null = null;
    try { runtime = createGlRuntime(canvas); } catch (e) { warnGlFxSkipped(e instanceof Error ? e.message : undefined); return; }
    let raf = 0;
    let hidden: HTMLVideoElement[] = [];
    let buffers: Array<{ stage: HTMLCanvasElement; styled: HTMLCanvasElement; fx: HTMLCanvasElement; rt: GlRuntime | null }> | null = null;
    const restore = () => { hidden.forEach((v) => { v.style.visibility = ''; }); hidden = []; };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = clipRef.current;
      const tr = trRef.current;
      if (tr) {
        const find = (id: string) => container.querySelector(`video[data-clip-id="${id}"]`) as HTMLVideoElement | null;
        const a = find(tr.outClipId); const b = find(tr.inClipId);
        if (!a || !b || a.readyState < 2 || b.readyState < 2 || !a.videoWidth) { canvas.style.visibility = 'hidden'; restore(); return; }
        const def = resolveTransition(tr.glType, tr.glDef, tr.glParams);
        if (!def) { canvas.style.visibility = 'hidden'; restore(); return; }
        // [remix] Fix A: blend the clips as they are composited in the viewer (fx -> fit / transform / crop / opacity over black), not their raw frames
        const sides = tr.outClip && tr.inClip && tr.time !== undefined ? ([{ v: a, clip: tr.outClip, k: 0 }, { v: b, clip: tr.inClip, k: 1 }] as const) : null;
        let from: TexImageSource = a; let to: TexImageSource = b;
        if (sides) {
          const cw = container.clientWidth || a.videoWidth; const ch = container.clientHeight || a.videoHeight;
          const dpr = Math.min(2, window.devicePixelRatio || 1); const cap = Math.min(1, 1600 / Math.max(cw, ch, 1));
          const W = Math.max(2, Math.round(cw * dpr * cap)); const H = Math.max(2, Math.round(ch * dpr * cap));
          if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
          const bufs = (buffers ??= [0, 1].map(() => ({ stage: document.createElement('canvas'), styled: document.createElement('canvas'), fx: document.createElement('canvas'), rt: null as GlRuntime | null })));
          for (const { v, clip, k } of sides) {
            const buf = bufs[k];
            for (const c of [buf.stage, buf.styled, buf.fx]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
            const sctx = buf.stage.getContext('2d'); const dctx = buf.styled.getContext('2d');
            if (!sctx || !dctx) continue;
            const fit = v.style.objectFit === 'cover' ? 'cover' : 'contain';
            const kk = fit === 'cover' ? Math.max(W / v.videoWidth, H / v.videoHeight) : Math.min(W / v.videoWidth, H / v.videoHeight);
            sctx.clearRect(0, 0, W, H); sctx.drawImage(v, (W - v.videoWidth * kk) / 2, (H - v.videoHeight * kk) / 2, v.videoWidth * kk, v.videoHeight * kk);
            let picture: CanvasImageSource = buf.stage;
            if (clipHasFx(clip)) {
              buf.rt ??= createGlRuntime(buf.fx);
              buf.rt.renderFxChain(clipFxPasses(clip, v.currentTime, Math.max(0, (v.currentTime - clip.trimStart) / (clip.speed || 1))), buf.stage);
              picture = buf.fx;
            }
            // the playback engine already writes the clip's flip + pose + crop onto the <video>: same strings, so the same geometry
            drawStyledFrame(dctx, picture, { cssTransform: v.style.transform, clipPath: v.style.clipPath, opacity: interpolateProperty(clip, 'opacity', Math.max(0, (tr.time as number) - clip.startTime)) }, '#000');
          }
          from = bufs[0].styled; to = bufs[1].styled;
        } else if (canvas.width !== a.videoWidth || canvas.height !== a.videoHeight) { canvas.width = a.videoWidth; canvas.height = a.videoHeight; }
        try {
          const time = performance.now() / 1000;
          runtime!.render(def.frag, from, to, tr.progress, def.uniforms({ time, aspect: canvas.width / canvas.height }));
        } catch { canvas.style.visibility = 'hidden'; restore(); return; }
        canvas.style.visibility = 'visible';
        // the clip-fx branch below styles this canvas like its <video>; the transition canvas already carries each side's geometry
        canvas.style.transform = ''; canvas.style.clipPath = ''; canvas.style.opacity = ''; canvas.style.mixBlendMode = ''; canvas.style.objectFit = 'contain';
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
      try { runtime!.renderFxChain(clipFxPasses(c, video.currentTime, Math.max(0, (video.currentTime - c.trimStart) / (c.speed || 1))), video); } catch { canvas.style.visibility = 'hidden'; restore(); return; }
      canvas.style.visibility = 'visible';
      if (hidden[0] !== video) { restore(); hidden = [video]; }
      video.style.visibility = 'hidden';
      // [remix] same resolved geometry as the hidden <video> (fit, transform, crop, stacking, opacity)
      canvas.style.objectFit = video.style.objectFit || 'contain';
      canvas.style.transform = video.style.transform;
      canvas.style.clipPath = video.style.clipPath;
      canvas.style.zIndex = video.style.zIndex;
      canvas.style.opacity = video.style.opacity;
      canvas.style.mixBlendMode = c.blendMode && c.blendMode !== 'normal' ? c.blendMode : '';
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); restore(); runtime?.dispose(); buffers?.forEach((b) => b.rt?.dispose()); };
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
