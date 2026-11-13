// [remix] Library browser for OpenChatCut's effects / LUTs / transitions, using their own thumbnail components
// (FxThumb, TransitionThumb) and sample frames. Clicking a card applies it to the selected clip / cut.
import { useRef, useState } from 'react';
import { FxThumb } from '../../../openchatcut/library/FxThumb';
import { TransitionThumb } from '../../../openchatcut/library/TransitionThumb';
import { PreviewCleanupContext } from '../../../openchatcut/library/ResourcePreviewContext';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../../openchatcut/gl/fx/effects';
import { t } from '../../../openchatcut/i18n/t';
import { GL_TRANSITION_ORDER, glTransitionLabel } from '@cinegen/lib/occ/transitions';
import { userLutIds } from '@cinegen/lib/occ/user-luts';
import { usePluginPacks, pluginResourceItems } from '../../../openchatcut/library/pluginResources';
import { installFromText, installFromUrl, removePack, setPackEnabled } from '@cinegen/lib/occ/plugins';
import { customTransitionThumbUrl } from '../../../openchatcut/gl/transitionThumb';
import { getCustomTransition, customTransitionUniforms } from '../../../openchatcut/gl/customTransitions';
import '../../../openchatcut/library/library.css';

type Tab = 'fx' | 'lut' | 'tr' | 'ext';
interface Props { onClose: () => void; onPickFx: (id: string) => void; onPickLut: (id: string) => void; onPickTransition?: (id: string) => void }

export function OccLibraryModal({ onClose, onPickFx, onPickLut, onPickTransition }: Props) {
  const [tab, setTab] = useState<Tab>('fx');
  const [hover, setHover] = useState<string | null>(null);
  const packs = usePluginPacks();
  const pfx = pluginResourceItems(packs, 'fx').map((i) => i.id);
  const plut = pluginResourceItems(packs, 'lut').map((i) => i.id);
  const ptr = pluginResourceItems(packs, 'transition').map((i) => i.id);
  const ids = tab === 'fx' ? [...FX_IDS, ...pfx] : tab === 'lut' ? [...LUT_IDS, ...userLutIds(), ...plut] : [...GL_TRANSITION_ORDER, ...ptr];
  const pick = (id: string) => { if (tab === 'fx') onPickFx(id); else if (tab === 'lut') onPickLut(id); else onPickTransition?.(id); };
  return (
    <div className="occ-library" role="dialog" aria-label="Effects library" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(760px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          {([['fx', `Effects (${FX_IDS.length + pfx.length})`], ['lut', `LUTs & looks (${LUT_IDS.length + userLutIds().length + plut.length})`], ['tr', `Transitions (${GL_TRANSITION_ORDER.length + ptr.length})`], ['ext', `Extensions (${packs.length})`]] as Array<[Tab, string]>).map(([k, label]) => (
            <button key={k} className="clip-properties-panel__toggle-btn" style={tab === k ? { borderColor: '#d9ff00' } : undefined} onClick={() => setTab(k)}>{label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="clip-properties-panel__toggle-btn" aria-label="Close library" onClick={onClose}>×</button>
        </div>
        {tab === 'ext' ? <ExtensionsPanel /> : <PreviewCleanupContext.Provider value={() => {}}>
          <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 10, paddingRight: 4 }}>
            {ids.map((id) => (
              <button key={id} className={`cc-resource-card${hover === id ? ' hovered' : ''}`} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => pick(id)} data-testid={`library-card-${id}`}>
                <div className="cc-resource-thumb">
                  {tab === 'tr' ? (id.startsWith('plugin:') ? <PluginTransitionThumb id={id} /> : <TransitionThumb type={id as never} playing={hover === id} />) : <FxThumb assetId={id} playing={hover === id} />}
                </div>
                <span className="cc-resource-name">{tab === 'tr' ? (id.startsWith('plugin:') ? (getCustomTransition(id)?.label ?? id) : glTransitionLabel(id)) : t(ALL_FX[id]?.name ?? id)}</span>
              </button>
            ))}
          </div>
        </PreviewCleanupContext.Provider>}
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>{tab === 'tr' ? 'Select a clip with a next clip, then choose a transition in the inspector.' : 'Click a card to apply it to the selected clip. Hover to preview.'}</div>
      </div>
    </div>
  );
}

function PluginTransitionThumb({ id }: { id: string }) {
  const d = getCustomTransition(id);
  const url = d ? customTransitionThumbUrl(id, d.frag, customTransitionUniforms(d)) : '';
  return url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10, opacity: 0.6 }}>plugin</span>;
}

/** Install / enable / remove OpenChatCut plugin packs (openchatcut-plugin@1). Their validator + GLSL compile probe run before anything is stored. */
function ExtensionsPanel() {
  const packs = usePluginPacks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [sha, setSha] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const run = async (job: () => ReturnType<typeof installFromText>) => {
    setBusy(true); setErrors([]); setNote('');
    try {
      const r = await job();
      if (!r.ok) setErrors(r.errors);
      else setNote(`Installed “${r.pack.name}” (${r.pack.items.length} item${r.pack.items.length === 1 ? '' : 's'}).${r.skipped?.length ? ` Skipped template(s) that need OpenChatCut's sandboxed template runtime: ${r.skipped.join(', ')}.` : ''}`);
    } finally { setBusy(false); }
  };
  return (
    <div data-testid="extensions-panel" style={{ overflow: 'auto', fontSize: 12 }}>
      <div style={{ opacity: 0.75, marginBottom: 8, lineHeight: 1.4 }}>Plugin packs (<code>openchatcut-plugin@1</code>) add effects, LUTs, transitions and zoom presets. A pack is checked against OpenChatCut's limits and its shaders are compiled before install. Packs are data only — no script from a pack is ever run.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden data-testid="extension-file" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await run(async () => installFromText(await f.text(), { source: { kind: 'file' } })); }} />
        <button className="clip-properties-panel__toggle-btn" disabled={busy} onClick={() => fileRef.current?.click()}>Install from file…</button>
        <input aria-label="Pack URL" placeholder="https://…/pack.json" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1, minWidth: 160, background: '#0d1218', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px' }} />
        <input aria-label="Expected SHA-256 (optional)" placeholder="SHA-256 (optional)" value={sha} onChange={(e) => setSha(e.target.value)} style={{ width: 150, background: '#0d1218', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px' }} />
        <button className="clip-properties-panel__toggle-btn" disabled={busy || !url.trim()} onClick={() => run(() => installFromUrl(url.trim(), sha.trim() ? { sha256: sha.trim() } : undefined))}>Install from URL</button>
      </div>
      {busy && <div role="status">Checking and installing…</div>}
      {note && <div role="status" data-testid="extension-note" style={{ color: '#34d399', marginBottom: 6 }}>{note}</div>}
      {errors.length > 0 && <div role="alert" data-testid="extension-errors" style={{ color: '#f87171', marginBottom: 6 }}>{errors.map((m, i) => <div key={i}>✕ {m}</div>)}</div>}
      {packs.length === 0 && <div style={{ opacity: 0.6 }}>No extensions installed.</div>}
      {packs.map((p) => (
        <div key={p.id} data-testid={`extension-${p.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{p.name} <span style={{ opacity: 0.55, fontWeight: 400 }}>v{p.version}{p.author ? ` · ${p.author}` : ''}</span></div>
            <div style={{ opacity: 0.65 }}>{p.description ?? ''} {p.items.length} item{p.items.length === 1 ? '' : 's'}: {p.items.map((i) => `${i.name} (${i.type})`).join(', ')}</div>
          </div>
          <button className="clip-properties-panel__toggle-btn" onClick={() => void setPackEnabled(p.id, !p.enabled)}>{p.enabled ? 'Disable' : 'Enable'}</button>
          <button className="clip-properties-panel__toggle-btn" onClick={() => void removePack(p.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
