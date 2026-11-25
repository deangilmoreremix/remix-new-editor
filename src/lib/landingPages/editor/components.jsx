/**
 * Responsive building blocks for editable landing pages. Everything user-written is rendered as React text
 * (escaped), links/images go through safeUrl/safeImageUrl, and the video / lead form keep the same tracking
 * events and token rules as the classic renderer.
 */
import { outreachPlayerSrc } from '../../outreach/landingPage.js';
import { useEffect, useRef, useState } from 'react';
import { fillTokens, splitAccent, prefillFor, safeUrl, safeImageUrl } from '../templates.js';
import { usePage, useThanks, useAfterSubmit, useViewer } from './context.js';
import { resolveAfterSubmit, scheduleRedirect, linkTarget } from '../afterSubmit.js';
import { ICON_PATHS } from '../siteIcons.js';

const MARKS = [{ at: 0.25, kind: 'progress_25' }, { at: 0.5, kind: 'progress_50' }, { at: 0.75, kind: 'progress_75' }];

export function useTokens() {
  const { tokens, page } = usePage();
  const own = { ...tokens, duration: '' };
  return (s) => fillTokens(String(s ?? ''), own, page);
}

/** Text with [[accent]] markers: the marked words get the accent style. */
export function AccentText({ text, as: Tag = 'span', className }) {
  const t = useTokens();
  const parts = splitAccent(String(text || ''));
  return (
    <Tag className={className}>
      {parts.map((p, i) => {
        const v = t(p.text);
        if (!v) return null;
        return p.accent ? <span key={i} className="pk-accent">{v}</span> : <span key={i}>{v}</span>;
      })}
    </Tag>
  );
}

const IMAGE_PATH = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const pathOf = (u) => String(u || '').split(/[?#]/)[0];
const httpsMedia = (v) => (/^https:\/\/[^\s"'<>()\\]+$/i.test(String(v || '').trim()) ? String(v).trim() : '');
/** A page "video" that is really a picture (an image-only page keeps its image there) is not played. */
export const isPlayableVideo = (u) => !!httpsMedia(u) && !IMAGE_PATH.test(pathOf(u));

/**
 * The video slot. Always shows a round play button over the picture so people know a video goes here:
 *   - a video exists (slotVideo, else the page's video): the picture is its poster; the button starts it
 *   - no video yet: the design's mock picture (or a neutral mock) + play button + "Your video goes here" in the editor
 *   - only a picture (slotImage, or an image-only page): shown as a still, no play button
 * The user's own picture (slotImage, then the page poster) beats the design's picture. `bakedPlay` says the design's
 * picture already draws a play button, so the overlay is only added over the user's own pictures.
 */
export function VideoPlayer({ poster = '', slotImage = '', slotVideo = '', bakedPlay = '' }) {
  const { page, handlers, preview, tokens } = usePage();
  const viewer = useViewer();
  const t = useTokens();
  // A personal link can carry the contact's own video / picture ({{video}}, {{image}}): they beat the slot and the page's.
  const contactVideo = isPlayableVideo(tokens?.video) ? httpsMedia(tokens.video) : '';
  const contactImage = safeImageUrl(tokens?.image) || '';
  const fired = useRef(new Set());
  const ref = useRef(null);
  const [started, setStarted] = useState(false);
  const once = (kind, fn) => {
    if (preview || fired.current.has(kind)) return;
    fired.current.add(kind);
    fn?.(kind);
  };
  // A Video Outreach campaign plays its personal player (each contact's greeting) here.
  const outreachSrc = preview || viewer.type === 'still' ? null : outreachPlayerSrc(page?.video_url);   // "still only" never plays a video, personal player included
  if (outreachSrc) {
    return (
      <div className="pk-video">
        <iframe className="pk-video-frame" src={outreachSrc} title={page?.title || 'Video'} allow="autoplay; fullscreen; clipboard-write" allowFullScreen />
      </div>
    );
  }
  // Published pages play https videos only; the editor and previews also play a just-picked local file (blob:),
  // which "Save as my page" uploads before the page is stored.
  const blobPreview = preview && /^blob:/i.test(String(page?.video_url || '')) ? String(page.video_url) : '';
  const pageVideo = isPlayableVideo(page?.video_url) ? page.video_url : blobPreview;
  // "Still only" shows the picture and never plays the video, even when the page has one.
  const stillOnly = viewer.type === 'still';
  const src = stillOnly ? '' : contactVideo || (isPlayableVideo(slotVideo) ? httpsMedia(slotVideo) : '') || pageVideo;
  const pageImage = !pageVideo && httpsMedia(page?.video_url) && IMAGE_PATH.test(pathOf(page.video_url)) ? httpsMedia(page.video_url) : '';
  const userImage = contactImage || safeImageUrl(slotImage) || pageImage;
  const designPoster = safeImageUrl(poster) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(poster) ? poster : '');
  const posterUrl = userImage || safeImageUrl(page?.poster_url) || designPoster;
  const ownPicture = !!(userImage || safeImageUrl(page?.poster_url));
  const still = !src && (!!userImage || (stillOnly && !!posterUrl));
  const baked = bakedPlay === true || bakedPlay === 'yes';
  const showPlay = !started && !still && (!baked || ownPicture);
  const mock = !src && !userImage && !still;
  const autoplay = viewer.autoplay === 'yes' && !preview && !!src;
  const aspect = ['16 / 9', '4 / 3', '1 / 1', '9 / 16'].includes(viewer.aspect) ? viewer.aspect : '';
  // Trim, start frame, subtitles, a button at a moment, and text on the video.
  const secs = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(n, 86400) : 0; };
  const startAt = secs(viewer.start);
  const endAt = secs(viewer.end) > startAt ? secs(viewer.end) : 0;
  const frameAt = !ownPicture && !designPoster ? secs(viewer.posterAt) : 0;   // no picture: show this frame of the video
  const fragment = src && (startAt || endAt || frameAt) ? `#t=${frameAt || startAt}${endAt ? `,${endAt}` : ''}` : '';
  const subtitles = safeUrl(viewer.subtitles) && /^https:/i.test(safeUrl(viewer.subtitles)) ? safeUrl(viewer.subtitles) : '';
  const ctaAt = secs(viewer.ctaAt);
  const ctaOn = ctaAt > 0 && !!t(viewer.ctaLabel) && !!(safeUrl(viewer.ctaUrl) || anchor(viewer.ctaUrl));
  const [ctaShown, setCtaShown] = useState(false);
  const overlay = viewer.overlay ? t(viewer.overlay) : '';
  // Before the first play the video may sit on the chosen frame: playback starts at the start time (0 included). After it reached the stop time, playing again starts over.
  const seekToStart = (v) => {
    if (!started && (frameAt || v.currentTime < startAt)) v.currentTime = startAt;
    if (endAt && v.currentTime >= endAt - 0.05) v.currentTime = startAt;
  };
  const play = () => { const v = ref.current; if (v && src) { seekToStart(v); void v.play?.(); } };
  return (
    <div className={`pk-video${mock ? ' pk-video--mock' : ''}${still ? ' pk-video--still' : ''}`}>
      <video
        ref={ref}
        controls={!!src && viewer.controls !== 'no'}
        {...(autoplay ? { autoPlay: true, muted: true } : {})}
        loop={viewer.loop === 'yes' && !startAt}   // with a start time, looping is done by hand so every round starts there
        style={aspect ? { aspectRatio: aspect } : undefined}
        playsInline
        preload="metadata"
        src={src ? `${src}${fragment}` : undefined}
        {...(subtitles ? { crossOrigin: 'anonymous' } : {})}
        poster={posterUrl || undefined}
        aria-label={viewer.alt ? t(viewer.alt) : still || mock ? (page?.title ? `Picture for ${page.title}` : 'Video placeholder') : (page?.title || 'Video')}
        onPlay={(e) => { seekToStart(e.currentTarget); setStarted(true); once('play', () => handlers.onPlay?.()); }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!started) return;   // a start-frame seek before play is not watching: no progress, no timed button
          if (ctaOn && v.currentTime >= ctaAt) setCtaShown(true);
          // Progress (25/50/75%) counts over the part that plays: from the start time to the stop time (or the end).
          const known = !!v.duration && Number.isFinite(v.duration);
          const end = known ? Math.min(endAt || v.duration, v.duration) : endAt;   // a stop time past the video's real end counts to the real end
          if (end > startAt) { const frac = (v.currentTime - startAt) / (end - startAt); MARKS.forEach((m) => { if (frac >= m.at) once(m.kind, handlers.onProgress); }); }
          if (endAt && v.currentTime >= endAt) { v.pause(); once('complete', () => handlers.onComplete?.()); if (viewer.loop === 'yes') { v.currentTime = startAt; void v.play?.(); } return; }
        }}
        onEnded={(e) => { if (ctaOn) setCtaShown(true); once('complete', () => handlers.onComplete?.()); if (viewer.loop === 'yes' && startAt) { e.currentTarget.currentTime = startAt; void e.currentTarget.play?.(); } }}
      >
        {subtitles ? <track kind="subtitles" src={subtitles} srcLang="en" label="Captions" default /> : null}
      </video>
      {overlay ? <span className="pk-video-overlay">{overlay}</span> : null}
      {ctaOn && (preview || ctaShown) ? <SafeLink className="pk-btn pk-btn--primary pk-video-cta" href={viewer.ctaUrl}>{t(viewer.ctaLabel)}</SafeLink> : null}
      {showPlay ? <button type="button" className="pk-video-play" aria-label={src ? 'Play video' : 'Video placeholder: your video goes here'} onClick={play} tabIndex={src ? 0 : -1} /> : null}
      {mock && preview ? <span className="pk-video-label">Your video goes here</span> : null}
      {viewer.caption ? <p className="pk-video-caption">{t(viewer.caption)}</p> : null}
    </div>
  );
}

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
];

/** "After the form is sent" for this page: resolves the setting and, once `done`, starts a redirect (never in the editor preview). */
function useAfterSubmitFlow(done) {
  const { preview } = usePage();
  const after = resolveAfterSubmit(useAfterSubmit());
  useEffect(() => {
    if (!done || preview || after.action !== 'redirect') return undefined;
    return scheduleRedirect(after.url);
  }, [done, preview, after.action, after.url]);
  return after;
}
const AfterButton = ({ after }) => (after.action === 'button' ? <a className="pk-btn pk-btn--primary pk-after" href={after.url} {...linkTarget(after.url)}>{after.buttonText}</a> : null);

export function LeadForm({ title, subtitle, submitLabel = 'Send', successMessage = 'Thanks!', privacy, fields = DEFAULT_FIELDS }) {
  const { handlers, preview, tokens } = usePage();
  const t = useTokens();
  const [state, setState] = useState({ status: 'idle', error: '' });
  const formError = useAfterSubmit().formError;
  const failText = formError ? t(formError) : 'Could not send. Please try again.';
  const after = useAfterSubmitFlow(state.status === 'done');
  if (state.status === 'done') return <div className="pk-form pk-form--done"><p className="pk-thanks">{t(successMessage) || 'Thanks!'}</p><AfterButton after={after} /></div>;
  const onSubmit = async (e) => {
    e.preventDefault();
    if (preview) { setState({ status: 'idle', error: 'Preview only: nothing is sent.' }); return; }
    const data = {};
    new FormData(e.currentTarget).forEach((v, k) => { data[k] = String(v); });
    setState({ status: 'sending', error: '' });
    const res = await (handlers.onLead?.(data) ?? { error: 'Form is not available' });
    if (res?.error) setState({ status: 'idle', error: failText });
    else setState({ status: 'done', error: '' });
  };
  return (
    <form className="pk-form" onSubmit={onSubmit}>
      {title ? <AccentText as="h2" className="pk-form-title" text={title} /> : null}
      {subtitle ? <p className="pk-form-sub">{t(subtitle)}</p> : null}
      {fields.map((f) => (
        <label key={f.key} className="pk-field">
          <span className="pk-sr">{f.label}</span>
          {f.type === 'select'
            ? (
              <select name={f.key} required={!!f.required} defaultValue="">
                <option value="" disabled>{t(f.placeholder || f.label)}</option>
                {String(f.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )
            : f.type === 'textarea'
            ? <textarea name={f.key} rows={3} required={!!f.required} placeholder={t(f.placeholder || f.label)} defaultValue={prefillFor(f.key, tokens) || ''} maxLength={2000} />
            : <input name={f.key} type={['text', 'email', 'tel'].includes(f.type) ? f.type : 'text'} required={!!f.required} placeholder={t(f.placeholder || f.label)} defaultValue={prefillFor(f.key, tokens) || ''} maxLength={2000} />}
        </label>
      ))}
      <button type="submit" className="pk-btn pk-btn--primary" disabled={state.status === 'sending'}>{t(submitLabel)}</button>
      <p className="pk-status" role="status">{state.error}</p>
      {privacy ? <p className="pk-privacy">{t(privacy)}</p> : null}
    </form>
  );
}

// In-page anchors (#lead, #contact...) are safe and let buttons scroll to a section.
const anchor = (v) => (/^#[a-z0-9_-]{1,40}$/i.test(String(v || '').trim()) ? String(v).trim() : '');

export function SafeLink({ href, children, className }) {
  const url = safeUrl(href) || anchor(href);
  if (!url) return null;
  const external = /^https?:/i.test(url);
  return <a className={className} href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
}

export function Icon({ name, className = 'pk-ico' }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );
}

const asList = (v) => (Array.isArray(v) ? v : []);
const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

/** An email box that records a lead through the page's normal lead handler. */
export function EmailSignup({ placeholder = 'Enter your email', label = 'Subscribe', source = '', className = '' }) {
  const { handlers, preview } = usePage();
  const t = useTokens();
  const thanks = useThanks();
  const [state, setState] = useState({ status: 'idle', error: '' });
  const formError = useAfterSubmit().formError;
  const failText = formError ? t(formError) : 'Could not send. Please try again.';
  const after = useAfterSubmitFlow(state.status === 'done');
  if (state.status === 'done') return <><p className="pk-thanks">{t(thanks) || 'Thanks!'}</p><AfterButton after={after} /></>;
  const onSubmit = async (e) => {
    e.preventDefault();
    if (preview) { setState({ status: 'idle', error: 'Preview only: nothing is sent.' }); return; }
    const email = new FormData(e.currentTarget).get('email');
    setState({ status: 'sending', error: '' });
    const res = await (handlers.onLead?.({ email: String(email || ''), message: `Signed up: ${source}` }) ?? { error: 'Form is not available' });
    setState(res?.error ? { status: 'idle', error: failText } : { status: 'done', error: '' });
  };
  return (
    <form className={`pk-mini ${className}`} onSubmit={onSubmit}>
      <label className="pk-mini-field"><span className="pk-sr">Email</span><input name="email" type="email" required maxLength={200} placeholder={t(placeholder)} /></label>
      <button type="submit" className="pk-btn pk-btn--primary" disabled={state.status === 'sending'}>{t(label)}</button>
      <span className="pk-status" role="status">{state.error}</span>
    </form>
  );
}

/* ---------- page sections ---------- */

export function NavBar({ brand, logo, logoAlt, links, loginLabel, loginUrl, ctaLabel, ctaUrl }) {
  const t = useTokens();
  const logoUrl = safeImageUrl(logo) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(logo || '')) ? logo : '');
  return (
    <nav className="pk-nav" aria-label="Site">
      <a className="pk-brand" href="#top">{logoUrl ? <img src={logoUrl} alt={t(logoAlt) || ''} width="34" height="34" /> : null}<span>{t(brand)}</span></a>
      <ul className="pk-nav-links">
        {asList(links).map((l, i) => (
          <li key={i}>{safeUrl(l.url) ? <SafeLink href={l.url}>{t(l.label)}</SafeLink> : <span>{t(l.label)}</span>}</li>
        ))}
      </ul>
      <div className="pk-nav-right">
        {loginLabel ? (safeUrl(loginUrl) ? <SafeLink className="pk-nav-login" href={loginUrl}>{t(loginLabel)}</SafeLink> : <span className="pk-nav-login">{t(loginLabel)}</span>) : null}
        {ctaLabel ? <a className="pk-btn pk-btn--primary pk-nav-cta" href={safeUrl(ctaUrl) || anchor(ctaUrl) || '#lead'} {...linkTarget(safeUrl(ctaUrl) || '')}>{t(ctaLabel)}</a> : null}
      </div>
    </nav>
  );
}

const cssImage = (v) => {
  const u = safeImageUrl(v) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(v || '')) ? String(v) : '');
  // Never let quotes, brackets, backslashes or spaces anywhere near a style value.
  return u && !/["'()\\\s<>]/.test(u) ? `url(${JSON.stringify(u)})` : '';
};

export function Hero({ variant = 'copy-video-form', background, eyebrow, headline, subhead, bullets, chip, photo, slotImage, slotVideo, bakedPlay, formTitle, formSubtitle, submitLabel, formFields, privacy, buttons, showForm = 'yes' }) {
  const t = useTokens();
  const fields = asList(formFields).filter((f) => f.key && f.label).map((f) => ({ ...f, key: String(f.key).replace(/[^a-z0-9_]/gi, '').toLowerCase() }));
  return (
    <header className={`pk-hero pk-hero--${variant}${showForm === 'yes' ? '' : ' pk-hero--noform'}`} id="top" style={cssImage(background) ? { '--pk-hero-bg': cssImage(background) } : undefined}>
      <div className="pk-hero-copy">
        {eyebrow ? <span className="pk-eyebrow">{t(eyebrow)}</span> : null}
        <AccentText as="h1" className="pk-headline" text={headline} />
        {subhead ? <p className="pk-subhead">{t(subhead)}</p> : null}
        {asList(bullets).length ? <ul className="pk-bullets">{asList(bullets).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
        {asList(buttons).length ? <div className="pk-actions">{asList(buttons).map((b, i) => <SafeLink key={i} className={`pk-btn pk-btn--${b.style === 'primary' ? 'primary' : 'secondary'}`} href={b.url}>{t(b.label)}</SafeLink>)}</div> : null}
      </div>
      <div className="pk-hero-video" id="video">
        <VideoPlayer poster={photo} slotImage={slotImage} slotVideo={slotVideo} bakedPlay={bakedPlay} />
        {chip ? <div className="pk-chip">{t(chip)}</div> : null}
      </div>
      {showForm === 'yes' ? <div className="pk-hero-form" id="lead"><LeadForm title={formTitle} subtitle={formSubtitle} submitLabel={submitLabel} privacy={privacy} fields={fields.length ? fields : undefined} /></div> : null}
    </header>
  );
}

export function Strip({ kind = 'logos', title, items }) {
  const t = useTokens();
  return (
    <section className={`pk-strip pk-strip--${kind}`}>
      {title ? <p className="pk-strip-title">{t(title)}</p> : null}
      <ul className="pk-strip-row">
        {asList(items).map((it, i) => (
          <li key={i} className="pk-strip-item">
            {kind === 'benefits' ? <>{imgUrl(it.image) ? <img className="pk-strip-photo" src={imgUrl(it.image)} alt={t(it.alt) || ''} loading="lazy" /> : null}<Icon name={it.icon} className="pk-ico pk-ico--lg" /><span><b>{t(it.title)}</b>{it.text ? <small>{t(it.text)}</small> : null}</span></>
              : kind === 'stats' ? <><b className="pk-stat-value">{t(it.value)}</b><span>{t(it.title)}</span></>
                : <span className="pk-logo-word">{t(it.title)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Band({ title, text, buttonLabel, placeholder, social, tagline, brand }) {
  const t = useTokens();
  return (
    <section className="pk-band">
      <div className="pk-band-in">
        {tagline || brand ? <div className="pk-band-brand">{brand ? <b>{t(brand)}</b> : null}{tagline ? <span>{t(tagline)}</span> : null}</div> : null}
        <div className="pk-band-text"><b>{t(title)}</b>{text ? <span>{t(text)}</span> : null}</div>
        <EmailSignup placeholder={placeholder} label={buttonLabel || 'Subscribe'} source={title} className="pk-mini--band" />
        {social ? <p className="pk-social">{t(social)}</p> : null}
      </div>
    </section>
  );
}

/** A contact form band with any number of fields (name, email, company, message...). */
export function ContactBand({ eyebrow, title, text, fields, submitLabel, successMessage }) {
  const t = useTokens();
  return (
    <section className="pk-band pk-band--contact" id="contact">
      <div className="pk-band-in pk-band-in--contact">
        <div className="pk-band-text">{eyebrow ? <small className="pk-eyebrow-plain">{t(eyebrow)}</small> : null}<b>{t(title)}</b>{text ? <span>{t(text)}</span> : null}</div>
        <LeadForm submitLabel={submitLabel || 'Contact us'} successMessage={successMessage} fields={asList(fields).filter((f) => f.key && f.label)} />
      </div>
    </section>
  );
}

export function Footer({ text, links, logo, logoAlt, social }) {
  const t = useTokens();
  return (
    <footer className="pk-footer">
      {imgUrl(logo) ? <img className="pk-footer-logo" src={imgUrl(logo)} alt={t(logoAlt) || ''} height="28" loading="lazy" /> : null}
      {text ? <p>{t(text)}</p> : null}
      {asList(social).filter((i) => i && ICON_PATHS[i.icon] && (safeUrl(i.url) || anchor(i.url))).length ? <div className="pk-footer-social">{asList(social).filter((i) => i && ICON_PATHS[i.icon] && (safeUrl(i.url) || anchor(i.url))).slice(0, 8).map((i, n) => <SafeLink key={n} className="pk-ctabar-social" href={i.url}><Icon name={i.icon} /><span className="pk-sr">{i.icon}</span></SafeLink>)}</div> : null}
      <ul>{asList(links).map((l, i) => <li key={i}>{safeUrl(l.url) ? <SafeLink href={l.url}>{t(l.label)}</SafeLink> : <span>{t(l.label)}</span>}</li>)}</ul>
    </footer>
  );
}

export function TextBlock({ eyebrow, title, text, align = 'center' }) {
  const t = useTokens();
  return (
    <section className={`pk-textblock pk-textblock--${align}`}>
      {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
      {title ? <AccentText as="h2" className="pk-h2" text={title} /> : null}
      {text ? <p className="pk-lede">{t(text)}</p> : null}
    </section>
  );
}

/* ---------- cards (live inside a Grid) ---------- */

const imgUrl = (v) => safeImageUrl(v) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(v || '')) ? String(v) : '');

const span = (n) => ({ '--pk-span': Math.max(1, Math.min(6, Number(n) || 1)) });

export function CardShell({ children, columns, tone, className = '' }) {
  return <article className={`pk-card pk-card--${tone || 'plain'} ${className}`} style={span(columns)}>{children}</article>;
}

export function LeadMagnetCard({ columns, tag, title, text, cover, buttonLabel, placeholder }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="pk-card--magnet">
      <div className="pk-book" aria-hidden="true"><b>{t(cover || title)}</b></div>
      <div className="pk-magnet-body">
        {tag ? <span className="pk-tag">{t(tag)}</span> : null}
        <h3 className="pk-card-title">{t(title)}</h3>
        {text ? <p className="pk-card-text">{t(text)}</p> : null}
        <EmailSignup placeholder={placeholder} label={buttonLabel || 'Send it to me'} source={title} />
      </div>
    </CardShell>
  );
}

export function TableCard({ columns, title, windowTitle, windowSubtitle, sidebar, kpis, headings, rows }) {
  const t = useTokens();
  const heads = split(headings);
  const body = (
    <>
      {asList(kpis).length ? <div className="pk-kpis">{asList(kpis).map((k, i) => <div key={i} className="pk-kpi-cell"><b>{t(k.value)}</b><span>{t(k.label)}</span></div>)}</div> : null}
      <div className="pk-table" role="table">
        {heads.length ? <div className="pk-tr pk-tr--head" role="row">{heads.map((h, i) => <span key={i} role="columnheader">{h}</span>)}</div> : null}
        {asList(rows).map((r, i) => (
          <div key={i} className="pk-tr" role="row">
            <span className="pk-td-who"><i className="pk-dot">{String(r.name || '?').slice(0, 1).toUpperCase()}</i><b>{t(r.name)}</b></span>
            {r.col2 ? <span>{t(r.col2)}</span> : null}{r.col3 ? <span>{t(r.col3)}</span> : null}
            {r.tag ? <span className="pk-pill">{t(r.tag)}</span> : null}
          </div>
        ))}
      </div>
    </>
  );
  return (
    <CardShell columns={columns} className="pk-card--table">
      {windowTitle || asList(sidebar).length ? (
        <div className="pk-win">
          <div className="pk-win-bar"><span className="pk-win-dots"><i /><i /><i /></span>{windowTitle ? <b>{t(windowTitle)}</b> : null}{windowSubtitle ? <small>{t(windowSubtitle)}</small> : null}</div>
          <div className="pk-win-body">
            <ul className="pk-win-side">{asList(sidebar).map((s, i) => <li key={i} className={i === 0 ? 'is-on' : ''}>{t(s.label)}</li>)}</ul>
            <div>{body}</div>
          </div>
        </div>
      ) : <>{title ? <h3 className="pk-card-title">{t(title)}</h3> : null}{body}</>}
    </CardShell>
  );
}

export function StatsCard({ columns, title, items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="pk-card--stats">
      {title ? <h3 className="pk-card-title">{t(title)}</h3> : null}
      <div className="pk-stats">{asList(items).map((it, i) => <div key={i} className="pk-stat">{it.icon ? <Icon name={it.icon} /> : null}<b>{t(it.value)}</b><span>{t(it.label)}</span></div>)}</div>
    </CardShell>
  );
}

export function ChecklistCard({ columns, title, text, items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns}>
      <h3 className="pk-card-title">{t(title)}</h3>
      {text ? <p className="pk-card-text">{t(text)}</p> : null}
      <ul className="pk-checks">{asList(items).map((it, i) => <li key={i}><Icon name="check" className="pk-ico pk-ico--box" /><span>{t(it.label)}</span>{it.value ? <em>{t(it.value)}</em> : null}</li>)}</ul>
    </CardShell>
  );
}

export function QuoteCard({ columns, heading, quotes }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className="pk-card--quotes">
      {heading ? <h3 className="pk-card-title">{t(heading)}</h3> : null}
      {asList(quotes).map((q, i) => (
        <figure key={i} className="pk-quote">
          <blockquote>{`\u201C${t(q.text)}\u201D`}</blockquote>
          <figcaption>{imgUrl(q.avatar) ? <img className="pk-avatar" src={imgUrl(q.avatar)} alt={t(q.avatarAlt) || ''} loading="lazy" width="46" height="46" /> : <i className="pk-dot pk-dot--lg">{String(q.name || '?').slice(0, 1).toUpperCase()}</i>}<span><b>{t(q.name)}</b><small>{t(q.role)}</small></span></figcaption>
        </figure>
      ))}
    </CardShell>
  );
}

export function StepsCard({ columns, title, layout = 'list', items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns} className={`pk-card--steps pk-steps--${layout}`}>
      {title ? <h3 className="pk-card-title">{t(title)}</h3> : null}
      <ol className="pk-steps">{asList(items).map((it, i) => <li key={i}><span className="pk-step-n">{i + 1}</span>{it.icon ? <Icon name={it.icon} className="pk-ico pk-ico--lg" /> : null}<b>{t(it.title)}</b>{it.text ? <span>{t(it.text)}</span> : null}</li>)}</ol>
    </CardShell>
  );
}

export function FeaturesCard({ columns, title, items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns}>
      {title ? <h3 className="pk-card-title">{t(title)}</h3> : null}
      <ul className="pk-feats">{asList(items).map((it, i) => <li key={i}><Icon name={it.icon || 'check'} className="pk-ico pk-ico--lg" /><span><b>{t(it.title)}</b>{it.text ? <small>{t(it.text)}</small> : null}</span></li>)}</ul>
    </CardShell>
  );
}

export function FaqCard({ columns, title, items }) {
  const t = useTokens();
  return (
    <CardShell columns={columns}>
      {title ? <h3 className="pk-card-title">{t(title)}</h3> : null}
      {asList(items).map((it, i) => <details key={i} className="pk-faq"><summary>{t(it.q)}</summary><p>{t(it.a)}</p></details>)}
    </CardShell>
  );
}

export function KpiCard({ columns, title, value, note }) {
  const t = useTokens();
  return (
    <CardShell columns={columns}>
      <h3 className="pk-card-title">{t(title)}</h3>
      <b className="pk-kpi-value">{t(value)}</b>
      <svg className="pk-spark" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 52 L25 46 L50 48 L75 36 L100 40 L125 26 L150 30 L175 12 L200 4 L200 60 L0 60 Z" className="pk-spark-area" /><path d="M0 52 L25 46 L50 48 L75 36 L100 40 L125 26 L150 30 L175 12 L200 4" className="pk-spark-line" fill="none" /></svg>
      {note ? <small className="pk-card-text">{t(note)}</small> : null}
    </CardShell>
  );
}

export function ScheduleCard({ columns, title, text, month, days, time, buttonLabel , weekdays }) {
  const t = useTokens();
  return (
    <CardShell columns={columns}>
      <h3 className="pk-card-title">{t(title)}</h3>
      {text ? <p className="pk-card-text">{t(text)}</p> : null}
      {month ? <div className="pk-cal-month">{t(month)}</div> : null}
      <div className="pk-cal-grid pk-cal-head">{(split(weekdays).length === 7 ? split(weekdays) : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="pk-cal-grid">{split(days).map((d, i) => <span key={i} className={`pk-cal-day${d.startsWith('*') ? ' is-on' : ''}`}>{d.replace(/^\*/, '')}</span>)}</div>
      {time ? <div className="pk-cal-time">{t(time)}</div> : null}
      {buttonLabel ? <a className="pk-btn pk-btn--primary" href="#lead">{t(buttonLabel)}</a> : null}
    </CardShell>
  );
}

export function ButtonCard({ columns, eyebrow, title, text, buttons }) {
  const t = useTokens();
  return (
    <CardShell columns={columns}>
      {eyebrow ? <span className="pk-eyebrow-plain">{t(eyebrow)}</span> : null}
      <h3 className="pk-card-title">{t(title)}</h3>
      {text ? <p className="pk-card-text">{t(text)}</p> : null}
      <div className="pk-actions">{asList(buttons).map((b, i) => <SafeLink key={i} className={`pk-btn pk-btn--${b.style === 'primary' ? 'primary' : 'secondary'}`} href={b.url}>{t(b.label)}</SafeLink>)}</div>
    </CardShell>
  );
}

export function PageImage({ src, alt, rounded = 'yes' }) {
  const url = safeImageUrl(src) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(src || '')) ? src : '');
  if (!url) return null;
  return <img className={`pk-image${rounded === 'yes' ? ' pk-image--round' : ''}`} src={url} alt={alt || ''} loading="lazy" />;
}

/** Text with a tick list and a button next to a picture (e.g. "See it in action" with a laptop mock-up), or a banner with a photo behind it. */
export function Showcase({ variant = 'split', title, text, bullets, buttonLabel, buttonUrl, button2Label, button2Url, image, imageAlt, background, side = 'right', points }) {
  const t = useTokens();
  const img = safeImageUrl(image) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(String(image || '')) ? image : '');
  return (
    <section className={`pk-showcase pk-showcase--${variant === 'band' ? 'band' : 'split'} pk-showcase--${side === 'left' ? 'left' : 'right'}`} style={cssImage(background) ? { '--pk-showcase-bg': cssImage(background) } : undefined}>
      <div className="pk-showcase-copy">
        {title ? <AccentText as="h2" className="pk-showcase-title" text={title} /> : null}
        {text ? <p className="pk-showcase-text">{t(text)}</p> : null}
        {asList(bullets).length ? <ul className="pk-bullets">{asList(bullets).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
        {buttonLabel ? <SafeLink className="pk-btn pk-btn--primary pk-showcase-btn" href={buttonUrl || '#video'}>{t(buttonLabel)}</SafeLink> : null}
        {button2Label ? <SafeLink className="pk-btn pk-btn--secondary pk-showcase-btn" href={button2Url || '#lead'}>{t(button2Label)}</SafeLink> : null}
      </div>
      {variant === 'band' ? (
        asList(points).length ? <ul className="pk-showcase-points">{asList(points).map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null
      ) : img ? <div className="pk-showcase-art"><img src={img} alt={imageAlt || ''} loading="lazy" /></div> : null}
    </section>
  );
}

/** A full-width button bar (usually the last thing on a phone-style page). */
export function CtaBar({ text, label, url, label2, url2, icon, icons }) {
  const t = useTokens();
  const href = safeUrl(url) || anchor(url) || '#lead';
  const ext = /^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  const social = (Array.isArray(icons) ? icons : []).filter((i) => i && ICON_PATHS[i.icon] && (safeUrl(i.url) || anchor(i.url))).slice(0, 6);
  if (!text) {
    const bar = <a className="pk-ctabar" href={href} {...ext}>{icon ? <Icon name={icon} /> : null}<span>{t(label)}</span></a>;
    const second = label2 ? <SafeLink className="pk-ctabar pk-ctabar--second" href={url2 || '#lead'}><span>{t(label2)}</span></SafeLink> : null;
    if (!social.length) return second ? <>{bar}{second}</> : bar;
    return (
      <div className="pk-ctabar pk-ctabar--social">
        <span>{t(label)}</span>
        {social.map((i, n) => <SafeLink key={n} className="pk-ctabar-social" href={i.url}><Icon name={i.icon} /><span className="pk-sr">{i.icon}</span></SafeLink>)}
      </div>
    );
  }
  return (
    <section className="pk-ctabar pk-ctabar--split">
      {icon ? <Icon name={icon} className="pk-ico pk-ico--lg" /> : null}
      <p>{t(text)}</p>
      <a className="pk-btn pk-btn--cta" href={href} {...ext}>{t(label)}</a>
      {label2 ? <SafeLink className="pk-btn pk-btn--secondary" href={url2 || '#lead'}>{t(label2)}</SafeLink> : null}
    </section>
  );
}

/**
 * Video Outreach (Sendspark-style) block under the video: who sent it, Like, the booking button
 * and the booking calendar embedded on the page. The button scrolls to the calendar when there
 * is one, else opens the link.
 */
export function OutreachActions({ senderName, senderTitle, senderPhoto, senderPhotoAlt, like = 'yes', likeLabel = 'Like', likedLabel = 'Liked', ctaLabel, ctaUrl, calendarUrl, calendarTitle }) {
  const t = useTokens();
  const { handlers, preview } = usePage();
  const [liked, setLiked] = useState(false);
  const cal = /^https:\/\//i.test(String(calendarUrl || '')) ? safeUrl(calendarUrl) : '';
  const href = safeUrl(ctaUrl);
  const photo = imgUrl(senderPhoto);
  const name = t(senderName);
  const cta = () => { if (!preview) handlers.onCta?.(); };
  return (
    <section className="pk-outreach" id="lead">
      <div className="pk-outreach-row">
        {name ? (
          <div className="pk-outreach-sender">
            {photo ? <img src={photo} alt={t(senderPhotoAlt) || ''} width="48" height="48" /> : <span className="pk-outreach-initial" aria-hidden="true">{name.slice(0, 1)}</span>}
            <div><strong>{name}</strong>{senderTitle ? <span>{t(senderTitle)}</span> : null}</div>
          </div>
        ) : null}
        <div className="pk-outreach-buttons">
          {like === 'yes' ? (
            <button type="button" className={`pk-btn pk-btn--secondary pk-like${liked ? ' is-liked' : ''}`} aria-pressed={liked} onClick={() => { if (liked) return; setLiked(true); if (!preview) handlers.onLike?.(); }}>
              <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {liked ? (t(likedLabel) || 'Liked') : (t(likeLabel) || 'Like')}
            </button>
          ) : null}
          {ctaLabel && cal ? (
            <button type="button" className="pk-btn pk-btn--primary" onClick={() => { document.getElementById('pk-outreach-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); cta(); }}>{t(ctaLabel)}</button>
          ) : ctaLabel && href ? (
            <SafeLink className="pk-btn pk-btn--primary" href={href}><span onClick={cta}>{t(ctaLabel)}</span></SafeLink>
          ) : null}
        </div>
      </div>
      {cal ? (
        <div className="pk-outreach-calendar" id="pk-outreach-calendar">
          {calendarTitle ? <h2 className="pk-h2">{t(calendarTitle)}</h2> : null}
          <iframe src={cal} title={t(calendarTitle) || 'Book a time'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" />
        </div>
      ) : null}
    </section>
  );
}

/**
 * "#lead" buttons scroll to the hero form. Designs without a hero form keep their form in the contact band
 * (id="contact"), so those buttons fall back to it. Done on click, so no element needs a duplicate id.
 */
export function LeadAnchorFallback() {
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target?.closest?.('a[href="#lead"]');
      if (!a || document.getElementById('lead')) return;
      const target = document.getElementById('contact');
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}

/**
 * A slim strip shown ONLY to someone who opened a personal link (the page knows their name or company):
 * "A personal video for Dana". Generic visitors see nothing, so a design looks exactly as designed for them.
 */
export function PersonalGreeting({ text }) {
  const t = useTokens();
  const { tokens } = usePage();
  const known = ['firstname', 'company'].some((k) => String(tokens?.[k] ?? '').trim());
  const out = known && String(text || '').trim() ? t(text) : '';
  if (!out) return null;
  return <div className="pk-greeting" role="note">{out}</div>;
}
