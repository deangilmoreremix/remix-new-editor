// [remix] Named layouts (split screen / grid / picture-in-picture): OpenChatCut's layouts.ts computes each slot's placement; here it is
// applied as the clip transform of the selected clip and the other video clips that overlap the playhead.
import { useState } from 'react';
import { clipEffectiveDuration, clipEndTime, type Clip, type Timeline } from '@cinegen/types/timeline';
import { LAYOUT_IDS, layoutSlots, placeInSlot, type LayoutId, type LayoutMode } from '../../../openchatcut/editor/layouts';
import type { ClipTransform } from '@cinegen/lib/occ/transform';

const LABEL: Record<LayoutId, string> = { full: 'Full frame (reset)', '2up-horizontal': 'Split screen – side by side', '2up-vertical': 'Split screen – top / bottom', '3up-horizontal': 'Three across', 'grid-4': '2 × 2 grid', pip: 'Picture in picture' };

export function ClipLayoutSection({ clip, timeline, currentTime, onTimelineEdit }: { clip: Clip; timeline: Timeline; currentTime: number; onTimelineEdit: (edit: (tl: Timeline) => Timeline) => void }) {
  const [layout, setLayout] = useState<LayoutId>('2up-horizontal');
  const [mode, setMode] = useState<LayoutMode>('cover');
  const kind = (id: string) => timeline.tracks.find((t) => t.id === id)?.kind;
  if (kind(clip.trackId) !== 'video') return null;
  const at = Math.min(Math.max(currentTime, clip.startTime), clipEndTime(clip) - 0.01);
  const group = [clip, ...timeline.clips.filter((c) => c.id !== clip.id && kind(c.trackId) === 'video' && c.startTime <= at && clipEndTime(c) > at)];
  if (group.length < 2 && layout !== 'full') return null;
  const slots = Object.values(layoutSlots(layout));
  return (
    <div className="clip-properties-panel__section" data-testid="clip-layout">
      <div className="clip-properties-panel__section-title">Layout</div>
      <div className="clip-properties-panel__row">
        <select aria-label="Layout" style={{ flex: 1, minWidth: 0, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 }} value={layout} onChange={(e) => setLayout(e.target.value as LayoutId)}>
          {LAYOUT_IDS.map((id) => <option key={id} value={id}>{LABEL[id]}</option>)}
        </select>
        <select aria-label="Fill mode" style={{ width: 80, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 }} value={mode} onChange={(e) => setMode(e.target.value as LayoutMode)}>
          <option value="cover">Fill</option><option value="fit">Fit</option>
        </select>
      </div>
      <div className="clip-properties-panel__row">
        <button className="clip-properties-panel__toggle-btn" data-testid="apply-layout" onClick={() => onTimelineEdit((tl) => ({
          ...tl,
          clips: tl.clips.map((c) => {
            const i = group.findIndex((g) => g.id === c.id);
            if (i < 0 || i >= slots.length) return c;
            if (layout === 'full') return { ...c, transform: undefined };
            const p = placeInSlot(slots[i], mode);
            const transform: ClipTransform = { x: p.x ?? 0, y: p.y ?? 0, scale: p.scale ?? 1, rotation: 0, ...(p.crop ? { crop: p.crop } : {}) };
            return { ...c, transform };
          }),
        }))}>{layout === 'full' ? 'Reset layout' : `Apply to ${Math.min(group.length, slots.length)} clip${Math.min(group.length, slots.length) === 1 ? '' : 's'} at the playhead`}</button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.65 }}>The selected clip takes the first slot; other video clips under the playhead follow in track order.{clipEffectiveDuration(clip) < 0.1 ? '' : ''}</div>
    </div>
  );
}
