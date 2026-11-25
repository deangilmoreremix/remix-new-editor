// [remix] "My presets" tab of the Add to timeline window: overlays saved with "Save as preset" in an overlay's settings.
import { useState } from 'react';
import { listOverlayPresets, deleteOverlayPreset, type OverlayPreset } from '@cinegen/lib/overlays/overlay-presets';
import '../../styles/edit-panels.css';

export function MyPresetsPanel({ onPick }: { onPick: (preset: OverlayPreset) => void }) {
  const [presets, setPresets] = useState<OverlayPreset[]>(() => listOverlayPresets());
  const [error, setError] = useState('');
  if (!presets.length) {
    return (
      <div data-testid="my-presets-empty" className="cg-empty" style={{ padding: 24 }}>
        <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 6 }}>No presets yet</strong>
        Add a Smart Text, image, sticker or lower third, style it, then choose <em>Save as preset</em> in its settings. It will appear here for every project in this browser.
      </div>
    );
  }
  return (
    <div data-testid="my-presets" className="cg-stack" style={{ minHeight: 0, maxHeight: '100%', overflowY: 'auto' }}>
      {error && <div role="alert" className="cg-error">{error}</div>}
      {presets.map((p) => (
        <div key={p.id} className="cg-row" data-testid={`preset-${p.id}`}>
          <div className="cg-row__body">
            <div className="cg-row__title cg-row__title--ellipsis">{p.name}</div>
            <div className="cg-row__desc">{p.items.length} overlay{p.items.length > 1 ? 's' : ''} · {p.items.map((i) => i.type.replace(/^overlay-/, '')).join(', ')}</div>
          </div>
          <button type="button" className="cg-btn" data-testid={`preset-add-${p.id}`} onClick={() => onPick(p)}>Add at playhead</button>
          <button type="button" className="cg-btn" aria-label={`Delete preset ${p.name}`} onClick={() => { setError(''); if (!deleteOverlayPreset(p.id)) setError('That preset could not be deleted (browser storage refused the change).'); setPresets(listOverlayPresets()); }}>Delete</button>
        </div>
      ))}
    </div>
  );
}
