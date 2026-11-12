// [remix] Browser for OpenChatCut's motion-graphics templates (assets/templates). Adds the chosen template to the overlay lane at the playhead.
// Cards show the template's own picture and play it live on hover (see preview-card.tsx), same as the Animations library.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { loadMgTemplates, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { PreviewCard, CARD_CSS } from './preview-card';
import { mgPreview } from './add-to-timeline-registry';

const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input, transparent)', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 10, padding: '11px 12px', fontSize: 13 };

export function MgTemplatesPanel({ onPick, onClose }: { onPick: (t: MgTemplate) => void; onClose?: () => void }) {
  const [all, setAll] = useState<MgTemplate[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  useEffect(() => { void loadMgTemplates().then(setAll); }, []);
  // templates the code gate still rejects are not offered at all
  const usable = useMemo(() => (all ?? []).filter((t) => t.usable), [all]);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const t of usable) m.set(t.category, (m.get(t.category) ?? 0) + 1); return m; }, [usable]);
  const cats = useMemo(() => ['all', ...counts.keys()], [counts]);
  const list = usable.filter((t) => (cat === 'all' || t.category === cat) && (!q || `${t.name} ${t.description ?? ''} ${t.category}`.toLowerCase().includes(q.toLowerCase())));
  const blocked = (all ?? []).length - usable.length;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <strong style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>✺ Choose a motion graphic</strong>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, opacity: 0.6 }}>{usable.length} templates</span>
        {onClose && <button className="clip-properties-panel__toggle-btn" onClick={onClose}>Close</button>}
      </div>
      <div style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 12px' }}>Hover a card to play it. Click to add it to the timeline.</div>
      <div role="tablist" aria-label="Motion graphics categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {cats.map((c) => {
          const on = cat === c;
          return (
            <button key={c} role="tab" aria-selected={on} onClick={() => setCat(c)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
              {c === 'all' ? 'All' : c}
              <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' }}>{c === 'all' ? usable.length : counts.get(c)}</span>
            </button>
          );
        })}
      </div>
      <input type="text" placeholder="⌕  Search motion graphics…" aria-label="Search motion graphics" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, marginBottom: 12 }} />
      <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start', paddingRight: 4, minHeight: 0, flex: 1 }}>
        {!all && <span style={{ fontSize: 12, opacity: 0.7 }}>Loading…</span>}
        {list.map((t) => (
          <PreviewCard key={t.id} preview={mgPreview(t)} title={t.name} badge="Motion graphic" sub={`${t.category} · ${t.width}×${t.height} · ${(t.durationInFrames / t.fps).toFixed(1)}s`} onClick={() => onPick(t)} testId={`mg-${t.id}`} />
        ))}
        {all && !list.length && <span style={{ fontSize: 13, opacity: 0.7 }}>No motion graphics match your search.</span>}
      </div>
      {all && blocked > 0 && <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>{usable.length} templates available ({blocked} excluded: raw HTML injection is not allowed in the sandbox, or the repair could not be verified).</div>}
    </>
  );
}

export function MgTemplatesModal({ onClose, onPick }: { onClose: () => void; onPick: (t: MgTemplate) => void }) {
  return (
    <div role="dialog" aria-label="Motion graphics templates" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <style>{CARD_CSS}</style>
      <div style={{ width: 'min(1100px, 94vw)', height: 'min(800px, 90vh)', display: 'flex', flexDirection: 'column', background: '#0b1016', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <MgTemplatesPanel onPick={onPick} onClose={onClose} />
      </div>
    </div>
  );
}
