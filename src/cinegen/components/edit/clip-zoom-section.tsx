// [remix] Zoom section of the clip inspector: OpenChatCut's zoom shapes (editor/zoom.ts, ZOOM_SHAPE_ORDER) and follow-subject tracking.
import { useState } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { toFileUrl } from '@cinegen/lib/utils/file-url';
import type { ZoomEffect, ZoomShape } from '../../../openchatcut/editor/types';
import { ZOOM_SHAPE_ORDER, ZOOM_SHAPE_LABELS } from '../../../openchatcut/editor/types';
import { t } from '../../../openchatcut/i18n/t';
import { usePluginPacks, pluginResourceItems } from '../../../openchatcut/library/pluginResources';
import { getCustomZoom, zoomFromCustomDef } from '../../../openchatcut/editor/customZooms';
import { FollowSubjectDialog } from './follow-subject-dialog';

const selectStyle = { flex: 1, minWidth: 0, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 } as const;

export function ClipZoomSection({ clip, asset, onUpdate }: { clip: Clip; asset: Asset | null; onUpdate: (u: { zoom?: ZoomEffect }) => void }) {
  const [follow, setFollow] = useState(false);
  const pluginZooms = pluginResourceItems(usePluginPacks(), 'zoom');
  const z = clip.zoom;
  const set = (patch: Partial<ZoomEffect>) => onUpdate({ zoom: { ...(z ?? { magnification: 1.5, shape: 'hold' }), ...patch } });
  const following = !!z?.reframeCurve?.keyframes.length;
  return (
    <div className="clip-properties-panel__section" data-testid="clip-zoom">
      <div className="clip-properties-panel__section-title">Zoom</div>
      <div className="clip-properties-panel__row">
        <select aria-label="Zoom shape" style={selectStyle} value={z ? (following ? '__follow' : z.label && pluginZooms.some((p) => getCustomZoom(p.id)?.label === z.label) ? pluginZooms.find((p) => getCustomZoom(p.id)?.label === z.label)!.id : z.shape ?? 'hold') : ''} onChange={(e) => {
          if (!e.target.value) return onUpdate({ zoom: undefined });
          if (e.target.value === '__follow') return;
          // plugin zoom preset: their zoomFromCustomDef snapshot (envelope / shape / focal point) is copied into the clip
          if (e.target.value.startsWith('plugin:')) { const d = getCustomZoom(e.target.value); if (d) onUpdate({ zoom: { ...zoomFromCustomDef(d), reframeCurve: undefined } as ZoomEffect }); return; }
          set({ shape: e.target.value as ZoomShape, reframeCurve: undefined });
        }}>
          <option value="">No zoom</option>
          {following && <option value="__follow">Following subject</option>}
          {ZOOM_SHAPE_ORDER.map((s) => <option key={s} value={s}>{t(ZOOM_SHAPE_LABELS[s])}</option>)}
          {pluginZooms.map((p) => <option key={p.id} value={p.id}>{p.name} (extension)</option>)}
        </select>
      </div>
      {z && (
        <>
          <div className="clip-properties-panel__row">
            <span className="clip-properties-panel__label">Amount</span>
            <input type="range" className="clip-properties-panel__slider" min={1} max={8} step={0.1} value={z.magnification ?? 1.5} onChange={(e) => set({ magnification: parseFloat(e.target.value) })} />
            <span className="clip-properties-panel__value">{(z.magnification ?? 1.5).toFixed(1)}×</span>
          </div>
          {!following && (['focalPointX', 'focalPointY'] as const).map((k) => (
            <div className="clip-properties-panel__row" key={k}>
              <span className="clip-properties-panel__label">{k === 'focalPointX' ? 'Focus X' : 'Focus Y'}</span>
              <input type="range" className="clip-properties-panel__slider" min={0} max={1} step={0.01} value={z[k] ?? 0.5} onChange={(e) => set({ [k]: parseFloat(e.target.value) })} />
              <span className="clip-properties-panel__value">{Math.round((z[k] ?? 0.5) * 100)}%</span>
            </div>
          ))}
        </>
      )}
      {asset?.type === 'video' && <div className="clip-properties-panel__row"><button className="clip-properties-panel__toggle-btn" onClick={() => setFollow(true)}>Follow subject…</button></div>}
      {follow && asset && <FollowSubjectDialog clip={clip} src={toFileUrl(asset.fileRef || asset.url)} width={asset.width} height={asset.height} onClose={() => setFollow(false)} onApply={(zoom) => onUpdate({ zoom })} />}
    </div>
  );
}
