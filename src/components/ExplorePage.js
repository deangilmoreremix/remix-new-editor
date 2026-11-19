import { navigate } from '../lib/router.js';
import { templates, TEMPLATE_CATEGORIES } from '../lib/templates.js';
import { getTemplateThumbnail, getCategoryThumbnail, createThumbnailImg } from '../lib/thumbnails.js';
import { CURATED_PROMPTS } from '../data/curatedPrompts.js';
import { studioCards, createSection } from './AppsHub.js';

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

  const trendingSection = document.createElement('div');
  trendingSection.className = 'mb-12 animate-fade-in-up';
  trendingSection.style.animationDelay = '0.1s';
  trendingSection.innerHTML = '<h2 class="text-lg font-bold text-white mb-4">Trending Templates</h2>';

  const trendingGrid = document.createElement('div');
  trendingGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';

  const trending = templates.slice(0, 8);
  trending.forEach(t => {
    const card = document.createElement('div');
    card.className = 'bg-card-bg/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group';
    const thumbSrc = getTemplateThumbnail(t.id);
    const heroWrapper = document.createElement('div');
    heroWrapper.className = 'thumb-hero h-36 relative';
    heroWrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
    const img = createThumbnailImg(thumbSrc, t.name, 'w-full h-full object-cover', t);
    heroWrapper.appendChild(img);
    card.appendChild(heroWrapper);
    const info = document.createElement('div');
    info.className = 'p-3';
    info.innerHTML = `
      <div class="text-sm font-bold text-white group-hover:text-primary transition-colors">${t.name}</div>
      <div class="text-xs text-muted mt-0.5">${t.description}</div>
    `;
    card.appendChild(info);
    card.onclick = () => navigate(`template/${t.id}`);
    trendingGrid.appendChild(card);
  });
  trendingSection.appendChild(trendingGrid);
  inner.appendChild(trendingSection);

  const promptsSection = document.createElement('div');
  promptsSection.className = 'mb-12 animate-fade-in-up';
  promptsSection.style.animationDelay = '0.2s';
  promptsSection.innerHTML = '<h2 class="text-lg font-bold text-white mb-4">Prompt Library</h2>';

  const promptsGrid = document.createElement('div');
  promptsGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

  CURATED_PROMPTS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'bg-card-bg/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/[0.06] hover:border-white/10 transition-all group';
    card.innerHTML = `
      <div class="text-xs text-muted mb-2">${p.category} / ${p.model}</div>
      <div class="text-sm text-white leading-relaxed mb-3">${p.prompt}</div>
      <button class="text-xs font-bold text-primary hover:underline try-btn">Try this prompt</button>
    `;
    card.querySelector('.try-btn').onclick = () => {
      localStorage.setItem('prefill_prompt', p.prompt);
      navigate('image');
    };
    promptsGrid.appendChild(card);
  });
  promptsSection.appendChild(promptsGrid);
  inner.appendChild(promptsSection);

  const categoriesSection = document.createElement('div');
  categoriesSection.className = 'animate-fade-in-up';
  categoriesSection.style.animationDelay = '0.3s';
  categoriesSection.innerHTML = '<h2 class="text-lg font-bold text-white mb-4">Browse by Category</h2>';

  const catGrid = document.createElement('div');
  catGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';

  Object.values(TEMPLATE_CATEGORIES).forEach(cat => {
    const count = templates.filter(t => t.category === cat).length;
    const card = document.createElement('div');
    card.className = 'bg-card-bg/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group';
    const catThumb = getCategoryThumbnail(cat);
    if (catThumb) {
      const heroWrapper = document.createElement('div');
      heroWrapper.className = 'thumb-hero h-24 relative';
      heroWrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
      const img = createThumbnailImg(catThumb, cat, 'w-full h-full object-cover');
      heroWrapper.appendChild(img);
      card.appendChild(heroWrapper);
    }
    const info = document.createElement('div');
    info.className = 'p-3';
    info.innerHTML = `
      <div class="text-sm font-bold text-white group-hover:text-primary transition-colors">${cat}</div>
      <div class="text-xs text-muted mt-1">${count} templates</div>
    `;
    card.appendChild(info);
    card.onclick = () => navigate('templates');
    catGrid.appendChild(card);
  });
  categoriesSection.appendChild(catGrid);
  inner.appendChild(categoriesSection);

  const cards = studioCards();
  const studiosSection = createSection('All studios', cards, true);
  studiosSection.style.marginTop = '3rem';
  studiosSection.dataset.exploreStudios = String(cards.length);
  inner.appendChild(studiosSection);

  container.appendChild(inner);
  return container;
}
