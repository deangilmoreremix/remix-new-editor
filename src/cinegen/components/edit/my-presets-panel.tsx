// [remix] "My presets" tab of the Add to timeline window: overlays saved with "Save as preset" in an overlay's settings.
import { useState } from 'react';
import { listOverlayPresets, deleteOverlayPreset, type OverlayPreset } from '@cinegen/lib/overlays/overlay-presets';

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-input)' } as const;

export function MyPresetsPanel({ onPick }: { onPick: (preset: OverlayPreset) => void }) {
  const [presets, setPresets] = useState<OverlayPreset[]>(() => listOverlayPresets());
  const [error, setError] = useState('');
  if (!presets.length) {
    return (
      <div data-testid="my-presets-empty" style={{ padding: 24, color: 'var(--text-dim, rgba(255,255,255,.6))', fontSize: 13, lineHeight: 1.6 }}>
        <strong style={{ display: 'block', color: 'inherit', marginBottom: 6 }}>No presets yet</strong>
        Add a Smart Text, image, sticker or lower third, style it, then choose <em>Save as preset</em> in its settings. It will appear here for every project in this browser.
      </div>
    );
  }
  return (
    <div data-testid="my-presets" style={{ display: 'grid', gap: 10, padding: '4px 2px', minHeight: 0, maxHeight: '100%', overflowY: 'auto' }}>
      {error && <div role="alert" style={{ color: 'var(--error, #ff8a8a)', fontSize: 12 }}>{error}</div>}
      {presets.map((p) => (
        <div key={p.id} style={rowStyle} data-testid={`preset-${p.id}`}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>{p.items.length} overlay{p.items.length > 1 ? 's' : ''} · {p.items.map((i) => i.type.replace(/^overlay-/, '')).join(', ')}</div>
          </div>
          <button type="button" className="cg-btn" data-testid={`preset-add-${p.id}`} onClick={() => onPick(p)}>Add at playhead</button>
          <button type="button" className="cg-btn" aria-label={`Delete preset ${p.name}`} onClick={() => { setError(''); if (!deleteOverlayPreset(p.id)) setError('That preset could not be deleted (browser storage refused the change).'); setPresets(listOverlayPresets()); }}>Delete</button>
        </div>
      ))}
    </div>
  );
}
