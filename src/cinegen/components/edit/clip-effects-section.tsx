// [remix] Effects / LUT / Blend section of the clip inspector. The effect catalog, defaults and slider ranges are
// OpenChatCut's own (src/openchatcut/gl/fx); this only hosts them in CineGen's inspector.
import { useEffect, useRef, useState } from 'react';
import type { Clip, ClipFx } from '@cinegen/types/timeline';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../../openchatcut/gl/fx/effects';
import { primeClipLuts } from '@cinegen/lib/occ/clip-fx';
import { OccLibraryModal } from './occ-library-modal';
import { importCubeFile, loadUserLuts, userLutIds } from '@cinegen/lib/occ/user-luts';
import { t } from '../../../openchatcut/i18n/t';

const selectStyle = { flex: 1, minWidth: 0, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12, fontFamily: 'inherit' } as const;

// CSS blend modes (the OpenChatCut source in this repo has no blend feature; this is the browser's own list).
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'plus-lighter'] as const;

type Updates = Partial<Pick<Clip, 'fx' | 'lut' | 'blendMode'>>;
interface Props { clip: Clip; onUpdate: (updates: Updates) => void }

export function ClipEffectsSection({ clip, onUpdate }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [, bump] = useState(0);
  const [lutError, setLutError] = useState('');
  const [library, setLibrary] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void loadUserLuts().then((l) => l.length && bump((n) => n + 1)); }, []);
  const fx = clip.fx ?? [];
  const setFx = (next: ClipFx[]) => onUpdate({ fx: next.length ? next : undefined });
  const setLut = (id: string) => {
    if (!id) return onUpdate({ lut: undefined });
    const next = { id, intensity: clip.lut?.intensity ?? 1 };
    void primeClipLuts({ lut: next });
    onUpdate({ lut: next });
  };
  return (
    <div className="clip-properties-panel__section" data-testid="clip-effects">
      <div className="clip-properties-panel__section-title">Effects</div>
      {fx.map((f, i) => {
        const def = ALL_FX[f.id];
        if (!def) return null;
        return (
          <div key={`${f.id}-${i}`} style={{ marginBottom: 6 }}>
            <div className="clip-properties-panel__row">
              <button className="clip-properties-panel__toggle-btn" onClick={() => setOpen(open === i ? null : i)} title={t(def.desc)} style={{ flex: 1, textAlign: 'left' }}>{t(def.name)}</button>
              <button className="clip-properties-panel__toggle-btn" aria-label={`${f.enabled === false ? 'Enable' : 'Disable'} ${def.name}`} onClick={() => setFx(fx.map((x, j) => (j === i ? { ...x, enabled: x.enabled === false } : x)))}>{f.enabled === false ? 'Off' : 'On'}</button>
              <button className="clip-properties-panel__toggle-btn" aria-label={`Remove ${def.name}`} onClick={() => setFx(fx.filter((_, j) => j !== i))}>×</button>
            </div>
            {open === i && def.props.map((p) => p.kind === 'color' ? null : (
              <div className="clip-properties-panel__row" key={p.key}>
                <span className="clip-properties-panel__label">{t(p.label)}</span>
                <input type="range" className="clip-properties-panel__slider" min={p.min} max={p.max} step={p.step ?? 0.01}
                  value={typeof f.props[p.key] === 'number' ? (f.props[p.key] as number) : p.default}
                  onChange={(e) => setFx(fx.map((x, j) => (j === i ? { ...x, props: { ...x.props, [p.key]: parseFloat(e.target.value) } } : x)))} />
                <span className="clip-properties-panel__value">{(typeof f.props[p.key] === 'number' ? (f.props[p.key] as number) : p.default).toFixed(2)}</span>
              </div>
            ))}
          </div>
        );
      })}
      <div className="clip-properties-panel__row">
        <button className="clip-properties-panel__toggle-btn" onClick={() => setLibrary(true)}>Browse library…</button>
      </div>
      {library && <OccLibraryModal onClose={() => setLibrary(false)} onPickFx={(id) => { setFx([...fx, { id, props: {} }]); setOpen(fx.length); setLibrary(false); }} onPickLut={(id) => { setLut(id); setLibrary(false); }} />}
      <div className="clip-properties-panel__row">
        <select aria-label="Add effect" style={selectStyle} value="" onChange={(e) => { if (e.target.value) { setFx([...fx, { id: e.target.value, props: {} }]); setOpen(fx.length); } }}>
          <option value="">+ Add effect…</option>
          {FX_IDS.map((id) => <option key={id} value={id}>{t(ALL_FX[id].name)}</option>)}
        </select>
      </div>
      <div className="clip-properties-panel__section-title" style={{ marginTop: 8 }}>LUT / Look</div>
      <div className="clip-properties-panel__row">
        <select aria-label="LUT" style={selectStyle} value={clip.lut?.id ?? ''} onChange={(e) => setLut(e.target.value)}>
          <option value="">None</option>
          {LUT_IDS.map((id) => <option key={id} value={id}>{t(ALL_FX[id].name)}</option>)}
          {userLutIds().map((id) => <option key={id} value={id}>{ALL_FX[id].name} (imported)</option>)}
        </select>
      </div>
      <div className="clip-properties-panel__row">
        <input ref={fileRef} type="file" accept=".cube" hidden aria-label="Import .cube LUT" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try { setLutError(''); const lut = await importCubeFile(f); bump((n) => n + 1); setLut(lut.id); } catch (err) { setLutError(err instanceof Error ? err.message : String(err)); }
        }} />
        <button className="clip-properties-panel__toggle-btn" onClick={() => fileRef.current?.click()}>Import .cube LUT…</button>
      </div>
      {lutError && <div style={{ color: '#f87171', fontSize: 11 }}>{lutError}</div>}
      {clip.lut && (
        <div className="clip-properties-panel__row">
          <span className="clip-properties-panel__label">Intensity</span>
          <input type="range" className="clip-properties-panel__slider" min={0} max={1} step={0.01} value={clip.lut.intensity}
            onChange={(e) => onUpdate({ lut: { ...clip.lut!, intensity: parseFloat(e.target.value) } })} />
          <span className="clip-properties-panel__value">{Math.round(clip.lut.intensity * 100)}%</span>
        </div>
      )}
      <div className="clip-properties-panel__section-title" style={{ marginTop: 8 }}>Blend</div>
      <div className="clip-properties-panel__row">
        <select aria-label="Blend mode" style={selectStyle} value={clip.blendMode ?? 'normal'} onChange={(e) => onUpdate({ blendMode: e.target.value === 'normal' ? undefined : e.target.value })}>
          {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
