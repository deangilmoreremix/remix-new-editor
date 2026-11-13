// [remix] Stage 2: graph editor popover for ONE segment easing: presets, a draggable cubic-bezier (two handles + numeric fields) and spring parameters.
// The curve drawn is the real applyEase() the preview and export evaluate.
import { useRef } from 'react';
import { EASE_LABELS, EASE_PRESETS, PRESET_BEZIER, DEFAULT_SPRING, applyEase, type BezierPoints, type EaseSpec } from '@cinegen/lib/editor/stage2/easing';

const W = 240; const H = 200; const PAD = 16; const Y_MIN = -0.5; const Y_MAX = 1.5;
const px = (x: number) => PAD + x * (W - 2 * PAD);
const py = (y: number) => PAD + (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * (H - 2 * PAD);
const unx = (p: number) => (p - PAD) / (W - 2 * PAD);
const uny = (p: number) => Y_MIN + (1 - (p - PAD) / (H - 2 * PAD)) * (Y_MAX - Y_MIN);

const kindOf = (e: EaseSpec | undefined): 'preset' | 'bezier' | 'spring' => (typeof e === 'object' && e && 'bezier' in e ? 'bezier' : typeof e === 'object' && e && 'spring' in e ? 'spring' : 'preset');
const bezierOf = (e: EaseSpec | undefined): BezierPoints => (typeof e === 'object' && e && 'bezier' in e ? e.bezier : typeof e === 'string' ? PRESET_BEZIER[e] ?? [0, 0, 1, 1] : [0.42, 0, 0.58, 1]);

export function CurveEditor({ ease, onChange, onClose }: { ease: EaseSpec | undefined; onChange: (e: EaseSpec) => void; onClose: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const kind = kindOf(ease);
  const bz = bezierOf(ease);
  const spring = typeof ease === 'object' && ease && 'spring' in ease ? ease.spring : DEFAULT_SPRING;
  const pts = Array.from({ length: 61 }, (_, i) => { const t = i / 60; return `${px(t).toFixed(1)},${py(applyEase(t, ease)).toFixed(1)}`; }).join(' ');

  const drag = (which: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = svg.current; if (!el) return;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, unx(((ev.clientX - r.left) / r.width) * W)));
      const y = Math.max(-1, Math.min(2, uny(((ev.clientY - r.top) / r.height) * H)));
      const next: BezierPoints = [...bz] as BezierPoints;
      next[which * 2] = Math.round(x * 100) / 100; next[which * 2 + 1] = Math.round(y * 100) / 100;
      onChange({ bezier: next });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const setNum = (i: number, v: number) => { if (!Number.isFinite(v)) return; const n: BezierPoints = [...bz] as BezierPoints; n[i] = i % 2 === 0 ? Math.max(0, Math.min(1, v)) : Math.max(-1, Math.min(2, v)); onChange({ bezier: n }); };
  const tab = (k: typeof kind, label: string, make: () => EaseSpec) => (
    <button type="button" className="clip-properties-panel__toggle-btn" data-testid={`curve-mode-${k}`} aria-pressed={kind === k} style={kind === k ? { borderColor: '#22d3ee', color: '#22d3ee' } : undefined} onClick={() => { if (kind !== k) onChange(make()); }}>{label}</button>
  );
  return (
    <div role="dialog" aria-label="Curve editor" data-testid="curve-editor" className="stage2-popover" style={{ background: 'var(--bg-elevated, #151a24)', border: '1px solid var(--border-medium, rgba(255,255,255,.2))', borderRadius: 8, padding: 10, margin: '6px 0', boxShadow: '0 6px 24px rgba(0,0,0,.45)' }}>
      <div className="clip-properties-panel__row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>Easing curve</span>
        <button type="button" className="clip-properties-panel__toggle-btn" aria-label="Close curve editor" data-testid="curve-close" onClick={onClose}>✕</button>
      </div>
      <div className="clip-properties-panel__row">
        {tab('preset', 'Preset', () => 'ease-in-out')}{tab('bezier', 'Bezier', () => ({ bezier: bz }))}{tab('spring', 'Spring', () => ({ spring: DEFAULT_SPRING }))}
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: 'rgba(0,0,0,.25)', borderRadius: 6, touchAction: 'none', display: 'block' }} data-testid="curve-svg">
        <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(0)} stroke="rgba(255,255,255,.25)" /><line x1={px(0)} y1={py(1)} x2={px(1)} y2={py(1)} stroke="rgba(255,255,255,.25)" />
        <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="rgba(255,255,255,.12)" strokeDasharray="3 3" />
        {kind === 'bezier' && <>
          <line x1={px(0)} y1={py(0)} x2={px(bz[0])} y2={py(bz[1])} stroke="#f59e0b" /><line x1={px(1)} y1={py(1)} x2={px(bz[2])} y2={py(bz[3])} stroke="#f59e0b" />
        </>}
        <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth={2} data-testid="curve-path" />
        {kind === 'bezier' && <>
          <circle cx={px(bz[0])} cy={py(bz[1])} r={7} fill="#f59e0b" style={{ cursor: 'grab' }} data-testid="curve-handle-1" onPointerDown={drag(0)} />
          <circle cx={px(bz[2])} cy={py(bz[3])} r={7} fill="#f59e0b" style={{ cursor: 'grab' }} data-testid="curve-handle-2" onPointerDown={drag(1)} />
        </>}
      </svg>
      {kind === 'preset' && (
        <div className="clip-properties-panel__row">
          <select aria-label="Easing preset" data-testid="curve-preset" className="clip-properties-panel__select" value={typeof ease === 'string' ? ease : 'linear'} onChange={(e) => onChange(e.target.value as EaseSpec)}>
            {EASE_PRESETS.map((p) => <option key={p} value={p}>{EASE_LABELS[p]}</option>)}
          </select>
        </div>
      )}
      {kind === 'bezier' && (
        <div className="clip-properties-panel__row" style={{ gap: 4 }}>
          {bz.map((v, i) => <input key={i} type="number" aria-label={['x1', 'y1', 'x2', 'y2'][i]} data-testid={`curve-num-${i}`} step={0.05} value={v} style={{ width: 52 }} onChange={(e) => setNum(i, parseFloat(e.target.value))} />)}
        </div>
      )}
      {kind === 'spring' && (['tension', 'friction', 'mass'] as const).map((k) => (
        <div className="clip-properties-panel__row" key={k}>
          <span className="clip-properties-panel__label">{k}</span>
          <input type="range" className="clip-properties-panel__slider" data-testid={`curve-spring-${k}`} min={k === 'mass' ? 0.2 : 20} max={k === 'mass' ? 5 : 400} step={k === 'mass' ? 0.1 : 1} value={spring[k]} onChange={(e) => onChange({ spring: { ...spring, [k]: parseFloat(e.target.value) } })} />
          <span className="clip-properties-panel__value">{spring[k]}</span>
        </div>
      ))}
    </div>
  );
}
