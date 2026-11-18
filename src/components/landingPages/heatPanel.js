// Heat maps for a landing page: where visitors click (drawn over the live page), how far they scroll, which video
// seconds they watch, and one row per personal link (the personalized video's viewer) with their leads.
// Data comes from the owner-only aggregated RPCs; cells below 3 sessions are never returned, so one visitor can't be picked out.

import { fetchPageHeat, fetchContactStats, listContacts, pageUrl } from '../../lib/landingPages/client.js';
import { heatCells } from '../../lib/landingPages/heat.js';
import { contactLabel } from './leadsPanel.js';

const INPUT = 'rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50';
const TAB = 'px-3 py-1.5 text-xs font-bold rounded-lg border';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const VIEWPORTS = [['all', 'All devices'], ['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']];
const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']];
const WIDTH = { all: 1280, desktop: 1280, tablet: 768, mobile: 390 };

/** Merge the heat rows, event counts and contact fields into the per-link table. */
export function contactRows({ heat, stats, contacts }) {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const heatBy = new Map(heat.map((h) => [h.contactId, h]));
  const statBy = new Map(stats.map((s) => [s.contactId, s]));
  const ids = new Set([...heatBy.keys(), ...statBy.keys()]);
  return [...ids].map((id) => {
    const h = heatBy.get(id) || {}; const s = statBy.get(id) || {};
    return {
      contactId: id, who: contactLabel(id, byId), views: s.views || 0, plays: s.plays || 0, watchedSeconds: h.watchedSeconds || 0,
      maxScroll: h.maxScroll || 0, clicks: h.clicks || 0, completed: s.completes || 0, leads: s.leads || 0, lastSeen: h.lastSeen || s.lastSeen || null,
    };
  }).sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')));
}

export function heatPanel({ page, getClient }) {
  const box = el('section', 'rounded-2xl border border-white/10 bg-panel-bg p-4 flex flex-col gap-3');
  box.appendChild(el('h3', 'text-sm font-extrabold uppercase tracking-wide', 'Heat maps'));
  if (!page.published) { box.appendChild(el('p', 'text-xs text-secondary', 'Publish the page to start collecting heat maps. Visitors on the public page are sampled; the editor preview is not.')); return box; }
  let view = 'clicks'; let viewport = 'all'; let days = 30;
  const bar = el('div', 'flex flex-wrap items-center gap-2');
  const out = el('div', '');
  const vpSel = el('select', INPUT); VIEWPORTS.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; vpSel.appendChild(o); });
  const rangeSel = el('select', INPUT); RANGES.forEach(([v, l]) => { const o = el('option', '', l); o.value = String(v); if (v === 30) o.selected = true; rangeSel.appendChild(o); });
  const tabs = {};
  [['clicks', 'Clicks'], ['scroll', 'Scroll depth'], ['watch', 'Video watched'], ['contacts', 'Personal links']].forEach(([id, label]) => {
    const b = el('button', TAB, label); b.type = 'button'; tabs[id] = b; b.addEventListener('click', () => { view = id; load(); }); bar.appendChild(b);
  });
  bar.append(vpSel, rangeSel);
  vpSel.addEventListener('change', () => { viewport = vpSel.value; load(); });
  rangeSel.addEventListener('change', () => { days = Number(rangeSel.value); load(); });
  box.append(bar, out);

  const paintTabs = () => Object.entries(tabs).forEach(([id, b]) => { b.className = `${TAB} ${id === view ? 'border-primary text-primary' : 'border-white/10 text-secondary hover:text-white'}`; });

  async function load() {
    paintTabs();
    out.replaceChildren(el('p', 'text-sm text-secondary', 'Loading…'));
    try {
      const client = await getClient();
      const to = new Date().toISOString(); const from = new Date(Date.now() - days * 86400000).toISOString();
      const heat = await fetchPageHeat(client, page.id, { from, to, viewport });
      if (view === 'clicks') return out.replaceChildren(clickMap(page, heat.clicks, viewport));
      if (view === 'scroll') return out.replaceChildren(scrollBars(heat.scroll));
      if (view === 'watch') return out.replaceChildren(watchBars(heat.watch));
      const [stats, contacts] = await Promise.all([fetchContactStats(client, page.id).catch(() => []), listContacts(client, page.id).catch(() => [])]);
      return out.replaceChildren(contactTable(contactRows({ heat: heat.contacts, stats, contacts })));
    } catch (err) {
      out.replaceChildren(el('p', 'text-sm text-red-300', err?.message || 'Could not load heat maps.'));
    }
  }
  load();
  return box;
}

const needMore = () => el('p', 'text-sm text-secondary', 'Not enough visits yet. A spot or second appears once at least 3 different visitors reached it, so no single visitor can be picked out.');

function clickMap(page, rows, viewport) {
  const cells = heatCells(rows);
  if (!cells.length) return needMore();
  const wrap = el('div', 'flex flex-col gap-2');
  const w = WIDTH[viewport] || 1280;
  const scroller = el('div', 'overflow-auto rounded-xl border border-white/10 bg-black'); scroller.style.maxHeight = '70vh';
  const stage = el('div', 'relative'); stage.style.width = `${w}px`; stage.style.margin = '0 auto';
  const frame = document.createElement('iframe');
  frame.src = `${pageUrl(page.id)}?embed=1`; frame.title = 'Your page'; frame.style.cssText = `width:${w}px;height:1600px;border:0;display:block`;
  const overlay = el('div', 'absolute inset-0 pointer-events-none');
  cells.forEach((c) => {
    const d = el('div', ''); d.title = `${c.clicks} click${c.clicks === 1 ? '' : 's'} from ${c.sessions} visitors`;
    d.style.cssText = `position:absolute;left:${c.left}%;top:${c.top}%;width:${c.size}%;height:${c.size}%;border-radius:50%;background:radial-gradient(circle, rgba(255,60,40,${0.25 + 0.6 * c.weight}), rgba(255,200,0,${0.12 + 0.3 * c.weight}) 60%, transparent 72%);transform:scale(${1.6 + c.weight});`;
    overlay.appendChild(d);
  });
  // The heat is positioned in permille of the page height, so the frame is sized to the page's real height once it loads.
  frame.addEventListener('load', () => { try { frame.style.height = `${frame.contentDocument.documentElement.scrollHeight}px`; } catch { /* cross-origin embed: keep the default height */ } });
  stage.append(frame, overlay); scroller.appendChild(stage);
  wrap.append(el('p', 'text-xs text-secondary', `${cells.reduce((n, c) => n + c.clicks, 0)} clicks in ${cells.length} hot spot${cells.length === 1 ? '' : 's'}. Warmer = more clicks. Only spots with 3 or more visitors are shown.`), scroller);
  return wrap;
}

function scrollBars(rows) {
  if (!rows.length) return needMore();
  const total = Number(rows[0].total_sessions) || 0;
  const wrap = el('div', 'flex flex-col gap-1');
  wrap.appendChild(el('p', 'text-xs text-secondary', `${total} visitors. Each bar is the share who scrolled at least that far.`));
  rows.forEach((r) => {
    const pct = total ? Math.round((Number(r.sessions) / total) * 100) : 0;
    const line = el('div', 'flex items-center gap-2 text-xs');
    const track = el('div', 'flex-1 h-3 rounded bg-white/10 overflow-hidden'); const fill = el('div', 'h-full bg-primary'); fill.style.width = `${pct}%`; track.appendChild(fill);
    line.append(el('span', 'w-10 text-secondary', `${r.depth}%`), track, el('span', 'w-10 text-right', `${pct}%`));
    wrap.appendChild(line);
  });
  return wrap;
}

function watchBars(rows) {
  if (!rows.length) return needMore();
  const max = Math.max(1, ...rows.map((r) => Number(r.sessions)));
  const wrap = el('div', 'flex flex-col gap-2');
  wrap.appendChild(el('p', 'text-xs text-secondary', 'How many visitors watched each second of the video. Dips show where people leave or skip.'));
  const chart = el('div', 'flex items-end gap-px h-32 overflow-x-auto');
  rows.slice(0, 600).forEach((r) => {
    const b = el('div', 'bg-primary/80 min-w-[3px] flex-1'); b.style.height = `${Math.max(4, (Number(r.sessions) / max) * 100)}%`; b.title = `${r.sec}s: ${r.sessions} visitors`;
    chart.appendChild(b);
  });
  wrap.appendChild(chart);
  return wrap;
}

function contactTable(rows) {
  if (!rows.length) return el('p', 'text-sm text-secondary', 'No one has opened a personal link yet. Each link\'s views, watch time, scroll, clicks and leads show here.');
  const t = el('table', 'w-full text-sm text-left');
  const th = el('tr', 'text-[11px] uppercase tracking-wide text-secondary');
  ['Who', 'Views', 'Plays', 'Seconds watched', 'Scrolled', 'Clicks', 'Watched to end', 'Leads', 'Last seen'].forEach((c) => th.appendChild(el('th', 'px-2 py-1 whitespace-nowrap', c)));
  t.appendChild(el('thead')).appendChild(th);
  const tb = el('tbody');
  rows.forEach((r) => {
    const tr = el('tr', 'border-t border-white/5');
    [r.who, r.views, r.plays, r.watchedSeconds, `${r.maxScroll}%`, r.clicks, r.completed, r.leads, r.lastSeen ? new Date(r.lastSeen).toLocaleString() : ''].forEach((v) => tr.appendChild(el('td', 'px-2 py-1 whitespace-nowrap', String(v))));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  const scroller = el('div', 'overflow-x-auto'); scroller.appendChild(t); return scroller;
}
