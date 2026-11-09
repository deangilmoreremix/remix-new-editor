// [remix] Library browser for OpenChatCut's effects / LUTs / transitions, using their own thumbnail components
// (FxThumb, TransitionThumb) and sample frames. Clicking a card applies it to the selected clip / cut.
import { useState } from 'react';
import { FxThumb } from '../../../openchatcut/library/FxThumb';
import { TransitionThumb } from '../../../openchatcut/library/TransitionThumb';
import { PreviewCleanupContext } from '../../../openchatcut/library/ResourcePreviewContext';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../../openchatcut/gl/fx/effects';
import { t } from '../../../openchatcut/i18n/t';
import { GL_TRANSITION_ORDER, glTransitionLabel } from '@cinegen/lib/occ/transitions';
import { userLutIds } from '@cinegen/lib/occ/user-luts';
import '../../../openchatcut/library/library.css';

type Tab = 'fx' | 'lut' | 'tr';
interface Props { onClose: () => void; onPickFx: (id: string) => void; onPickLut: (id: string) => void; onPickTransition?: (id: string) => void }

export function OccLibraryModal({ onClose, onPickFx, onPickLut, onPickTransition }: Props) {
  const [tab, setTab] = useState<Tab>('fx');
  const [hover, setHover] = useState<string | null>(null);
  const ids = tab === 'fx' ? FX_IDS : tab === 'lut' ? [...LUT_IDS, ...userLutIds()] : [...GL_TRANSITION_ORDER];
  const pick = (id: string) => { if (tab === 'fx') onPickFx(id); else if (tab === 'lut') onPickLut(id); else onPickTransition?.(id); };
  return (
    <div className="occ-library" role="dialog" aria-label="Effects library" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(760px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          {([['fx', `Effects (${FX_IDS.length})`], ['lut', `LUTs & looks (${LUT_IDS.length + userLutIds().length})`], ['tr', `Transitions (${GL_TRANSITION_ORDER.length})`]] as Array<[Tab, string]>).map(([k, label]) => (
            <button key={k} className="clip-properties-panel__toggle-btn" style={tab === k ? { borderColor: '#22d3ee' } : undefined} onClick={() => setTab(k)}>{label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="clip-properties-panel__toggle-btn" aria-label="Close library" onClick={onClose}>×</button>
        </div>
        <PreviewCleanupContext.Provider value={() => {}}>
          <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 10, paddingRight: 4 }}>
            {ids.map((id) => (
              <button key={id} className={`cc-resource-card${hover === id ? ' hovered' : ''}`} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => pick(id)} data-testid={`library-card-${id}`}>
                <div className="cc-resource-thumb">
                  {tab === 'tr' ? <TransitionThumb type={id as never} playing={hover === id} /> : <FxThumb assetId={id} playing={hover === id} />}
                </div>
                <span className="cc-resource-name">{tab === 'tr' ? glTransitionLabel(id) : t(ALL_FX[id]?.name ?? id)}</span>
              </button>
            ))}
          </div>
        </PreviewCleanupContext.Provider>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>{tab === 'tr' ? 'Select a clip with a next clip, then choose a transition in the inspector.' : 'Click a card to apply it to the selected clip. Hover to preview.'}</div>
      </div>
    </div>
  );
}
