// [remix] Library browser for OpenChatCut's effects / LUTs / transitions, using their own thumbnail components
// (FxThumb, TransitionThumb) and sample frames. Clicking an effect or look applies it to the selected clip. Transitions are
// preview-only here: they are applied between two clips from the inspector (Transition to next clip).
// Presentation: the shared Edit-tab ModalShell (search, counts, applied state). Data and handlers are unchanged.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FxThumb } from '../../../openchatcut/library/FxThumb';
import { TransitionThumb } from '../../../openchatcut/library/TransitionThumb';
import { PreviewCleanupContext } from '../../../openchatcut/library/ResourcePreviewContext';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../../openchatcut/gl/fx/effects';
import { t } from '../../../openchatcut/i18n/t';
import { GL_TRANSITION_ORDER, glTransitionLabel } from '@cinegen/lib/occ/transitions';
import { GLT_IDS } from '../../../openchatcut/gl/glt';
import { userLutIds } from '@cinegen/lib/occ/user-luts';
import { usePluginPacks, pluginResourceItems } from '../../../openchatcut/library/pluginResources';
import { installFromText, installFromUrl, removePack, setPackEnabled } from '@cinegen/lib/occ/plugins';
import { customTransitionThumbUrl } from '../../../openchatcut/gl/transitionThumb';
import { getCustomTransition, customTransitionUniforms } from '../../../openchatcut/gl/customTransitions';
import { ModalShell } from '../ui/modal-shell';
import '../../../openchatcut/library/library.css';

type Tab = 'fx' | 'lut' | 'tr' | 'ext';
interface Props {
  onClose: () => void;
  onPickFx: (id: string) => void;
  onPickLut: (id: string) => void;
  onPickTransition?: (id: string) => void;
  /** Effect ids already on the selected clip, and its current look, so those cards show as applied. */
  appliedFx?: string[];
  appliedLut?: string;
  /** Name of the clip effects and looks are applied to. */
  clipName?: string;
}

const SUBTITLE: Record<Tab, string> = {
  fx: 'Click an effect to add it to the selected clip. Hover to preview.',
  lut: 'Click a look to apply it to the selected clip. Hover to preview.',
  tr: 'Preview the transitions. Apply one from the inspector, between two clips.',
  ext: 'Install, enable or remove plugin packs.',
};

export function OccLibraryModal({ onClose, onPickFx, onPickLut, onPickTransition, appliedFx = [], appliedLut, clipName }: Props) {
  const [tab, setTab] = useState<Tab>('fx');
  const [hover, setHover] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const packs = usePluginPacks();
  const pfx = pluginResourceItems(packs, 'fx').map((i) => i.id);
  const plut = pluginResourceItems(packs, 'lut').map((i) => i.id);
  const ptr = pluginResourceItems(packs, 'transition').map((i) => i.id);
  const fxIds = [...FX_IDS, ...pfx];
  const lutIds = [...LUT_IDS, ...userLutIds(), ...plut];
  const trIds = [...GL_TRANSITION_ORDER, ...GLT_IDS, ...ptr];
  const nameOf = (id: string) => (tab === 'tr' ? (id.startsWith('plugin:') ? (getCustomTransition(id)?.label ?? id) : glTransitionLabel(id)) : t(ALL_FX[id]?.name ?? id));
  const all = tab === 'fx' ? fxIds : tab === 'lut' ? lutIds : trIds;
  const q = query.trim().toLowerCase();
  const ids = useMemo(() => (q ? all.filter((id) => String(nameOf(id)).toLowerCase().includes(q)) : all), [all, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (id: string) => { if (tab === 'fx') onPickFx(id); else if (tab === 'lut') onPickLut(id); else onPickTransition?.(id); };
  const isApplied = (id: string) => (tab === 'fx' ? appliedFx.includes(id) : tab === 'lut' ? appliedLut === id : false);
  const previewOnly = tab === 'tr' && !onPickTransition;

  // "/" jumps to the search box, like the catalog modals elsewhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const tabs: Array<[Tab, string, number]> = [['fx', 'Effects', fxIds.length], ['lut', 'LUTs & looks', lutIds.length], ['tr', 'Transitions', trIds.length], ['ext', 'Extensions', packs.length]];
  const footerHint = tab === 'tr' ? 'Select a clip with a next clip, then choose a transition in the inspector.' : tab === 'ext' ? 'Packs are checked before install; no script from a pack is ever run.' : 'Click a card to apply it to the selected clip. Hover to preview.';
  const appliedCount = tab === 'fx' ? appliedFx.length : tab === 'lut' ? (appliedLut ? 1 : 0) : 0;

  return (
    <ModalShell
      className="occ-library"
      title="Effects library"
      subtitle={SUBTITLE[tab]}
      icon="✦"
      chip={clipName ? clipName : undefined}
      ariaLabel="Effects library"
      closeLabel="Close library"
      width={900}
      height={tab === 'ext' ? undefined : 'min(760px, 86vh)'}
      toolbar={(
        <>
          <div className="cg-seg" role="tablist">
            {tabs.map(([k, label, n]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className="cg-seg__btn" onClick={() => { setTab(k); setQuery(''); }}>
                {label}<span className="cg-count">{n}</span>
              </button>
            ))}
          </div>
          {tab !== 'ext' && (
            <label className="cg-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${tab === 'fx' ? 'effects' : tab === 'lut' ? 'looks' : 'transitions'}…`} data-testid="library-search" />
              <span className="cg-kbd" aria-hidden="true">/</span>
            </label>
          )}
        </>
      )}
      footer={(
        <>
          <span>{footerHint}</span>
          <span className="cg-modal__footer-spacer" />
          {appliedCount > 0 && <span data-testid="library-applied-count">{appliedCount} applied to this clip</span>}
        </>
      )}
      onClose={onClose}
    >
      {tab === 'ext' ? <ExtensionsPanel /> : (
        <PreviewCleanupContext.Provider value={() => {}}>
          {ids.length === 0 ? (
            <div className="cg-empty" data-testid="library-empty">No {tab === 'fx' ? 'effects' : tab === 'lut' ? 'looks' : 'transitions'} match “{query}”.</div>
          ) : (
            <div className="cg-grid">
              {ids.map((id) => (
                <button key={id} type="button" className={`cg-card${hover === id ? ' is-hover' : ''}${isApplied(id) ? ' is-applied' : ''}`} style={previewOnly ? { cursor: 'default' } : undefined}
                  onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => pick(id)} data-testid={`library-card-${id}`}>
                  <div className="cg-card__thumb">
                    {tab === 'tr' ? (id.startsWith('plugin:') ? <PluginTransitionThumb id={id} /> : <TransitionThumb type={id as never} playing={hover === id} />) : <FxThumb assetId={id} playing={hover === id} />}
                  </div>
                  <span className="cg-card__name">{nameOf(id)}</span>
                </button>
              ))}
            </div>
          )}
        </PreviewCleanupContext.Provider>
      )}
    </ModalShell>
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
    <div data-testid="extensions-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="cg-note">Plugin packs (<code>openchatcut-plugin@1</code>) add effects, LUTs, transitions and zoom presets. A pack is checked against OpenChatCut's limits and its shaders are compiled before install. Packs are data only — no script from a pack is ever run.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 14, borderRadius: 12, border: '1px dashed var(--border-medium)', background: 'rgba(255,255,255,0.02)' }}>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden data-testid="extension-file" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await run(async () => installFromText(await f.text(), { source: { kind: 'file' } })); }} />
        <button type="button" className="cg-btn" disabled={busy} onClick={() => fileRef.current?.click()}>Install from file…</button>
        <input className="cg-field" aria-label="Pack URL" placeholder="https://…/pack.json" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1, minWidth: 180, width: 'auto' }} />
        <input className="cg-field" aria-label="Expected SHA-256 (optional)" placeholder="SHA-256 (optional)" value={sha} onChange={(e) => setSha(e.target.value)} style={{ width: 170 }} />
        <button type="button" className="cg-btn cg-btn--primary" disabled={busy || !url.trim()} onClick={() => run(() => installFromUrl(url.trim(), sha.trim() ? { sha256: sha.trim() } : undefined))}>Install from URL</button>
      </div>
      {busy && <div role="status" className="cg-note">Checking and installing…</div>}
      {note && <div role="status" data-testid="extension-note" className="cg-ok">{note}</div>}
      {errors.length > 0 && <div role="alert" data-testid="extension-errors" className="cg-error">{errors.map((m, i) => <div key={i}>✕ {m}</div>)}</div>}
      <div className="cg-label">Installed · {packs.length}</div>
      {packs.length === 0 && <div className="cg-empty" style={{ padding: '18px 12px' }}>No extensions installed.</div>}
      {packs.map((p) => (
        <div key={p.id} data-testid={`extension-${p.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 11 }}>v{p.version}{p.author ? ` · ${p.author}` : ''}</span></div>
            <div className="cg-note" style={{ marginTop: 2 }}>{p.description ?? ''} {p.items.length} item{p.items.length === 1 ? '' : 's'}: {p.items.map((i) => `${i.name} (${i.type})`).join(', ')}</div>
          </div>
          <button type="button" className="cg-btn" onClick={() => void setPackEnabled(p.id, !p.enabled)}>{p.enabled ? 'Disable' : 'Enable'}</button>
          <button type="button" className="cg-btn" onClick={() => void removePack(p.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
