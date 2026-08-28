// Seedance 2.5 showcase — curated prompt examples from the upstream repo.
//
// Mirrors the MiniMax H3 gallery pattern so Seedance demos get the same
// lazy-loaded video frames, category filtering, and on-demand prompt modals.

import {
  seedanceDemos,
  SEEDANCE_CATEGORIES,
  SEEDANCE_MODEL,
  getCategoryCounts,
  formatDuration,
  loadDemoPrompt,
  getCreateTarget,
  ratioToNumber,
} from '../../../data/seedanceDemos.js';
import { createMediaFrame, cleanupFrames, pauseFramesIn, revealOnScroll } from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  sectionHeading,
  createViewPromptButton,
  createStyleLink,
  createStudioIcon,
  metaPill,
  escapeHtml,
} from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

const INITIAL_VISIBLE = 8;

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
      <div class="mt-4 flex flex-col items-center gap-2" data-mmx-card-actions>
        <div class="flex flex-wrap items-center justify-center gap-2" data-mmx-primary-actions></div>
        <div class="flex items-center justify-center gap-1.5" data-mmx-studio-icons></div>
      </div>
    </div>
  `;

  const mediaHost = card.querySelector('[data-mmx-card-media]');
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio: ratioToNumber(demo.aspectRatio),
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
  const primaryActions = card.querySelector('[data-mmx-primary-actions]');
  const studioIconsHost = card.querySelector('[data-mmx-studio-icons]');

  primaryActions.appendChild(createViewPromptButton(demo, handleViewPrompt, {
    label: 'View Prompt',
    loadPrompt: loadDemoPrompt,
    model: SEEDANCE_MODEL,
  }));
  primaryActions.appendChild(createStyleLink(demo, { label: 'Create This Style', getTarget, loadPrompt: loadDemoPrompt, model: SEEDANCE_MODEL }));

  const target = getCreateTarget(demo);
  const templateId = target.params.template;
  if (templateId) {
    const studioIcons = [
      { route: 'template/' + templateId,    label: 'T', title: 'Open in Template Studio' },
      { route: 'cinema-template',           label: 'C', title: 'Open in Cinema Template Studio', params: { template: templateId } },
      { route: 'cinema',                    label: 'F', title: 'Open in Cinema Studio',          params: { template: templateId } },
      { route: 'video',                     label: 'V', title: 'Open in Video Studio',           params: { template: templateId } },
      { route: 'image',                     label: 'I', title: 'Open in Image Studio',           params: { template: templateId } },
    ];
    studioIcons.forEach((icon) => {
      studioIconsHost.appendChild(
        createStudioIcon(demo, {
          route: icon.route,
          params: icon.params || {},
          label: icon.label,
          title: icon.title,
        })
      );
    });
  }

  return card;
}

export function SeedanceShowcase() {
  injectMinimaxStyles();

  const counts = getCategoryCounts();

  const section = document.createElement('section');
  section.id = 'seedance-showcase';
  section.className =
    'relative overflow-hidden bg-gradient-to-b from-[#020205] via-[#05070b] to-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'seedance-heading');
  section.setAttribute('data-testid', 'seedance-showcase');

  section.innerHTML = `
    <div class="container relative z-10 mx-auto max-w-7xl">
      ${sectionHeading({
        eyebrow: 'Seedance 2.5',
        title: 'Prompt Examples',
        accent: 'From the Official Library',
        subtitle:
          'Curated production-ready prompts for cinematic, commercial, fashion, VFX, and multi-reference video generation.',
        id: 'seedance-heading',
      })}

      <div class="mt-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter demos by category" data-seedance-filters>
        ${SEEDANCE_CATEGORIES.map((category) => {
          const count = category === 'All' ? seedanceDemos.length : counts[category] || 0;
          return `
            <button
              type="button"
              data-seedance-filter="${escapeHtml(category)}"
              aria-pressed="${category === 'All' ? 'true' : 'false'}"
              class="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]"
            >
              <span>${escapeHtml(category)}</span>
              <span class="text-[10px] tabular-nums opacity-50">${count}</span>
            </button>`;
        }).join('')}
      </div>

      <p class="sr-only" role="status" aria-live="polite" data-seedance-gallery-status></p>

      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5"
        data-seedance-gallery-grid
      ></div>

      <p class="mt-10 hidden text-center text-sm text-gray-500" data-seedance-empty>
        No demos in this category yet.
      </p>
    </div>
  `;

  const grid = section.querySelector('[data-seedance-gallery-grid]');
  const filterHost = section.querySelector('[data-seedance-filters]');
  const filterButtons = Array.from(section.querySelectorAll('[data-seedance-filter]'));
  const statusEl = section.querySelector('[data-seedance-gallery-status]');
  const emptyEl = section.querySelector('[data-seedance-empty]');

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
      const active = button.dataset.seedanceFilter === activeCategory;
      button.setAttribute('aria-pressed', String(active));
      FILTER_ACTIVE.forEach((cls) => button.classList.toggle(cls, active));
      FILTER_IDLE.forEach((cls) => button.classList.toggle(cls, !active));
    });
  }

  function render() {
    const filtered =
      activeCategory === 'All'
        ? seedanceDemos
        : seedanceDemos.filter((demo) => demo.category === activeCategory);

    const visible = expanded ? filtered : filtered.slice(0, INITIAL_VISIBLE);

    pauseFramesIn(grid);
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    const fragment = document.createDocumentFragment();
    visible.forEach((demo) => fragment.appendChild(getCard(demo)));
    grid.appendChild(fragment);

    emptyEl.classList.toggle('hidden', filtered.length > 0);

    disposeReveal();
    disposeReveal = revealOnScroll(grid.querySelectorAll('.mmx-reveal'), { stagger: 55 });
  }

  filterHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-seedance-filter]');
    if (!button) return;
    const next = button.dataset.seedanceFilter;
    if (next === activeCategory) return;
    activeCategory = next;
    expanded = false;
    paintFilters();
    render();
  });

  paintFilters();
  render();

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

export default SeedanceShowcase;
