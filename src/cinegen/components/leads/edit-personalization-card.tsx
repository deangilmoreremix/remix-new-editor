// [remix] Edit personalization of a PUBLISHED video without touching the live link: edit (the same Personalization
// Modal, Business Finder and Asset Finder) -> save draft -> preview the draft as any business -> publish the draft
// to the same URL. Recipient links keep working; only what the draft changed is different once it is promoted.
import { useState } from 'react';
// @ts-expect-error plain JS
import { selectContact } from '../../../lib/contactStore.js';
import type { usePublished } from './use-publish';
import type { useRecipients } from './use-recipients';
import type { BusinessLibrary } from './use-business-library';
import { DraftPreview } from './draft-preview';

const KIND_LABEL = { live: 'Live', draft: 'Draft', superseded: 'Earlier' } as const;
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };

export function EditPersonalizationCard({ pub, rec, lib, playerDeps }: { playerDeps?: Record<string, unknown>; pub: ReturnType<typeof usePublished>; rec: ReturnType<typeof useRecipients>; lib: BusinessLibrary }) {
  const [preview, setPreview] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  if (!pub.info) return null;
  if (pub.draftsUnavailable) return <section className="leads-card" data-testid="edit-personalization"><h3 className="leads-card__title">Edit personalization</h3><p className="leads-note" data-testid="drafts-unavailable">Drafts are not installed on this project yet (database upgrade pending). Use “Update published video” to change the live version.</p></section>;

  const live = pub.info.live_revision ?? 1;
  const drafts = pub.revisions.filter((r) => r.kind === 'draft');
  const businessName = lib.business?.name;
  return (
    <section className="leads-card" data-testid="edit-personalization">
      <h3 className="leads-card__title">Edit personalization <span className="leads-pill">Live: version {live}</span></h3>
      <ol className="leads-steps">
        <li><b>Edit.</b> Change the business, find or upload images, update text and the call-to-action.
          <div className="leads-row">
            <label className="leads-label" style={{ flex: 1 }}>Editing for
              <select className="leads-input" data-testid="edit-contact" value={lib.profile?.id ?? ''} onChange={(e) => { selectContact(e.target.value); window.dispatchEvent(new CustomEvent('remix:contact-changed')); }}>
                <option value="" disabled>Select a business</option>
                {rec.rows.map((r) => <option key={r.contactId} value={r.contactId}>{r.businessName || r.name}</option>)}
              </select>
            </label>
            <button type="button" className="leads-btn leads-btn--primary" onClick={() => void lib.findMore()} data-testid="edit-open">Edit personalization</button>
          </div>
        </li>
        <li><b>Save as draft.</b> Your live link does not change.
          <div className="leads-row">
            <button type="button" className="leads-btn" disabled={pub.busy} onClick={async () => { const rev = await pub.saveDraft(pub.title); if (rev) setNotice(`Saved as draft ${rev}. Your live link is unchanged.`); }} data-testid="draft-save">{pub.busy ? 'Working…' : 'Save draft'}</button>
          </div>
        </li>
        <li><b>Preview, then publish.</b>
          {drafts.length === 0 && <p className="leads-note" data-testid="drafts-empty">No drafts yet.</p>}
          {pub.revisions.map((r) => (
            <div key={r.revision} className="leads-row" data-testid={`rev-${r.revision}`} data-kind={r.kind}>
              <span className={`leads-tag leads-tag--${r.kind === 'draft' ? 'wall' : 'lead'}`}>{KIND_LABEL[r.kind]}</span>
              <span className="leads-note">Version {r.revision} · {when(r.created_at)}</span>
              {r.kind === 'draft' && (<>
                <button type="button" className="leads-btn" onClick={() => setPreview(r.revision)} data-testid={`rev-preview-${r.revision}`}>Preview draft</button>
                {confirm === r.revision
                  ? <><button type="button" className="leads-btn leads-btn--primary" disabled={pub.busy} onClick={async () => { await pub.promote(r.revision); setConfirm(null); setNotice(`Draft ${r.revision} is now live at the same link.${rec.summary.linked ? ' Personalized links keep working.' : ''}`); }} data-testid={`rev-publish-yes-${r.revision}`}>Make it live</button> <button type="button" className="leads-btn" onClick={() => setConfirm(null)}>Cancel</button></>
                  : <button type="button" className="leads-btn" onClick={() => setConfirm(r.revision)} data-testid={`rev-publish-${r.revision}`}>Publish draft</button>}
              </>)}
            </div>
          ))}
        </li>
      </ol>
      {rec.summary.stale > 0 && <p className="leads-note" data-testid="stale-hint">{rec.summary.stale} personalized link{rec.summary.stale === 1 ? ' has' : 's have'} older images than {businessName ? `${businessName}'s` : 'the'} library. Use “Refresh images” in Personalized links to update only those.</p>}
      <p className="leads-note">Only the business you edit changes. Other businesses’ links and images stay as they are unless you refresh them.</p>
      {notice && <p className="leads-note" role="status" data-testid="edit-notice">{notice}</p>}
      {preview != null && pub.id && <DraftPreview videoId={pub.id} revision={preview} load={() => pub.draftProject(preview)} rows={rec.rows} onClose={() => setPreview(null)} playerDeps={playerDeps} />}
    </section>
  );
}
