// [remix] Position / scale / rotation of the clip in the frame, and the tracked path made by OpenChatCut's tracker (Zoom → Follow subject → Pin).
import type { Clip } from '@cinegen/types/timeline';
import { IDENTITY_TRANSFORM, hasTransform, type ClipTransform } from '@cinegen/lib/occ/transform';

const ROWS: Array<{ key: 'x' | 'y' | 'scale' | 'rotation'; label: string; min: number; max: number; step: number; unit: string }> = [
  { key: 'x', label: 'Position X', min: -100, max: 100, step: 0.5, unit: '%' },
  { key: 'y', label: 'Position Y', min: -100, max: 100, step: 0.5, unit: '%' },
  { key: 'scale', label: 'Scale', min: 0.1, max: 4, step: 0.01, unit: '×' },
  { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, unit: '°' },
];

export function ClipTransformSection({ clip, onUpdate }: { clip: Clip; onUpdate: (u: { transform?: ClipTransform }) => void }) {
  const tr = clip.transform ?? IDENTITY_TRANSFORM;
  const set = (patch: Partial<ClipTransform>) => { const next = { ...tr, ...patch }; onUpdate({ transform: hasTransform(next) ? next : undefined }); };
  return (
    <div className="clip-properties-panel__section" data-testid="clip-transform">
      <div className="clip-properties-panel__section-title">Transform</div>
      {ROWS.map((r) => (
        <div className="clip-properties-panel__row" key={r.key}>
          <span className="clip-properties-panel__label">{r.label}</span>
          <input type="range" className="clip-properties-panel__slider" data-testid={`transform-${r.key}`} min={r.min} max={r.max} step={r.step} value={tr[r.key]} onChange={(e) => set({ [r.key]: parseFloat(e.target.value) })} />
          <span className="clip-properties-panel__value">{tr[r.key].toFixed(r.key === 'scale' ? 2 : 1)}{r.unit}</span>
        </div>
      ))}
      <div className="clip-properties-panel__row">
        {tr.path?.length ? <span style={{ fontSize: 11, opacity: 0.75, flex: 1 }}>Tracked path: {tr.path.length} keys</span> : <span style={{ flex: 1 }} />}
        {tr.path?.length ? <button className="clip-properties-panel__toggle-btn" onClick={() => set({ path: undefined, scale: 1 })}>Clear track</button> : null}
        <button className="clip-properties-panel__toggle-btn" disabled={!hasTransform(clip.transform)} onClick={() => onUpdate({ transform: undefined })}>Reset</button>
      </div>
    </div>
  );
}
