/**
 * Responsive building blocks for editable landing pages. Everything user-written is rendered as React text
 * (escaped), links/images go through safeUrl/safeImageUrl, and the video / lead form keep the same tracking
 * events and token rules as the classic renderer.
 */
import { useRef, useState } from 'react';
import { fillTokens, splitAccent, prefillFor, safeUrl, safeImageUrl } from '../templates.js';
import { usePage } from './context.js';

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

export function VideoPlayer({ poster = '' }) {
  const { page, handlers, preview } = usePage();
  const fired = useRef(new Set());
  const once = (kind, fn) => {
    if (preview || fired.current.has(kind)) return;
    fired.current.add(kind);
    fn?.(kind);
  };
  const src = /^https:\/\//i.test(page?.video_url || '') ? page.video_url : '';
  const posterUrl = safeImageUrl(page?.poster_url) || safeImageUrl(poster) || (/^\/landing-art\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(poster) ? poster : '');
  return (
    <div className="pk-video">
      <video
        controls
        playsInline
        preload="metadata"
        src={src || undefined}
        poster={posterUrl || undefined}
        aria-label={page?.title || 'Video'}
        onPlay={() => once('play', () => handlers.onPlay?.())}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!v.duration || !Number.isFinite(v.duration)) return;
          MARKS.forEach((m) => { if (v.currentTime / v.duration >= m.at) once(m.kind, handlers.onProgress); });
        }}
        onEnded={() => once('complete', () => handlers.onComplete?.())}
      />
    </div>
  );
}

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
];

export function LeadForm({ title, subtitle, submitLabel = 'Send', successMessage = 'Thanks!', privacy, fields = DEFAULT_FIELDS }) {
  const { handlers, preview, tokens } = usePage();
  const t = useTokens();
  const [state, setState] = useState({ status: 'idle', error: '' });
  if (state.status === 'done') return <div className="pk-form pk-form--done"><p className="pk-thanks">{t(successMessage) || 'Thanks!'}</p></div>;
  const onSubmit = async (e) => {
    e.preventDefault();
    if (preview) { setState({ status: 'idle', error: 'Preview only: nothing is sent.' }); return; }
    const data = {};
    new FormData(e.currentTarget).forEach((v, k) => { data[k] = String(v); });
    setState({ status: 'sending', error: '' });
    const res = await (handlers.onLead?.(data) ?? { error: 'Form is not available' });
    if (res?.error) setState({ status: 'idle', error: 'Could not send. Please try again.' });
    else setState({ status: 'done', error: '' });
  };
  return (
    <form className="pk-form" onSubmit={onSubmit}>
      {title ? <h2 className="pk-form-title">{t(title)}</h2> : null}
      {subtitle ? <p className="pk-form-sub">{t(subtitle)}</p> : null}
      {fields.map((f) => (
        <label key={f.key} className="pk-field">
          <span className="pk-sr">{f.label}</span>
          {f.type === 'textarea'
            ? <textarea name={f.key} rows={3} required={!!f.required} placeholder={t(f.placeholder || f.label)} defaultValue={prefillFor(f.key, tokens) || ''} maxLength={2000} />
            : <input name={f.key} type={f.type || 'text'} required={!!f.required} placeholder={t(f.placeholder || f.label)} defaultValue={prefillFor(f.key, tokens) || ''} maxLength={2000} />}
        </label>
      ))}
      <button type="submit" className="pk-btn pk-btn--primary" disabled={state.status === 'sending'}>{t(submitLabel)}</button>
      <p className="pk-status" role="status">{state.error}</p>
      {privacy ? <p className="pk-privacy">{t(privacy)}</p> : null}
    </form>
  );
}

export function SafeLink({ href, children, className }) {
  const url = safeUrl(href);
  if (!url) return null;
  const external = /^https?:/i.test(url);
  return <a className={className} href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
}

export function Hero({ eyebrow, headline, subhead, bullets = [], chip, photo, formTitle, formSubtitle, submitLabel, ctaLabel, ctaUrl }) {
  const t = useTokens();
  return (
    <header className="pk-hero">
      <div className="pk-hero-copy">
        {eyebrow ? <span className="pk-eyebrow">{t(eyebrow)}</span> : null}
        <AccentText as="h1" className="pk-headline" text={headline} />
        {subhead ? <p className="pk-subhead">{t(subhead)}</p> : null}
        {bullets.length ? <ul className="pk-bullets">{bullets.map((b, i) => <li key={i}>{t(b.text)}</li>)}</ul> : null}
        {ctaLabel ? <SafeLink className="pk-btn pk-btn--secondary" href={ctaUrl}>{t(ctaLabel)}</SafeLink> : null}
      </div>
      <div className="pk-hero-video">
        <VideoPlayer poster={photo} />
        {chip ? <div className="pk-chip">{t(chip)}</div> : null}
      </div>
      <div className="pk-hero-form"><LeadForm title={formTitle} subtitle={formSubtitle} submitLabel={submitLabel} /></div>
    </header>
  );
}
