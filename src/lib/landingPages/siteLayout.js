/**
 * "Site" pages: a full marketing-site composition (nav, hero with video + form, proof strip, bento cards,
 * sign-up band) built from the page's own config. Every string is set with textContent, every link goes
 * through safeUrl, icons are fixed internal SVG paths, and the video / lead form / calendar are the SAME
 * blocks every other layout uses, so tokens, events and the safety rules are unchanged.
 */
import '../../../styles/video-site.css';
import { safeUrl } from './templates.js';
import { icon } from './siteIcons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Decorative sparkline for the KPI card (fixed geometry, no data from config). */
function sparkline(doc) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 60');
  svg.setAttribute('class', 'vp-spark');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');
  const area = doc.createElementNS(SVG_NS, 'path');
  area.setAttribute('d', 'M0 52 L25 46 L50 48 L75 36 L100 40 L125 26 L150 30 L175 12 L200 4 L200 60 L0 60 Z');
  area.setAttribute('class', 'vp-spark-area');
  const line = doc.createElementNS(SVG_NS, 'path');
  line.setAttribute('d', 'M0 52 L25 46 L50 48 L75 36 L100 40 L125 26 L150 30 L175 12 L200 4');
  line.setAttribute('class', 'vp-spark-line');
  line.setAttribute('fill', 'none');
  svg.append(area, line);
  return svg;
}

const present = (...nodes) => nodes.filter(Boolean);

function stars(doc, n = 5) {
  const s = doc.createElement('span');
  s.className = 'vp-stars';
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `${n} out of 5 stars`);
  for (let i = 0; i < n; i += 1) s.appendChild(icon(doc, 'star', 'vp-star'));
  return s;
}

/** A tiny "enter your email" form that records a lead through the page's normal lead handler. */
function emailForm(ctx, { placeholder, button, source, className = '' }) {
  const { doc, h, handlers, preview, t } = ctx;
  const form = h(doc, 'form', `vp-mini ${className}`.trim());
  const wrap = h(doc, 'label', 'vp-mini-field');
  wrap.appendChild(icon(doc, 'mail', 'vp-ico vp-mini-ico'));
  const input = h(doc, 'input', 'vp-mini-input');
  input.type = 'email';
  input.required = true;
  input.name = 'email';
  input.maxLength = 200;
  input.placeholder = t(placeholder) || 'Enter your email';
  input.setAttribute('aria-label', input.placeholder);
  wrap.appendChild(input);
  const submit = h(doc, 'button', 'vp-mini-btn', t(button) || 'Subscribe');
  submit.type = 'submit';
  const status = h(doc, 'span', 'vp-status vp-mini-status');
  status.setAttribute('role', 'status');
  form.append(wrap, submit, status);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (preview) { status.textContent = 'Preview only: nothing is sent.'; return; }
    submit.disabled = true;
    status.textContent = '';
    const res = await (handlers.onLead?.({ email: input.value, message: `Signed up: ${source}` }) ?? { error: 'Form is not available' });
    if (res?.error) { submit.disabled = false; status.textContent = 'Could not send. Please try again.'; return; }
    form.replaceChildren(h(doc, 'span', 'vp-thanks vp-mini-thanks', 'Thanks! Check your inbox.'));
  });
  return form;
}

const CARD_BUILDERS = {
  heading(ctx, c, card) {
    const { doc, h, t } = ctx;
    if (c.eyebrow) card.appendChild(h(doc, 'div', 'vp-eyebrow', t(c.eyebrow)));
    card.appendChild(h(doc, 'h2', 'vp-card-title vp-card-title--big', t(c.title)));
    if (c.text) card.appendChild(h(doc, 'p', 'vp-card-text', t(c.text)));
  },
  playbook(ctx, c, card) {
    const { doc, h, t } = ctx;
    const book = h(doc, 'div', 'vp-book');
    book.append(h(doc, 'span', 'vp-book-title', t(c.cover || c.title)), icon(doc, 'play', 'vp-ico vp-book-play'));
    const body = h(doc, 'div', 'vp-playbook-body');
    if (c.eyebrow) body.appendChild(h(doc, 'span', 'vp-tag', t(c.eyebrow)));
    body.append(h(doc, 'h2', 'vp-card-title', t(c.title)));
    if (c.text) body.appendChild(h(doc, 'p', 'vp-card-text', t(c.text)));
    body.appendChild(emailForm(ctx, { placeholder: c.placeholder, button: c.button || 'Send me the guide', source: c.title }));
    card.append(book, body);
  },
  table(ctx, c, card) {
    const { doc, h, t } = ctx;
    card.appendChild(h(doc, 'h2', 'vp-card-title', t(c.title)));
    const table = h(doc, 'div', 'vp-table');
    table.setAttribute('role', 'table');
    const head = h(doc, 'div', 'vp-tr vp-tr--head');
    head.setAttribute('role', 'row');
    (c.cols || []).forEach((col) => { const x = h(doc, 'span', 'vp-td', col); x.setAttribute('role', 'columnheader'); head.appendChild(x); });
    table.appendChild(head);
    (c.items || []).forEach((it) => {
      const row = h(doc, 'div', 'vp-tr');
      row.setAttribute('role', 'row');
      const who = h(doc, 'span', 'vp-td vp-td--who');
      who.appendChild(h(doc, 'i', 'vp-dot', (it.title || '?').slice(0, 1).toUpperCase()));
      who.appendChild(h(doc, 'b', '', it.title));
      row.appendChild(who);
      if (it.text) row.appendChild(h(doc, 'span', 'vp-td', it.text));
      if (it.value) row.appendChild(h(doc, 'span', 'vp-td', it.value));
      if (it.tag) row.appendChild(h(doc, 'span', 'vp-td vp-td--tag', it.tag));
      table.appendChild(row);
    });
    card.appendChild(table);
  },
  stats(ctx, c, card) {
    const { doc, h, t } = ctx;
    card.appendChild(h(doc, 'h2', 'vp-card-title', t(c.title)));
    const grid = h(doc, 'div', 'vp-stats');
    (c.items || []).forEach((it) => {
      const s = h(doc, 'div', 'vp-stat');
      if (it.icon) s.appendChild(icon(doc, it.icon, 'vp-ico vp-stat-ico'));
      s.append(h(doc, 'b', 'vp-stat-value', it.value), h(doc, 'span', 'vp-stat-label', it.title));
      grid.appendChild(s);
    });
    card.appendChild(grid);
  },
  checklist(ctx, c, card) {
    const { doc, h, t } = ctx;
    card.appendChild(h(doc, 'h2', 'vp-card-title', t(c.title)));
    const ul = h(doc, 'ul', 'vp-checks');
    (c.items || []).forEach((it) => {
      const li = h(doc, 'li', 'vp-check');
      li.append(icon(doc, 'check', 'vp-ico vp-check-ico'), h(doc, 'span', '', it.title));
      ul.appendChild(li);
    });
    card.appendChild(ul);
  },
  quotes(ctx, c, card) {
    const { doc, h, t } = ctx;
    if (c.title) card.appendChild(h(doc, 'h2', 'vp-card-title', t(c.title)));
    (c.items || []).forEach((it) => {
      const q = h(doc, 'figure', 'vp-q');
      const who = h(doc, 'div', 'vp-q-who');
      who.appendChild(h(doc, 'i', 'vp-dot vp-dot--lg', (it.by || '?').slice(0, 1).toUpperCase()));
      const meta = h(doc, 'div', 'vp-q-meta');
      meta.append(h(doc, 'b', '', it.by), h(doc, 'span', '', it.title));
      who.appendChild(meta);
      q.append(h(doc, 'blockquote', 'vp-q-text', `“${t(it.text)}”`), who, stars(doc));
      card.appendChild(q);
    });
  },
  steps(ctx, c, card) {
    const { doc, h, t } = ctx;
    if (c.title) card.appendChild(h(doc, 'h2', 'vp-card-title vp-card-title--big', t(c.title)));
    const ol = h(doc, 'ol', 'vp-steps');
    (c.items || []).forEach((it, i) => {
      const li = h(doc, 'li', 'vp-step');
      li.appendChild(h(doc, 'span', 'vp-step-n', String(i + 1)));
      if (it.icon) li.appendChild(icon(doc, it.icon, 'vp-ico vp-step-ico'));
      li.append(h(doc, 'b', 'vp-step-title', t(it.title)), h(doc, 'span', 'vp-step-text', t(it.text)));
      ol.appendChild(li);
    });
    card.appendChild(ol);
  },
  features(ctx, c, card) {
    const { doc, h, t } = ctx;
    if (c.title) card.appendChild(h(doc, 'h2', 'vp-card-title', t(c.title)));
    const ul = h(doc, 'ul', 'vp-feats');
    (c.items || []).forEach((it) => {
      const li = h(doc, 'li', 'vp-feat');
      li.appendChild(icon(doc, it.icon || 'check', 'vp-ico vp-feat-ico'));
      const body = h(doc, 'div', 'vp-feat-body');
      body.append(h(doc, 'b', '', t(it.title)));
      if (it.text) body.appendChild(h(doc, 'span', '', t(it.text)));
      li.appendChild(body);
      ul.appendChild(li);
    });
    card.appendChild(ul);
  },
  faq(ctx, c, card) {
    const { doc, h, t } = ctx;
    if (c.title) card.appendChild(h(doc, 'h2', 'vp-card-title', t(c.title)));
    (c.items || []).forEach((it) => {
      const d = h(doc, 'details', 'vp-faq');
      d.append(h(doc, 'summary', 'vp-faq-q', t(it.title)));
      if (it.text) d.appendChild(h(doc, 'p', 'vp-faq-a', t(it.text)));
      card.appendChild(d);
    });
  },
  kpi(ctx, c, card) {
    const { doc, h, t } = ctx;
    const top = h(doc, 'div', 'vp-kpi-top');
    top.append(icon(doc, 'users', 'vp-ico'), h(doc, 'span', '', t(c.title)));
    card.append(top, h(doc, 'b', 'vp-kpi-value', c.value), sparkline(doc));
    if (c.text) card.appendChild(h(doc, 'span', 'vp-kpi-note', t(c.text)));
  },
};

export const CARD_TYPES = Object.freeze(Object.keys(CARD_BUILDERS));

function buildCard(ctx, c) {
  const { doc, h } = ctx;
  const card = h(doc, 'section', `vp-card vp-card--${c.type} vp-w${c.w || 4}`);
  CARD_BUILDERS[c.type]?.(ctx, c, card);
  return card;
}

function buildStrip(ctx, strip) {
  const { doc, h, t } = ctx;
  if (!strip || !strip.items.length) return null;
  const el = h(doc, 'section', `vp-strip vp-strip--${strip.kind}`);
  if (strip.title) el.appendChild(h(doc, 'div', 'vp-strip-title', t(strip.title)));
  const row = h(doc, 'div', 'vp-strip-row');
  strip.items.forEach((it) => {
    const item = h(doc, 'div', 'vp-strip-item');
    if (strip.kind === 'benefits') {
      item.appendChild(icon(doc, it.icon || 'check', 'vp-ico vp-strip-ico'));
      const txt = h(doc, 'div', 'vp-strip-text');
      txt.appendChild(h(doc, 'b', '', t(it.title)));
      if (it.text) txt.appendChild(h(doc, 'span', '', t(it.text)));
      item.appendChild(txt);
    } else if (strip.kind === 'stats') {
      item.append(h(doc, 'b', 'vp-strip-value', it.value), h(doc, 'span', 'vp-strip-label', t(it.title)));
    } else {
      item.appendChild(h(doc, 'span', 'vp-logo-word', t(it.title)));
    }
    row.appendChild(item);
  });
  el.appendChild(row);
  return el;
}

function siteLayout(ctx) {
  const { doc, h, mark, root, config, frame, blocks: b, t } = ctx;
  const site = config.site;
  root.replaceChildren();
  const page = h(doc, 'div', `vp-site vp-site--${site.hero.variant}`);

  // ---- nav
  const nav = h(doc, 'header', 'vp-sitenav');
  const brand = h(doc, 'div', 'vp-sitebrand');
  brand.append(mark(doc, { imageUrl: config.theme.logoUrl, name: config.brand.name, className: 'vp-mark--sender' }));
  if (config.brand.name) brand.appendChild(h(doc, 'span', 'vp-brand-name', config.brand.name));
  nav.appendChild(brand);
  const links = h(doc, 'nav', 'vp-navlinks');
  links.setAttribute('aria-label', 'Site');
  site.nav.links.forEach((l) => {
    const href = safeUrl(l.url);
    const node = href ? h(doc, 'a', 'vp-navlink', l.label) : h(doc, 'span', 'vp-navlink', l.label);
    if (href) { node.href = href; if (/^https?:/i.test(href)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; } }
    links.appendChild(node);
  });
  const right = h(doc, 'div', 'vp-navright');
  if (site.nav.login) {
    const href = safeUrl(site.nav.loginUrl);
    const a = href ? h(doc, 'a', 'vp-navlogin', site.nav.login) : h(doc, 'span', 'vp-navlogin', site.nav.login);
    if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    right.appendChild(a);
  }
  if (site.nav.cta) {
    const btn = h(doc, 'button', 'vp-navcta', site.nav.cta);
    btn.type = 'button';
    btn.addEventListener('click', () => (b.form || b.copy)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }));
    right.appendChild(btn);
  }
  nav.append(links, right);

  // ---- hero: copy | video | form (order per variant, done in CSS grid areas)
  const hero = h(doc, 'section', 'vp-sitehero');
  const copy = h(doc, 'div', 'vp-sh-copy');
  if (site.hero.eyebrow) copy.appendChild(h(doc, 'span', 'vp-eyebrow vp-eyebrow--pill', t(site.hero.eyebrow)));
  if (b.copy) copy.appendChild(b.copy);
  if (site.hero.bullets.length) {
    const ul = h(doc, 'ul', 'vp-bullets');
    site.hero.bullets.forEach((x) => {
      const li = h(doc, 'li', 'vp-bullet');
      li.append(icon(doc, 'check', 'vp-ico vp-bullet-ico'), h(doc, 'span', '', t(x)));
      ul.appendChild(li);
    });
    copy.appendChild(ul);
  }
  const hasActions = !!b.actions?.children.length;
  if (hasActions && site.hero.actions === 'copy') copy.appendChild(b.actions);

  const vid = h(doc, 'div', 'vp-sh-video');
  vid.appendChild(b.media);
  if (site.hero.chip) {
    const chip = h(doc, 'div', 'vp-chip', t(site.hero.chip));
    frame.appendChild(chip);
  }

  const formWrap = h(doc, 'div', 'vp-sh-form');
  if (b.form) {
    formWrap.appendChild(b.form);
    if (hasActions && site.hero.actions === 'form') {
      formWrap.appendChild(h(doc, 'div', 'vp-or', 'or'));
      formWrap.appendChild(b.actions);
    }
  } else if (hasActions && site.hero.actions === 'form') {
    formWrap.appendChild(b.actions);
  }
  hero.append(...present(copy, vid), ...(formWrap.children.length ? [formWrap] : []));

  // ---- proof strip + cards
  const strip = buildStrip(ctx, site.strip);
  const cards = h(doc, 'div', 'vp-cards');
  site.cards.forEach((c) => cards.appendChild(buildCard(ctx, c)));
  // Blocks the owner turned on elsewhere in the editor still appear (calendar, transcript, story, sections, quote, logos).
  const extras = present(b.calendar, b.transcript, b.story, ...b.sections, b.quote, b.logos);
  extras.forEach((n) => { const w = h(doc, 'section', 'vp-card vp-card--block vp-w6'); w.appendChild(n); cards.appendChild(w); });

  // ---- sign-up band
  let band = null;
  if (site.band.title) {
    band = h(doc, 'section', 'vp-band');
    const inner = h(doc, 'div', 'vp-wrap vp-band-in');
    const txt = h(doc, 'div', 'vp-band-text');
    txt.appendChild(h(doc, 'b', 'vp-band-title', t(site.band.title)));
    if (site.band.text) txt.appendChild(h(doc, 'span', '', t(site.band.text)));
    inner.append(txt, emailForm(ctx, { placeholder: site.band.placeholder, button: site.band.button, source: site.band.title, className: 'vp-mini--band' }));
    if (site.band.social) inner.appendChild(h(doc, 'div', 'vp-social', site.band.social));
    band.appendChild(inner);
  }

  const topBand = h(doc, 'div', 'vp-site-top');
  const topWrap = h(doc, 'div', 'vp-wrap');
  topWrap.append(nav, hero);
  topBand.appendChild(topWrap);
  page.appendChild(topBand);
  const body = h(doc, 'div', 'vp-wrap vp-site-body');
  if (strip) body.appendChild(strip);
  if (cards.children.length) body.appendChild(cards);
  if (body.children.length) page.appendChild(body);
  if (band) page.appendChild(band);
  root.appendChild(page);
  if (b.foot) root.appendChild(b.foot);
  if (b.consent) root.appendChild(b.consent);
}

export const composeSite = siteLayout;
