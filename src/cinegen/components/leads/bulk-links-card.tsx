// [remix] Bulk link manager (Leads tab): one personalized link per contact for the published video. No video is duplicated.
import { useMemo, useState } from 'react';
// @ts-expect-error plain JS
import { slugify, isValidSlug } from '../../../lib/editor/publish/publishClient.js';
import type { usePublished } from './use-publish';
import type { useRecipients } from './use-recipients';

const STATUS_LABEL: Record<string, string> = { ready: 'Ready', 'missing-assets': 'Needs assets', 'already-linked': 'Linked', invalid: 'Invalid' };

export function BulkLinksCard({ pub, rec }: { pub: ReturnType<typeof usePublished>; rec: ReturnType<typeof useRecipients> }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [slugDraft, setSlugDraft] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const live = !!pub.info?.published;
  const suggestion = useMemo(() => slugify(pub.title), [pub.title]);
  const allIds = rec.rows.map((r) => r.contactId);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const copy = (key: string, text: string) => { void navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); };
  const download = () => {
    const blob = new Blob([rec.csv(sel.size ? [...sel] : undefined)], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'personalized-links.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  if (rec.unavailable) return <section className="leads-card" data-testid="bulk-links"><h3 className="leads-card__title">Personalized links</h3><p className="leads-note" data-testid="bulk-unavailable">Personalized links are not installed on this project yet (database upgrade pending).</p></section>;
  if (!pub.info) return <section className="leads-card" data-testid="bulk-links"><h3 className="leads-card__title">Personalized links</h3><p className="leads-note" data-testid="bulk-needs-publish">Publish the video first. Then create one link per business or contact from the same video.</p></section>;

  const s = rec.summary;
  const slugOk = isValidSlug(slugDraft);
  return (
    <section className="leads-card" data-testid="bulk-links">
      <h3 className="leads-card__title">Personalized links <span className="leads-pill" data-testid="bulk-summary">{s.linked} live · {s.ready} ready · {s.missing} need assets{s.revoked ? ` · ${s.revoked} revoked` : ''}</span></h3>
      {!live && <p className="leads-note">This video is unpublished: links will not play until you republish.</p>}

      <div className="leads-row" data-testid="slug-row">
        <label className="leads-label" style={{ flex: 1 }}>Link name
          <input className="leads-input" placeholder={suggestion || 'smith-roofing'} value={slugDraft} onChange={(e) => setSlugDraft(e.target.value.toLowerCase())} data-testid="slug-input" aria-invalid={!!slugDraft && !slugOk} />
        </label>
        <button type="button" className="leads-btn" disabled={rec.busy || !slugOk} onClick={() => void rec.saveSlug(slugDraft)} data-testid="slug-save">Save</button>
        {suggestion && isValidSlug(suggestion) && suggestion !== slugDraft && <button type="button" className="leads-chip" onClick={() => setSlugDraft(suggestion)} data-testid="slug-suggest">Use “{suggestion}”</button>}
      </div>
      <p className="leads-note">{rec.slug ? <>Links look like <code>/v/{rec.slug}?recipient=…</code>. Renaming keeps old links working.</> : <>No link name yet: links use <code>/watch/{rec.videoId}</code>.</>}</p>

      <div className="leads-row">
        <button type="button" className="leads-btn" onClick={() => void rec.importCsv()} data-testid="bulk-import">Import contacts (CSV)</button>
        <button type="button" className="leads-btn" onClick={() => setSel(sel.size === allIds.length ? new Set() : new Set(allIds))} data-testid="bulk-select-all">{sel.size === allIds.length && allIds.length ? 'Clear selection' : 'Select all'}</button>
        <button type="button" className="leads-btn leads-btn--primary" disabled={rec.busy || !sel.size} onClick={() => void rec.create([...sel])} data-testid="bulk-create">Create links ({sel.size})</button>
        <button type="button" className="leads-btn" disabled={rec.busy || !sel.size} onClick={() => void rec.create([...sel], { allowMissing: true })} data-testid="bulk-create-anyway" title="Create links even where an image is missing; the viewer sees the fallback or no image">Create anyway</button>
        <button type="button" className="leads-btn" disabled={rec.busy || ![...sel].some((id) => rec.rows.find((r) => r.contactId === id)?.stale)} onClick={() => void rec.refresh([...sel])} data-testid="bulk-refresh">Refresh images{s.stale ? ` (${s.stale})` : ''}</button>
        <button type="button" className="leads-btn" disabled={!s.linked} onClick={download} data-testid="bulk-export">Export CSV</button>
      </div>

      {rec.rows.length === 0 && <p className="leads-note" data-testid="bulk-empty">No contacts yet. Import a CSV or add a business with Find a business.</p>}
      {rec.rows.length > 0 && (
        <div className="leads-tablewrap">
          <table className="leads-table" data-testid="bulk-table">
            <thead><tr><th /><th>Contact</th><th>Business</th><th>Video</th><th>Personalization</th><th>Assets</th><th>URL</th><th>Link</th><th /></tr></thead>
            <tbody>
              {rec.rows.map((r) => (
                <tr key={r.contactId} data-testid={`row-${r.contactId}`}>
                  <td><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.has(r.contactId)} onChange={() => toggle(r.contactId)} /></td>
                  <td>{r.name}</td>
                  <td>{r.businessName || '—'}</td>
                  <td>{pub.title}</td>
                  <td><span className={`leads-tag leads-tag--${r.plan.status === 'ready' || r.plan.status === 'already-linked' ? 'lead' : 'wall'}`} data-testid={`pstatus-${r.contactId}`}>{STATUS_LABEL[r.plan.status]}</span>{r.stale && <span className="leads-tag leads-tag--wall" data-testid={`stale-${r.contactId}`}> images changed</span>}</td>
                  <td data-testid={`assets-${r.contactId}`}>
                    {r.plan.missingSlots.length === 0 ? 'Complete' : <>Missing {r.plan.missingSlots.join(', ')} <button type="button" className="leads-chip" onClick={() => void rec.findAssets(r.contactId)} data-testid={`find-${r.contactId}`}>Find assets</button></>}
                  </td>
                  <td data-testid={`url-${r.contactId}`}>{r.recipient && r.linkStatus === 'active' ? <input className="leads-input" readOnly value={rec.urlOf(r.recipient)} aria-label={`Link for ${r.name}`} /> : '—'}</td>
                  <td data-testid={`lstatus-${r.contactId}`}>{r.linkStatus === 'none' ? '—' : r.linkStatus}</td>
                  <td>
                    {r.recipient && r.linkStatus === 'active' && (<>
                      <button type="button" className="leads-btn" onClick={() => copy(r.contactId, rec.urlOf(r.recipient!))} data-testid={`copy-${r.contactId}`}>{copied === r.contactId ? 'Copied' : 'Copy'}</button>{' '}
                      <button type="button" className="leads-btn" disabled={!live} onClick={() => setPreview(rec.urlOf(r.recipient!))} data-testid={`preview-${r.contactId}`}>Preview</button>{' '}
                      {revoking === r.recipient.id
                        ? <><button type="button" className="leads-btn leads-btn--primary" data-testid={`revoke-yes-${r.contactId}`} onClick={() => { void rec.revoke(r.recipient!.id); setRevoking(null); }}>Revoke for good</button> <button type="button" className="leads-btn" onClick={() => setRevoking(null)}>Cancel</button></>
                        : <button type="button" className="leads-btn" onClick={() => setRevoking(r.recipient!.id)} data-testid={`revoke-${r.contactId}`}>Revoke</button>}
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rec.notice && <p className="leads-note" role="status" data-testid="bulk-notice">{rec.notice}</p>}
      {rec.error && <p className="leads-error" role="alert" data-testid="bulk-error">{rec.error}</p>}
      <p className="leads-note">Every link plays the same published video. Only each person’s own text and images change. Names and emails are never put in the URL.</p>
      {preview && (
        <div className="leads-modal" role="dialog" aria-label="Recipient preview" onClick={() => setPreview(null)}>
          <div className="leads-modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="leads-modal__bar"><span>Recipient preview — what this person sees</span><button type="button" className="leads-btn" onClick={() => setPreview(null)}>Close</button></div>
            <iframe className="leads-preview" data-testid="recipient-frame" title="Recipient preview" src={preview} allow="autoplay; fullscreen" />
          </div>
        </div>
      )}
    </section>
  );
}
