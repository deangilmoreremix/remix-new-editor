import { navigate } from '../lib/router.js';
import { templates, allTemplates } from '../lib/templates.js';
import { NICHE_LABELS_MAP } from '../lib/nicheTemplatesIndex.js';
import { templatesForNiche } from '../lib/templateCategories.js';
import { getTemplateThumbnail, getCategoryThumbnail, createThumbnailImg } from '../lib/thumbnails.js';
import { getFavoriteTemplateIds, getRecentTemplateIds, isFavoriteTemplate, toggleFavoriteTemplate } from '../lib/templateUx.js';
import { syncFavorites, fetchTrendingTemplateIds, isCloudReady, TRENDING_WINDOW_DAYS } from '../lib/templateCloud.js';
import { CURATED_PROMPTS } from '../data/curatedPrompts.js';
import { studioCards, createSection } from './AppsHub.js';

const TRENDING_COUNT = 8;
const RECENT_COUNT = 4;

/** Every template category with its real size: the 8 standard ones plus the industry (niche) ones, as on the Templates page. */
export function exploreCategories() {
  const all = Array.isArray(allTemplates) ? allTemplates.filter(Boolean) : [];
  const standard = [...new Set(all.filter((t) => !t.niche).map((t) => t.category).filter(Boolean))]
    .map((label) => ({ label, niche: false, count: all.filter((t) => !t.niche && t.category === label).length }));
  const niches = Object.values(NICHE_LABELS_MAP || {})
    .map((label) => ({ label, niche: true, count: templatesForNiche(all, label).length }))
    .filter((c) => c.count > 0);
  return [...standard, ...niches];
}

function templateCard(t) {
  const card = document.createElement('div');
  card.className = 'relative bg-card-bg/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group';
  card.dataset.templateId = t.id;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  const thumbSrc = getTemplateThumbnail(t.id);
  const heroWrapper = document.createElement('div');
  heroWrapper.className = 'thumb-hero h-36 relative';
  heroWrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
  heroWrapper.appendChild(createThumbnailImg(thumbSrc, t.name, 'w-full h-full object-cover', t));
  card.appendChild(heroWrapper);

  const info = document.createElement('div');
  info.className = 'p-3';
  const name = document.createElement('div');
  name.className = 'text-sm font-bold text-white group-hover:text-primary transition-colors';
  name.textContent = t.name;
  const desc = document.createElement('div');
  desc.className = 'text-xs text-muted mt-0.5';
  desc.textContent = t.description || '';
  info.append(name, desc);
  card.appendChild(info);

  const star = document.createElement('button');
  star.type = 'button';
  star.dataset.favorite = t.id;
  star.className = 'absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/70 text-sm text-zinc-300 transition hover:bg-black/90';
  star.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); toggleFavoriteTemplate(t.id); });
  card.appendChild(star);

  const open = () => navigate(`template/${t.id}`);
  card.onclick = open;
  card.onkeydown = (e) => { if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } };
  return card;
}

function paintStars(root) {
  root.querySelectorAll('[data-favorite]').forEach((star) => {
    const id = star.dataset.favorite;
    const on = isFavoriteTemplate(id);
    const name = star.closest('[data-template-id]')?.querySelector('.font-bold')?.textContent || 'template';
    star.textContent = on ? '★' : '☆';
    star.setAttribute('aria-pressed', String(on));
    star.setAttribute('aria-label', on ? `Remove ${name} from favorites` : `Add ${name} to favorites`);
  });
}

function sectionHeading(text, hint) {
  const wrap = document.createElement('div');
  wrap.className = 'mb-4';
  const h2 = document.createElement('h2');
  h2.className = 'text-lg font-bold text-white';
  h2.textContent = text;
  wrap.appendChild(h2);
  if (hint) {
    const p = document.createElement('p');
    p.className = 'text-xs text-muted mt-1';
    p.textContent = hint;
    wrap.appendChild(p);
  }
  return wrap;
}

export function ExplorePage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg';

  const inner = document.createElement('div');
  inner.className = 'w-full px-4 md:px-8 py-8 md:py-12';

  inner.innerHTML = `
    <div class="mb-10 animate-fade-in-up">
      <h1 class="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">Explore</h1>
      <p class="text-secondary text-sm md:text-base max-w-xl">Discover curated prompts, trending templates, every studio, and creative inspiration</p>
    </div>
  `;

  const byId = new Map((Array.isArray(allTemplates) ? allTemplates : []).filter(Boolean).map((t) => [t.id, t]));

  // ---- Your favorites (and recently opened) ------------------------------
  const favoritesSection = document.createElement('div');
  favoritesSection.className = 'mb-12 animate-fade-in-up';
  favoritesSection.dataset.exploreFavorites = '';
  inner.appendChild(favoritesSection);

  function renderFavorites() {
    favoritesSection.innerHTML = '';
    const favorites = getFavoriteTemplateIds().map((id) => byId.get(id)).filter(Boolean);
    const recent = getRecentTemplateIds().filter((id) => !isFavoriteTemplate(id)).map((id) => byId.get(id)).filter(Boolean).slice(0, RECENT_COUNT);
    favoritesSection.appendChild(sectionHeading('Your favorites', isCloudReady()
      ? 'Saved to your account, so they follow you to any device.'
      : 'Star a template to keep it here. Sign in to have your favorites on every device.'));
    if (favorites.length) {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';
      favorites.forEach((t) => grid.appendChild(templateCard(t)));
      favoritesSection.appendChild(grid);
    } else {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-muted';
      empty.textContent = 'No favorites yet. Tap the ☆ on any template below.';
      favoritesSection.appendChild(empty);
    }
    if (recent.length) {
      const h = document.createElement('h3');
      h.className = 'text-sm font-bold text-muted uppercase tracking-wider mt-6 mb-3';
      h.textContent = 'Recently opened';
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';
      recent.forEach((t) => grid.appendChild(templateCard(t)));
      favoritesSection.append(h, grid);
    }
    paintStars(favoritesSection);
  }

  // ---- Trending: real usage when there is some, else the default order ----
  const trendingSection = document.createElement('div');
  trendingSection.className = 'mb-12 animate-fade-in-up';
  trendingSection.dataset.exploreTrending = 'default';
  trendingSection.style.animationDelay = '0.1s';
  inner.appendChild(trendingSection);

  function renderTrending(rankedIds = []) {
    const ranked = rankedIds.map((id) => byId.get(id)).filter(Boolean);
    const picked = [...ranked];
    for (const t of templates) {
      if (picked.length >= TRENDING_COUNT) break;
      if (!picked.includes(t)) picked.push(t);
    }
    const live = ranked.length > 0;
    trendingSection.dataset.exploreTrending = live ? 'live' : 'default';
    trendingSection.innerHTML = '';
    trendingSection.appendChild(sectionHeading('Trending Templates', live
      ? `Most opened and favorited in the last ${TRENDING_WINDOW_DAYS} days.`
      : null));
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';
    picked.slice(0, TRENDING_COUNT).forEach((t) => grid.appendChild(templateCard(t)));
    trendingSection.appendChild(grid);
    paintStars(trendingSection);
  }

  // ---- Prompt library ------------------------------------------------------
  const promptsSection = document.createElement('div');
  promptsSection.className = 'mb-12 animate-fade-in-up';
  promptsSection.style.animationDelay = '0.2s';
  promptsSection.appendChild(sectionHeading('Prompt Library'));
  const promptsGrid = document.createElement('div');
  promptsGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
  CURATED_PROMPTS.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'bg-card-bg/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/[0.06] hover:border-white/10 transition-all group';
    const meta = document.createElement('div');
    meta.className = 'text-xs text-muted mb-2';
    meta.textContent = `${p.category} / ${p.model}`;
    const text = document.createElement('div');
    text.className = 'text-sm text-white leading-relaxed mb-3';
    text.textContent = p.prompt;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-xs font-bold text-primary hover:underline try-btn';
    btn.textContent = 'Try this prompt';
    btn.onclick = () => {
      try { localStorage.setItem('prefill_prompt', p.prompt); } catch { /* storage blocked */ }
      navigate('image');
    };
    card.append(meta, text, btn);
    promptsGrid.appendChild(card);
  });
  promptsSection.appendChild(promptsGrid);
  inner.appendChild(promptsSection);

  // ---- Browse by category: real counts, opens Templates on that category ---
  const categoriesSection = document.createElement('div');
  categoriesSection.className = 'animate-fade-in-up';
  categoriesSection.style.animationDelay = '0.3s';
  categoriesSection.appendChild(sectionHeading('Browse by Category', `${allTemplates.length} templates in ${exploreCategories().length} categories`));
  const catGrid = document.createElement('div');
  catGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';
  exploreCategories().forEach(({ label, count, niche }) => {
    const card = document.createElement('div');
    card.className = 'bg-card-bg/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group';
    card.dataset.category = label;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const catThumb = niche ? null : getCategoryThumbnail(label);
    if (catThumb) {
      const heroWrapper = document.createElement('div');
      heroWrapper.className = 'thumb-hero h-24 relative';
      heroWrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
      heroWrapper.appendChild(createThumbnailImg(catThumb, label, 'w-full h-full object-cover'));
      card.appendChild(heroWrapper);
    }
    const info = document.createElement('div');
    info.className = 'p-3';
    const name = document.createElement('div');
    name.className = 'text-sm font-bold text-white group-hover:text-primary transition-colors';
    name.textContent = label;
    const n = document.createElement('div');
    n.className = 'text-xs text-muted mt-1';
    n.dataset.categoryCount = String(count);
    n.textContent = `${count} ${count === 1 ? 'template' : 'templates'}`;
    info.append(name, n);
    card.appendChild(info);
    const open = () => navigate('templates', { category: label });
    card.onclick = open;
    card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    catGrid.appendChild(card);
  });
  categoriesSection.appendChild(catGrid);
  inner.appendChild(categoriesSection);

  // ---- All studios ----------------------------------------------------------
  const cards = studioCards();
  const studiosSection = createSection('All studios', cards, true);
  studiosSection.style.marginTop = '3rem';
  studiosSection.dataset.exploreStudios = String(cards.length);
  inner.appendChild(studiosSection);

  container.appendChild(inner);

  // First paint from this browser, then bring in the account's favorites and the usage ranking.
  renderFavorites();
  renderTrending();
  let disposed = false;
  syncFavorites().then(() => { if (!disposed) { renderFavorites(); paintStars(container); } });
  fetchTrendingTemplateIds(TRENDING_COUNT).then((ids) => { if (!disposed && ids.length) renderTrending(ids); });

  // A star toggled anywhere on this page (or merged in from the account) refreshes every copy of it.
  const refresh = () => { renderFavorites(); paintStars(container); };
  window.addEventListener('template-favorite-toggled', refresh);
  window.addEventListener('template-favorites-changed', refresh);
  container.cleanup = () => {
    disposed = true;
    window.removeEventListener('template-favorite-toggled', refresh);
    window.removeEventListener('template-favorites-changed', refresh);
  };
  return container;
}
