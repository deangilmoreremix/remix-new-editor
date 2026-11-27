// [remix] Browser for OpenChatCut's motion-graphics templates (assets/templates). Adds the chosen template to the overlay lane at the playhead.
// Cards show the template's own picture and play it live on hover (see preview-card.tsx), same as the Animations library.
import { useMemo, useState } from 'react';
import type { MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { PreviewCard } from './preview-card';
import { mgPreview } from './add-to-timeline-registry';
import '../../styles/modal-shell.css';
import '../../styles/edit-modal-templates.css';

/** The list is loaded once by the Add to timeline window and handed down (null while loading), so the Motion graphics tab and the All tab share one load. */
export function MgTemplatesPanel({ templates, error, onRetry, onPick }: { templates: MgTemplate[] | null; error?: boolean; onRetry?: () => void; onPick: (t: MgTemplate) => void }) {
  const all = templates;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  // templates the code gate still rejects are not offered at all
  const usable = useMemo(() => (all ?? []).filter((t) => t.usable), [all]);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const t of usable) m.set(t.category, (m.get(t.category) ?? 0) + 1); return m; }, [usable]);
  const cats = useMemo(() => ['all', ...counts.keys()], [counts]);
  const list = usable.filter((t) => (cat === 'all' || t.category === cat) && (!q || `${t.name} ${t.description ?? ''} ${t.category}`.toLowerCase().includes(q.toLowerCase())));
  const blocked = (all ?? []).length - usable.length;
  return (
    <div className="etm-fill">
      <div className="etm-head">
        <strong>✺ Choose a motion graphic</strong>
        <span className="etm-spacer" />
        <span className="cg-note">{usable.length} templates</span>
      </div>
      <div className="cg-note etm-hint">Hover a card to play it. Click to add it to the timeline.</div>
      <div role="tablist" aria-label="Motion graphics categories" className="cg-chips etm-chips">
        {cats.map((c) => {
          const on = cat === c;
          return (
            <button key={c} type="button" role="tab" aria-selected={on} className="cg-chip etm-chip" onClick={() => setCat(c)}>
              {c === 'all' ? 'All' : c}
              <span className="cg-count">{c === 'all' ? usable.length : counts.get(c)}</span>
            </button>
          );
        })}
      </div>
      <label className="cg-search" style={{ marginBottom: 12, flex: '0 0 auto', minHeight: 36 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input type="text" placeholder="Search motion graphics…" aria-label="Search motion graphics" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="etm-cards">
        {!all && <span className="cg-note">Loading…</span>}
        {error && <MgLoadError onRetry={onRetry} />}
        {list.map((t) => (
          <PreviewCard key={t.id} preview={mgPreview(t)} title={t.name} badge="Motion graphic" sub={`${t.category} · ${t.width}×${t.height} · ${(t.durationInFrames / t.fps).toFixed(1)}s`} onClick={() => onPick(t)} testId={`mg-${t.id}`} />
        ))}
        {all && !error && !list.length && <div className="cg-empty">No motion graphics match your search.</div>}
      </div>
      {all && blocked > 0 && <div className="cg-note" style={{ marginTop: 8 }}>{usable.length} templates available ({blocked} excluded: raw HTML injection is not allowed in the sandbox, or the repair could not be verified).</div>}
    </div>
  );
}

/** Shown in the Motion graphics tab and the All tab when the template list could not be loaded. */
export function MgLoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" data-testid="mg-load-error" className="etm-banner etm-wide">
      <span>Could not load the motion graphics.</span>
      {onRetry && <button type="button" className="cg-btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}
