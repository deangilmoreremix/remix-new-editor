// [remix] Fix E: a compound clip rendered as ONE group in the export. The compound's picture children are drawn (each with its own look: fx, pose, crop,
// fades, zoom, opacity, blend) into one offscreen canvas in z order, THEN the compound's own fx / LUT run once over that canvas and its own
// transform / crop / zoom / flip / opacity are applied once (resolveLook of the compound's own layer fields), exactly as for a single clip. So group opacity
// 0.5 over two overlapping children is not applied per child (the overlap is not darkened twice) and a blur sees the composited group.
// Same technique as GlTransitionLayer (MediaVideo with onVideoFrame -> canvas, hidden; the result is mirrored into a visible 2D canvas while rendering).
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, Sequence, continueRender, delayRender, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from 'remotion';
import { Video as MediaVideo } from '@remotion/media';
import { createGlRuntime, type GlRuntime } from './runtime';
import { ALL_FX } from './fx/effects';
import { cubeSettled, ensureCube } from './fx/cube';
import { buildEffectShaderFrame } from './shaderFrame';
import { drawStyledFrame } from './styledFrame';
import { backgroundFillAppearance, backgroundFillFilter } from '../editor/backgroundFill';
import type { GlSideLook, ResolveSideLook } from './GlTransitionLayer';

export interface GroupChild { id: string; kind: 'video' | 'image'; src: string; from: number; durationInFrames: number; trimBefore?: number; playbackRate?: number; fit?: 'contain' | 'cover'; clipBlend?: string; clipTransform?: { fill?: number } }

function drawFit(ctx: CanvasRenderingContext2D, source: CanvasImageSource, fit: 'contain' | 'cover') {
  const W = ctx.canvas.width; const H = ctx.canvas.height;
  const d = source as CanvasImageSource & { videoWidth?: number; videoHeight?: number; displayWidth?: number; displayHeight?: number; width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const nw = d.videoWidth ?? d.displayWidth ?? d.naturalWidth ?? d.width ?? 0; const nh = d.videoHeight ?? d.displayHeight ?? d.naturalHeight ?? d.height ?? 0;
  ctx.clearRect(0, 0, W, H);
  if (!nw || !nh) return;
  const k = fit === 'cover' ? Math.max(W / nw, H / nh) : Math.min(W / nw, H / nh);
  ctx.drawImage(source, (W - nw * k) / 2, (H - nh * k) / 2, nw * k, nh * k);
}

type Staged = Map<string, number>;

function ChildSource({ child, groupFrom, stage, fillStage, staged }: { child: GroupChild; groupFrom: number; stage: HTMLCanvasElement; fillStage: HTMLCanvasElement | null; staged: React.MutableRefObject<Staged> }) {
  const frame = useCurrentFrame(); // relative to the child's Sequence
  const env = useRemotionEnvironment();
  const rendering = env.isRendering || env.isClientSideRendering;
  const abs = child.from + frame;
  const fit = child.fit === 'contain' ? 'contain' : 'cover';
  const done = (src: CanvasImageSource) => {
    const ctx = stage.getContext('2d'); if (ctx) drawFit(ctx, src, fit);
    if (fillStage) { const f = fillStage.getContext('2d'); if (f) drawFit(f, src, 'cover'); }
    staged.current.set(child.id, abs);
  };
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (child.kind !== 'image') return;
    const handle = rendering ? delayRender(`group image ${child.id}`) : null;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; done(img); if (handle != null) continueRender(handle); };
    img.onerror = () => { if (handle != null) continueRender(handle); };
    img.src = child.src;
    return () => { if (handle != null) try { continueRender(handle); } catch { /* already released */ } };
  }, [child.src, child.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (child.kind === 'image' && imgRef.current) done(imgRef.current); }, [abs]); // eslint-disable-line react-hooks/exhaustive-deps
  void groupFrom;
  if (child.kind === 'image') return null;
  return (
    <AbsoluteFill style={{ opacity: 0, pointerEvents: 'none' }}>
      <MediaVideo src={child.src} trimBefore={child.trimBefore || 0} playbackRate={child.playbackRate ?? 1} muted headless={rendering} objectFit={fit}
        style={{ width: '100%', height: '100%' }} onVideoFrame={(frameSource: CanvasImageSource) => done(frameSource)} />
    </AbsoluteFill>
  );
}

export function GroupLayer({ group, items: children, resolveLook, sideOf, from }: { group: Record<string, unknown>; items: GroupChild[]; resolveLook: ResolveSideLook; sideOf: (layer: Record<string, unknown>) => GlSideLook; /** composition frame where the group starts */ from: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const env = useRemotionEnvironment();
  const rendering = env.isRendering || env.isClientSideRendering;
  const abs = from + frame;
  const mk = () => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; };
  const bufs = useMemo(() => ({
    group: mk(), groupFx: mk(),
    stage: new Map<string, HTMLCanvasElement>(), fill: new Map<string, HTMLCanvasElement>(), styled: new Map<string, HTMLCanvasElement>(), fx: new Map<string, HTMLCanvasElement>(),
  }), [width, height]); // eslint-disable-line react-hooks/exhaustive-deps
  for (const c of children) {
    if (!bufs.stage.has(c.id)) { bufs.stage.set(c.id, mk()); bufs.fx.set(c.id, mk()); }
    if (c.clipTransform?.fill !== undefined && !bufs.fill.has(c.id)) bufs.fill.set(c.id, mk());
  }
  // hold the frame from a layout effect (see GlTransitionLayer)
  const hold = useRef<number | null>(null);
  const releaseH = (h: number | null) => { if (h != null && hold.current === h) { hold.current = null; try { continueRender(h); } catch { /* released */ } } };
  useLayoutEffect(() => { const h = rendering ? delayRender('compound group frame') : null; hold.current = h; return () => releaseH(h); }, [abs, rendering]); // eslint-disable-line react-hooks/exhaustive-deps
  const staged = useRef<Staged>(new Map());
  const rts = useRef(new Map<string, GlRuntime>());
  const groupRt = useRef<GlRuntime | null>(null);
  const outRef = useRef<HTMLCanvasElement | null>(null);
  const sides = useMemo(() => new Map(children.map((c) => [c.id, sideOf(c as unknown as Record<string, unknown>)])), [children, sideOf]);
  const groupSide = useMemo(() => sideOf(group), [group, sideOf]);

  const active = children.filter((c) => abs >= c.from && abs < c.from + c.durationInFrames);

  useEffect(() => {
    const handle = rendering ? hold.current : null;
    let raf = 0; let done = false;
    const finish = () => { if (!done) { done = true; releaseH(handle); } };
    const tick = () => {
      if (active.some((c) => staged.current.get(c.id) !== abs)) { raf = requestAnimationFrame(tick); return; }
      try {
        const resolved = active.map((c) => ({ c, r: resolveLook(sides.get(c.id) as GlSideLook, abs, fps) }));
        const gr = resolveLook(groupSide, abs, fps);
        // a .cube LUT must be loaded before its pass runs
        let waiting = false;
        for (const e of [...resolved.flatMap((x) => x.r.effects), ...gr.effects]) { const cube = ALL_FX[e.id]?.cube; if (cube) { void ensureCube(cube); if (!cubeSettled(cube)) waiting = true; } }
        if (waiting) { raf = requestAnimationFrame(tick); return; }
        const gctx = bufs.group.getContext('2d');
        if (gctx) {
          gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.globalAlpha = 1; gctx.globalCompositeOperation = 'source-over'; gctx.clearRect(0, 0, width, height);
          for (const { c, r } of resolved) {
            let picture: CanvasImageSource = bufs.stage.get(c.id) as HTMLCanvasElement;
            const fxs = r.effects.filter((e) => e.id in ALL_FX).map((e) => ({ def: ALL_FX[e.id], overrides: e.overrides }));
            if (fxs.length) {
              let rt = rts.current.get(c.id);
              if (!rt) { rt = createGlRuntime(bufs.fx.get(c.id) as HTMLCanvasElement); rts.current.set(c.id, rt); }
              rt.renderFxChain(buildEffectShaderFrame(fxs, r.localFrame, fps).passes, picture);
              picture = bufs.fx.get(c.id) as HTMLCanvasElement;
            }
            const app = r.fill && bufs.fill.get(c.id) ? backgroundFillAppearance(width, height, r.fill.strength) : null;
            drawStyledFrame(gctx, picture, {
              ...r.look, keep: true, blend: c.clipBlend,
              ...(app && r.fill ? { fill: { source: bufs.fill.get(c.id) as HTMLCanvasElement, filter: backgroundFillFilter(app), scale: app.overscanScale, transform: r.fill.transform, opacity: r.fill.opacity } } : {}),
            });
          }
        }
        // the compound's own fx / LUT once over the composited group, then its own transform / crop / zoom / flip / opacity once
        let picture: CanvasImageSource = bufs.group;
        const gfx = gr.effects.filter((e) => e.id in ALL_FX).map((e) => ({ def: ALL_FX[e.id], overrides: e.overrides }));
        if (gfx.length) {
          groupRt.current ??= createGlRuntime(bufs.groupFx);
          groupRt.current.renderFxChain(buildEffectShaderFrame(gfx, gr.localFrame, fps).passes, bufs.group);
          picture = bufs.groupFx;
        }
        const out = outRef.current; const octx = out?.getContext('2d');
        if (out && octx) { if (out.width !== width || out.height !== height) { out.width = width; out.height = height; } drawStyledFrame(octx, picture, gr.look); }
      } catch (e) { console.error('[compound-group]', e); }
      if (rendering) raf = requestAnimationFrame(() => { raf = requestAnimationFrame(finish); }); else finish(); // let the canvas paint before the frame is captured
    };
    tick();
    return () => { cancelAnimationFrame(raf); finish(); };
  }, [abs, fps, width, height, rendering, bufs, sides, groupSide, resolveLook, children]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { rts.current.forEach((r) => r.dispose()); rts.current.clear(); groupRt.current?.dispose(); groupRt.current = null; }, []);

  const blend = group.clipBlend as string | undefined;
  return (
    <AbsoluteFill style={blend ? { mixBlendMode: blend as React.CSSProperties['mixBlendMode'] } : undefined}>
      {children.map((c) => (
        <Sequence key={c.id} from={c.from - from} durationInFrames={c.durationInFrames} layout="none">
          <ChildSource child={c} groupFrom={from} stage={bufs.stage.get(c.id) as HTMLCanvasElement} fillStage={bufs.fill.get(c.id) ?? null} staged={staged} />
        </Sequence>
      ))}
      <canvas ref={outRef} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
}
