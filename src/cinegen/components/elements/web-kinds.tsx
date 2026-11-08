// [remix] Extra Element kinds for the Timeline Editor (not in CineGen): List Builder and Lead Generator.
// These keep the Timeline Editor's EXISTING designs and logic: the Elements tab only lists and launches them.
//  - List Builder  -> the editor's List Builder settings panel (Interactive panel, renderListBuilderSettings)
//  - Lead Generator -> the editor's Lead Generator add-on (Interactive panel, `lead-form`: the form overlay + Fields/Style/Integrations settings)
// The host page listens for `remix:open-element-kind` and opens the existing UI (see TimelineEditorPage).
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import type { OverlayKind } from '@cinegen/types/workspace';
import { createOverlay } from '@cinegen/lib/overlays/overlays';
import { selectOverlay } from '@cinegen/lib/overlays/selection';
export type WebKind = 'list-builder' | 'lead-generator';
export interface WebKindItem { id: string; kind: WebKind }

export const WEB_KINDS: Array<{ id: WebKind; label: string; blurb: string }> = [
  { id: 'list-builder', label: 'List Builder', blurb: 'Opt-in / personalizer form shown over your video. Opens the List Builder settings.' },
  { id: 'lead-generator', label: 'Lead Generator', blurb: 'Lead capture form shown over your video (Fields, Style, Integrations). Adds the Lead Generator at the playhead.' },
];

export function newWebKind(kind: WebKind): WebKindItem { return { id: `wk-${kind}`, kind }; }

export function openWebKind(kind: WebKind) {
  window.dispatchEvent(new CustomEvent('remix:open-element-kind', { detail: { kind } }));
}

const OVERLAY_TYPE: Record<WebKind, OverlayKind> = { 'list-builder': 'list-builder', 'lead-generator': 'lead-form' };

/** Lead Generator / List Builder are overlays on the video: here you add one at the start of the timeline or open an existing one. */
export function WebKindsPanel({ kind, onEdit }: { kind: WebKind; editing?: WebKindItem | null; onEdit: (item: WebKindItem | null) => void }) {
  const meta = WEB_KINDS.find((k) => k.id === kind)!;
  const { state, dispatch } = useWorkspace();
  const type = OVERLAY_TYPE[kind];
  const mine = state.overlays.filter((o) => o.type === type);
  const open = (id: string) => { selectOverlay(id); dispatch({ type: 'SET_TAB', tab: 'edit' }); };
  const add = () => {
    const overlay = createOverlay(type, 0, 10);
    dispatch({ type: 'ADD_OVERLAY', overlay });
    onEdit(null);
    open(overlay.id);
  };
  return (
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
  );
}
