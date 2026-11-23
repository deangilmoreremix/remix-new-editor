// [remix] Extra Element kinds for the Timeline Editor (not in CineGen): List Builder and Lead Generator.
// These keep the Timeline Editor's EXISTING designs and logic: the Elements tab only lists and launches them.
//  - List Builder  -> the shared opt-in form settings (Styles / Fields / Pointer / Integrations): one per video, a locked gate at 0s
//  - Lead Generator -> the editor's Lead Generator add-on (Interactive panel, `lead-form`: the form overlay + Fields/Style/Integrations settings)
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import type { OverlayKind } from '@cinegen/types/workspace';
import { createOverlay, applyDesignToOverlay, findGate, startAfterGate, FORM_DESIGNS } from '@cinegen/lib/overlays/overlays';
// @ts-expect-error plain JS: the opt-in form designs + a real scaled-down render of one (shared with the Design tab)
import { OPTIN_DESIGN_CATEGORIES, getOptinDesign } from '../../../lib/editor/addons/optinDesigns.js';
// @ts-expect-error plain JS
import { liveDesignThumb } from '../../../lib/editor/addons/listBuilder.js';
import '../../../../styles/timeline-addons.css'; // the preview tiles are drawn with the form's own styles
import { selectOverlay } from '@cinegen/lib/overlays/selection';
export type WebKind = 'list-builder' | 'lead-generator';
export interface WebKindItem { id: string; kind: WebKind }

export const WEB_KINDS: Array<{ id: WebKind; label: string; blurb: string }> = [
  { id: 'list-builder', label: 'List Builder', blurb: 'Viewers fill this in before the video plays (one per video, at the start). Pick from 22 pointers and animations.' },
  { id: 'lead-generator', label: 'Lead Generator', blurb: 'Lead capture form that pauses the video wherever you place it (Styles, Fields, Pointer, Integrations).' },
];

export function newWebKind(kind: WebKind): WebKindItem { return { id: `wk-${kind}`, kind }; }

const OVERLAY_TYPE: Record<WebKind, OverlayKind> = { 'list-builder': 'list-builder', 'lead-generator': 'lead-form' };

/** "+ New" on these cards: add the overlay at the start of the timeline and open it in Edit (no host event involved). */
export function openWebKind(kind: WebKind, dispatch: (a: { type: 'ADD_OVERLAY'; overlay: ReturnType<typeof createOverlay> } | { type: 'SET_TAB'; tab: 'edit' }) => void) {
  const overlay = createOverlay(OVERLAY_TYPE[kind], 0, 10);
  dispatch({ type: 'ADD_OVERLAY', overlay });
  selectOverlay(overlay.id);
  dispatch({ type: 'SET_TAB', tab: 'edit' });
}

/** Lead Generator / List Builder are overlays on the video: here you add one at the start of the timeline or open an existing one. */
export function WebKindsPanel({ kind, onEdit }: { kind: WebKind; editing?: WebKindItem | null; onEdit: (item: WebKindItem | null) => void }) {
  const meta = WEB_KINDS.find((k) => k.id === kind)!;
  const { state, dispatch } = useWorkspace();
  const type = OVERLAY_TYPE[kind];
  const mine = state.overlays.filter((o) => o.type === type);
  const open = (id: string) => { selectOverlay(id); dispatch({ type: 'SET_TAB', tab: 'edit' }); };
  const add = () => {
    // one List Builder per video: open the one that is there
    const gate = type === 'list-builder' ? findGate(state.overlays) : undefined;
    if (gate) { onEdit(null); open(gate.id); return; }
    const overlay = createOverlay(type, startAfterGate(state.overlays, 0), 10);
    dispatch({ type: 'ADD_OVERLAY', overlay });
    onEdit(null);
    open(overlay.id);
  };
  // A design card creates the overlay WITH that design, through the same createOverlay as the card above (a List Builder is still one per video:
  // when it is already there the design is applied to it).
  const addDesign = (designId: string) => {
    const gate = type === 'list-builder' ? findGate(state.overlays) : undefined;
    if (gate) {
      dispatch({ type: 'UPDATE_OVERLAY', overlayId: gate.id, updates: { config: (applyDesignToOverlay(gate, designId) as { config?: object }).config } } as never);
      onEdit(null);
      open(gate.id);
      return;
    }
    const overlay = createOverlay(type, startAfterGate(state.overlays, 0), 10, designId);
    dispatch({ type: 'ADD_OVERLAY', overlay });
    onEdit(null);
    open(overlay.id);
  };
  return (
    <>
    <div className="elements-tab__grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {mine.map((o) => (
        <button key={o.id} type="button" className="element-card" onClick={() => open(o.id)}
          style={{ textAlign: 'left', padding: 18, border: '1px solid #eb5054', borderRadius: 'var(--radius-lg)', background: 'var(--bg-raised)', color: 'inherit', cursor: 'pointer' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{meta.label}</div>
          <span style={{ display: 'inline-block', fontSize: 10, letterSpacing: '.08em', color: '#eb5054', background: 'rgba(235,80,84,.14)', borderRadius: 6, padding: '2px 8px' }}>OVERLAY · {o.start.toFixed(1)}s–{o.end.toFixed(1)}s</span>
          <div style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 12 }}>Open it in Edit to change its fields, style and timing.</div>
        </button>
      ))}
      <button
        type="button"
        className="element-card"
        onClick={add}
        style={{ textAlign: 'left', padding: 18, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-raised)', color: 'inherit', cursor: 'pointer' }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{meta.label}</div>
        <span style={{ display: 'inline-block', fontSize: 10, letterSpacing: '.08em', color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 6, padding: '2px 8px' }}>{meta.label.toUpperCase()}</span>
        <div style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 12 }}>{meta.blurb} Click to add it as an overlay on the video.</div>
      </button>
    </div>
    <section data-testid="form-designs" aria-label={`${meta.label} designs`} style={{ marginTop: 28 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Start from a design</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
        {type === 'list-builder'
          ? 'One click puts the design on your List Builder (it is added if there is none). Everything stays editable afterwards, in the Design tab and the other settings.'
          : 'One click adds a Lead Generator with that design. Everything stays editable afterwards, in the Design tab and the other settings.'}
      </p>
      {(OPTIN_DESIGN_CATEGORIES as Array<[string, string]>).map(([cid, clabel]) => {
        const items = FORM_DESIGNS.filter((d) => d.category === cid);
        if (!items.length) return null;
        return (
          <div key={cid} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 8px' }}>{clabel}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {items.map((d) => (
                <button key={d.id} type="button" className="element-card" data-testid={`design-card-${d.id}`} aria-label={`${meta.label}: ${d.label}`} onClick={() => addDesign(d.id)}
                  style={{ textAlign: 'left', padding: 10, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-raised)', color: 'inherit', cursor: 'pointer' }}>
                  <span dangerouslySetInnerHTML={{ __html: liveDesignThumb(getOptinDesign(d.id)) }} />
                  <div style={{ fontWeight: 600, margin: '8px 0 2px', textAlign: 'center' }}>{d.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center' }}>{d.layout}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
    </>
  );
}
