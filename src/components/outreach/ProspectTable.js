// src/components/outreach/ProspectTable.js
//
// The prospect table on Generate & share (Sendspark's dynamic-video prospect list): filters All / Generated /
// Sent / Watched, and per prospect their thumbnail, initials, name and email, company, website, status and how
// much they watched. Each row has Share (the Link / GIF / Embed window) and a ⋯ menu with the ways to send.
//
// renderProspectTable({ links, contacts, stats, filter, setFilter, total, onAddProspects, share(l), menu(l) })
//   stats: { [contactId]: { views, plays, completes, ctaClicks, progress } } or null while loading
//   menu(l): [{ label, attr, href? , onClick? }]
//   remove(l): delete this prospect (a Delete button on their row); leave out for no button

const el = (tag, cls = '', txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
const LOOK = {
  plain: 'border border-white/[0.08] bg-transparent text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.18]',
  primary: 'border border-white/[0.12] border-l-2 border-l-primary bg-transparent text-white/90 hover:text-white hover:bg-white/[0.06]',
  selected: 'border border-primary/25 bg-primary/[0.08] text-white/90',
};
function btn(label, { primary = false, selected = false } = {}) {
  const b = el('button', `inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${LOOK[selected ? 'selected' : primary ? 'primary' : 'plain']}`, label);
  b.type = 'button';
  return b;
}

export const FILTERS = [['all', 'All'], ['generated', 'Generated'], ['sent', 'Sent'], ['watched', 'Watched']];
const STATUS = {
  watched: ['Watched', 'bg-emerald-400'],
  sent: ['Sent', 'bg-amber-400'],
  generated: ['Generated', 'bg-sky-400'],
  generating: ['Generating', 'bg-orange-400'],
};

/** How far along a prospect is: watched (played) > sent (you sent their link) > generated > generating. */
export function prospectStatus(l, st) {
  if (st && (st.plays > 0 || st.progress > 0 || st.completes > 0 || st.ctaClicks > 0)) return 'watched';
  if (l.sentAt) return 'sent';
  return l.link ? 'generated' : 'generating';
}

/** The percentage watched, 0-100. */
export const watchedPct = (st) => Math.max(st?.progress || 0, st?.completes ? 100 : 0);

/** Counts per filter. A watched prospect also counts as sent and generated, like the funnel it is. */
export function filterCounts(links, stats) {
  const n = { all: links.length, generated: 0, sent: 0, watched: 0 };
  links.forEach((l) => {
    const s = prospectStatus(l, stats?.[l.contactId]);
    if (s !== 'generating') n.generated += 1;
    if (s === 'sent' || s === 'watched') n.sent += 1;
    if (s === 'watched') n.watched += 1;
  });
  return n;
}

export function filterLinks(links, stats, filter) {
  if (filter === 'all') return links;
  return links.filter((l) => {
    const s = prospectStatus(l, stats?.[l.contactId]);
    if (filter === 'watched') return s === 'watched';
    if (filter === 'sent') return s === 'sent' || s === 'watched';
    return s !== 'generating';
  });
}

export const initials = (name) => { const p = String(name || '').trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'; };
const COLORS = ['#6366f1', '#f97316', '#eab308', '#10b981', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444'];
export const avatarColor = (s) => COLORS[[...String(s || '')].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % COLORS.length];
const host = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, '');

const COLS = 'lg:grid-cols-[150px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_110px_80px_220px]';

export function renderProspectTable({ links = [], contacts = [], stats = null, filter = 'all', setFilter = () => {}, total = links.length, onAddProspects = () => {}, share = () => {}, menu = () => [], remove = null } = {}) {
  const box = el('div', 'flex flex-col gap-4');
  box.setAttribute('data-outreach-prospect-table', '');
  const generated = links.filter((l) => l.link).length;
  const head = el('div', 'flex flex-wrap items-center gap-3');
  const counts = filterCounts(links, stats);
  const tabs = el('div', 'mr-auto flex flex-wrap gap-2');
  tabs.setAttribute('role', 'tablist');
  FILTERS.forEach(([k, label]) => {
    const t = btn(`${label} ${counts[k]}`, { selected: filter === k });
    t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(filter === k)); t.setAttribute('data-prospect-filter', k);
    t.addEventListener('click', () => setFilter(k));
    tabs.appendChild(t);
  });
  const gen = el('span', 'text-sm text-white/50', `${generated} of ${total} generated`);
  gen.setAttribute('data-prospects-generated', '');
  const add = btn('Add Prospects', { primary: true });
  add.setAttribute('data-prospects-add', '');
  add.addEventListener('click', onAddProspects);
  head.append(tabs, gen, add);
  box.appendChild(head);

  const table = el('div', 'overflow-hidden rounded-2xl border border-white/10');
  const th = el('div', `hidden gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-white/45 lg:grid ${COLS}`);
  ['Thumbnail', 'Prospect', 'Company', 'Website', 'Status', 'Watched', ''].forEach((t) => th.appendChild(el('div', '', t)));
  table.appendChild(th);
  const rows = filterLinks(links, stats, filter);
  if (!rows.length) table.appendChild(el('p', 'px-4 py-6 text-sm text-white/45', filter === 'all' ? 'No prospects yet.' : 'No prospects here yet.'));
  rows.forEach((l) => {
    const c = contacts.find((x) => x.id === l.contactId) || {};
    const st = stats?.[l.contactId] || null;
    const status = prospectStatus(l, st);
    const row = el('div', `grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-white/5 px-4 py-3 last:border-b-0 ${COLS}`);
    row.setAttribute('data-outreach-link-row', l.contactId || '');
    row.setAttribute('data-status', status);
    const thumb = el('div', 'row-span-3 aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] lg:row-span-1');
    thumb.setAttribute('data-outreach-row-thumb', '');
    if (l.thumbnailUrl) { const img = el('img', 'h-full w-full object-cover'); img.src = l.thumbnailUrl; img.alt = `Thumbnail for ${l.name || 'this prospect'}`; img.loading = 'lazy'; thumb.appendChild(img); }
    else thumb.appendChild(el('span', 'grid h-full place-items-center text-[10px] text-white/35', 'No thumbnail'));
    const who = el('div', 'flex min-w-0 items-center gap-3');
    const av = el('span', 'grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white', initials(l.name || l.email));
    av.style.background = avatarColor(l.name || l.email);
    const words = el('div', 'min-w-0');
    words.append(el('div', 'truncate text-sm font-bold', l.name || '(no name)'), el('div', 'truncate text-xs text-white/50', l.email || ''));
    if (l.heard) { const h = el('div', 'truncate text-[11px] text-white/40', `Hears: “${l.heard}”`); h.setAttribute('data-outreach-heard', ''); words.appendChild(h); }
    who.append(av, words);
    const company = el('div', 'truncate text-sm text-white/80', c.company || l.company || '');
    const site = el('div', 'flex min-w-0 flex-col items-start gap-1 text-sm');
    if (c.website) { const a = el('a', 'max-w-full truncate text-primary hover:underline', host(c.website)); a.href = /^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`; a.target = '_blank'; a.rel = 'noopener noreferrer'; site.appendChild(a); }
    // Sendspark's orange fallback indicator: this prospect's video shows the fallback website.
    if (l.site === 'fallback') {
      const f = el('span', 'inline-flex rounded-full border border-orange-400/40 bg-orange-400/10 px-2 py-0.5 text-[10px] font-bold text-orange-300', 'Fallback');
      f.title = l.siteError ? 'Their website returned an error, so their video uses your fallback website.' : 'No website, so their video uses your fallback website.';
      f.setAttribute('data-outreach-fallback', l.siteError ? 'error' : 'none');
      site.appendChild(f);
    }
    const [label, dot] = STATUS[status];
    const stEl = el('div', 'flex items-center gap-2 text-sm');
    stEl.setAttribute('data-outreach-status', status);
    stEl.append(el('span', `h-2 w-2 rounded-full ${dot}`), el('span', '', label));
    const pct = watchedPct(st);
    const watch = el('div', 'text-sm font-bold tabular-nums', st ? `${pct}%` : '–');
    watch.setAttribute('data-outreach-watch', String(pct));
    if (st?.ctaClicks) watch.title = 'Clicked your button';
    const acts = el('div', 'relative flex items-center gap-2 lg:justify-end');
    const sh = btn('Share', { primary: true });
    sh.setAttribute('data-outreach-share', '');
    sh.addEventListener('click', () => share(l));
    const more = btn('⋯');
    more.setAttribute('aria-label', `More ways to send to ${l.name || 'this prospect'}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('data-outreach-more', '');
    const pop = el('div', 'absolute right-0 top-full z-20 mt-1 hidden w-48 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#14151a] py-1 shadow-2xl');
    pop.setAttribute('role', 'menu');
    menu(l).forEach((m) => {
      const item = el(m.href ? 'a' : 'button', 'px-4 py-2 text-left text-sm text-white/80 hover:bg-white/[0.06] hover:text-white', m.label);
      if (m.href) { item.href = m.href; if (!/^mailto:/.test(m.href)) { item.target = '_blank'; item.rel = 'noopener noreferrer'; } } else item.type = 'button';
      item.setAttribute('role', 'menuitem');
      if (m.attr) item.setAttribute(m.attr, '');
      if (m.disabled) { item.setAttribute('aria-disabled', 'true'); item.classList.add('pointer-events-none', 'opacity-40'); }
      item.addEventListener('click', (e) => { m.onClick?.(e, item); });
      pop.appendChild(item);
    });
    more.addEventListener('click', () => { pop.classList.toggle('hidden'); pop.classList.toggle('flex'); });
    acts.append(sh, more, pop);
    if (remove) {
      const del = btn('Delete');
      del.setAttribute('aria-label', `Delete ${l.name || 'this prospect'}`);
      del.setAttribute('data-outreach-delete', '');
      del.classList.add('hover:!text-red-300', 'hover:!border-red-400/40');
      del.addEventListener('click', () => remove(l));
      acts.insertBefore(del, pop);
    }
    row.append(thumb, who, company, site, stEl, watch, acts);
    table.appendChild(row);
  });
  box.appendChild(table);
  return box;
}
