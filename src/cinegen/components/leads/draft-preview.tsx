// [remix] Owner-only preview of a DRAFT revision, shown "as" any contact. Drafts are not served by /watch or /v,
// so this mounts the same viewer in-page with the draft snapshot. Nothing is recorded: no view counts, no events,
// no lead submissions, no voice calls, and the host page's styles/title are left alone.
import { useEffect, useRef, useState } from 'react';
// @ts-expect-error plain JS
import { mountWatchPage } from '../../../pages/WatchPage.jsx';
import type { BulkRow } from '@cinegen/lib/leads/bulk-rows';

export function DraftPreview({ videoId, draftId, label, load, rows, onClose, playerDeps = {} }: { playerDeps?: Record<string, unknown>; videoId: string; draftId: string; label: string; load: () => Promise<unknown>; rows: BulkRow[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [as, setAs] = useState('');           // contactId, '' = generic viewer
  const [err, setErr] = useState('');
  const [project, setProject] = useState<unknown>(null);

  useEffect(() => { let on = true; load().then((p) => { if (on) { setProject(p); if (!p) setErr('This draft could not be loaded.'); } }).catch((e) => on && setErr((e as Error).message)); return () => { on = false; }; }, [load]);

  useEffect(() => {
    if (!project || !box.current) return;
    const row = rows.find((r) => r.contactId === as);
    // what that business would see: its own text + its currently assigned images. Unknown contact = generic viewer.
    const viewerProfile = row ? { id: row.contactId, variables: { ...(row.plan.variables as Record<string, string>) } } : null;
    let player: { destroy?: () => void } | null = null; let dead = false;
    void mountWatchPage(box.current, `draft-${videoId}`, {
      isolated: true, viewerProfile, ...playerDeps,
      fetchVideo: async () => ({ id: `draft-${videoId}-${draftId}`, title: label, project }),
      countView: () => {}, recordEvent: () => {}, onLead: async () => ({ stored: false, error: null }), voiceFor: async () => null,
    }).then((p: typeof player) => { if (dead) p?.destroy?.(); else player = p; });
    return () => { dead = true; player?.destroy?.(); };
  }, [project, as, rows, videoId, draftId, label, playerDeps]);

  return (
    <div className="leads-modal" role="dialog" aria-label="Draft preview" data-testid="draft-preview" onClick={onClose}>
      <div className="leads-modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="leads-modal__bar">
          <span>Draft “{label}” preview — not live. Nothing here is recorded.</span>
          <label className="leads-row" style={{ gap: 6 }}>View as
            <select className="leads-input" value={as} onChange={(e) => setAs(e.target.value)} data-testid="draft-as" style={{ width: 'auto' }}>
              <option value="">Generic viewer</option>
              {rows.map((r) => <option key={r.contactId} value={r.contactId}>{r.businessName || r.name}</option>)}
            </select>
          </label>
          <button type="button" className="leads-btn" onClick={onClose}>Close</button>
        </div>
        {err ? <p className="leads-error" role="alert" data-testid="draft-error">{err}</p> : <div ref={box} className="leads-draft watch-embed" data-testid="draft-stage" />}
      </div>
    </div>
  );
}
