/**
 * Renders a landing page from `{ page, tokens }` into DOM. Shared by the public
 * page (src/pages/VideoPage.jsx) and the studio's live preview, so the preview
 * is exactly what viewers get. All user text goes in through textContent, and
 * every URL passes safeUrl/safeImageUrl, so a hostile config can't inject markup.
 */
import { composeLayout } from './layouts.js';
import {
  getTemplate, sanitizeConfig, fillTokens, safeUrl, safeImageUrl, splitAccent, formatDuration, readableOn, ctaHref, prefillFor, FONTS,
} from './templates.js';

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

const clock = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/** play() returns a promise in browsers and undefined in some environments; never throw. */
function tryPlay(video) {
  try {
    const p = video.play?.();
    p?.catch?.(() => {});
  } catch { /* autoplay blocked or unsupported */ }
}

/** Trailing separators left behind when a token in the footer is empty ("Sent by Dean · "). */
const tidy = (s) => s.replace(/\s*[·|•-]\s*$/, '').trim();

/** A logo image, or a coloured letter tile when there is no image. */
function mark(doc, { imageUrl, name, className }) {
  const url = safeImageUrl(imageUrl);
  if (url) {
    const img = h(doc, 'img', `vp-mark vp-mark--img ${className || ''}`);
    img.src = url;
    img.alt = '';
    img.loading = 'eager';
    return img;
  }
  return h(doc, 'span', `vp-mark ${className || ''}`, (String(name || '?').trim()[0] || '?').toUpperCase());
}

/**
 * @param {object} o
 *   page      { title, video_url, poster_url, duration, config }
 *   tokens    { firstname, company, companylogo, ... }  (contact / URL values)
 *   handlers  { onPlay, onProgress(kind), onComplete, onCta, onLead(data) -> Promise<{stored,error}> }
 *   preview   true in the studio (no events, form submit is a no-op message)
 * @returns {{ root: HTMLElement, video: HTMLVideoElement, destroy(): void }}
 */
export function renderLandingPage({ page, tokens = {}, handlers = {}, preview = false, doc = globalThis.document }) {
  const config = sanitizeConfig(page?.config);
  const tpl = getTemplate(config.template);
  const theme = config.theme;
  // Page-owned tokens always win over contact values so a contact can't spoof the sender.
  const own = { ...tokens, sender: config.sender.name, brand: config.brand.name, duration: formatDuration(page?.duration) };
  const t = (s) => fillTokens(s, own);

  const traits = (tpl.traits || []).map((x) => `vp--t-${x}`).join(' ');
  const root = h(doc, 'div', `vp vp--${tpl.id} vp--${tpl.layout} vp--${theme.mode} ${traits}`.trim());
  if (tpl.radius != null) root.style.setProperty('--vp-radius', `${tpl.radius}px`);
  // Per-design surface colours (trusted constants from the template definition, never from page config).
  Object.entries(tpl.vars || {}).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty('--vp-accent', theme.accent);
  root.style.setProperty('--vp-highlight', theme.highlight);
  root.style.setProperty('--vp-on-accent', readableOn(theme.accent));
  root.style.setProperty('--vp-on-highlight', readableOn(theme.highlight));
  root.style.setProperty('--vp-bg', theme.bg);
  root.style.setProperty('--vp-text', theme.text);
  root.style.setProperty('--vp-font', FONTS[theme.font]);

  // ---- top bar: co-branded (sender × recipient) or a plain logo
  const company = (own.company || '').trim();
  const tagline = t(config.brand.tagline);
  if (config.brand.name || tagline || (tpl.intro && company)) {
    const top = h(doc, 'header', 'vp-top');
    const brandBox = h(doc, 'div', 'vp-cobrand');
    if (config.brand.name || theme.logoUrl) {
      const me = h(doc, 'span', 'vp-brand-item');
      me.append(mark(doc, { imageUrl: theme.logoUrl, name: config.brand.name, className: 'vp-mark--sender' }));
      if (config.brand.name) me.appendChild(h(doc, 'span', 'vp-brand-name', config.brand.name));
      brandBox.appendChild(me);
    }
    if (company && tpl.intro) {
      if (brandBox.childNodes.length) brandBox.appendChild(h(doc, 'span', 'vp-times', '×'));
      const them = h(doc, 'span', 'vp-brand-item');
      them.append(mark(doc, { imageUrl: own.companylogo, name: company, className: 'vp-mark--recipient' }), h(doc, 'span', 'vp-brand-name', company));
      brandBox.appendChild(them);
    }
    top.appendChild(brandBox);
    if (tagline) top.appendChild(h(doc, 'span', 'vp-tagline', tagline));
    root.appendChild(top);
  } else if (theme.logoUrl) {
    const head = h(doc, 'header', 'vp-brand');
    const img = h(doc, 'img', 'vp-logo');
    img.src = safeImageUrl(theme.logoUrl);
    img.alt = '';
    img.loading = 'eager';
    head.appendChild(img);
    root.appendChild(head);
  }

  const topEl = root.querySelector(':scope > .vp-top, :scope > .vp-brand');
  const main = h(doc, 'main', 'vp-main');
  root.appendChild(main);

  // ---- copy (pill, headline, subhead, CTA)
  const copy = h(doc, 'section', 'vp-copy');
  let countdownTimer = null;
  if (config.countdown.enabled) {
    const cd = h(doc, 'div', 'vp-countdown');
    const prefix = t(config.countdown.label) || 'Offer ends in';
    const end = Date.parse(config.countdown.endsAt);
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) { cd.hidden = true; if (countdownTimer) clearInterval(countdownTimer); return; }
      const s = Math.floor(ms / 1000);
      const dd = Math.floor(s / 86400);
      const pad = (n) => String(n).padStart(2, '0');
      cd.textContent = `${prefix} ${dd ? `${dd}d ` : ''}${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    };
    tick();
    if (!cd.hidden) countdownTimer = setInterval(tick, 1000);
    copy.appendChild(cd);
  }
  const badge = t(config.badge);
  if (badge) copy.appendChild(h(doc, 'span', 'vp-pill', badge));
  if (config.headline) {
    const hl = h(doc, 'h1', 'vp-headline');
    splitAccent(config.headline).forEach((part) => {
      const txt = t(part.text);
      if (!txt) return;
      hl.appendChild(part.accent ? h(doc, 'span', 'vp-accent', txt) : doc.createTextNode(txt));
    });
    if (hl.childNodes.length) copy.appendChild(hl);
  }
  const subhead = t(config.subhead);
  if (subhead) copy.appendChild(h(doc, 'p', 'vp-subhead', subhead));

  // ---- video
  const media = h(doc, 'section', 'vp-media');
  const player = h(doc, 'div', 'vp-player');
  const frame = h(doc, 'div', 'vp-frame');
  const video = h(doc, 'video', 'vp-video');
  video.controls = !tpl.customPlayer;
  video.playsInline = true;
  video.preload = 'metadata';
  video.setAttribute('aria-label', page?.title || 'Video');
  const poster = safeImageUrl(page?.poster_url);
  if (poster) video.poster = poster;
  const src = /^https:\/\//i.test(page?.video_url || '') ? page.video_url : '';
  if (src) video.src = src;
  if (config.autoplay && !preview) { video.muted = true; video.autoplay = true; }
  frame.appendChild(video);
  player.appendChild(frame);
  media.appendChild(player);
  if (tpl.adaptive) {
    // Frame follows the video's real shape (wide, square or tall) instead of assuming 16:9.
    frame.classList.add('is-adaptive');
    frame.dataset.shape = 'wide';
    video.addEventListener('loadedmetadata', () => {
      const w = video.videoWidth;
      const hh = video.videoHeight;
      if (!w || !hh) return;
      frame.style.setProperty('--ar', String(Math.round((w / hh) * 1000) / 1000));
      frame.dataset.shape = w > hh * 1.15 ? 'wide' : hh > w * 1.15 ? 'tall' : 'square';
    });
  }

  const cleanups = [];
  const listen = (target, type, fn) => { target.addEventListener(type, fn); cleanups.push(() => target.removeEventListener(type, fn)); };

  if (tpl.customPlayer) {
    const bigPlay = h(doc, 'button', 'vp-bigplay');
    bigPlay.type = 'button';
    bigPlay.setAttribute('aria-label', 'Play video');
    bigPlay.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';

    const caption = h(doc, 'div', 'vp-caption');
    const capTitle = h(doc, 'div', 'vp-caption-title');
    const capSub = h(doc, 'div', 'vp-caption-sub');
    const durBadge = h(doc, 'span', 'vp-dur');
    caption.append(capTitle, capSub);
    const paintCaption = () => {
      capTitle.textContent = t(config.overlay.title);
      capSub.textContent = t(config.overlay.subtitle);
      durBadge.textContent = own.duration;
      caption.hidden = !capTitle.textContent && !capSub.textContent;
      durBadge.hidden = !own.duration;
    };
    paintCaption();
    frame.append(caption, durBadge, bigPlay);

    const bar = h(doc, 'div', 'vp-bar');
    const playBtn = h(doc, 'button', 'vp-bar-btn', '▶');
    playBtn.type = 'button';
    playBtn.setAttribute('aria-label', 'Play');
    const cur = h(doc, 'span', 'vp-time', '0:00');
    const seek = h(doc, 'input', 'vp-seek');
    seek.type = 'range';
    seek.min = '0'; seek.max = '1000'; seek.step = '1'; seek.value = '0';
    seek.setAttribute('aria-label', 'Seek');
    const total = h(doc, 'span', 'vp-time', own.duration || '0:00');
    const fs = h(doc, 'button', 'vp-bar-btn', '⛶');
    fs.type = 'button';
    fs.setAttribute('aria-label', 'Full screen');
    bar.append(playBtn, cur, seek, total, fs);
    player.appendChild(bar);

    const toggle = () => { if (video.paused) tryPlay(video); else video.pause(); };
    const paint = () => {
      const playing = !video.paused && !video.ended;
      playBtn.textContent = playing ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      bigPlay.hidden = playing || video.currentTime > 0.05;
      caption.hidden = caption.hidden || (playing || video.currentTime > 0.05);
      durBadge.hidden = !own.duration || playing || video.currentTime > 0.05;
    };
    listen(bigPlay, 'click', toggle);
    listen(playBtn, 'click', toggle);
    listen(frame, 'click', (e) => { if (e.target === video) toggle(); });
    listen(video, 'play', paint);
    listen(video, 'pause', paint);
    listen(video, 'ended', paint);
    listen(video, 'timeupdate', () => {
      cur.textContent = clock(video.currentTime);
      if (video.duration) seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
    });
    listen(video, 'loadedmetadata', () => {
      if (!own.duration && Number.isFinite(video.duration)) {
        own.duration = formatDuration(video.duration);
        total.textContent = own.duration;
        paintCaption();
        paint();
      }
    });
    listen(seek, 'input', () => { if (video.duration) video.currentTime = (Number(seek.value) / 1000) * video.duration; });
    listen(fs, 'click', () => { if (doc.fullscreenElement) doc.exitFullscreen?.(); else player.requestFullscreen?.(); });
    paint();
  }

  // ---- CTA
  const ctaLabel = t(config.cta.label);
  if (ctaLabel && config.cta.type === 'play') {
    const btn = h(doc, 'button', 'vp-cta vp-cta--play');
    btn.type = 'button';
    btn.append(h(doc, 'span', 'vp-cta-icon', '▶'), doc.createTextNode(` ${ctaLabel}`));
    btn.addEventListener('click', () => {
      media.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      tryPlay(video);
    });
    copy.appendChild(btn);
  } else if (ctaLabel && safeUrl(config.cta.url)) {
    const url = safeUrl(config.cta.url);
    const a = h(doc, 'a', 'vp-cta', ctaLabel);
    a.href = url;
    if (/^https?:/i.test(url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.addEventListener('click', () => { if (!preview) handlers.onCta?.(); });
    copy.appendChild(a);
  }

  main.append(copy, media);

  // ---- action buttons, Like, embedded calendar (any template; the pitch page is built around them)
  let formBox = null; // the lead form is built below; "scroll to the form" buttons look it up when clicked
  let liked = false;
  const actions = h(doc, 'div', 'vp-actions');
  if (config.likes.enabled) {
    const like = h(doc, 'button', 'vp-like');
    like.type = 'button';
    like.setAttribute('aria-pressed', 'false');
    const heart = h(doc, 'span', 'vp-like-icon', '♡');
    const word = h(doc, 'span', 'vp-like-word', 'Like');
    like.append(heart, word);
    like.addEventListener('click', () => {
      if (liked) return;
      liked = true;
      heart.textContent = '♥';
      word.textContent = 'Liked';
      like.classList.add('is-liked');
      like.setAttribute('aria-pressed', 'true');
      if (!preview) handlers.onLike?.();
    });
    actions.appendChild(like);
  }
  const calendarUrl = config.calendar.url;
  const calendarBox = calendarUrl ? h(doc, 'section', 'vp-calendar') : null;
  config.ctas.forEach((b) => {
    const label = t(b.label);
    const toCalendar = b.kind === 'calendar' && calendarUrl;
    const toForm = b.kind === 'form' && config.form.enabled;
    const href = toCalendar || toForm ? '' : ctaHref(b.kind, b.value);
    if (!label || (!href && !toCalendar && !toForm)) return;
    let node;
    if (toCalendar || toForm) {
      node = h(doc, 'button', `vp-btn vp-btn--${b.style}`, label);
      node.type = 'button';
      node.addEventListener('click', () => {
        const target = toCalendar ? calendarBox : formBox;
        target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        if (toForm) target?.querySelector('input, textarea')?.focus?.({ preventScroll: true });
        if (!preview) handlers.onCta?.();
      });
    } else {
      node = h(doc, 'a', `vp-btn vp-btn--${b.style}`, label);
      node.href = href;
      if (b.kind === 'download') node.setAttribute('download', '');
      if (/^https?:/i.test(href)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
      node.addEventListener('click', () => { if (!preview) handlers.onCta?.(); });
    }
    actions.appendChild(node);
  });
  if (actions.children.length) media.after(actions);
  if (calendarBox) {
    const title = t(config.calendar.title);
    if (title) calendarBox.appendChild(h(doc, 'h2', 'vp-calendar-title', title));
    const frameEl = h(doc, 'iframe', 'vp-calendar-frame');
    frameEl.src = calendarUrl;
    frameEl.title = title || 'Book a time';
    frameEl.loading = 'lazy';
    frameEl.referrerPolicy = 'no-referrer-when-downgrade';
    frameEl.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    calendarBox.appendChild(frameEl);
    (actions.children.length ? actions : media).after(calendarBox);
  }

  // ---- transcript panel (beside the video on the pitch page, below it elsewhere)
  let side = null;
  if (config.transcript.enabled && config.transcript.items.length) {
    side = h(doc, 'aside', 'vp-transcript');
    side.appendChild(h(doc, 'h2', 'vp-transcript-title', 'Transcript'));
    const list = h(doc, 'ol', 'vp-transcript-list');
    const lines = [];
    config.transcript.items.forEach((it) => {
      const li = h(doc, 'li', 'vp-line-item');
      const b = h(doc, 'button', 'vp-line');
      b.type = 'button';
      b.append(h(doc, 'span', 'vp-line-time', clock(it.t)), h(doc, 'span', 'vp-line-text', it.text));
      listen(b, 'click', () => { video.currentTime = it.t; tryPlay(video); });
      li.appendChild(b);
      list.appendChild(li);
      lines.push({ t: it.t, b });
    });
    side.appendChild(list);
    listen(video, 'timeupdate', () => {
      let active = -1;
      lines.forEach((l, i) => { if (video.currentTime >= l.t) active = i; });
      lines.forEach((l, i) => l.b.classList.toggle('is-active', i === active));
    });
  }

  // ---- lead form
  if (config.form.enabled) {
    formBox = h(doc, 'section', 'vp-form');
    const title = t(config.form.title);
    if (title) formBox.appendChild(h(doc, 'h2', 'vp-form-title', title));
    const sub = t(config.form.subtitle);
    if (sub) formBox.appendChild(h(doc, 'p', 'vp-form-sub', sub));
    const form = h(doc, 'form', 'vp-form-body');
    config.form.fields.forEach((f) => {
      const label = h(doc, 'label', 'vp-field');
      label.appendChild(h(doc, 'span', 'vp-field-label', f.label + (f.required ? ' *' : '')));
      const input = h(doc, f.type === 'textarea' ? 'textarea' : 'input', 'vp-input');
      if (f.type !== 'textarea') input.type = f.type;
      else input.rows = 3;
      if (f.placeholder) input.placeholder = t(f.placeholder);
      const pre = prefillFor(f.key, tokens);
      if (pre) input.value = pre;
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
    const privacy = t(config.form.privacy);
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
    formBox.appendChild(form);
    if (privacy) formBox.appendChild(h(doc, 'p', 'vp-privacy', privacy));
  }

  // ---- story + byline (left of the form on the intro layout)
  let storyBox = null;
  const storyHeading = t(config.story.heading);
  const storyBody = config.story.body.map(t).filter(Boolean);
  const senderName = config.sender.name;
  if (storyHeading || storyBody.length || senderName) {
    storyBox = h(doc, 'section', 'vp-story');
    if (storyHeading) storyBox.appendChild(h(doc, 'h2', 'vp-story-title', storyHeading));
    storyBody.forEach((p) => storyBox.appendChild(h(doc, 'p', 'vp-story-body', p)));
    if (senderName) {
      const by = h(doc, 'div', 'vp-byline');
      by.appendChild(mark(doc, { imageUrl: config.sender.avatarUrl, name: senderName, className: 'vp-mark--avatar' }));
      const who = h(doc, 'div', 'vp-byline-text');
      who.appendChild(h(doc, 'div', 'vp-byline-name', senderName));
      if (config.sender.title) who.appendChild(h(doc, 'div', 'vp-byline-title', config.sender.title));
      by.appendChild(who);
      storyBox.appendChild(by);
    }
  }

  if (storyBox && formBox) {
    const cols = h(doc, 'div', 'vp-cols');
    cols.append(storyBox, formBox);
    main.appendChild(cols);
  } else {
    if (storyBox) main.appendChild(storyBox);
    if (formBox) main.appendChild(formBox);
  }

  // ---- extra sections
  const sectionEls = [];
  config.sections.forEach((s) => {
    const sec = h(doc, 'section', 'vp-section');
    const heading = t(s.heading);
    const body = t(s.body);
    if (heading) sec.appendChild(h(doc, 'h2', 'vp-section-title', heading));
    if (body) sec.appendChild(h(doc, 'p', 'vp-section-body', body));
    main.appendChild(sec);
    sectionEls.push(sec);
  });

  // ---- testimonial + customer logos
  let quoteEl = null;
  let logosEl = null;
  let footEl = null;
  const quote = t(config.testimonial.quote);
  if (quote) {
    const box = h(doc, 'figure', 'vp-quote');
    quoteEl = box;
    box.appendChild(h(doc, 'blockquote', 'vp-quote-text', `“${quote}”`));
    const by = t(config.testimonial.by);
    if (by) box.appendChild(h(doc, 'figcaption', 'vp-quote-by', by));
    main.appendChild(box);
  }
  if (config.logos.length) {
    const strip = h(doc, 'div', 'vp-logos');
    logosEl = strip;
    config.logos.forEach((l) => {
      if (l.imageUrl) {
        const img = h(doc, 'img', 'vp-logos-img');
        img.src = l.imageUrl;
        img.alt = l.name || '';
        img.loading = 'lazy';
        strip.appendChild(img);
      } else strip.appendChild(h(doc, 'span', 'vp-logos-name', l.name));
    });
    main.appendChild(strip);
  }

  // ---- footer
  const footText = tidy(t(config.footer.text));
  const optOut = config.footer.optOutUrl;
  if (footText || optOut) {
    const foot = h(doc, 'footer', 'vp-foot');
    footEl = foot;
    foot.appendChild(h(doc, 'span', 'vp-foot-text', footText));
    if (optOut) {
      const a = h(doc, 'a', 'vp-optout', "Don't want these? Opt out");
      a.href = optOut;
      if (/^https?:/i.test(optOut)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      foot.appendChild(a);
    }
    root.appendChild(foot);
  }
  let consentEl = null;
  if (config.consent.notice) { consentEl = h(doc, 'p', 'vp-consent', config.consent.notice); root.appendChild(consentEl); }

  // ---- structural layouts: the same blocks, arranged as a genuinely different page (see layouts.js)
  if (tpl.compose) {
    composeLayout(tpl.compose, {
      doc, h, mark, clock, tryPlay, listen, root, main, config, tpl, t, own, tokens, preview, handlers, video, frame, player, media, onDestroy: (fn) => cleanups.push(fn),
      blocks: { top: topEl, copy, media, actions, calendar: calendarBox, transcript: side, form: formBox, story: storyBox, sections: sectionEls, quote: quoteEl, logos: logosEl, foot: footEl, consent: consentEl },
    });
  } else if (tpl.pitch) {
    const left = h(doc, 'div', 'vp-pitch-main');
    [...main.children].forEach((n) => left.appendChild(n));
    main.appendChild(left);
    main.classList.add('vp-pitch-grid');
    if (side) main.appendChild(side); else main.classList.add('vp-pitch-grid--single');
  } else if (side) {
    main.appendChild(side);
  }
  if (tpl.pitch && (tpl.traits || []).includes('banner')) {
    // Headline block moves up into a coloured banner with the header; the video card overlaps its lower edge.
    const banner = h(doc, 'div', 'vp-banner');
    const top = root.querySelector(':scope > .vp-top');
    const copyEl = main.querySelector('.vp-copy');
    if (top) banner.appendChild(top);
    if (copyEl) banner.appendChild(copyEl);
    root.insertBefore(banner, main);
  }
  if ((tpl.traits || []).includes('card')) {
    const card = h(doc, 'div', 'vp-card');
    [...root.children].forEach((n) => card.appendChild(n));
    root.appendChild(card);
  }

  // ---- viewer events (public page only)
  const fired = new Set();
  const once = (kind, fn) => { if (!fired.has(kind)) { fired.add(kind); fn?.(kind); } };
  if (!preview) {
    listen(video, 'play', () => once('play', () => handlers.onPlay?.()));
    listen(video, 'timeupdate', () => {
      const d = video.duration;
      if (!d || !Number.isFinite(d)) return;
      const ratio = video.currentTime / d;
      PROGRESS_MARKS.forEach((m) => { if (ratio >= m.at) once(m.kind, handlers.onProgress); });
    });
    listen(video, 'ended', () => once('complete', () => handlers.onComplete?.()));
  }

  return {
    root,
    video,
    destroy() {
      if (countdownTimer) clearInterval(countdownTimer);
      cleanups.forEach((fn) => fn());
      video.pause?.();
      video.removeAttribute('src');
    },
  };
}
