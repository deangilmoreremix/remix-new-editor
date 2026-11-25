// Studio Demos: captioned tour videos for the headline studios.
// Sits right after the apps grid, when the visitor has just seen the list of apps.
// One featured player plus a picker; a tour only downloads when its play button is clicked.
import GUIDE_INDEX from '../../../data/studioGuideIndex.json';
import GUIDE_VIDEOS from '../../../data/guideVideos.json';
import { createDemoPlayer, tourFor, formatDuration } from '../common/demoPlayer.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Headline studios, in the order they are shown. A slug with no guide or no tour is skipped.
const FEATURED = [
  'video-studio', 'image-studio', 'cinema-studio', 'director',
  'character-studio', 'avatar-studio', 'lip-sync-studio', 'ai-vfx-studio',
  'edit-studio', 'storyboard-studio', 'brand-studio', 'timeline-editor',
];

function featuredStudios() {
  const bySlug = new Map();
  for (const c of GUIDE_INDEX) for (const g of c.guides) bySlug.set(g.slug, g);
  return FEATURED.map((slug) => ({ guide: bySlug.get(slug), tour: tourFor(slug) })).filter((s) => s.guide && s.tour);
}

export function StudioDemosSection() {
  const studios = featuredStudios();
  const totalTours = Object.keys(GUIDE_VIDEOS.studios || {}).length;

  const section = document.createElement('section');
  section.id = 'studio-demos';
  section.className = 'relative py-20 px-4 bg-[#020205]';
  section.setAttribute('aria-labelledby', 'studio-demos-heading');
  section.setAttribute('data-testid', 'studio-demos-section');

  if (!studios.length) return section;

  section.innerHTML = `
    <div class="container mx-auto max-w-6xl">
      <div class="text-center mb-10">
        <span class="inline-block text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400 border border-cyan-400/30 bg-cyan-400/[0.08] rounded-full px-4 py-1.5 mb-5">Studio demos</span>
        <h2 id="studio-demos-heading" class="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4">
          Watch each studio <span class="text-cyan-400 italic">in action.</span>
        </h2>
        <p class="text-lg text-gray-300 max-w-3xl mx-auto">
          Captioned walkthroughs of the real studios, control by control. Pick one to watch.
        </p>
      </div>

      <div class="max-w-4xl mx-auto">
        <div>
          <div data-demo-stage></div>
          <div class="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2" aria-live="polite">
            <div>
              <h3 data-demo-name class="text-xl font-bold text-white"></h3>
              <p data-demo-desc class="text-sm text-gray-400 mt-1"></p>
            </div>
            <a data-demo-guide href="#" class="text-sm font-semibold text-cyan-300 hover:text-cyan-200 whitespace-nowrap">Read the full guide →</a>
          </div>
        </div>

      </div>

      <div class="mt-8">
        <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-demo-picker>
          ${studios.map(({ guide, tour }) => `
            <li>
              <button type="button" data-demo-slug="${esc(guide.slug)}" aria-pressed="false"
                class="demo-pick group w-full text-left rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-cyan-400/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                <span class="relative block aspect-video bg-black">
                  <img src="${esc(guide.thumbnail)}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                  <span class="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">${formatDuration(tour.seconds)}</span>
                </span>
                <span class="block px-3 py-2 text-sm font-semibold text-gray-200 group-hover:text-white">${esc(guide.name)}</span>
              </button>
            </li>`).join('')}
        </ul>
      </div>

      <div class="text-center mt-10">
        <a href="/studios/" class="inline-flex items-center gap-2 text-cyan-300 font-semibold hover:text-cyan-200 transition-colors">Browse all ${totalTours} studio tours →</a>
      </div>
    </div>`;

  const stage = section.querySelector('[data-demo-stage]');
  const nameEl = section.querySelector('[data-demo-name]');
  const descEl = section.querySelector('[data-demo-desc]');
  const guideEl = section.querySelector('[data-demo-guide]');
  const buttons = Array.from(section.querySelectorAll('[data-demo-slug]'));
  let current = null;

  const select = (slug) => {
    const entry = studios.find((s) => s.guide.slug === slug);
    if (!entry) return;
    const { guide, tour } = entry;
    if (current) current.stop();
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
    buttons.forEach((b) => {
      const on = b.getAttribute('data-demo-slug') === slug;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('ring-2', on);
      b.classList.toggle('ring-cyan-400', on);
    });
  };

  buttons.forEach((b) => b.addEventListener('click', () => select(b.getAttribute('data-demo-slug'))));
  select(studios[0].guide.slug);

  section.cleanup = () => { if (current) current.stop(); };
  return section;
}

export default StudioDemosSection;
