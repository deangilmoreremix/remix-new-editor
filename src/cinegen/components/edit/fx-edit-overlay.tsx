// [remix] Fix C: draggable handles on the preview for the Path Mask (pen tool: click / drag points and bezier handles) and the Corner Pin
// (four corners). Mounted by GlClipLayer next to the effect canvas and given the same CSS transform, so the handles sit on the picture as the
// clip is positioned; drags write through the session callback published by the inspector (fx-edit-store). Preview-only UI: nothing is rendered
// into the export.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ALL_FX } from '../../../openchatcut/gl/fx/effects';
import { useFxEdit, selectVertex, type FxEditSession } from '@cinegen/lib/occ/fx-edit-store';
import { getAutoKey } from '@cinegen/lib/editor/stage2/auto-key-store';
import { moveAnchorPatch, sampledFxAt, scalarPatch, setPathPatch } from '@cinegen/lib/occ/fx-edit-model';
import { flattenPath, fromPathSpace, insertVertexNear, maskParams, pathAt, polyCentroid, toPathSpace, removeVertex, type PathVertex } from '../../../openchatcut/gl/fx/s9/pathMask';
import { CORNER_KEYS, propsFromQuad, quadFromProps } from '../../../openchatcut/gl/fx/s9/cornerPin';
import type { Quad } from '../../../openchatcut/gl/fx/s9/homography';

interface View { cw: number; ch: number; aspect: number; fit: string; transform: string }
const sameView = (a: View, b: View) => a.cw === b.cw && a.ch === b.ch && a.aspect === b.aspect && a.fit === b.fit && a.transform === b.transform;
/** Rect of the picture inside the layer box (object-fit contain / cover). */
export function frameRect(v: Pick<View, 'cw' | 'ch' | 'aspect' | 'fit'>): { x: number; y: number; w: number; h: number } {
  const boxA = v.cw / Math.max(1, v.ch);
  const wide = v.fit === 'cover' ? v.aspect < boxA : v.aspect > boxA;
  const w = wide ? v.cw : v.ch * v.aspect; const h = wide ? v.cw / v.aspect : v.ch;
  return { x: (v.cw - w) / 2, y: (v.ch - h) / 2, w, h };
}

const HANDLE = 5.5;
const col = { path: '#22d3ee', pt: '#ffffff', sel: '#facc15', handle: '#f472b6', quad: '#22d3ee' };

export function FxEditOverlay({ canvasRef, clipId }: { canvasRef: RefObject<HTMLCanvasElement | null>; clipId?: string | null }) {
  const { session, tool, selected } = useFxEdit();
  const svgRef = useRef<SVGSVGElement>(null);
  const sessRef = useRef<FxEditSession | null>(null); sessRef.current = session;
  const [view, setView] = useState<View>({ cw: 0, ch: 0, aspect: 16 / 9, fit: 'contain', transform: '' });
  const lastPress = useRef({ t: 0, a: -1 }); // pointer capture sends dblclick to the svg: a double press on an anchor is detected in `down`
  const drag = useRef<null | { kind: 'anchor' | 'in' | 'out' | 'corner' | 'quad' | 'pen'; i: number; last?: [number, number]; moved?: boolean }>(null);
  const kind = session ? ALL_FX[session.clip.fx?.[session.fxIndex]?.id ?? '']?.editor : undefined;
  const live = !!session && session.clip.id === clipId && (kind === 'mask' || kind === 'cornerpin'); // only over the clip being edited

  // follow the effect canvas: its box, picture aspect, object-fit and transform (the clip's pose)
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const svg = svgRef.current; const cv = canvasRef.current;
      if (!svg) return;
      const next: View = { cw: svg.clientWidth, ch: svg.clientHeight, aspect: cv && cv.width && cv.height ? cv.width / cv.height : 16 / 9, fit: cv?.style.objectFit || 'contain', transform: cv?.style.transform ?? '' };
      setView((old) => (sameView(old, next) ? old : next));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [live, canvasRef]);

  // Delete / Backspace removes the selected path point
  useEffect(() => {
    if (!live || kind !== 'mask') return;
    const onKey = (e: KeyboardEvent) => {
      const s = sessRef.current; const tgt = e.target as HTMLElement | null;
      if (!s || selected < 0 || (e.key !== 'Delete' && e.key !== 'Backspace') || tgt?.closest('input,textarea,select,[contenteditable]')) return;
      const path = pathAt(sampledFxAt(s.clip, s.fxIndex, s.clipT));
      if (path.length <= 0) return;
      e.preventDefault();
      s.apply(setPathPatch(s.clip, s.fxIndex, removeVertex(path, selected), s.clipT, true));
      selectVertex(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, kind, selected]);

  if (!live || !session) return null;
  const fr = frameRect(view);
  const props = sampledFxAt(session.clip, session.fxIndex, session.clipT);
  const toSvg = (u: number, v: number): [number, number] => [fr.x + u * fr.w, fr.y + v * fr.h];
  const fromEvent = (e: React.PointerEvent): [number, number] | null => {
    const svg = svgRef.current; const m = svg?.getScreenCTM();
    if (!svg || !m || !fr.w || !fr.h) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [(p.x - fr.x) / fr.w, (p.y - fr.y) / fr.h];
  };

  // ---- corner pin -----------------------------------------------------------------------------------------------------------
  const quad = quadFromProps(props);
  const setCorner = (i: number, x: number, y: number) => { const s = sessRef.current!; s.apply(scalarPatch(s.clip, s.fxIndex, { [CORNER_KEYS[i][0]]: x, [CORNER_KEYS[i][1]]: y }, s.clipT, getAutoKey())); };
  const moveQuad = (dx: number, dy: number) => { const s = sessRef.current!; const q = quadFromProps(sampledFxAt(s.clip, s.fxIndex, s.clipT)).map(([x, y]) => [x + dx, y + dy]) as Quad; s.apply(scalarPatch(s.clip, s.fxIndex, propsFromQuad(q), s.clipT, getAutoKey())); };

  // ---- path mask ------------------------------------------------------------------------------------------------------------
  const path = pathAt(props);
  const mp = maskParams(props);
  const centroid = polyCentroid(flattenPath(path));
  const aspect = view.aspect;
  const frameOf = (x: number, y: number) => fromPathSpace(mp, centroid, aspect, x, y);
  const pathPoint = (u: number, v: number) => toPathSpace(mp, centroid, aspect, u, v);
  const poly = path.length >= 2 ? flattenPath(path).map(([x, y]) => frameOf(x, y)) : [];
  const toD = (pts: Array<[number, number]>, close: boolean) => pts.map((p, i) => `${i ? 'L' : 'M'}${toSvg(p[0], p[1]).join(' ')}`).join('') + (close ? 'Z' : '');
  const writePath = (next: PathVertex[], structural: boolean) => { const s = sessRef.current!; s.apply(setPathPatch(s.clip, s.fxIndex, next, s.clipT, structural)); };
  const nearOutline = (u: number, v: number) => {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = toSvg(...poly[i]), b = toSvg(...poly[(i + 1) % poly.length]); const [px, py] = toSvg(u, v);
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy));
    }
    return best < 7;
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const pos = fromEvent(e); const s = sessRef.current;
    if (!pos || !s || e.button !== 0) return;
    const [u, v] = pos;
    const t = (e.target as SVGElement).dataset;
    svgRef.current!.setPointerCapture(e.pointerId);
    if (kind === 'cornerpin') {
      if (t.corner !== undefined) drag.current = { kind: 'corner', i: Number(t.corner) };
      else if (t.quad !== undefined) drag.current = { kind: 'quad', i: 0, last: [u, v] };
      return;
    }
    if (t.anchor !== undefined) {
      const i = Number(t.anchor); const now = performance.now(); const dbl = lastPress.current.a === i && now - lastPress.current.t < 400; lastPress.current = { t: now, a: i };
      selectVertex(i);
      if (dbl && kind === 'mask' && tool === 'edit') { toggleSmooth(i); lastPress.current = { t: 0, a: -1 }; return; }
      drag.current = { kind: 'anchor', i }; return;
    }
    if (t.handle !== undefined) { const [which, idx] = t.handle.split(':'); drag.current = { kind: which as 'in' | 'out', i: Number(idx) }; return; }
    const p = pathPoint(u, v);
    if (tool === 'pen') {
      const next = [...path, { x: p[0], y: p[1], inX: 0, inY: 0, outX: 0, outY: 0 }];
      writePath(next, true); selectVertex(next.length - 1); drag.current = { kind: 'pen', i: next.length - 1, last: p };
    } else if (nearOutline(u, v) && path.length >= 2) {
      const ins = insertVertexNear(path, p[0], p[1], aspect); writePath(ins.path, true); selectVertex(ins.index); drag.current = { kind: 'anchor', i: ins.index };
    } else selectVertex(-1);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; const s = sessRef.current; const pos = fromEvent(e);
    if (!d || !s || !pos) return;
    const [u, v] = pos;
    if (d.kind === 'corner') { setCorner(d.i, u, v); return; }
    if (d.kind === 'quad') { moveQuad(u - d.last![0], v - d.last![1]); d.last = [u, v]; return; }
    const cur = pathAt(sampledFxAt(s.clip, s.fxIndex, s.clipT));
    const p = pathPoint(u, v);
    if (d.kind === 'anchor') { s.apply(moveAnchorPatch(s.clip, s.fxIndex, d.i, p[0], p[1], s.clipT, getAutoKey())); return; }
    const a = cur[d.i]; if (!a) return;
    const ox = p[0] - a.x, oy = p[1] - a.y; // handle offset from the anchor
    if (d.kind === 'pen') { if (Math.hypot(ox * aspect, oy) > 0.01) writePath(cur.map((q, j) => (j === d.i ? { ...q, outX: ox, outY: oy, inX: -ox, inY: -oy } : q)), false); return; }
    // dragging one handle mirrors the other (smooth point) unless Alt is held
    const next = cur.map((q, j) => (j !== d.i ? q : d.kind === 'out' ? { ...q, outX: ox, outY: oy, ...(e.altKey ? {} : { inX: -ox, inY: -oy }) } : { ...q, inX: ox, inY: oy, ...(e.altKey ? {} : { outX: -ox, outY: -oy }) }));
    writePath(next, false);
  };
  const up = (e: React.PointerEvent<SVGSVGElement>) => { drag.current = null; try { svgRef.current?.releasePointerCapture(e.pointerId); } catch { /* not captured */ } };
  const toggleSmooth = (i: number) => {
    const s = sessRef.current; if (!s) return;
    const cur = pathAt(sampledFxAt(s.clip, s.fxIndex, s.clipT)); const a = cur[i]; if (!a) return;
    const hasH = a.inX || a.inY || a.outX || a.outY;
    const prev = cur[(i + cur.length - 1) % cur.length], nxt = cur[(i + 1) % cur.length];
    const tx = (nxt.x - prev.x) / 6, ty = (nxt.y - prev.y) / 6; // auto-smooth: tangent parallel to the neighbours' chord
    writePath(cur.map((q, j) => (j !== i ? q : hasH ? { ...q, inX: 0, inY: 0, outX: 0, outY: 0 } : { ...q, inX: -tx, inY: -ty, outX: tx, outY: ty })), false);
  };

  return (
    <svg ref={svgRef} data-testid="fx-edit-overlay" data-kind={kind} tabIndex={-1}
      viewBox={`0 0 ${Math.max(1, view.cw)} ${Math.max(1, view.ch)}`} preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: view.transform || undefined, pointerEvents: kind === 'mask' && tool === 'pen' ? 'auto' : 'none', cursor: kind === 'mask' && tool === 'pen' ? 'crosshair' : 'default', touchAction: 'none', overflow: 'visible', zIndex: 5 }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <rect x={fr.x} y={fr.y} width={fr.w} height={fr.h} fill="none" stroke="rgba(255,255,255,.25)" strokeDasharray="4 4" pointerEvents="none" />
      {kind === 'cornerpin' && (
        <>
          <path data-quad="1" d={toD(quad, true)} fill="rgba(34,211,238,.08)" stroke={col.quad} strokeWidth={1.5} style={{ pointerEvents: 'all', cursor: 'move' }} />
          {quad.map((q, i) => { const [x, y] = toSvg(q[0], q[1]); return (
            <g key={i} style={{ pointerEvents: 'all', cursor: 'move' }}>
              <circle data-corner={i} data-testid={`corner-${i}`} cx={x} cy={y} r={HANDLE + 1.5} fill={col.pt} stroke={col.quad} strokeWidth={2} />
            </g>); })}
        </>
      )}
      {kind === 'mask' && (
        <>
          {poly.length > 1 && <path d={toD(poly, path.length >= 3)} fill={path.length >= 3 ? 'rgba(34,211,238,.10)' : 'none'} stroke={col.path} strokeWidth={1.5} pointerEvents="none" />}
          {poly.length > 1 && <path d={toD(poly, path.length >= 3)} fill="none" stroke="transparent" strokeWidth={10} style={{ pointerEvents: tool === 'edit' ? 'stroke' : 'none' }} />}
          {selected >= 0 && path[selected] && (() => {
            const a = path[selected];
            const ps = ([['in', a.inX, a.inY], ['out', a.outX, a.outY]] as const).filter(([, hx, hy]) => hx || hy).map(([w, hx, hy]) => ({ w, anchor: toSvg(...frameOf(a.x, a.y)), pt: toSvg(...frameOf(a.x + hx, a.y + hy)) }));
            return ps.map((h) => (
              <g key={h.w}>
                <line x1={h.anchor[0]} y1={h.anchor[1]} x2={h.pt[0]} y2={h.pt[1]} stroke={col.handle} strokeWidth={1} pointerEvents="none" />
                <circle data-handle={`${h.w}:${selected}`} cx={h.pt[0]} cy={h.pt[1]} r={4.5} fill={col.handle} stroke="#fff" strokeWidth={1} style={{ pointerEvents: 'all', cursor: 'pointer' }} />
              </g>));
          })()}
          {path.map((a, i) => { const [x, y] = toSvg(...frameOf(a.x, a.y)); return (
            <rect key={i} data-anchor={i} data-testid={`anchor-${i}`} x={x - HANDLE} y={y - HANDLE} width={HANDLE * 2} height={HANDLE * 2} fill={i === selected ? col.sel : col.pt} stroke={col.path} strokeWidth={1.5} style={{ pointerEvents: 'all', cursor: 'move' }} />); })}
        </>
      )}
    </svg>
  );
}
