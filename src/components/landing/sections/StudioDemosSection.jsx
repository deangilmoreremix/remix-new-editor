// Studio Demos: captioned tour videos for every studio.
// Sits right after the apps grid, when the visitor has just seen the list of apps.
// One featured player plus a tabbed picker (Featured, All, then one tab per category).
// A tour only downloads when its play button is clicked.
import GUIDE_INDEX from '../../../data/studioGuideIndex.json';
import { createDemoPlayer, tourFor, formatDuration } from '../common/demoPlayer.js';
import { attachClipPreviews, startClip, stopClip } from '../common/clipPreview.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Headline studios, shown on the first tab. A slug with no guide or no tour is skipped.
const FEATURED = [
  'video-studio', 'image-studio', 'cinema-studio', 'director',
  'character-studio', 'avatar-studio', 'lip-sync-studio', 'ai-vfx-studio',
  'edit-studio', 'storyboard-studio', 'brand-studio', 'timeline-editor',
];

/** Every studio that has a guide and a tour, plus the tabs that group them. */
function buildTabs() {
  const bySlug = new Map();
  const categories = [];
  for (const c of GUIDE_INDEX) {
    const items = [];
    for (const g of c.guides) {
      const tour = tourFor(g.slug);
      if (!tour) continue;
      const entry = { guide: g, tour };
      bySlug.set(g.slug, entry);
      items.push(entry);
    }
    if (items.length) categories.push({ key: c.id, label: c.title, items });
  }
  const featured = FEATURED.map((slug) => bySlug.get(slug)).filter(Boolean);
  const all = categories.flatMap((c) => c.items);
  const tabs = [];
  if (featured.length) tabs.push({ key: 'featured', label: 'Featured', items: featured });
  tabs.push({ key: 'all', label: 'All', items: all });
  tabs.push(...categories);
  return { tabs, all };
}

export function StudioDemosSection() {
  const { tabs, all } = buildTabs();

  const section = document.createElement('section');
  section.id = 'studio-demos';
  section.className = 'relative py-20 px-4 bg-[#020205]';
  section.setAttribute('aria-labelledby', 'studio-demos-heading');
  section.setAttribute('data-testid', 'studio-demos-section');

  if (!all.length) return section;

  section.innerHTML = `
    <div class="container mx-auto max-w-6xl">
      <div class="text-center mb-10">
        <span class="inline-block text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400 border border-cyan-400/30 bg-cyan-400/[0.08] rounded-full px-4 py-1.5 mb-5">Studio demos</span>
        <h2 id="studio-demos-heading" class="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4">
          Watch each studio <span class="text-cyan-400 italic">in action.</span>
        </h2>
        <p class="text-lg text-gray-300 max-w-3xl mx-auto">
          ${all.length} captioned walkthroughs of the real studios, control by control. Pick one to watch.
        </p>
      </div>

      <div class="max-w-4xl mx-auto">
        <div data-demo-stage></div>
        <div class="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2" aria-live="polite">
          <div>
            <h3 data-demo-name class="text-xl font-bold text-white"></h3>
            <p data-demo-desc class="text-sm text-gray-400 mt-1"></p>
          </div>
          <a data-demo-guide href="#" class="text-sm font-semibold text-cyan-300 hover:text-cyan-200 whitespace-nowrap">Read the full guide →</a>
        </div>
      </div>

      <div class="mt-8">
        <div class="flex flex-wrap justify-center gap-2 mb-6" role="group" aria-label="Studio demo categories" data-demo-tabs>
          ${tabs.map((t) => `<button type="button" data-demo-tab="${esc(t.key)}" aria-pressed="false" class="px-4 py-2 rounded-full text-sm font-medium text-gray-300">${esc(t.label)} <span class="text-gray-500">${t.items.length}</span></button>`).join('')}
        </div>
        <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-demo-picker></ul>
      </div>

      <div class="text-center mt-10">
        <a href="/studios/" class="inline-flex items-center gap-2 text-cyan-300 font-semibold hover:text-cyan-200 transition-colors">Browse all ${all.length} studio guides →</a>
      </div>
    </div>`;

  const stage = section.querySelector('[data-demo-stage]');
  const nameEl = section.querySelector('[data-demo-name]');
  const descEl = section.querySelector('[data-demo-desc]');
  const guideEl = section.querySelector('[data-demo-guide]');
  const picker = section.querySelector('[data-demo-picker]');
  const tabButtons = Array.from(section.querySelectorAll('[data-demo-tab]'));
  let current = null;
  let currentSlug = null;

  const markSelected = () => {
    picker.querySelectorAll('[data-demo-slug]').forEach((b) => {
      const on = b.getAttribute('data-demo-slug') === currentSlug;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('ring-2', on);
      b.classList.toggle('ring-cyan-400', on);
      if (on) startClip(b); else stopClip(b);
    });
  };

  const select = (slug) => {
    const entry = all.find((s) => s.guide.slug === slug);
    if (!entry) return;
    const { guide, tour } = entry;
    if (current) current.stop();
    currentSlug = slug;
    current = createDemoPlayer({
      label: `${guide.name} tour`,
      poster: tour.poster,
      fallbackPoster: guide.thumbnail,
      src: tour.mp4,
      captions: tour.captions,
      className: 'rounded-2xl border border-white/10 shadow-2xl shadow-cyan-400/10',
    });
    stage.replaceChildren(current);
    nameEl.textContent = `${guide.name} · ${formatDuration(tour.seconds)}`;
    descEl.textContent = guide.shortDescription || '';
    guideEl.href = `/studios/${guide.slug}/`;
    markSelected();
  };

  const showTab = (key) => {
    const tab = tabs.find((t) => t.key === key);
    if (!tab) return;
    tabButtons.forEach((b) => {
      const on = b.getAttribute('data-demo-tab') === key;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('ring-2', on);
      b.classList.toggle('ring-cyan-400', on);
    });
    picker.innerHTML = tab.items.map(({ guide, tour }) => `
      <li>
        <button type="button" data-demo-slug="${esc(guide.slug)}" aria-pressed="false"
          class="demo-pick group w-full text-left rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-cyan-400/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
          <span class="relative block aspect-video bg-black">
            <img src="${esc(guide.thumbnail)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
            <span data-clip-frame class="absolute inset-0 block"></span>
            <span class="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">${formatDuration(tour.seconds)}</span>
          </span>
          <span class="block px-3 py-2 text-sm font-semibold text-gray-200 group-hover:text-white">${esc(guide.name)}</span>
        </button>
      </li>`).join('');
    markSelected();
  };

  tabButtons.forEach((b) => b.addEventListener('click', () => showTab(b.getAttribute('data-demo-tab'))));
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('[data-demo-slug]');
    if (b) select(b.getAttribute('data-demo-slug'));
  });

  attachClipPreviews(picker, (tile) => tile.getAttribute('data-demo-slug') === currentSlug);

  showTab(tabs[0].key);
  select(tabs[0].items[0].guide.slug);

  section.cleanup = () => {
    if (current) current.stop();
    picker.querySelectorAll('[data-demo-slug]').forEach(stopClip);
  };
  return section;
}

export default StudioDemosSection;
