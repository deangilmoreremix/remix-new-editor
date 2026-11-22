// [remix] "Save as preset" row of the overlay settings.
import { useState } from 'react';
import type { OverlayClip } from '@cinegen/types/workspace';
import { captureOverlayPreset, saveOverlayPreset } from '@cinegen/lib/overlays/overlay-presets';

/** "Save as preset": names the overlay's look and keeps it in My presets (Add to timeline window), for every project in this browser. */
export function SavePresetRow({ overlay }: { overlay: OverlayClip }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const save = () => {
    const preset = captureOverlayPreset([overlay], name || overlay.name);
    if (!preset) { setMsg('This overlay cannot be saved as a preset.'); return; }
    setMsg(saveOverlayPreset(preset) ? `Saved “${preset.name}” to My presets.` : 'Could not save (browser storage is unavailable).');
    setNaming(false); setName('');
  };
  return (
    <div data-testid="save-preset" style={{ padding: '0 12px 8px' }}>
      {naming ? (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: 'flex', gap: 6 }}>
          <input type="text" autoFocus value={name} placeholder="Preset name" aria-label="Preset name" maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="mini-btn">Save</button>
          <button type="button" className="mini-btn" onClick={() => setNaming(false)}>Cancel</button>
        </form>
      ) : (
        <button type="button" className="mini-btn" style={{ width: '100%', padding: '5px 8px' }} onClick={() => { setMsg(''); setNaming(true); }}>★ Save as preset</button>
      )}
      {msg && <p role="status" style={{ fontSize: 11, margin: '6px 0 0', color: 'var(--text-secondary)' }}>{msg}</p>}
    </div>
  );
}

