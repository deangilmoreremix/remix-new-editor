// SPDX-License-Identifier: AGPL-3.0-or-later — modelled on OpenChatCut's gl/GlTransition.tsx and ClipFx.tsx.
// [remix] Renders one GL transition between two video sources inside a Remotion <Sequence> that spans the overlap window;
// used by the export composition so CineGen cut transitions are burned into the MP4.
import { useEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from 'remotion';
import { Video as MediaVideo } from '@remotion/media';
import { createGlRuntime, type GlRuntime } from './runtime';
import { disposeRuntimeSlot, ensureRuntimeSlot } from './runtimeSlot';
import { GLSL_TRANSITIONS } from './transitions';
import { buildTransitionShaderFrame } from './shaderFrame';
import type { GlslTransitionType } from '../types';

export interface GlSource { src: string; trimBefore: number; playbackRate?: number }

function drawFit(ctx: CanvasRenderingContext2D, source: CanvasImageSource, fit: 'contain' | 'cover') {
  const W = ctx.canvas.width; const H = ctx.canvas.height;
  const d = source as CanvasImageSource & { videoWidth?: number; videoHeight?: number; displayWidth?: number; displayHeight?: number; width?: number; height?: number };
  const nw = d.videoWidth ?? d.displayWidth ?? d.width ?? 0; const nh = d.videoHeight ?? d.displayHeight ?? d.height ?? 0;
  ctx.clearRect(0, 0, W, H);
  if (!nw || !nh) return;
  const k = fit === 'cover' ? Math.max(W / nw, H / nh) : Math.min(W / nw, H / nh);
  ctx.drawImage(source, (W - nw * k) / 2, (H - nh * k) / 2, nw * k, nh * k);
}

export function GlTransitionLayer({ out, inn, glType, durationInFrames, fit = 'cover' }: { out: GlSource; inn: GlSource; glType: string; durationInFrames: number; fit?: 'contain' | 'cover' }) {
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
  const def = GLSL_TRANSITIONS[glType as GlslTransitionType];

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
        runtime.render(f.frag, stage.out, stage.inn, f.progress, f.uniforms);
        const mirror = outCanvasRef.current;
        if (mirror) { mirror.width = canvas.width; mirror.height = canvas.height; mirror.getContext('2d')?.drawImage(canvas, 0, 0); }
      } catch (e) { console.error('[gl-transition]', e); disposeRuntimeSlot(runtimeRef); }
      finish();
    };
    tick();
    return () => { cancelAnimationFrame(raf); finish(); };
  }, [frame, def, glType, durationInFrames, fps, width, height, rendering, stage]);
  useEffect(() => () => disposeRuntimeSlot(runtimeRef), []);

  if (!def) return null;
  const src = (s: GlSource, key: 'out' | 'inn') => (
    <AbsoluteFill style={{ opacity: 0, pointerEvents: 'none' }}>
      <MediaVideo src={s.src} trimBefore={s.trimBefore} playbackRate={s.playbackRate ?? 1} muted headless={rendering} objectFit={fit}
        style={{ width: '100%', height: '100%' }}
        onVideoFrame={(frameSource: CanvasImageSource) => { const ctx = stage[key].getContext('2d'); if (ctx) { drawFit(ctx, frameSource, fit); staged.current[key] = frame; } }} />
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
