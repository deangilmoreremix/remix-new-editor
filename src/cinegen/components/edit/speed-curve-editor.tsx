// [remix] Stage 11 (port J): speed-ramp curve editor. A graph of speed over the clip's source range with draggable points; the easing of each segment is
// edited with the Stage 2 CurveEditor (presets / cubic-bezier / spring), the same component the keyframe curves use. Apply cuts the clip into pieces that
// follow the curve (lib/editor/stage11/speed-curve.ts), so preview and export play the same thing.
import { useMemo, useRef, useState } from 'react';
import { CurveEditor } from './curve-editor';
import type { EaseSpec } from '@cinegen/lib/editor/stage2/easing';
import { RAMP_MAX_SPEED, RAMP_MIN_SPEED } from '@cinegen/lib/editor/stage1/speed-ramp';
import {
  CURVE_PRESETS, CURVE_DEFAULT_STEPS, CURVE_MAX_STEPS, CURVE_MIN_STEPS, curveDuration, curvePieceSpeeds, curveSpeedAt, normalizeCurve, pieceDuration, sampleCurve,
  type SpeedCurve,
} from '@cinegen/lib/editor/stage11/speed-curve';

const W = 300; const H = 150; const PAD = 14;
const LMIN = Math.log2(RAMP_MIN_SPEED); const LMAX = Math.log2(RAMP_MAX_SPEED);
const px = (u: number) => PAD + u * (W - 2 * PAD);
const py = (s: number) => PAD + (1 - (Math.log2(Math.max(RAMP_MIN_SPEED, Math.min(RAMP_MAX_SPEED, s))) - LMIN) / (LMAX - LMIN)) * (H - 2 * PAD);
const unx = (p: number) => Math.max(0, Math.min(1, (p - PAD) / (W - 2 * PAD)));
const uns = (p: number) => 2 ** (LMIN + (1 - (p - PAD) / (H - 2 * PAD)) * (LMAX - LMIN));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function SpeedCurveEditor({ sourceSeconds, initial, initialSteps, note, onApply, onClose }: { sourceSeconds: number; initial?: SpeedCurve; initialSteps?: number; /** [remix] Fix M: re-edit / stale-group message */ note?: string; onApply: (curve: SpeedCurve, steps: number) => void; onClose: () => void }) {
  const [curve, setCurve] = useState<SpeedCurve>(() => normalizeCurve(initial ?? CURVE_PRESETS['hero-moment'].curve));
  const [steps, setSteps] = useState(initialSteps ?? CURVE_DEFAULT_STEPS);
  const [sel, setSel] = useState(0); // selected point = the segment that starts there
  const [easeOpen, setEaseOpen] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const pts = curve.points;
  const speeds = useMemo(() => curvePieceSpeeds(curve, steps), [curve, steps]);
  const outSec = useMemo(() => pieceDuration(speeds, sourceSeconds), [speeds, sourceSeconds]);
  const line = useMemo(() => sampleCurve(curve, 90).map(([u, s]) => `${px(u).toFixed(1)},${py(s).toFixed(1)}`).join(' '), [curve]);

  const local = (ev: { clientX: number; clientY: number }) => { const r = svg.current!.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H }; };
  const setPoint = (i: number, at: number | undefined, speed: number) => setCurve((c) => {
    const next = c.points.map((p) => ({ ...p }));
    const last = next.length - 1;
    if (at !== undefined && i > 0 && i < last) next[i].at = Math.max(next[i - 1].at + 0.01, Math.min(next[i + 1].at - 0.01, at));
    next[i].speed = r3(Math.max(RAMP_MIN_SPEED, Math.min(RAMP_MAX_SPEED, speed)));
    return { points: next };
  });
  const dragPoint = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation(); setSel(i);
    const move = (ev: PointerEvent) => { const p = local(ev); setPoint(i, unx(p.x), uns(p.y)); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const addPoint = (e: React.MouseEvent) => {
    const p = local(e); const u = unx(p.x);
    if (pts.some((q) => Math.abs(q.at - u) < 0.03)) return;
    setCurve((c) => {
      const i = c.points.findIndex((q) => q.at > u);
      const next = [...c.points.slice(0, i), { at: r3(u), speed: r3(curveSpeedAt(c, u)), ease: c.points[i - 1].ease }, ...c.points.slice(i)];
      return { points: next };
    });
    setSel(pts.findIndex((q) => q.at > u));
  };
  const removePoint = (i: number) => { if (i === 0 || i === pts.length - 1) return; setCurve((c) => ({ points: c.points.filter((_, k) => k !== i) })); setSel(0); };
  const setEase = (e: EaseSpec) => setCurve((c) => ({ points: c.points.map((p, k) => (k === sel ? { ...p, ease: e } : p)) }));
  const segEnd = pts[Math.min(sel + 1, pts.length - 1)];

  return (
    <div role="dialog" aria-label="Speed curve" data-testid="speed-curve-editor" style={{ position: 'fixed', left: 560, bottom: 44, width: W + 24, zIndex: 55, background: 'var(--bg-elevated, #151a24)', color: '#eee', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: 10, boxShadow: '0 6px 24px rgba(0,0,0,.45)', fontSize: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong>Speed curve</strong>
        <button type="button" aria-label="Close speed curve" data-testid="speed-curve-close" onClick={onClose}>✕</button>
      </div>
      {note && <div data-testid="speed-curve-note" style={{ opacity: 0.85, marginBottom: 6 }}>{note}</div>}
      <select aria-label="Speed curve preset" data-testid="speed-curve-preset" value="" onChange={(e) => { const p = CURVE_PRESETS[e.target.value]; if (p) { setCurve(normalizeCurve(p.curve)); setSel(0); } }} style={{ width: '100%', marginBottom: 6 }}>
        <option value="">Start from a preset…</option>
        {Object.entries(CURVE_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
      </select>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" data-testid="speed-curve-svg" style={{ background: 'rgba(0,0,0,.25)', borderRadius: 6, touchAction: 'none', display: 'block' }} onDoubleClick={addPoint}>
        {[0.25, 0.5, 1, 2, 4, 8].map((s) => <g key={s}><line x1={PAD} x2={W - PAD} y1={py(s)} y2={py(s)} stroke={s === 1 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)'} /><text x={W - PAD} y={py(s) - 2} fontSize={8} textAnchor="end" fill="rgba(255,255,255,.5)">{s}x</text></g>)}
        <polyline points={line} fill="none" stroke="#22d3ee" strokeWidth={2} data-testid="speed-curve-path" />
        {pts.map((p, i) => <circle key={i} cx={px(p.at)} cy={py(p.speed)} r={sel === i ? 7 : 5.5} fill={sel === i ? '#f59e0b' : '#22d3ee'} stroke="#000" style={{ cursor: 'grab' }} data-testid={`speed-point-${i}`} onPointerDown={dragPoint(i)} onDoubleClick={(e) => { e.stopPropagation(); removePoint(i); }} />)}
      </svg>
      <div style={{ opacity: 0.7, margin: '4px 0' }}>Double-click the graph to add a point, double-click a point to remove it. Horizontal = position in the clip, vertical = speed.</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <label>Point {sel + 1}/{pts.length}: <input type="number" aria-label="Point speed" data-testid="speed-point-value" min={RAMP_MIN_SPEED} max={RAMP_MAX_SPEED} step={0.05} value={pts[sel]?.speed ?? 1} style={{ width: 60 }} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setPoint(sel, undefined, v); }} />x</label>
        <button type="button" data-testid="speed-segment-curve" disabled={sel >= pts.length - 1} onClick={() => setEaseOpen((o) => !o)} title="Edit the easing between this point and the next">Segment curve…</button>
        <button type="button" data-testid="speed-point-remove" disabled={sel === 0 || sel === pts.length - 1} onClick={() => removePoint(sel)}>Remove point</button>
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Pieces <input type="range" aria-label="Pieces" data-testid="speed-steps" min={CURVE_MIN_STEPS} max={CURVE_MAX_STEPS} value={steps} onChange={(e) => setSteps(parseInt(e.target.value, 10))} /><span data-testid="speed-steps-value">{steps}</span></label>
      <div data-testid="speed-curve-result" style={{ margin: '4px 0', opacity: 0.85 }}>{sourceSeconds.toFixed(2)} s of source plays in {outSec.toFixed(2)} s (exact remap {curveDuration(curve, sourceSeconds).toFixed(2)} s)</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button type="button" data-testid="speed-curve-apply" onClick={() => onApply(curve, steps)}>Apply curve</button>
      </div>
      {easeOpen && sel < pts.length - 1 && <CurveEditor ease={pts[sel].ease} onChange={setEase} onClose={() => setEaseOpen(false)} />}
      {easeOpen && <span hidden data-testid="speed-segment-info">{pts[sel].at}-{segEnd.at}</span>}
    </div>
  );
}
