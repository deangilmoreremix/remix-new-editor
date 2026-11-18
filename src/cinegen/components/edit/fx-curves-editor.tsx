// [remix] Fix C: draggable tone-curve editor for the Curves effect (RGB master + red / green / blue). Click the plot to add a point, drag to move,
// double-click (or Alt-click) a point to delete it. The curve drawn is the same monotone spline the renderer samples.
import { useRef, useState } from 'react';
import { monotoneCurve, sampleCurve, type CurvePoint } from '../../../openchatcut/gl/fx/s9/curveSpline';
import { addPoint, CURVE_CHANNELS, curveKey, editorPoints, flatToPoints, hasNewCurves, movePoint, pointsToFlat, removePoint, type CurveChannel } from '../../../openchatcut/gl/fx/s9/curves';

type Props = Record<string, number | number[] | undefined>;
const SIZE = 200;
const NAMES: Record<CurveChannel, string> = { m: 'RGB', r: 'R', g: 'G', b: 'B' };
const COLORS: Record<CurveChannel, string> = { m: '#e5e7eb', r: '#f87171', g: '#4ade80', b: '#60a5fa' };

export function FxCurvesEditor({ props, onChange }: { props: Props; onChange: (values: Record<string, number[]>) => void }) {
  const [ch, setCh] = useState<CurveChannel>('m');
  const [sel, setSel] = useState(-1);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(-1);
  const last = useRef({ t: 0, i: -1 }); // pointer capture sends the dblclick event to the svg, so a double press is detected here
  const pts = (c: CurveChannel): CurvePoint[] => editorPoints(props, c);
  const write = (c: CurveChannel, next: CurvePoint[]) => {
    // the first edit of an old project writes all four curves (its five master points become the starting master curve)
    const all = Object.fromEntries(CURVE_CHANNELS.map((k) => [curveKey(k), pointsToFlat(k === c ? next : hasNewCurves(props) ? flatToPoints(props[curveKey(k)]) : pts(k))]));
    onChange(all);
  };
  const cur = pts(ch);
  const local = (e: React.PointerEvent | React.MouseEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect(); // the viewBox has a 6-unit margin around the SIZE x SIZE plot
    const k = (SIZE + 12) / r.width;
    return [((e.clientX - r.left) * k - 6) / SIZE, 1 - ((e.clientY - r.top) * k - 6) / SIZE];
  };
  const toXY = (p: CurvePoint) => `${p.x * SIZE},${(1 - p.y) * SIZE}`;
  const line = (c: CurveChannel) => sampleCurve(monotoneCurve(pts(c)), 65).map((y, i) => `${((i / 64) * SIZE).toFixed(1)},${((1 - y) * SIZE).toFixed(1)}`).join(' ');
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const t = (e.target as SVGElement).dataset;
    svgRef.current!.setPointerCapture(e.pointerId);
    if (t.pt !== undefined) {
      const i = Number(t.pt);
      const now = performance.now(); const dbl = last.current.i === i && now - last.current.t < 400; last.current = { t: now, i };
      if (e.altKey || dbl) { write(ch, removePoint(cur, i)); setSel(-1); last.current = { t: 0, i: -1 }; return; }
      dragging.current = i; setSel(i); return;
    }
    const [x, y] = local(e);
    const r = addPoint(cur, x, y);
    write(ch, r.points); dragging.current = r.index; setSel(r.index);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current < 0) return;
    const [x, y] = local(e);
    write(ch, movePoint(cur, dragging.current, x, y));
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => { dragging.current = -1; try { svgRef.current?.releasePointerCapture(e.pointerId); } catch { /* not captured */ } };
  return (
    <div data-testid="fx-curves-editor" style={{ margin: '4px 0 8px' }}>
      <div className="clip-properties-panel__row" style={{ gap: 4 }}>
        {CURVE_CHANNELS.map((c) => (
          <button key={c} className="clip-properties-panel__toggle-btn" data-testid={`curves-ch-${c}`} aria-pressed={ch === c} style={{ flex: 1, color: ch === c ? COLORS[c] : undefined, fontWeight: ch === c ? 700 : 400 }} onClick={() => { setCh(c); setSel(-1); }}>{NAMES[c]}</button>
        ))}
        <button className="clip-properties-panel__toggle-btn" data-testid="curves-reset" title="Reset this channel to a straight line" onClick={() => write(ch, [{ x: 0, y: 0 }, { x: 1, y: 1 }])}>Reset</button>
      </div>
      <svg ref={svgRef} width="100%" viewBox={`-6 -6 ${SIZE + 12} ${SIZE + 12}`} style={{ aspectRatio: '1', maxWidth: 260, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, touchAction: 'none', display: 'block' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Tone curve">
        {[0.25, 0.5, 0.75].map((g) => <g key={g} stroke="rgba(255,255,255,.12)"><line x1={g * SIZE} y1={0} x2={g * SIZE} y2={SIZE} /><line x1={0} y1={g * SIZE} x2={SIZE} y2={g * SIZE} /></g>)}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="rgba(255,255,255,.18)" strokeDasharray="3 3" />
        {CURVE_CHANNELS.filter((c) => c !== ch).map((c) => <polyline key={c} points={line(c)} fill="none" stroke={COLORS[c]} strokeOpacity={0.25} strokeWidth={1} pointerEvents="none" />)}
        <polyline data-testid="curves-line" points={line(ch)} fill="none" stroke={COLORS[ch]} strokeWidth={2} pointerEvents="none" />
        {cur.map((p, i) => { const [x, y] = toXY(p).split(',').map(Number); return <circle key={i} data-pt={i} data-testid={`curve-pt-${i}`} cx={x} cy={y} r={i === sel ? 6 : 5} fill={i === sel ? '#facc15' : '#fff'} stroke={COLORS[ch]} strokeWidth={2} style={{ cursor: 'grab' }} />; })}
      </svg>
      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 3 }}>Click to add a point, drag to move, double-click or Alt-click a point to remove it.</div>
    </div>
  );
}
