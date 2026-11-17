// [remix] Fix E: compound clips rendered as ONE group in the preview. The playback engine plays the compound's picture children as ordinary <video>
// elements (each with its own look); while the playhead is inside a compound that has a look of its own (fx, opacity, blend, transform, crop, flip),
// this layer draws those children into one offscreen canvas (z order, each with its own look), runs the compound's fx once over it and shows the
// result with the compound's own transform / crop / opacity / blend applied ONCE. The children's elements (and their fill canvases) are hidden meanwhile.
import { useEffect, useRef } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import { clipEffectiveDuration } from '@cinegen/types/timeline';
import { createGlRuntime } from '../../../openchatcut/gl/runtime';
import type { GlRuntime } from '../../../openchatcut/gl/runtimeTypes';
import { clipFxPasses, clipHasFx, primeClipLuts } from '@cinegen/lib/occ/clip-fx';
import { drawStyledFrame } from '../../../openchatcut/gl/styledFrame';
import { interpolateProperty } from '@cinegen/lib/editor/timeline-operations';
import { clipPoseCss } from '@cinegen/lib/editor/stage2/anim';
import { backgroundFillAppearance, backgroundFillFilter } from '../../../openchatcut/editor/backgroundFill';

interface Props { container: HTMLElement | null; groups: Clip[] | undefined; clips: Clip[]; currentTime: number }
interface Slot { canvas: HTMLCanvasElement; group: HTMLCanvasElement; fx: HTMLCanvasElement; fxRt: GlRuntime | null; out: GlRuntime | null; kids: Map<string, { stage: HTMLCanvasElement; fx: HTMLCanvasElement; rt: GlRuntime | null }> }

export function GlGroupLayer({ container, groups, clips, currentTime }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ groups, clips, currentTime });
  live.current = { groups, clips, currentTime };
  const has = !!groups?.length;
  useEffect(() => { for (const g of groups ?? []) void primeClipLuts(g); }, [groups]);

  useEffect(() => {
    const hostEl = host.current;
    if (!has || !container || !hostEl) return;
    const slots = new Map<string, Slot>();
    let hidden: HTMLElement[] = [];
    let raf = 0;
    const restore = () => { hidden.forEach((e) => { e.style.visibility = ''; }); hidden = []; };
    const mk = () => document.createElement('canvas');
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { groups: gs, clips: cs, currentTime: t } = live.current;
      const nextHidden: HTMLElement[] = [];
      const shown = new Set<string>();
      for (const g of gs ?? []) {
        const gt = t - g.startTime;
        if (gt < 0 || gt >= clipEffectiveDuration(g)) continue;
        const members = cs.filter((c) => c.compoundGroup === g.id);
        const vids = members.map((c) => ({ c, v: container.querySelector(`video[data-clip-id="${c.id}"]`) as HTMLVideoElement | null })).filter((x): x is { c: Clip; v: HTMLVideoElement } => !!x.v && x.v.readyState >= 2 && x.v.videoWidth > 0 && x.v.style.opacity !== '0');
        if (!vids.length) continue;
        let slot = slots.get(g.id);
        if (!slot) {
          const canvas = mk(); canvas.dataset.testid = 'gl-group-layer'; canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
          hostEl.appendChild(canvas);
          slot = { canvas, group: mk(), fx: mk(), fxRt: null, out: null, kids: new Map() }; slots.set(g.id, slot);
        }
        try {
          const cw = container.clientWidth || 1280; const ch = container.clientHeight || 720;
          const dpr = Math.min(2, window.devicePixelRatio || 1); const cap = Math.min(1, 1600 / Math.max(cw, ch, 1));
          const W = Math.max(2, Math.round(cw * dpr * cap)); const H = Math.max(2, Math.round(ch * dpr * cap));
          for (const c of [slot.canvas, slot.group, slot.fx]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
          const gctx = slot.group.getContext('2d'); const octx = slot.canvas.getContext('2d');
          if (!gctx || !octx) continue;
          gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, W, H);
          // z order = the engine's z-index of each child element
          vids.sort((a, b) => Number(a.v.style.zIndex || 0) - Number(b.v.style.zIndex || 0));
          let zTop = 0;
          for (const { c, v } of vids) {
            let k = slot.kids.get(c.id); if (!k) { k = { stage: mk(), fx: mk(), rt: null }; slot.kids.set(c.id, k); }
            for (const cv of [k.stage, k.fx]) if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
            const sctx = k.stage.getContext('2d'); if (!sctx) continue;
            const fit = v.style.objectFit === 'cover' ? 'cover' : 'contain';
            const kk = fit === 'cover' ? Math.max(W / v.videoWidth, H / v.videoHeight) : Math.min(W / v.videoWidth, H / v.videoHeight);
            sctx.clearRect(0, 0, W, H); sctx.drawImage(v, (W - v.videoWidth * kk) / 2, (H - v.videoHeight * kk) / 2, v.videoWidth * kk, v.videoHeight * kk);
            let picture: CanvasImageSource = k.stage;
            if (clipHasFx(c)) { k.rt ??= createGlRuntime(k.fx); k.rt.renderFxChain(clipFxPasses(c, v.currentTime, Math.max(0, (v.currentTime - c.trimStart) / (c.speed || 1))), k.stage); picture = k.fx; }
            const op = interpolateProperty(c, 'opacity', Math.max(0, t - c.startTime));
            const look: Parameters<typeof drawStyledFrame>[2] = { cssTransform: v.style.transform, clipPath: v.style.clipPath, opacity: op, keep: true, blend: c.blendMode };
            const fillCv = container.querySelector(`canvas[data-fill-for="${c.id}"]`) as HTMLCanvasElement | null;
            if (fillCv && c.transform?.fill !== undefined) { const a = backgroundFillAppearance(W, H, c.transform.fill); look.fill = { source: fillCv, filter: backgroundFillFilter(a), scale: a.overscanScale, opacity: op }; nextHidden.push(fillCv); }
            drawStyledFrame(gctx, picture, look);
            nextHidden.push(v); zTop = Math.max(zTop, Number(v.style.zIndex || 0));
          }
          // the compound's own fx once over the composited group
          let pic: CanvasImageSource = slot.group;
          if (clipHasFx(g)) { slot.fxRt ??= createGlRuntime(slot.fx); slot.fxRt.renderFxChain(clipFxPasses(g, gt, gt), slot.group); pic = slot.fx; }
          octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, W, H); octx.drawImage(pic, 0, 0, W, H);
          // ... and its own transform / crop / opacity / blend / flip once, as CSS on the group canvas (as the engine does for a single clip's element)
          const pose = clipPoseCss(g, gt);
          const flip = `scale(${g.flipH ? -1 : 1}, ${g.flipV ? -1 : 1})`;
          slot.canvas.style.transform = `${flip}${pose.transform ? ` ${pose.transform}` : ''}`;
          slot.canvas.style.clipPath = pose.clipPath ?? '';
          slot.canvas.style.opacity = String(interpolateProperty(g, 'opacity', gt));
          slot.canvas.style.mixBlendMode = g.blendMode && g.blendMode !== 'normal' ? g.blendMode : '';
          slot.canvas.style.zIndex = String(zTop);
          slot.canvas.style.visibility = 'visible';
          shown.add(g.id);
        } catch { /* keep the children visible when the group cannot be drawn */ nextHidden.length = 0; }
      }
      for (const [id, s] of slots) if (!shown.has(id)) s.canvas.style.visibility = 'hidden';
      for (const e of nextHidden) { e.style.visibility = 'hidden'; }
      hidden.filter((e) => !nextHidden.includes(e)).forEach((e) => { e.style.visibility = ''; });
      hidden = nextHidden;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); restore(); for (const s of slots.values()) { s.canvas.remove(); s.fxRt?.dispose(); s.out?.dispose(); s.kids.forEach((k) => k.rt?.dispose()); } };
  }, [container, has]);

  return has ? <div ref={host} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} /> : null;
}
