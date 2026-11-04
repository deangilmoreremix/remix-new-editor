/**
 * Stock media browser (Pixabay + Pexels, videos + images) used by the
 * timeline's Stock Media panel. Pure DOM; searching is injected.
 *
 * renderStockBrowser(container, {
 *   search(kind, source, query) → Promise<{ ok, items, error }>,
 *   onPick(item, kind),            // item from stockMedia.js normalizers
 *   kinds: ['videos', 'images'],
 *   sources: [['pixabay','Pixabay'], ['pexels','Pexels']],
 *   suggestions: { videos: [...], images: [...] },
 * })
 */
import { STOCK_SOURCES, STOCK_HOME } from './stockMedia.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const STOCK_SUGGESTIONS = {
  videos: ['business', 'city', 'nature', 'technology', 'people', 'abstract background'],
  images: ['office', 'team', 'product', 'background', 'technology', 'sky'],
};

export function renderStockBrowser(container, {
  search, onPick, kinds = ['videos', 'images'], sources = STOCK_SOURCES, suggestions = STOCK_SUGGESTIONS,
} = {}) {
  const st = { kind: kinds[0], source: sources[0][0], query: suggestions[kinds[0]]?.[0] || '', results: {}, busy: null };
  const keyOf = () => `${st.source}:${st.kind}:${st.query.toLowerCase()}`;

  const draw = () => {
    const res = st.results[keyOf()];
    const sourceLabel = (sources.find(([id]) => id === st.source) || [st.source, st.source])[1];
    let body;
    if (!st.query) body = '<p class="addon-field__hint">Search for footage or photos.</p>';
    else if (!res || res.loading) body = '<p class="addon-field__hint">Loading…</p>';
    else if (res.error) body = `<p class="addon-field__hint addon-field__hint--error">${esc(res.error)}</p>`;
    else if (!res.items.length) body = '<p class="addon-field__hint">Nothing found.</p>';
    else {
      body = `<div class="stock-grid" role="list">${res.items.map((it, i) => `
        <button type="button" role="listitem" class="stock-item${st.busy === it.id ? ' is-busy' : ''}" data-stock-pick="${i}" title="${esc(it.name)}${it.user ? ` by ${esc(it.user)}` : ''} — add to timeline" style="background-image:url(${esc(JSON.stringify(String(it.thumbnail || it.preview || '')))})">
          ${st.kind === 'videos' ? `<span class="addon-video-dur">${Math.round(it.duration || 0)}s</span>` : ''}
          <span class="stock-item__add" aria-hidden="true">＋</span>
        </button>`).join('')}</div>`;
    }
    container.innerHTML = `
      <div class="stock-browser">
        <div class="addon-tabs">${kinds.map((k) => `<button type="button" class="mini-btn addon-tab${k === st.kind ? ' active' : ''}" data-stock-kind="${k}">${k === 'videos' ? '🎬 Videos' : '🖼️ Images'}</button>`).join('')}</div>
        <div class="addon-tabs">${sources.map(([id, l]) => `<button type="button" class="mini-btn addon-tab${id === st.source ? ' active' : ''}" data-stock-source="${id}">${esc(l)}</button>`).join('')}</div>
        <form class="addon-video-search stock-search"><input type="search" class="stock-query" placeholder="Search ${esc(sourceLabel)} ${st.kind}" value="${esc(st.query)}" aria-label="Search stock ${st.kind}"/><button type="submit" class="mini-btn">Search</button></form>
        <div class="stock-suggestions">${(suggestions[st.kind] || []).map((q) => `<button type="button" class="stock-chip${q === st.query ? ' is-on' : ''}" data-stock-query="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        ${body}
        <p class="addon-field__hint addon-source-label">${st.kind === 'videos' ? 'Videos' : 'Images'} from <a href="${STOCK_HOME[st.source] || '#'}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel)}</a></p>
      </div>`;
    load();
  };

  const load = () => {
    if (!st.query) return;
    const key = keyOf();
    if (st.results[key]) return;
    st.results[key] = { loading: true, items: [] };
    Promise.resolve(search(st.kind, st.source, st.query))
      .then((r) => { st.results[key] = { items: r?.items || [], error: r?.ok === false ? (r.error || 'Search failed') : null }; })
      .catch((err) => { st.results[key] = { items: [], error: err?.message || 'Search failed' }; })
      .then(() => { if (keyOf() === key) draw(); });
  };

  const onClick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn || !container.contains(btn)) return;
    if (btn.dataset.stockKind) {
      st.kind = btn.dataset.stockKind;
      if (!st.query) st.query = suggestions[st.kind]?.[0] || '';
      draw();
    } else if (btn.dataset.stockSource) {
      st.source = btn.dataset.stockSource;
      draw();
    } else if (btn.dataset.stockQuery) {
      st.query = btn.dataset.stockQuery;
      draw();
    } else if (btn.dataset.stockPick != null) {
      const item = st.results[keyOf()]?.items?.[Number(btn.dataset.stockPick)];
      if (!item || st.busy) return;
      st.busy = item.id;
      btn.classList.add('is-busy');
      try {
        await onPick?.(item, st.kind);
      } finally {
        st.busy = null;
        btn.classList.remove('is-busy');
      }
    }
  };
  const onSubmit = (e) => {
    if (!e.target.classList.contains('stock-search')) return;
    e.preventDefault();
    st.query = e.target.querySelector('.stock-query').value.trim();
    draw();
  };
  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  draw();
  return {
    destroy() {
      container.removeEventListener('click', onClick);
      container.removeEventListener('submit', onSubmit);
    },
    state: st,
  };
}
