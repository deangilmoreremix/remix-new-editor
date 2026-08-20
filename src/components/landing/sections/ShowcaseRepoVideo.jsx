// Repo Video Showcase — demos organized by category sections.
//
// Mirrors the existing landing-page pattern: instead of one giant filtered gallery,
// the 530 demos are grouped into per-category sub-sections, each with its own
// sectionHeading, curated initial card set, and "Show More" behaviour — exactly
// like UGCDemoShowcase and MadeWithSmartVideo.
//
// Source mapping:
//   BeatAPI/awesome-minimax-h3-prompts     → 253 MiniMax H3 demos
//   BeatAPI/awesome-seedance-2-5-prompts   → 242 Seedance 2.5 demos
//   ZeroLu/awesome-seedance                → 35  Seedance 2.0 demos
//
// Excludes all higgsfield-branded entries (9 removed).

import { minimaxH3Demos, getCreateTarget as getCreateTargetMinimax, loadDemoPrompt as loadDemoPromptMinimax, MINIMAX_MODEL } from '../../../data/beatapiMinimaxH3Demos.js';
import { seedance25Demos, getCreateTarget as getCreateTargetSeedance, loadDemoPrompt as loadDemoPromptSeedance, SEEDANCE_MODEL } from '../../../data/beatapiSeedance25Demos.js';
import { zeroLuDemos, getCreateTarget as getCreateTargetZeroLu, loadDemoPrompt as loadDemoPromptZeroLu, ZERO_LU_MODEL } from '../../../data/zeroLuDemos.js';

import { createMediaFrame, cleanupFrames, pauseFramesIn, revealOnScroll } from './minimax/mediaFrame.js';
import { injectMinimaxStyles, sectionHeading, createStyleLink, createViewPromptButton, metaPill, categoryBadge, escapeHtml } from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

/** Cards per category section before "Show More" expands. */
const INITIAL_VISIBLE = 8;

/** Per-source adapters for CTA routing and prompt loading. */
const SOURCE_ADAPTERS = {
  seedance25: {
    getCreateTarget: getCreateTargetSeedance,
    loadDemoPrompt: loadDemoPromptSeedance,
    modelName: SEEDANCE_MODEL,
  },
  minimaxh3: {
    getCreateTarget: getCreateTargetMinimax,
    loadDemoPrompt: loadDemoPromptMinimax,
    modelName: MINIMAX_MODEL,
  },
  zeroLu: {
    getCreateTarget: getCreateTargetZeroLu,
    loadDemoPrompt: loadDemoPromptZeroLu,
    modelName: ZERO_LU_MODEL,
  },
};

/** Source label for attribution badges on cards. */
function sourceLabel(source) {
  return source === 'minimaxh3' ? 'MiniMax H3'
    : source === 'seedance25' ? 'Seedance 2.5'
    : source === 'zeroLu' ? 'Seedance 2.0'
    : source;
}

/** Safe duration formatter. */
function formatDurationSafe(demo) {
  if (!demo.duration) return '—';
  return demo.duration + 's';
}

/**
 * Merge all three repo demo arrays, tagging each with its source.
 */
const ALL_DEMOS = [
  ...seedance25Demos.map((d) => ({ ...d, source: 'seedance25' })),
  ...minimaxH3Demos.map((d) => ({ ...d, source: 'minimaxh3' })),
  ...zeroLuDemos.filter((d) => d.videoSrc).map((d) => ({ ...d, source: 'zeroLu' })),
];

/**
 * Category section configs — each defines its heading, which categories
 * to pull from, and how many to show initially.
 *
 * Sparse categories (Beauty, Characters, Food, Web/UI) are merged into
 * the "More Styles" section so every section has enough content.
 */
const SECTIONS = [
  {
    id: 'commercial',
    title: 'Commercial & Ads',
    subtitle: 'Product spots, brand films, and e-commerce demos — every clip is a runnable prompt.',
    categories: ['Commercial'],
    initial: 12,
  },
  {
    id: 'cinema',
    title: 'Cinema & Film',
    subtitle: 'Narrative shorts, concept films, and cinematic sequences with source-verified reference videos.',
    categories: ['Cinema'],
    initial: 12,
  },
  {
    id: 'social',
    title: 'Social & UGC',
    subtitle: 'Vlogs, memes, and creator-style content built for TikTok, Instagram, and Shorts.',
    categories: ['Social', 'UGC'],
    initial: 12,
  },
  {
    id: 'animation',
    title: 'Animation',
    subtitle: 'Stylized 2D, 3D, and anime motion graphics with consistent characters and worlds.',
    categories: ['Animation'],
    initial: 12,
  },
  {
    id: 'fashion',
    title: 'Fashion & Style',
    subtitle: 'Runway looks, beauty reels, and luxury product films with premium cinematic polish.',
    categories: ['Fashion', 'Beauty'],
    initial: 8,
  },
  {
    id: 'action',
    title: 'Action & VFX',
    subtitle: 'Explosions, fight scenes, game cinematics, titan-scale VFX and motion graphics.',
    categories: ['Action', 'VFX', 'Characters'],
    initial: 12,
  },
];

/** Build the section label for the eyebrow. */
function sectionEyebrow(section) {
  const labels = {
    commercial: 'Ads & Brands',
    cinema: 'Cinematic Shorts',
    social: 'Social Content',
    animation: 'Animated Motion',
    fashion: 'Fashion & Beauty',
    action: 'Action & VFX',
  };
  return labels[section.id] || section.title;
}

/**
 * Build a gallery card for a demo, with per-source CTA and prompt loading.
 */
function createGalleryCard(demo) {
  const adapter = SOURCE_ADAPTERS[demo.source] || SOURCE_ADAPTERS.minimaxh3;

  const card = document.createElement('article');
  card.className =
    'repo-card mmx-reveal group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.025]';
  card.dataset.mmxSlug = demo.slug;
  card.dataset.mmxCategory = demo.category;
  card.dataset.repoSource = demo.source;

  const [w, h] = (demo.aspectRatio || '16:9').split(':').map(Number);
  const ratio = w && h ? w / h : 16 / 9;

  card.innerHTML = `
    <div class="relative" data-repo-card-media>
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end gap-1.5 p-2.5">
        ${metaPill(formatDurationSafe(demo))}
        ${categoryBadge(sourceLabel(demo.source), { tone: 'neutral' })}
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#05070b] to-transparent"></div>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400/80">${escapeHtml(demo.category)}</span>
      <h3 class="mt-1.5 text-sm font-bold leading-snug text-white">${escapeHtml(demo.title)}</h3>
      <p class="mt-1 flex-1 text-xs leading-relaxed text-gray-500">${escapeHtml(demo.useCase || demo.category)}</p>
      <div class="mt-4 flex flex-wrap items-center gap-2" data-repo-card-actions></div>
    </div>
  `;

  const mediaHost = card.querySelector('[data-repo-card-media]');
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio: ratio,
    className: 'w-full',
    ariaLabel: `${demo.title} — ${demo.useCase || ''}`,
  });
  mediaHost.insertBefore(frame, mediaHost.firstChild);

  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `<svg class="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  mediaHost.appendChild(cue);

  const actions = card.querySelector('[data-repo-card-actions]');
  actions.appendChild(
    createViewPromptButton(demo, handleViewPrompt, {
      label: 'View Prompt',
      loadPrompt: adapter.loadDemoPrompt,
      model: adapter.modelName,
      getTarget: adapter.getCreateTarget,
    })
  );
  actions.appendChild(createStyleLink(demo, {
    label: 'Create This Style',
    variant: 'ghost',
    getTarget: adapter.getCreateTarget,
  }));

  return card;
}

/**
 * Create a category section element with its own heading, grid, and
 * lazy-loaded card pool.
 */
function createCategorySection(sectionConfig, allDemos) {
  const sectionDemos = allDemos.filter((d) =>
    sectionConfig.categories.includes(d.category)
  );

  if (sectionDemos.length === 0) return null;

  const section = document.createElement('section');
  section.id = `repo-${sectionConfig.id}-section`;
  section.className = 'relative py-16 sm:py-20';
  section.setAttribute('aria-labelledby', `repo-${sectionConfig.id}-heading`);

  section.innerHTML = `
    <div class="container relative mx-auto max-w-7xl px-5 sm:px-6">
      ${sectionHeading({
        eyebrow: sectionEyebrow(sectionConfig),
        title: sectionConfig.title,
        accent: '',
        subtitle: sectionConfig.subtitle,
        id: `repo-${sectionConfig.id}-heading`,
      })}

      <p class="sr-only" role="status" aria-live="polite" data-repo-status-${sectionConfig.id}></p>

      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5"
        data-repo-grid-${sectionConfig.id}
      ></div>

      <div class="mt-12 flex justify-center">
        <button
          type="button"
          data-repo-show-more-${sectionConfig.id}
          class="btn-enhanced inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]"
        >
          <span data-show-more-label-${sectionConfig.id}>Show All ${sectionDemos.length} Demos</span>
          <svg class="h-4 w-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const grid = section.querySelector(`[data-repo-grid-${sectionConfig.id}]`);
  const showMoreButton = section.querySelector(`[data-repo-show-more-${sectionConfig.id}]`);
  const showMoreLabel = section.querySelector(`[data-show-more-label-${sectionConfig.id}]`);
  const statusEl = section.querySelector(`[data-repo-status-${sectionConfig.id}]`);

  const cardCache = new Map();

  function getCard(demo) {
    if (!cardCache.has(demo.slug)) {
      cardCache.set(demo.slug, createGalleryCard(demo));
    }
    return cardCache.get(demo.slug);
  }

  let expanded = false;

  function render() {
    const visible = expanded ? sectionDemos : sectionDemos.slice(0, sectionConfig.initial);

    pauseFramesIn(grid);
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    const fragment = document.createDocumentFragment();
    visible.forEach((demo) => fragment.appendChild(getCard(demo)));
    grid.appendChild(fragment);

    const hasMore = sectionDemos.length > sectionConfig.initial;
    showMoreButton.parentElement.classList.toggle('hidden', !hasMore);

    if (hasMore) {
      showMoreLabel.textContent = expanded
        ? 'Show Less'
        : 'Show All ' + sectionDemos.length + ' Demos';
      showMoreButton.setAttribute('aria-expanded', String(expanded));
    }

    statusEl.textContent = 'Showing ' + visible.length + ' of ' + sectionDemos.length + ' demos.';

    const disposeReveal = revealOnScroll(grid.querySelectorAll('.mmx-reveal'), { stagger: 45 });

    // Store cleanup
    section._disposeReveal = () => {
      disposeReveal();
      cardCache.forEach((card) => cleanupFrames(card));
    };
  }

  showMoreButton.addEventListener('click', () => {
    expanded = !expanded;
    render();
    if (!expanded) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  render();

  return section;
}

export function ShowcaseRepoVideo() {
  injectMinimaxStyles();

  const container = document.createElement('div');
  container.id = 'repo-video-showcase';
  container.className = 'relative';
  container.setAttribute('aria-label', 'Repo video demos by category');

  // Create a section per category group
  for (const sectionConfig of SECTIONS) {
    const section = createCategorySection(sectionConfig, ALL_DEMOS);
    if (section) container.appendChild(section);
  }

  // Cleanup function
  container.cleanup = () => {
    container.querySelectorAll('section').forEach((s) => {
      if (s._disposeReveal) s._disposeReveal();
      cleanupFrames(s);
    });
  };

  return container;
}

export default ShowcaseRepoVideo;
