/**
 * Renders a landing page from `{ page, tokens }` into DOM. Shared by the public
 * page (src/pages/VideoPage.jsx) and the studio's live preview, so the preview
 * is exactly what viewers get. All user text goes in through textContent, and
 * every URL passes safeUrl/safeImageUrl, so a hostile config can't inject markup.
 */
import { getTemplate, sanitizeConfig, fillTokens, safeUrl, safeImageUrl, FONTS } from './templates.js';

const PROGRESS_MARKS = [
  { at: 0.25, kind: 'progress_25' },
  { at: 0.5, kind: 'progress_50' },
  { at: 0.75, kind: 'progress_75' },
];

function h(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== '') node.textContent = text;
  return node;
}

/**
 * @param {object} o
 *   page      { title, video_url, poster_url, config }
 *   tokens    { firstname, company, ... }
 *   handlers  { onPlay, onProgress(kind), onComplete, onCta, onLead(data) -> Promise<{stored,error}> }
 *   preview   true in the studio (no events, form submit is a no-op message)
 * @returns {{ root: HTMLElement, video: HTMLVideoElement, destroy(): void }}
 */
export function renderLandingPage({ page, tokens = {}, handlers = {}, preview = false, doc = globalThis.document }) {
  const config = sanitizeConfig(page?.config);
  const tpl = getTemplate(config.template);
  const t = (s) => fillTokens(s, tokens);
  const theme = config.theme;

  const root = h(doc, 'div', `vp vp--${tpl.id} vp--${tpl.layout} vp--${theme.mode}`);
  root.style.setProperty('--vp-accent', theme.accent);
  root.style.setProperty('--vp-bg', theme.bg);
  root.style.setProperty('--vp-text', theme.text);
  root.style.setProperty('--vp-font', FONTS[theme.font]);

  if (theme.logoUrl) {
    const head = h(doc, 'header', 'vp-brand');
    const img = h(doc, 'img', 'vp-logo');
    img.src = safeImageUrl(theme.logoUrl);
    img.alt = '';
    img.loading = 'eager';
    head.appendChild(img);
    root.appendChild(head);
  }

  const main = h(doc, 'main', 'vp-main');
  root.appendChild(main);

  // ---- copy (headline, subhead, CTA)
  const copy = h(doc, 'section', 'vp-copy');
  const headline = t(config.headline);
  if (headline) copy.appendChild(h(doc, 'h1', 'vp-headline', headline));
  const subhead = t(config.subhead);
  if (subhead) copy.appendChild(h(doc, 'p', 'vp-subhead', subhead));

  const ctaLabel = t(config.cta.label);
  const ctaUrl = safeUrl(config.cta.url);
  if (ctaLabel && ctaUrl) {
    const ctaEl = h(doc, 'a', 'vp-cta', ctaLabel);
    ctaEl.href = ctaUrl;
    if (/^https?:/i.test(ctaUrl)) { ctaEl.target = '_blank'; ctaEl.rel = 'noopener noreferrer'; }
    ctaEl.addEventListener('click', () => { if (!preview) handlers.onCta?.(); });
    copy.appendChild(ctaEl);
  }

  // ---- video
  const media = h(doc, 'section', 'vp-media');
  const frame = h(doc, 'div', 'vp-frame');
  const video = h(doc, 'video', 'vp-video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.setAttribute('aria-label', page?.title || 'Video');
  const poster = safeImageUrl(page?.poster_url);
  if (poster) video.poster = poster;
  const src = /^https:\/\//i.test(page?.video_url || '') ? page.video_url : '';
  if (src) video.src = src;
  if (config.autoplay && !preview) { video.muted = true; video.autoplay = true; }
  frame.appendChild(video);
  media.appendChild(frame);

  main.append(copy, media);

  // ---- lead form
  if (config.form.enabled) {
    const box = h(doc, 'section', 'vp-form');
    const title = t(config.form.title);
    if (title) box.appendChild(h(doc, 'h2', 'vp-form-title', title));
    const form = h(doc, 'form', 'vp-form-body');
    form.noValidate = false;
    config.form.fields.forEach((f) => {
      const label = h(doc, 'label', 'vp-field');
      label.appendChild(h(doc, 'span', 'vp-field-label', f.label + (f.required ? ' *' : '')));
      const input = h(doc, f.type === 'textarea' ? 'textarea' : 'input', 'vp-input');
      if (f.type !== 'textarea') input.type = f.type;
      else input.rows = 3;
      input.name = f.key;
      input.required = f.required;
      input.maxLength = 2000;
      label.appendChild(input);
      form.appendChild(label);
    });
    const submit = h(doc, 'button', 'vp-submit', config.form.submitLabel);
    submit.type = 'submit';
    const status = h(doc, 'p', 'vp-status');
    status.setAttribute('role', 'status');
    form.append(submit, status);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (preview) { status.textContent = 'Preview only: nothing is sent.'; return; }
      const data = {};
      new FormData(form).forEach((v, k) => { data[k] = String(v); });
      submit.disabled = true;
      status.textContent = '';
      const res = await (handlers.onLead?.(data) ?? { stored: false, error: 'Form is not available' });
      if (res?.error) {
        submit.disabled = false;
        status.textContent = 'Could not send. Please try again.';
        return;
      }
      form.replaceChildren(h(doc, 'p', 'vp-thanks', t(config.form.successMessage) || 'Thanks!'));
    });
    box.appendChild(form);
    main.appendChild(box);
  }

  // ---- extra sections
  config.sections.forEach((s) => {
    const sec = h(doc, 'section', 'vp-section');
    const heading = t(s.heading);
    const body = t(s.body);
    if (heading) sec.appendChild(h(doc, 'h2', 'vp-section-title', heading));
    if (body) sec.appendChild(h(doc, 'p', 'vp-section-body', body));
    main.appendChild(sec);
  });

  if (config.consent.notice) root.appendChild(h(doc, 'footer', 'vp-consent', config.consent.notice));

  // ---- viewer events (public page only)
  const fired = new Set();
  const once = (kind, fn) => { if (!fired.has(kind)) { fired.add(kind); fn?.(kind); } };
  const onPlay = () => once('play', () => handlers.onPlay?.());
  const onTime = () => {
    const d = video.duration;
    if (!d || !Number.isFinite(d)) return;
    const ratio = video.currentTime / d;
    PROGRESS_MARKS.forEach((m) => { if (ratio >= m.at) once(m.kind, handlers.onProgress); });
  };
  const onEnded = () => once('complete', () => handlers.onComplete?.());
  if (!preview) {
    video.addEventListener('play', onPlay);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnded);
  }

  return {
    root,
    video,
    destroy() {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnded);
      video.pause?.();
      video.removeAttribute('src');
    },
  };
}
