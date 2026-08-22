// Full AI video showcase — all 30 MiniMax H3 demos with category filtering.
//
// Performance contract:
//  - only INITIAL_VISIBLE cards are mounted on first render, so the page never
//    creates 30 media elements up front,
//  - every card renders its poster first; the <video> is created only when the
//    card approaches the viewport and is paused the moment it leaves,
//  - filtering detaches cards and pauses their video rather than leaving
//    orphaned players running off-DOM.

import {
  minimaxH3Demos,
  MINIMAX_CATEGORIES,
  getCategoryCounts,
  formatDuration,
  loadDemoPrompt,
} from '../../../data/minimaxH3Demos.js';
import { createMediaFrame, cleanupFrames, pauseFramesIn, revealOnScroll } from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  sectionHeading,
  createStyleLink,
  createViewPromptButton,
  metaPill,
  escapeHtml,
} from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

/** Cards rendered before the visitor asks for more. */
const INITIAL_VISIBLE = 12;

function createGalleryCard(demo) {
  const card = document.createElement('article');
  card.className =
    'mmx-card mmx-reveal group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.025]';
  card.dataset.mmxSlug = demo.slug;
  card.dataset.mmxCategory = demo.category;

  card.innerHTML = `
    <div class="relative" data-mmx-card-media>
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end p-2.5">
        ${metaPill(formatDuration(demo))}
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#05070b] to-transparent"></div>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400/80">${escapeHtml(demo.category)}</span>
      <h3 class="mt-1.5 text-sm font-bold leading-snug text-white">${escapeHtml(demo.title)}</h3>
      <p class="mt-1 flex-1 text-xs leading-relaxed text-gray-500">${escapeHtml(demo.useCase)}</p>
      <div class="mt-4 flex flex-wrap items-center gap-2" data-mmx-card-actions></div>
    </div>
  `;

  const mediaHost = card.querySelector('[data-mmx-card-media]');
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio: 16 / 9,
    className: 'w-full',
    ariaLabel: `${demo.title} — ${demo.useCase}`,
  });
  mediaHost.insertBefore(frame, mediaHost.firstChild);

  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `<svg class="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  mediaHost.appendChild(cue);

  const actions = card.querySelector('[data-mmx-card-actions]');
  actions.appendChild(createViewPromptButton(demo, handleViewPrompt, { label: 'View Prompt', loadPrompt }));
  actions.appendChild(createStyleLink(demo, { label: 'Create This Style', variant: 'ghost' }));

  return card;
}

export function AIVideoGallery() {
  injectMinimaxStyles();

  const counts = getCategoryCounts();

  const section = document.createElement('section');
  section.id = 'ai-video-gallery';
  section.className =
    'relative overflow-hidden bg-gradient-to-b from-[#020205] via-[#05070b] to-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'mmx-gallery-heading');
  section.setAttribute('data-testid', 'ai-video-gallery');

  section.innerHTML = `
    <div class="container relative z-10 mx-auto max-w-7xl">
      ${sectionHeading({
        eyebrow: `${minimaxH3Demos.length} AI video demos`,
        title: 'Every Style You Can',
        accent: 'Generate Today',
        subtitle:
          'Commercials, UGC, cinema, VFX, animation and social content — every clip below started as a single prompt.',
        id: 'mmx-gallery-heading',
      })}

      <!-- category filter -->
      <div class="mmx-reveal mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter demos by category" data-mmx-filters>
        ${MINIMAX_CATEGORIES.map((category) => {
          const count = category === 'All' ? minimaxH3Demos.length : counts[category] || 0;
          return `
            <button
              type="button"
              data-mmx-filter="${escapeHtml(category)}"
              aria-pressed="${category === 'All' ? 'true' : 'false'}"
              class="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]"
            >
              <span>${escapeHtml(category)}</span>
              <span class="text-[10px] tabular-nums opacity-50">${count}</span>
            </button>`;
        }).join('')}
      </div>

      <p class="sr-only" role="status" aria-live="polite" data-mmx-gallery-status></p>

      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5"
        data-mmx-gallery-grid
      ></div>

      <p class="mt-10 hidden text-center text-sm text-gray-500" data-mmx-empty>
        No demos in this category yet.
      </p>

      <div class="mt-12 flex justify-center">
        <button
          type="button"
          data-mmx-show-more
          class="btn-enhanced inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]"
        >
          <span data-mmx-show-more-label>Show More</span>
          <svg class="h-4 w-4 transition-transform duration-300" data-mmx-show-more-icon fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const grid = section.querySelector('[data-mmx-gallery-grid]');
  const filterHost = section.querySelector('[data-mmx-filters]');
  const filterButtons = Array.from(section.querySelectorAll('[data-mmx-filter]'));
  const showMoreButton = section.querySelector('[data-mmx-show-more]');
  const showMoreLabel = section.querySelector('[data-mmx-show-more-label]');
  const showMoreIcon = section.querySelector('[data-mmx-show-more-icon]');
  const statusEl = section.querySelector('[data-mmx-gallery-status]');
  const emptyEl = section.querySelector('[data-mmx-empty]');

  /** Cards are built once and reused across filter changes. */
  const cardCache = new Map();

  function getCard(demo) {
    if (!cardCache.has(demo.slug)) cardCache.set(demo.slug, createGalleryCard(demo));
    return cardCache.get(demo.slug);
  }

  let activeCategory = 'All';
  let expanded = false;
  let disposeReveal = () => {};

  const FILTER_ACTIVE = ['border-cyan-400/50', 'bg-cyan-400/10', 'text-cyan-200'];
  const FILTER_IDLE = ['border-white/10', 'bg-white/[0.03]', 'text-white/60'];

  function paintFilters() {
    filterButtons.forEach((button) => {
      const active = button.dataset.mmxFilter === activeCategory;
      button.setAttribute('aria-pressed', String(active));
      FILTER_ACTIVE.forEach((cls) => button.classList.toggle(cls, active));
      FILTER_IDLE.forEach((cls) => button.classList.toggle(cls, !active));
    });
  }

  function render() {
    const filtered =
      activeCategory === 'All'
        ? minimaxH3Demos
        : minimaxH3Demos.filter((demo) => demo.category === activeCategory);

    const visible = expanded ? filtered : filtered.slice(0, INITIAL_VISIBLE);

    // Detach current cards without destroying them, pausing any active video.
    pauseFramesIn(grid);
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    const fragment = document.createDocumentFragment();
    visible.forEach((demo) => fragment.appendChild(getCard(demo)));
    grid.appendChild(fragment);

    emptyEl.classList.toggle('hidden', filtered.length > 0);

    // Show More is only meaningful when the filter has more than we render.
    const hasMore = filtered.length > INITIAL_VISIBLE;
    showMoreButton.parentElement.classList.toggle('hidden', !hasMore);
    if (hasMore) {
      showMoreLabel.textContent = expanded
        ? 'Show Less'
        : `Show All ${filtered.length} Demos`;
      showMoreIcon.classList.toggle('rotate-180', expanded);
      showMoreButton.setAttribute('aria-expanded', String(expanded));
    }

    statusEl.textContent = `Showing ${visible.length} of ${filtered.length} demos${
      activeCategory === 'All' ? '' : ` in ${activeCategory}`
    }.`;

    disposeReveal();
    disposeReveal = revealOnScroll(grid.querySelectorAll('.mmx-reveal'), { stagger: 55 });
  }

  filterHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mmx-filter]');
    if (!button) return;
    const next = button.dataset.mmxFilter;
    if (next === activeCategory) return;
    activeCategory = next;
    expanded = false;
    paintFilters();
    render();
  });

  showMoreButton.addEventListener('click', () => {
    expanded = !expanded;
    render();
    if (!expanded) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  paintFilters();
  render();

  // Reveal the heading / filter row too.
  const disposeHeaderReveal = revealOnScroll(
    section.querySelectorAll(':scope > .container > .mmx-reveal')
  );

  section.cleanup = () => {
    disposeReveal();
    disposeHeaderReveal();
    cardCache.forEach((card) => cleanupFrames(card));
    cardCache.clear();
    cleanupFrames(section);
  };

  return section;
}

export default AIVideoGallery;
