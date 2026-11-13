// [remix] Position / scale / rotation of the clip in the frame (with keyframes), and the tracked path made by OpenChatCut's tracker (Zoom → Follow subject → Pin).
import { FLEX_CROP_EDGES, flexCropEdgeMax, flexCropInsetPatch, normalizedFlexCrop } from '../../../openchatcut/editor/flexCrop';
import { DEFAULT_BACKGROUND_FILL_STRENGTH } from '../../../openchatcut/editor/backgroundFill';
import type { Clip } from '@cinegen/types/timeline';
import { IDENTITY_TRANSFORM, hasTransform, transformValuesAt, upsertKey, type ClipTransform } from '@cinegen/lib/occ/transform';

const ROWS: Array<{ key: 'x' | 'y' | 'scale' | 'rotation'; label: string; min: number; max: number; step: number; unit: string }> = [
  { key: 'x', label: 'Position X', min: -100, max: 100, step: 0.5, unit: '%' },
  { key: 'y', label: 'Position Y', min: -100, max: 100, step: 0.5, unit: '%' },
  { key: 'scale', label: 'Scale', min: 0.1, max: 4, step: 0.01, unit: '×' },
  { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, unit: '°' },
];

export function ClipTransformSection({ clip, currentTime = 0, onUpdate }: { clip: Clip; currentTime?: number; onUpdate: (u: { transform?: ClipTransform }) => void }) {
  const tr = clip.transform ?? IDENTITY_TRANSFORM;
  const t = Math.max(0, Math.min(currentTime - clip.startTime, (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed || 1)));
  const cur = transformValuesAt(tr, t);
  const keyed = !!tr.keys?.length;
  const commit = (next: ClipTransform) => onUpdate({ transform: hasTransform(next) ? next : undefined });
  // with keyframes, moving a slider edits the key at the playhead; without, it edits the base value
  const set = (patch: Partial<typeof cur>) => commit(keyed ? upsertKey(tr, t, { ...cur, ...patch }) : { ...tr, ...patch });
  const atKey = !!tr.keys?.some((k) => Math.abs(k.t - t) <= 0.02);
  return (
    <div className="clip-properties-panel__section" data-testid="clip-transform">
      <div className="clip-properties-panel__section-title">Transform</div>
      {ROWS.map((r) => (
        <div className="clip-properties-panel__row" key={r.key}>
          <span className="clip-properties-panel__label">{r.label}</span>
          <input type="range" className="clip-properties-panel__slider" data-testid={`transform-${r.key}`} min={r.min} max={r.max} step={r.step} value={cur[r.key]} onChange={(e) => set({ [r.key]: parseFloat(e.target.value) })} />
          <span className="clip-properties-panel__value">{cur[r.key].toFixed(r.key === 'scale' ? 2 : 1)}{r.unit}</span>
        </div>
      ))}
      <div className="clip-properties-panel__row">
        <span className="clip-properties-panel__label">Fit</span>
        <select className="clip-properties-panel__select" data-testid="transform-fit" value={tr.fit ?? 'contain'} onChange={(e) => commit({ ...tr, fit: e.target.value as 'contain' | 'cover' })}>
          <option value="contain">Contain (whole picture)</option>
          <option value="cover">Cover (fill frame)</option>
        </select>
      </div>
      <div className="clip-properties-panel__row">
        <button className="clip-properties-panel__toggle-btn" data-testid="transform-fill" title="Fill the bars with a blurred copy of the clip" onClick={() => commit({ ...tr, fill: tr.fill === undefined ? DEFAULT_BACKGROUND_FILL_STRENGTH : undefined })}>{tr.fill === undefined ? 'Background fill: off' : 'Background fill: on'}</button>
        {tr.fill !== undefined && <input type="range" className="clip-properties-panel__slider" data-testid="transform-fill-strength" min={0} max={100} step={1} value={tr.fill} onChange={(e) => commit({ ...tr, fill: parseInt(e.target.value, 10) })} />}
      </div>
      {FLEX_CROP_EDGES.map((edge) => (
        <div className="clip-properties-panel__row" key={edge}>
          <span className="clip-properties-panel__label">Crop {edge}</span>
          <input type="range" className="clip-properties-panel__slider" data-testid={`transform-crop-${edge}`} min={0} max={flexCropEdgeMax(tr.crop, edge)} step={0.005} value={normalizedFlexCrop(tr.crop)[edge]} onChange={(e) => commit({ ...tr, crop: flexCropInsetPatch(tr.crop, edge, parseFloat(e.target.value)).crop })} />
          <span className="clip-properties-panel__value">{Math.round(normalizedFlexCrop(tr.crop)[edge] * 100)}%</span>
        </div>
      ))}
      <div className="clip-properties-panel__row">
        <button className="clip-properties-panel__toggle-btn" data-testid="transform-key" title="Record the current values as a keyframe at the playhead" onClick={() => commit(upsertKey(tr, t, cur))}>{atKey ? '◆ Update keyframe' : '◇ Add keyframe'}</button>
        {keyed && <button className="clip-properties-panel__toggle-btn" onClick={() => commit({ ...tr, keys: undefined, ...(tr.keys?.length ? { x: cur.x, y: cur.y, scale: cur.scale, rotation: cur.rotation } : {}) })}>Clear {tr.keys!.length} key{tr.keys!.length === 1 ? '' : 's'}</button>}
      </div>
      <div className="clip-properties-panel__row">
        {tr.path?.length ? <span style={{ fontSize: 11, opacity: 0.75, flex: 1 }}>Tracked path: {tr.path.length} keys</span> : <span style={{ flex: 1 }} />}
        {tr.path?.length ? <button className="clip-properties-panel__toggle-btn" onClick={() => commit({ ...tr, path: undefined, scale: 1 })}>Clear track</button> : null}
        <button className="clip-properties-panel__toggle-btn" disabled={!hasTransform(clip.transform)} onClick={() => onUpdate({ transform: undefined })}>Reset</button>
      </div>
    </div>
  );
}
