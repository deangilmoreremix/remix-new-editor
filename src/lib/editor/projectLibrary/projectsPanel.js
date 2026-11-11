/**
 * Projects panel: list/grid of saved timeline projects with search, filters,
 * sorting, cards and a six-tab detail view. DOM-only (matches the editor's
 * panel pattern); all I/O comes through injected `deps`.
 *
 * deps:
 *   getClient(): Promise<supabase client>
 *   getPublished(ids): Promise<{[projectId]: {id, published, slug?}}>
 *   getStats(ids):     Promise<{[projectId]: stats}|null>   (null/absent => unavailable)
 *   getCurrentProjectId(): string|null
 *   onOpen(row), onCreate(), onPreview(row), onExport(row),
 *   onShare(row), onToast(msg, type)
 *   tabs?: { analytics, audience, retarget, notifications }  each (host, ctx) => void
 */
import {
  listProjects, loadProject, renameProject, duplicateProject, deleteProject, toCard, filterCards,
} from './projectStore.js';

export const DETAIL_TABS = Object.freeze([
  ['overview', 'Overview'],
  ['analytics', 'Analytics'],
  ['audience', 'Audience'],
  ['retarget', 'Retarget'],
  ['notifications', 'Notifications'],
  ['share', 'Publish & Share'],
]);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtDuration = (s) => {
  if (s == null) return '—';
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
export const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const metric = (v, suffix = '') => (v == null ? '<span class="prj-na" title="Not collected yet">—</span>' : `${v}${suffix}`);
const RENDER_LABEL = { not_rendered: 'Not rendered', rendering: 'Rendering', complete: 'Rendered', failed: 'Render failed' };

export function renderProjectsPanel(host, deps) {
  const ui = { view: 'grid', search: '', published: 'all', render: 'all', followUp: false, sort: 'updated', selected: null, tab: 'overview' };
  let cards = [];
  let rows = {};
  let loading = true;
  let error = null;
  let alive = true;
  let unread = null;
  let tabCleanup = null; // set by tabs that mount something (e.g. React) and need tearing down

  host.classList.add('prj-root');
  host.innerHTML = `
    <div class="prj-title"><div><h3 class="prj-h">My Video Projects</h3><p class="prj-sub">Everything you have saved, published and measured</p></div><span class="prj-pill">Timeline Editor</span></div>
    <div class="prj-summary" data-role="summary"></div>
    <div class="prj-head">
      <label class="prj-searchbox"><span aria-hidden="true">⌕</span><input class="prj-search" type="search" placeholder="Search projects..." aria-label="Search projects" /></label>
      <button type="button" class="prj-filter-btn" data-toggle-filters aria-expanded="false" aria-controls="prj-filters" aria-label="Filters and sorting">☰</button>
      <button class="primary-btn prj-new" type="button">＋ New project</button>
    </div>
    <div class="prj-filters" id="prj-filters" role="group" aria-label="Project filters" hidden>
      <select class="text-input" data-f="published" aria-label="Published status">
        <option value="all">All</option><option value="published">Published</option><option value="unpublished">Unpublished</option></select>
      <select class="text-input" data-f="render" aria-label="Render status">
        <option value="all">Any render</option><option value="not_rendered">Not rendered</option><option value="complete">Rendered</option><option value="failed">Failed</option></select>
      <select class="text-input" data-f="sort" aria-label="Sort">
        <option value="updated">Last modified</option><option value="created">Created</option><option value="name">Name</option>
        <option value="viewed">Most viewed</option><option value="engaged">Most engaged</option><option value="leads">Most leads</option></select>
      <label class="prj-chk"><input type="checkbox" data-f="followUp" /> Needs follow-up</label>
      <span class="prj-views" role="group" aria-label="View">
        <button type="button" class="mini-btn active" data-view="grid" aria-pressed="true">▦</button>
        <button type="button" class="mini-btn" data-view="list" aria-pressed="false">☰</button>
      </span>
    </div>
    <div class="prj-body" data-role="body"></div>
    <div class="prj-detail" data-role="detail" hidden></div>`;

  const $ = (s) => host.querySelector(s);
  const body = $('[data-role="body"]');
  host.querySelector('[data-toggle-filters]').addEventListener('click', (e) => { const f = $('#prj-filters'); f.hidden = !f.hidden; e.currentTarget.setAttribute('aria-expanded', String(!f.hidden)); });
  const detail = $('[data-role="detail"]');

  const toast = (m, t) => deps.onToast?.(m, t);

  async function refresh() {
    loading = true; error = null; draw();
    try {
      const client = await deps.getClient();
      const list = await listProjects(client, { limit: 200 });
      const ids = list.map((r) => r.id);
      const [pub, stats] = await Promise.all([
        deps.getPublished ? deps.getPublished(ids).catch(() => ({})) : {},
        deps.getStats ? deps.getStats(ids).catch(() => null) : null,
      ]);
      unread = deps.getUnread ? await deps.getUnread().catch(() => null) : null;
      rows = Object.fromEntries(list.map((r) => [r.id, r]));
      cards = list.map((r) => toCard(r, { published: pub?.[r.id] || null, stats: stats?.[r.id] || null }));
    } catch (e) {
      error = e.message || 'Could not load projects';
    }
    loading = false;
    if (alive) draw();
  }

  function summaryHtml() {
    const published = cards.filter((c) => c.published).length;
    const withStats = cards.filter((c) => c.hasStats);
    const sum = (k) => (withStats.length ? withStats.reduce((a, c) => a + (c[k] || 0), 0) : null);
    const compact = (v) => (v == null ? '—' : v >= 10000 ? `${(v / 1000).toFixed(1)}K`.replace('.0K', 'K') : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v));
    const main = [['Published videos', published], ['Total plays · 30 days', sum('plays')], ['Leads · 30 days', sum('leads')]];
    const rest = [['CTA clicks', sum('ctaClicks')], ['Unread alerts', unread], ['Follow-ups', cards.filter((c) => c.needsFollowUp).length]];
    // Per-video unique viewers are intentionally NOT summed here (would not be unique people).
    return `<div class="prj-stats-main">${main.map(([l, v]) => `<div class="prj-stat prj-stat-lg"><span>${l}</span><b>${compact(v)}</b></div>`).join('')}</div>
      <div class="prj-stats-rest">${rest.map(([l, v]) => `<div class="prj-stat"><b>${compact(v)}</b><span>${l}</span></div>`).join('')}</div>`;
  }

  /** The one obvious next step for a project. */
  function primaryAction(c) {
    if (!c.published) return ['publish', 'Publish'];
    if (c.needsFollowUp) return ['retarget', 'Retarget'];
    return ['analytics', 'Analytics'];
  }

  function cardHtml(c) {
    const active = deps.getCurrentProjectId?.() === c.id;
    const [act, label] = primaryAction(c);
    const thumb = c.thumbnailUrl
      ? `<img src="${esc(c.thumbnailUrl)}" alt="" loading="lazy" />`
      : '<div class="prj-thumb-empty" aria-hidden="true">🎬</div>';
    return `
      <article class="prj-card${active ? ' is-current' : ''}" data-id="${esc(c.id)}" tabindex="0" aria-label="${esc(c.name)}">
        <div class="prj-thumb">${thumb}${c.unreadNotifications ? `<span class="prj-badge" title="Unread notifications">${c.unreadNotifications}</span>` : ''}</div>
        <div class="prj-meta">
          <h4 class="prj-name">${esc(c.name)}</h4>
          <div class="prj-tags">
            <span class="prj-chip prj-status ${c.published ? 'is-published' : ''}">${c.published ? 'Published' : 'Draft'}</span>
            <span class="prj-chip">${RENDER_LABEL[c.renderStatus] || esc(c.renderStatus)}</span>
            ${c.needsFollowUp ? '<span class="prj-chip">Follow-up</span>' : ''}
            ${c.parentProjectId ? '<span class="prj-chip">Follow-up video</span>' : ''}
          </div>
          <div class="prj-line"><span>${c.plays == null ? '<span class="prj-na" title="Not collected yet">—</span>' : Number(c.plays).toLocaleString('en-US')} plays</span><span>${c.completionPct == null ? '<span class="prj-na" title="Not enough data">—</span>' : `${c.completionPct}%`} complete</span></div>
          <div class="prj-sub">${fmtDuration(c.durationS)} · ${esc(c.aspectRatio || '—')} · Edited ${fmtDate(c.updatedAt)}</div>
        </div>
        <div class="prj-actions">
          <button type="button" class="prj-primary" data-act="${act}">${label}</button>
          <button type="button" class="mini-btn" data-act="open">Open in editor</button>
          <button type="button" class="mini-btn" data-act="details">Details</button>
          <button type="button" class="mini-btn" data-act="duplicate">Duplicate</button>
        </div>
      </article>`;
  }

  function draw() {
    $('[data-role="summary"]').innerHTML = loading || error ? '' : summaryHtml();
    body.className = `prj-body prj-${ui.view}`;
    if (loading) {
      body.innerHTML = '<div class="prj-skel" aria-busy="true"><i></i><i></i><i></i></div>';
      return;
    }
    if (error) {
      body.innerHTML = `<div class="prj-empty" role="alert"><p>${esc(error)}</p><button class="mini-btn" data-act="retry">Try again</button></div>`;
      return;
    }
    if (!cards.length) {
      body.innerHTML = '<div class="prj-empty"><p><b>No projects yet.</b><br>Save your timeline to see it here.</p><button class="primary-btn" data-act="create">Save current timeline as project</button></div>';
      return;
    }
    const shown = filterCards(cards, ui);
    if (!shown.length) {
      body.innerHTML = '<div class="prj-empty"><p>No projects match these filters.</p></div>';
      return;
    }
    body.innerHTML = shown.map(cardHtml).join('');
  }

  // -------------------------------------------------------------- detail
  function openDetail(id, tab = 'overview') {
    ui.selected = id; ui.tab = tab;
    drawDetail();
  }
  function closeDetail() { ui.selected = null; drawDetail(); }
  const openTab = (tab, opts = {}) => { ui.tab = tab; ui.tabOpts = opts; drawDetail(); };

  function drawDetail() {
    if (tabCleanup) { try { tabCleanup(); } catch { /* already unmounted */ } tabCleanup = null; }
    const c = cards.find((x) => x.id === ui.selected);
    const chrome = [...host.querySelectorAll('.prj-title, .prj-summary, .prj-head, .prj-filters')];
    if (!c) { detail.hidden = true; detail.innerHTML = ''; body.hidden = false; chrome.forEach((e) => { if (!e.matches('.prj-filters')) e.hidden = false; }); return; }
    // The list's title, stats and search are replaced by the project's own header while its detail is open.
    body.hidden = true; detail.hidden = false; chrome.forEach((e) => { e.hidden = true; });
    detail.innerHTML = `
      <div class="prj-detail-head">
        <button type="button" class="mini-btn" data-act="back">← Projects</button>
        <h3>${esc(c.name)}</h3>
      </div>
      <div class="prj-tabs" role="tablist">${DETAIL_TABS.map(([k, l]) =>
        `<button type="button" role="tab" class="mini-btn${k === ui.tab ? ' active' : ''}" aria-selected="${k === ui.tab}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="prj-tabpanel" data-role="tabpanel" role="tabpanel"></div>`;
    const panel = detail.querySelector('[data-role="tabpanel"]');
    const ctx = { project: rows[c.id], card: c, deps, refresh, openTab };
    if (ui.tab === 'overview') overviewTab(panel, c);
    else if (ui.tab === 'share') shareTab(panel, c);
    else if (deps.tabs?.[ui.tab]) { const r = deps.tabs[ui.tab](panel, ctx, ui.tabOpts || {}); ui.tabOpts = {}; if (typeof r === 'function') tabCleanup = r; }
    else panel.innerHTML = `<div class="prj-empty"><p>${c.published
      ? 'No data has been collected for this video yet.'
      : 'Publish this video to start collecting viewer data.'}</p></div>`;
  }

  function overviewTab(panel, c) {
    panel.innerHTML = `
      <div class="prj-ov">
        <div class="prj-thumb prj-thumb-lg">${c.thumbnailUrl ? `<img src="${esc(c.thumbnailUrl)}" alt="" />` : '<div class="prj-thumb-empty">🎬</div>'}</div>
        <dl class="prj-facts">
          <div><dt>Created</dt><dd>${fmtDate(c.createdAt)}</dd></div>
          <div><dt>Last modified</dt><dd>${fmtDate(c.updatedAt)}</dd></div>
          <div><dt>Duration</dt><dd>${fmtDuration(c.durationS)}</dd></div>
          <div><dt>Aspect ratio</dt><dd>${esc(c.aspectRatio || '—')}</dd></div>
          <div><dt>Render</dt><dd>${RENDER_LABEL[c.renderStatus] || esc(c.renderStatus)}</dd></div>
          <div><dt>Status</dt><dd>${c.published ? 'Published' : 'Not published'}</dd></div>
        </dl>
      </div>
      <div class="prj-actions prj-actions-wrap">
        <button type="button" class="primary-btn" data-act="open">Open in Timeline Editor</button>
        <button type="button" class="mini-btn" data-act="preview">Preview</button>
        <button type="button" class="mini-btn" data-act="export">Render / export</button>
        <button type="button" class="mini-btn" data-act="rename">Rename</button>
        <button type="button" class="mini-btn" data-act="duplicate">Duplicate</button>
        <button type="button" class="mini-btn prj-danger" data-act="delete">Delete</button>
      </div>`;
  }

  function shareTab(panel, c) {
    const link = c.publishedId ? `${globalThis.location?.origin || ''}/watch/${encodeURIComponent(c.publishedId)}` : null;
    panel.innerHTML = `
      <p>${c.published ? 'This video is live on its hosted player, which is where clicks, calls and forms are tracked. An exported MP4 cannot contain clickable overlays.' : 'Not published. Publishing creates a hosted interactive player; your editable project is kept.'}</p>
      ${link ? `<div class="prj-link"><input class="text-input" readonly value="${esc(link)}" aria-label="Share link" /><button type="button" class="mini-btn" data-act="copy" data-link="${esc(link)}">Copy link</button></div>` : ''}
      <div class="prj-actions prj-actions-wrap"><button type="button" class="primary-btn" data-act="share">${c.published ? 'Manage publishing' : 'Publish video'}</button></div>`;
  }

  // -------------------------------------------------------------- events
  async function act(name, id, el) {
    const row = rows[id];
    try {
      if (name === 'open') await deps.onOpen(row ? await loadProject(await deps.getClient(), id) : row);
      else if (name === 'details') openDetail(id);
      else if (name === 'analytics') openDetail(id, 'analytics');
      else if (name === 'retarget') openDetail(id, 'retarget');
      else if (name === 'publish') deps.onShare?.(row);
      else if (name === 'preview') deps.onPreview?.(row);
      else if (name === 'export') deps.onExport?.(row);
      else if (name === 'share') deps.onShare?.(row);
      else if (name === 'copy') { await navigator.clipboard?.writeText(el.dataset.link); toast('Link copied', 'success'); }
      else if (name === 'rename') {
        const next = globalThis.prompt('Rename project', row?.name || '');
        if (next && next.trim()) { await renameProject(await deps.getClient(), id, next); toast('Renamed', 'success'); await refresh(); drawDetail(); }
      } else if (name === 'duplicate') {
        await duplicateProject(await deps.getClient(), id); toast('Project duplicated', 'success'); await refresh();
      } else if (name === 'delete') {
        if (globalThis.confirm(`Delete "${row?.name}"? Published links will stop working only if you unpublish them.`)) {
          await deleteProject(await deps.getClient(), id); toast('Project deleted', 'success'); ui.selected = null; await refresh(); drawDetail();
        }
      }
    } catch (e) { toast(e.message || 'Action failed', 'error'); }
  }

  host.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-tab],[data-view]');
    if (!t || !host.contains(t)) return;
    if (t.dataset.view) {
      ui.view = t.dataset.view;
      host.querySelectorAll('[data-view]').forEach((b) => { const on = b === t; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
      draw(); return;
    }
    if (t.dataset.tab) { ui.tab = t.dataset.tab; ui.tabOpts = {}; drawDetail(); return; }
    const a = t.dataset.act;
    if (a === 'retry') return refresh();
    if (a === 'create') return deps.onCreate?.().then?.(refresh);
    if (a === 'back') return closeDetail();
    const id = t.closest('.prj-card')?.dataset.id || ui.selected;
    if (id) act(a, id, t);
  });
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList?.contains('prj-card')) openDetail(e.target.dataset.id);
  });
  $('.prj-new').addEventListener('click', async () => { try { await deps.onCreate?.(); await refresh(); } catch (e) { toast(e.message, 'error'); } });
  let t = null;
  $('.prj-search').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { ui.search = e.target.value; draw(); }, 150); });
  host.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('change', () => {
    ui[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; draw();
  }));

  refresh();
  return {
    refresh,
    openDetail,
    destroy() { alive = false; if (tabCleanup) { try { tabCleanup(); } catch { /* noop */ } tabCleanup = null; } },
    _state: () => ({ ui, cards }),
  };
}
