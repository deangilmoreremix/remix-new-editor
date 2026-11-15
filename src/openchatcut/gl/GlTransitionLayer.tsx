// SPDX-License-Identifier: AGPL-3.0-or-later — modelled on OpenChatCut's gl/GlTransition.tsx and ClipFx.tsx.
// [remix] Renders one GL transition between two video sources inside a Remotion <Sequence> that spans the overlap window;
// used by the export composition so CineGen cut transitions are burned into the MP4.
import { useEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from 'remotion';
import { Video as MediaVideo } from '@remotion/media';
import { createGlRuntime, type GlRuntime } from './runtime';
import { disposeRuntimeSlot, ensureRuntimeSlot } from './runtimeSlot';
import { GLSL_TRANSITIONS } from './transitions';
import { customTransitionUniforms, type CustomTransitionDef } from './customTransitions';
import { buildTransitionShaderFrame } from './shaderFrame';
import type { GlslTransitionType } from '../types';
import { gltFrag, gltUniforms, isGltId, type GltParams } from './glt';
import { ALL_FX } from './fx/effects';
import { cubeSettled, ensureCube } from './fx/cube';
import { buildEffectShaderFrame } from './shaderFrame';
import { drawStyledFrame, type StyledLook } from './styledFrame';

export interface GlSource { src: string; trimBefore: number; playbackRate?: number }
/** [remix] Fix A: how a clip is composited on the timeline (transform, keys, effects, fit, opacity), resolved per frame by `resolveLook` (host-provided, pure). */
export interface GlSideLook { fit?: 'contain' | 'cover'; [k: string]: unknown }
export type ResolveSideLook = (side: GlSideLook, frame: number, fps: number) => { look: StyledLook; effects: Array<{ id: string; overrides?: Record<string, number | number[]> }>; localFrame: number };

function drawFit(ctx: CanvasRenderingContext2D, source: CanvasImageSource, fit: 'contain' | 'cover') {
  const W = ctx.canvas.width; const H = ctx.canvas.height;
  const d = source as CanvasImageSource & { videoWidth?: number; videoHeight?: number; displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  const nw = d.videoWidth ?? d.displayWidth ?? d.width ?? 0; const nh = d.videoHeight ?? d.displayHeight ?? d.height ?? 0;
  ctx.clearRect(0, 0, W, H);
  if (!nw || !nh) return;
  const k = fit === 'cover' ? Math.max(W / nw, H / nh) : Math.min(W / nw, H / nh);
  ctx.drawImage(source, (W - nw * k) / 2, (H - nh * k) / 2, nw * k, nh * k);
}

export function GlTransitionLayer({ out, inn, glType, durationInFrames, fit = 'cover', customDef, glParams, outLook, innLook, resolveLook, windowFrom = 0, background = '#000' }: { out: GlSource; inn: GlSource; glType: string; durationInFrames: number; fit?: 'contain' | 'cover'; customDef?: CustomTransitionDef; glParams?: GltParams; outLook?: GlSideLook; innLook?: GlSideLook; resolveLook?: ResolveSideLook; /** composition frame where this window starts (the looks are resolved on the composition clock) */ windowFrom?: number; background?: string }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const env = useRemotionEnvironment();
  const rendering = env.isRendering || env.isClientSideRendering;
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const outCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<GlRuntime | null>(null);
  const staged = useRef({ out: -1, inn: -1 });
  const mk = () => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; };
  const stage = useMemo(() => ({ out: mk(), inn: mk() }), [width, height]); // eslint-disable-line react-hooks/exhaustive-deps
  // [remix] Fix A: per side, the composited clip (effects -> transform / crop / zoom / flip / opacity over the background) that the shader blends
  const styled = useMemo(() => ({ out: mk(), inn: mk() }), [width, height]); // eslint-disable-line react-hooks/exhaustive-deps
  const fxCanvas = useMemo(() => ({ out: mk(), inn: mk() }), [width, height]); // eslint-disable-line react-hooks/exhaustive-deps
  const fxRtOut = useRef<GlRuntime | null>(null);
  const fxRtInn = useRef<GlRuntime | null>(null);
  const fxRt = { out: fxRtOut, inn: fxRtInn };
  const looks = useMemo(() => (resolveLook && (outLook || innLook) ? { out: outLook, inn: innLook } : null), [resolveLook, outLook, innLook]);
  // [remix] plugin (openchatcut-plugin@1) transitions arrive as a snapshot: same two-input fragment contract, props → u_<key> defaults
  // [remix] Stage 6: vendored gl-transitions (glt-*) with their stored parameter overrides
  const def = GLSL_TRANSITIONS[glType as GlslTransitionType] ?? (isGltId(glType) ? { frag: gltFrag(glType)!, uniforms: () => gltUniforms(glType, glParams) } : undefined) ?? (customDef ? { frag: customDef.frag, uniforms: () => customTransitionUniforms(customDef) } : undefined);

  useEffect(() => {
    const canvas = glRef.current;
    if (!canvas || !def) return;
    const handle = rendering ? delayRender(`gl-transition ${glType}`) : null;
    let raf = 0; let done = false;
    const finish = () => { if (!done && handle != null) { done = true; continueRender(handle); } };
    const tick = () => {
      if (staged.current.out !== frame || staged.current.inn !== frame) { raf = requestAnimationFrame(tick); return; }
      try {
        const runtime = ensureRuntimeSlot(runtimeRef, () => createGlRuntime(canvas));
        const f = buildTransitionShaderFrame({ frag: def.frag, uniforms: def.uniforms }, { sequenceFrame: frame, durationInFrames, windowStartFrame: 0, fps, width, height, direction: 'left' });
        let a: TexImageSource = stage.out; let b: TexImageSource = stage.inn;
        if (looks && resolveLook) {
          const resolved = { out: looks.out ? resolveLook(looks.out, windowFrom + frame, fps) : null, inn: looks.inn ? resolveLook(looks.inn, windowFrom + frame, fps) : null };
          // a .cube LUT must be loaded before its pass runs
          let waiting = false;
          for (const key of ['out', 'inn'] as const) for (const e of resolved[key]?.effects ?? []) { const cube = ALL_FX[e.id]?.cube; if (cube) { void ensureCube(cube); if (!cubeSettled(cube)) waiting = true; } }
          if (waiting) { raf = requestAnimationFrame(tick); return; }
          for (const key of ['out', 'inn'] as const) {
            const r = resolved[key];
            const ctx = styled[key].getContext('2d');
            if (!ctx) continue;
            if (!r) { drawStyledFrame(ctx, stage[key], {}, background); continue; }
            const active = r.effects.filter((e) => e.id in ALL_FX).map((e) => ({ def: ALL_FX[e.id], overrides: e.overrides }));
            let picture: CanvasImageSource = stage[key];
            if (active.length) {
              const rt = ensureRuntimeSlot(fxRt[key], () => createGlRuntime(fxCanvas[key]));
              rt.renderFxChain(buildEffectShaderFrame(active, r.localFrame, fps).passes, stage[key]);
              picture = fxCanvas[key];
            }
            drawStyledFrame(ctx, picture, r.look, background);
          }
          a = styled.out; b = styled.inn;
        }
        runtime.render(f.frag, a, b, f.progress, f.uniforms);
        const mirror = outCanvasRef.current;
        if (mirror) { mirror.width = canvas.width; mirror.height = canvas.height; mirror.getContext('2d')?.drawImage(canvas, 0, 0); }
      } catch (e) { console.error('[gl-transition]', e); disposeRuntimeSlot(runtimeRef); }
      finish();
    };
    tick();
    return () => { cancelAnimationFrame(raf); finish(); };
  }, [frame, def, glType, glParams, durationInFrames, fps, width, height, rendering, stage, styled, fxCanvas, looks, resolveLook, windowFrom, background]);
  useEffect(() => () => { disposeRuntimeSlot(runtimeRef); disposeRuntimeSlot(fxRtOut); disposeRuntimeSlot(fxRtInn); }, []);

  if (!def) return null;
  const sideFit = (key: 'out' | 'inn'): 'contain' | 'cover' => (looks?.[key]?.fit === 'contain' ? 'contain' : looks?.[key] ? 'cover' : fit);
  const src = (s: GlSource, key: 'out' | 'inn') => (
    <AbsoluteFill style={{ opacity: 0, pointerEvents: 'none' }}>
      <MediaVideo src={s.src} trimBefore={s.trimBefore} playbackRate={s.playbackRate ?? 1} muted headless={rendering} objectFit={sideFit(key)}
        style={{ width: '100%', height: '100%' }}
        onVideoFrame={(frameSource: CanvasImageSource) => { const ctx = stage[key].getContext('2d'); if (ctx) { drawFit(ctx, frameSource, sideFit(key)); staged.current[key] = frame; } }} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill>
      {src(out, 'out')}
      {src(inn, 'inn')}
      <canvas ref={glRef} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: rendering ? 0 : 1 }} />
      {rendering && <canvas ref={outCanvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
    </AbsoluteFill>
  );
}
