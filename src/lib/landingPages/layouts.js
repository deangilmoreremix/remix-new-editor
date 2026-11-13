/**
 * Structural layouts: each composer takes the blocks render.js already built (header, headline copy,
 * player, action row, calendar, transcript, lead form, story, sections, quote, logos, footer) and arranges
 * them into a genuinely different page, not a re-skin of the same one. Composers only move existing nodes
 * and create static containers, so every safety rule that applies to the blocks still applies.
 *
 *   cinema-hero   video fills the screen, headline and buttons laid over it, details below the fold
 *   split-screen  sticky video panel on the left, scrolling content on the right
 *   conversation  a message thread: the video arrives as a message, buttons are quick replies
 *   app-window    product-UI window with a sidebar that jumps between the page's sections
 */

const present = (...nodes) => nodes.filter(Boolean);

/** Story and form side by side when both exist (wide screens), otherwise whichever one there is. */
function storyAndForm(ctx) {
  const { doc, h, blocks: b } = ctx;
  const wrap = h(doc, 'div', 'vp-cols');
  wrap.append(...present(b.story, b.form));
  return wrap.children.length ? wrap : null;
}

function cinemaHero(ctx) {
  const { doc, h, root, listen, video, media, blocks: b } = ctx;
  root.replaceChildren();

  const hero = h(doc, 'section', 'vp-hero');
  const stage = h(doc, 'div', 'vp-stage');
  stage.appendChild(media);
  const shade = h(doc, 'div', 'vp-hero-shade');
  const overlay = h(doc, 'div', 'vp-hero-overlay');
  overlay.append(...present(b.copy, b.actions));
  hero.append(stage, shade);
  if (b.top) hero.appendChild(b.top);
  hero.appendChild(overlay);

  const sheet = h(doc, 'div', 'vp-sheet');
  const inner = h(doc, 'div', 'vp-sheet-inner');
  inner.append(...present(b.calendar, storyAndForm(ctx), b.transcript, ...b.sections, b.quote, b.logos));
  sheet.appendChild(inner);

  const hint = h(doc, 'button', 'vp-hero-hint', inner.children.length ? 'Details' : '');
  hint.type = 'button';
  hint.setAttribute('aria-label', 'Scroll to the details');
  hint.addEventListener('click', () => sheet.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  if (inner.children.length) hero.appendChild(hint);

  // While the video plays the words step aside; hovering or focusing brings them back.
  const paint = () => root.classList.toggle('is-playing', !video.paused && !video.ended);
  listen(video, 'play', paint);
  listen(video, 'pause', paint);
  listen(video, 'ended', paint);

  root.append(hero, sheet, ...present(b.foot, b.consent));
}

function splitScreen(ctx) {
  const { doc, h, root, blocks: b } = ctx;
  root.replaceChildren();

  const wrap = h(doc, 'div', 'vp-split');
  const left = h(doc, 'aside', 'vp-split-left');
  left.append(...present(b.top, b.copy, b.media, b.actions));
  const right = h(doc, 'main', 'vp-split-right');
  right.append(...present(b.story, b.form, b.calendar, b.transcript, ...b.sections, b.quote, b.logos, b.foot, b.consent));
  wrap.append(left, right);
  root.appendChild(wrap);
}

function conversation(ctx) {
  const { doc, h, mark, root, config, blocks: b } = ctx;
  root.replaceChildren();

  const chat = h(doc, 'div', 'vp-chat');
  const senderName = config.sender.name || config.brand.name || 'Message';

  const head = h(doc, 'header', 'vp-chat-head');
  head.append(mark(doc, { imageUrl: config.sender.avatarUrl || config.theme.logoUrl, name: senderName, className: 'vp-mark--avatar' }));
  const who = h(doc, 'div', 'vp-chat-who');
  who.append(h(doc, 'div', 'vp-chat-name', senderName), h(doc, 'div', 'vp-chat-sub', config.sender.title || 'sent you a video'));
  head.appendChild(who);

  const thread = h(doc, 'main', 'vp-thread');
  let delay = 0;
  const bubble = (className, ...nodes) => {
    const row = h(doc, 'div', `vp-msg ${className || ''}`.trim());
    row.style.setProperty('--d', `${delay}ms`);
    delay += 140;
    const body = h(doc, 'div', 'vp-bubble');
    body.append(...present(...nodes));
    row.appendChild(body);
    thread.appendChild(row);
    return row;
  };

  const copy = b.copy;
  const headline = copy?.querySelector('.vp-headline');
  const subhead = copy?.querySelector('.vp-subhead');
  const countdown = copy?.querySelector('.vp-countdown');
  if (countdown) thread.appendChild(countdown);
  if (headline) bubble('vp-msg--text', headline);
  if (subhead) bubble('vp-msg--text', subhead);

  // The video is the message. The Like button becomes a reaction under it; every other button a quick reply.
  const like = b.actions?.querySelector('.vp-like');
  const video = bubble('vp-msg--media', b.media);
  if (like) video.appendChild(like);
  const replies = h(doc, 'div', 'vp-quick');
  [...(b.actions?.children || [])].forEach((n) => { if (n !== like) replies.appendChild(n); });
  if (replies.children.length) thread.appendChild(replies);

  if (b.story) {
    [...b.story.querySelectorAll('.vp-story-title, .vp-story-body')].forEach((n) => bubble('vp-msg--text', n));
    const byline = b.story.querySelector('.vp-byline');
    if (byline) bubble('vp-msg--sign', byline);
  }
  if (b.calendar) bubble('vp-msg--wide', b.calendar);
  if (b.transcript) {
    const details = h(doc, 'details', 'vp-transcript-fold');
    const summary = h(doc, 'summary', 'vp-transcript-summary', 'Transcript');
    details.append(summary, ...[...b.transcript.children].filter((n) => !n.classList.contains('vp-transcript-title')));
    bubble('vp-msg--wide', details);
  }
  b.sections.forEach((s) => bubble('vp-msg--text', s));
  if (b.quote) bubble('vp-msg--text', b.quote);
  if (b.logos) bubble('vp-msg--text', b.logos);

  // The reply box: the lead form, presented as a message composer.
  const composer = b.form ? h(doc, 'div', 'vp-composer') : null;
  if (composer) {
    const label = h(doc, 'div', 'vp-composer-label', `Reply to ${senderName}`);
    composer.append(label, b.form);
  }

  chat.append(head, thread, ...present(composer), ...present(b.foot, b.consent));
  root.appendChild(chat);
}

function appWindow(ctx) {
  const { doc, h, mark, root, config, blocks: b } = ctx;
  root.replaceChildren();

  const desk = h(doc, 'div', 'vp-desk');
  const win = h(doc, 'div', 'vp-window');

  const bar = h(doc, 'div', 'vp-winbar');
  const dots = h(doc, 'span', 'vp-windots');
  ['', '', ''].forEach(() => dots.appendChild(h(doc, 'i')));
  const title = config.brand.name || 'Video';
  bar.append(dots, h(doc, 'span', 'vp-wintitle', title));

  const body = h(doc, 'div', 'vp-winbody');
  const side = h(doc, 'nav', 'vp-sidebar');
  side.setAttribute('aria-label', 'Sections');
  const brand = h(doc, 'div', 'vp-side-brand');
  brand.append(mark(doc, { imageUrl: config.theme.logoUrl, name: config.brand.name, className: 'vp-mark--sender' }));
  if (config.brand.name) brand.appendChild(h(doc, 'span', 'vp-brand-name', config.brand.name));
  side.appendChild(brand);

  const content = h(doc, 'main', 'vp-wincontent');
  const mainCol = h(doc, 'div', 'vp-wincol');
  const rail = h(doc, 'div', 'vp-winrail');

  // header block and the headline become the page header
  const pageHead = h(doc, 'div', 'vp-pagehead');
  if (b.copy) pageHead.appendChild(b.copy);
  mainCol.append(...present(pageHead, b.media, b.actions, b.calendar, b.story, b.form));
  rail.append(...present(b.transcript, ...b.sections, b.quote, b.logos));
  content.append(mainCol, rail);

  // Sidebar: one entry per block that exists. Clicking scrolls to it; the entry for the visible block is highlighted.
  // Reading order of the main column first, then the side rail, so "first visible entry wins" never lets a
  // sticky rail card steal the highlight from the section the viewer is actually reading.
  const entries = [
    ['Overview', pageHead], ['Video', b.media], ['Book a time', b.calendar], ['About', b.story], ['Get in touch', b.form],
    ['Transcript', b.transcript], ...b.sections.map((s) => [s.querySelector('.vp-section-title')?.textContent || 'More', s]),
  ].filter(([, el]) => el);
  const links = entries.map(([label, el]) => {
    const btn = h(doc, 'button', 'vp-sidelink', label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      links.forEach((l) => l.classList.toggle('is-active', l === btn));
    });
    side.appendChild(btn);
    return btn;
  });
  links[0]?.classList.add('is-active');
  if (typeof globalThis.IntersectionObserver === 'function') {
    const visible = new Set();
    const obs = new globalThis.IntersectionObserver((hits) => {
      hits.forEach((e) => { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      const first = entries.findIndex(([, el]) => visible.has(el));
      if (first >= 0) links.forEach((l, i) => l.classList.toggle('is-active', i === first));
    }, { rootMargin: '-20% 0px -55% 0px' });
    entries.forEach(([, el]) => obs.observe(el));
  }

  body.append(side, content);
  win.append(bar, body, ...present(b.foot, b.consent));
  desk.appendChild(win);
  root.appendChild(desk);
}

const COMPOSERS = {
  'cinema-hero': cinemaHero,
  'split-screen': splitScreen,
  conversation,
  'app-window': appWindow,
};

export const LAYOUT_NAMES = Object.freeze(Object.keys(COMPOSERS));

export function composeLayout(name, ctx) {
  const fn = COMPOSERS[name];
  if (!fn) return false;
  fn(ctx);
  return true;
}
