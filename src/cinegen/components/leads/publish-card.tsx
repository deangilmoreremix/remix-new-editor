// [remix] Left column of the Leads tab: publish / unpublish, link + embed, what the video includes.
import { useEffect, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { publishIncludes } from '@cinegen/lib/leads/leads';
// @ts-expect-error plain JS
import { publicUrl, embedCode } from '../../../lib/editor/publish/publishClient.js';
import type { usePublished } from './use-publish';

export function PublishCard({ pub, leadCount }: { pub: ReturnType<typeof usePublished>; leadCount: number }) {
  const { state } = useWorkspace();
  const [title, setTitle] = useState(pub.title);
  const [copied, setCopied] = useState('');
  const [preview, setPreview] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => setTitle(pub.title), [pub.title]);
  const includes = publishIncludes(state.overlays ?? []);
  const live = !!pub.info?.published;
  const copy = (what: string, text: string) => { void navigator.clipboard?.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500); };
  return (
    <section className="leads-card" data-testid="publish-card">
      <h3 className="leads-card__title">Publish <span className={`leads-pill${live ? ' is-live' : ''}`}>{live ? 'Live' : pub.info ? 'Unpublished' : 'Not published'}</span></h3>
      <label className="leads-label">Title
        <input className="leads-input" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="publish-title" />
      </label>
      <div className="leads-row">
        <button type="button" className="leads-btn leads-btn--primary" disabled={pub.busy} onClick={() => void pub.publish(title)} data-testid="publish-btn">
          {pub.busy ? 'Working…' : pub.info ? 'Update published video' : 'Publish video'}
        </button>
        {pub.info && <button type="button" className="leads-btn" disabled={pub.busy} onClick={() => void pub.setLive(!live)} data-testid="unpublish-btn">{live ? 'Unpublish' : 'Republish'}</button>}
      </div>
      {pub.error && <p className="leads-error" role="alert">{pub.error}</p>}
      {!pub.signedIn && <p className="leads-note">Sign in to publish videos.</p>}
      {pub.info && pub.id && (
        <div className="leads-links">
          <div className="leads-copy"><span className="leads-label">Link</span><input readOnly value={publicUrl({ id: pub.id, business: pub.business, slug: pub.info.slug })} className="leads-input" /><button type="button" className="leads-btn" onClick={() => copy('link', publicUrl({ id: pub.id!, business: pub.business, slug: pub.info!.slug }))}>{copied === 'link' ? 'Copied' : 'Copy'}</button></div>
          <div className="leads-copy"><span className="leads-label">Embed</span><input readOnly value={embedCode(pub.id)} className="leads-input" /><button type="button" className="leads-btn" onClick={() => copy('embed', embedCode(pub.id!))}>{copied === 'embed' ? 'Copied' : 'Copy'}</button></div>
          <div className="leads-row">
            <button type="button" className="leads-btn" data-testid="preview-btn" disabled={!live} onClick={() => { setPreview(true); setNonce((n) => n + 1); }}>Preview as viewer</button>
            <a className="leads-btn" data-testid="view-link" href={publicUrl({ id: pub.id, business: pub.business, slug: pub.info.slug })} target="_blank" rel="noreferrer">View published page ↗</a>
          </div>
          {preview && live && (
            <div className="leads-modal" role="dialog" aria-label="Viewer preview" onClick={() => setPreview(false)}>
              <div className="leads-modal__box" onClick={(e) => e.stopPropagation()}>
                <div className="leads-modal__bar"><span>Viewer preview — what people see at your link</span><button type="button" className="leads-btn" onClick={() => setPreview(false)}>Close</button></div>
                <iframe key={nonce} className="leads-preview" data-testid="preview-frame" title="Published video preview" src={publicUrl({ id: pub.id, business: pub.business, slug: pub.info.slug })} allow="autoplay; fullscreen" />
              </div>
            </div>
          )}
          {!live && <p className="leads-note">Republish to preview and share the link.</p>}
          <p className="leads-stats">{pub.info.view_count ?? 0} views · {leadCount} leads</p>
        </div>
      )}
      <div className="leads-includes" data-testid="publish-includes">
        <div className="leads-label">This published video includes</div>
        {includes.length === 0 && <p className="leads-note">Plain video. Add a List Builder or Lead Generator from the Elements tab to collect leads.</p>}
        {includes.map((it, i) => (
          <div key={i} className="leads-include"><span aria-hidden>{it.icon}</span><div><b>{it.title}</b> — {it.detail}{it.note && <div className="leads-note">{it.note}</div>}</div></div>
        ))}
      </div>
      <p className="leads-note">Submitting a form in the editor is only a test. Leads are collected from the published link. Forms are not part of the exported MP4.</p>
    </section>
  );
}
