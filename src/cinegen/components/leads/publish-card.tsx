// [remix] Left column of the Leads tab: publish / unpublish, link + embed, what the video includes.
import { useEffect, useState } from 'react';
import { useWorkspace } from '@cinegen/components/workspace/workspace-shell';
import { publishIncludes } from '@cinegen/lib/leads/leads';
import { createQrEndCard, mp4WatchLink } from '@cinegen/lib/leads/qr-end-card';
import { LINK_PRESETS, trackedLink } from '@cinegen/lib/leads/share-links';
// @ts-expect-error plain JS
import { watchUrl, canonicalUrl, customDomainUrl, normalizeDomain, embedCode, slugify, validateSlug } from '../../../lib/editor/publish/publishClient.js';
// @ts-expect-error plain JS
import { GUEST_NOTICE } from '../../../lib/editor/publish/guestMessages.js';
import type { usePublished } from './use-publish';

export function PublishCard({ pub, leadCount }: { pub: ReturnType<typeof usePublished>; leadCount: number }) {
  const { state, dispatch } = useWorkspace();
  const [preset, setPreset] = useState('email');
  const [campaign, setCampaign] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const [qrDone, setQrDone] = useState(false);
  const [title, setTitle] = useState(pub.title);
  const [copied, setCopied] = useState('');
  const [preview, setPreview] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => setTitle(pub.title), [pub.title]);
  const [business, setBusiness] = useState('');
  const [slug, setSlug] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [domain, setDomain] = useState('');
  useEffect(() => setDomain(pub.info?.customDomain || ''), [pub.info?.customDomain]);
  useEffect(() => { setSlug(pub.info?.slug || slugify(pub.title, '')); }, [pub.info?.slug, pub.title]);
  const includes = publishIncludes(state.overlays ?? []);
  // The readable /v/<business>/<slug> link once set, else /watch/<id>.
  const shareLink = pub.info ? canonicalUrl({ ...pub.info, id: pub.id }) : '';
  const domainLink = pub.info ? customDomainUrl(pub.info) : null;
  const saveDomain = async () => {
    if (domain.trim() && !normalizeDomain(domain)) { setLinkMsg('Enter a domain like videos.yourbusiness.com (no https:// or path).'); return; }
    await pub.setDomain(domain);
    setLinkMsg(domain.trim() ? 'Domain saved. Point its DNS (CNAME) at smartvid.app; we then connect it.' : 'Domain removed.');
  };
  const saveLink = async () => {
    const bizErr = !pub.info?.business && business ? validateSlug(business.trim().toLowerCase()) : null;
    const err = bizErr || validateSlug(slug.trim().toLowerCase());
    if (!pub.info?.business && !business.trim()) { setLinkMsg('Choose a business name first.'); return; }
    if (err) { setLinkMsg(err); return; }
    await pub.saveLink(pub.info?.business ? '' : business.trim().toLowerCase(), slug.trim().toLowerCase());
    setLinkMsg('Link saved. Old links keep working.');
  };
  const live = !!pub.info?.published;
  const addQrCard = async () => {
    if (!pub.id) return;
    setQrBusy(true);
    try {
      const tl = state.timelines.find((t) => t.id === state.activeTimelineId) ?? state.timelines[0];
      const secs = Math.max(2, tl?.duration ?? 10);
      for (const overlay of await createQrEndCard(mp4WatchLink(pub.id, window.location.origin), secs)) dispatch({ type: 'ADD_OVERLAY', overlay });
      setQrDone(true);
    } finally { setQrBusy(false); }
  };
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
      {pub.guest && <p className="leads-note" data-testid="guest-notice">{GUEST_NOTICE}</p>}
      {pub.info && pub.id && (
        <div className="leads-links">
          <div className="leads-copy"><span className="leads-label">Link</span><input readOnly value={shareLink} className="leads-input" data-testid="share-link" /><button type="button" className="leads-btn" onClick={() => copy('link', shareLink)}>{copied === 'link' ? 'Copied' : 'Copy'}</button></div>
          {!pub.guest && (
            <div className="leads-linkedit" data-testid="custom-link">
              <span className="leads-label">Custom link</span>
              <div className="leads-row">
                {pub.info.business
                  ? <code>/v/{pub.info.business}/</code>
                  : <input className="leads-input" value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={48} placeholder="your-business" aria-label="Business name in link" data-testid="link-business" />}
                <input className="leads-input" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={48} placeholder="video-name" aria-label="Video name in link" data-testid="link-slug" />
                <button type="button" className="leads-btn" disabled={pub.busy} onClick={() => void saveLink()} data-testid="save-link">Save link</button>
              </div>
              <p className="leads-note" role="status">{linkMsg || (pub.info.business ? 'Rename any time; old links keep working.' : 'Pick a business name once; it is yours alone and appears in all your links.')}</p>
              {pub.info.business && (
                <div data-testid="custom-domain">
                  <span className="leads-label">Your own domain (optional)</span>
                  <div className="leads-row">
                    <input className="leads-input" value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={253} placeholder="videos.yourbusiness.com" aria-label="Your own domain" data-testid="link-domain" />
                    <button type="button" className="leads-btn" disabled={pub.busy} onClick={() => void saveDomain()} data-testid="save-domain">Save domain</button>
                  </div>
                  {domainLink && <p className="leads-note" data-testid="domain-link">Link on your domain once connected: {domainLink}</p>}
                </div>
              )}
              <label className="leads-label">Who can find it
                <select className="leads-input leads-select" value={pub.info.privacy === 'unlisted' ? 'unlisted' : 'public'} onChange={(e) => void pub.setPrivacy(e.target.value as 'public' | 'unlisted')} data-testid="link-privacy">
                  <option value="public">Public — search engines may list it</option>
                  <option value="unlisted">Unlisted — only people with the link</option>
                </select>
              </label>
            </div>
          )}
          <div className="leads-copy"><span className="leads-label">Embed</span><input readOnly value={embedCode(pub.id)} className="leads-input" /><button type="button" className="leads-btn" onClick={() => copy('embed', embedCode(pub.id!))}>{copied === 'embed' ? 'Copied' : 'Copy'}</button></div>
          <div className="leads-copy" data-testid="tracked-link">
            <span className="leads-label">Tracked link</span>
            <input readOnly value={trackedLink(shareLink, preset, campaign)} className="leads-input" aria-label="Tracked link" />
            <button type="button" className="leads-btn" onClick={() => copy('tracked', trackedLink(shareLink, preset, campaign))}>{copied === 'tracked' ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="leads-row">
            <select className="leads-input leads-select" aria-label="Where you will share it" value={preset} onChange={(e) => setPreset(e.target.value)} data-testid="link-preset">
              {LINK_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input className="leads-input" placeholder="Campaign name (optional)" value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={60} data-testid="link-campaign" />
          </div>
          <p className="leads-note">Share this version and each lead shows where it came from in the Leads tab (Source column).</p>
          <div className="leads-row">
            <button type="button" className="leads-btn" data-testid="preview-btn" disabled={!live} onClick={() => { setPreview(true); setNonce((n) => n + 1); }}>Preview as viewer</button>
            <a className="leads-btn" data-testid="view-link" href={shareLink} target="_blank" rel="noreferrer">View published page ↗</a>
            <button type="button" className="leads-btn" data-testid="download-mp4" onClick={() => dispatch({ type: 'SET_TAB', tab: 'export' })}>Download MP4 (free)</button>
          </div>
          {preview && live && (
            <div className="leads-modal" role="dialog" aria-label="Viewer preview" onClick={() => setPreview(false)}>
              <div className="leads-modal__box" onClick={(e) => e.stopPropagation()}>
                <div className="leads-modal__bar"><span>Viewer preview — what people see at your link</span><button type="button" className="leads-btn" onClick={() => setPreview(false)}>Close</button></div>
                <iframe key={nonce} className="leads-preview" data-testid="preview-frame" title="Published video preview" src={watchUrl(pub.id)} allow="autoplay; fullscreen" />
              </div>
            </div>
          )}
          <div className="leads-row">
            <button type="button" className="leads-btn" data-testid="add-qr-card" disabled={!live || qrBusy} onClick={() => void addQrCard()}>{qrBusy ? 'Adding…' : 'Add QR end card'}</button>
            <span className="leads-note">{qrDone ? 'Added to the overlay lane. Edit it in the Edit tab; it shows in the exported MP4.' : 'For MP4 viewers: a QR + link to this page in the last seconds.'}</span>
          </div>
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
