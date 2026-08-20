// Repo Video Showcase — demos split into focused per-source per-category sections.
//
// Mirrors the existing landing-page architecture: instead of a single
// monolithic gallery, the 512 demos are distributed across 12 dedicated
// showcase sections — one per source-repo × category combination that has
// enough content. Each section has its own sectionHeading, initial card set,
// and "Show More" behaviour — exactly like UGCDemoShowcase and
// MadeWithSmartVideo.
//
// Source mapping:
//   BeatAPI/awesome-minimax-h3-prompts     → 253 MiniMax H3 demos
//   BeatAPI/awesome-seedance-2-5-prompts   → 242 Seedance 2.5 demos
//   ZeroLu/awesome-seedance                → 35  Seedance 2.0 demos (17 playable)
//
// Sections (each curated by category + source):
//   1. MiniMax H3 — Cinema & Concept Shorts      (77 demos)
//   2. MiniMax H3 — Commercial & Brand Films      (70 demos)
//   3. Seedance 2.5 — Social Media Content        (68 demos)
//   4. Seedance 2.5 — Cinema Shorts               (62 demos)
//   5. MiniMax H3 — Social Content                (52 demos)
//   6. Seedance 2.5 — Commercial & Ads            (46 demos)
//   7. Seedance 2.5 — Action Sequences            (46 demos)
//   8. MiniMax H3 — Animation Reels               (17 demos)
//   9. Seedance 2.5 — Animation & Motion Design   (19 demos)
//  10. ZeroLu — Cinema Reference Clips            (17 demos)
//  11. MiniMax H3 — Action & VFX                  (26 demos, 21+5 merged)
//  12. MiniMax H3 — Fashion Films                 (11 demos)

import { minimaxH3Demos, getCreateTarget as getCreateTargetMinimax, loadDemoPrompt as loadDemoPromptMinimax, MINIMAX_MODEL } from '../../../data/beatapiMinimaxH3Demos.js';
import { seedance25Demos, getCreateTarget as getCreateTargetSeedance, loadDemoPrompt as loadDemoPromptSeedance, SEEDANCE_MODEL } from '../../../data/beatapiSeedance25Demos.js';
import { zeroLuDemos, getCreateTarget as getCreateTargetZeroLu, loadDemoPrompt as loadDemoPromptZeroLu, ZERO_LU_MODEL } from '../../../data/zeroLuDemos.js';

import { createMediaFrame, cleanupFrames, pauseFramesIn, revealOnScroll } from './minimax/mediaFrame.js';
import { injectMinimaxStyles, sectionHeading, createStyleLink, createViewPromptButton, metaPill, categoryBadge, escapeHtml } from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

/** Per-source adapters for CTA routing and prompt loading. */
const SOURCE_ADAPTERS = {
  seedance25: {
    getCreateTarget: getCreateTargetSeedance,
    loadDemoPrompt: loadDemoPromptSeedance,
    modelName: SEEDANCE_MODEL,
    sourceLabel: 'Seedance 2.5',
  },
  minimaxh3: {
    getCreateTarget: getCreateTargetMinimax,
    loadDemoPrompt: loadDemoPromptMinimax,
    modelName: MINIMAX_MODEL,
    sourceLabel: 'MiniMax H3',
  },
  zeroLu: {
    getCreateTarget: getCreateTargetZeroLu,
    loadDemoPrompt: loadDemoPromptZeroLu,
    modelName: ZERO_LU_MODEL,
    sourceLabel: 'ZeroLu (Sd 2.0)',
  },
};

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
 * 12 focused showcase sections.
 * Each pulls from a specific source × category combination, so every
 * section is tightly themed (like UGCDemoShowcase's vertical-specific cards).
 */
const SHOWCASE_SECTIONS = [
  {
    id: 'mmx-cinema',
    source: 'minimaxh3',
    category: 'Cinema',
    eyebrow: 'MiniMax H3',
    title: 'Cinema & Concept Shorts',
    subtitle: 'Full-length cinematic scenes, narrative concepts, and mood-driven shorts — each with a source-verified reference video.',
    initial: 12,
  },
  {
    id: 'mmx-commercial',
    source: 'minimaxh3',
    category: 'Commercial',
    eyebrow: 'MiniMax H3',
    title: 'Commercial & Brand Films',
    subtitle: 'High-production product spots, brand identity films, and commercial reels with polished cinematic grading.',
    initial: 12,
  },
  {
    id: 'sd-social',
    source: 'seedance25',
    category: 'Social',
    eyebrow: 'Seedance 2.5',
    title: 'Social Media Content',
    subtitle: 'Viral-ready clips optimized for TikTok, Instagram Reels, and Shorts — native aspect ratios and creator-style framing.',
    initial: 12,
  },
  {
    id: 'sd-cinema',
    source: 'seedance25',
    category: 'Cinema',
    eyebrow: 'Seedance 2.5',
    title: 'Cinema Shorts',
    subtitle: 'Story-driven concept films, narrative scenes, and cinematic sequences generated from long-form Seedance prompts.',
    initial: 12,
  },
  {
    id: 'mmx-social',
    source: 'minimaxh3',
    category: 'Social',
    eyebrow: 'MiniMax H3',
    title: 'Social Content',
    subtitle: 'TikTok-native, Instagram-first, and Shorts-optimized vertical content — each tuned for platform engagement.',
    initial: 12,
  },
  {
    id: 'sd-commercial',
    source: 'seedance25',
    categories: ['Commercial', 'Fashion'],
    eyebrow: 'Seedance 2.5',
    title: 'Commercial & Ads',
    subtitle: 'E-commerce product reveals, local business promos, brand ads, and fashion reels — all driven by single-prompt Seedance generation.',
    initial: 12,
  },
  {
    id: 'sd-action',
    source: 'seedance25',
    category: 'Action',
    eyebrow: 'Seedance 2.5',
    title: 'Action Sequences',
    subtitle: 'High-energy fight scenes, chase sequences, and kinetic action footage — generated from precise Seedance prompt libraries.',
    initial: 12,
  },
  {
    id: 'sd-animation',
    source: 'seedance25',
    category: 'Animation',
    eyebrow: 'Seedance 2.5',
    title: 'Animation & Motion Design',
    subtitle: 'Stylized animation, kinetic typography, and 2D/3D motion graphics from curated Seedance animation prompts.',
    initial: 10,
  },
  {
    id: 'mmx-animation',
    source: 'minimaxh3',
    category: 'Animation',
    eyebrow: 'MiniMax H3',
    title: 'Animation Reels',
    subtitle: 'Anime-style motion, 3D renders, and stylized animation sequences with MiniMax H3 reference footage.',
    initial: 10,
  },
  {
    id: 'zl-cinema',
    source: 'zeroLu',
    category: 'Cinema',
    eyebrow: 'ZeroLu',
    title: 'Cinema Reference Clips',
    subtitle: 'Curated Seedance 2.0 reference footage — the raw clips that started it all in the awesome-seedance collection.',
    initial: 10,
  },
  {
    id: 'mmx-action-vfx',
    source: 'minimaxh3',
    categories: ['Action', 'VFX'],
    eyebrow: 'MiniMax H3',
    title: 'Action & VFX',
    subtitle: 'Explosions, fight scenes, game cinematics, and motion graphics with MiniMax H3 precision.',
    initial: 12,
  },
  {
    id: 'mmx-fashion',
    source: 'minimaxh3',
    category: 'Fashion',
    eyebrow: 'MiniMax H3',
    title: 'Fashion Films',
    subtitle: 'Runway looks, beauty reels, and luxury product films with premium cinematic styling.',
    initial: 8,
  },
];

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
        ${categoryBadge(adapter.sourceLabel, { tone: 'neutral' })}
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
 * Create a showcase section element for a single source × category group.
 * Mirrors the structure of UGCDemoShowcase and MadeWithSmartVideo:
 *   - sectionHeading (eyebrow, title, subtitle)
 *   - card grid with lazy reveal
 *   - "Show All" button with smooth scroll back to section
 */
function createShowcaseSection(config, allDemos) {
  const sectionDemos = allDemos.filter((d) => {
    const sources = Array.isArray(config.source) ? config.source : [config.source];
    const categories = Array.isArray(config.category) ? config.category : config.categories || (config.category ? [config.category] : []);
    return sources.includes(d.source) && categories.includes(d.category);
  });

  if (sectionDemos.length === 0) return null;

  // Sort by title for consistent display
  sectionDemos.sort((a, b) => a.title.localeCompare(b.title));

  const sectionId = config.id;
  const section = document.createElement('section');
  section.id = `repo-${sectionId}`;
  section.className = 'relative py-12 sm:py-16';

  section.innerHTML = `
    <div class="container mx-auto max-w-7xl px-5 sm:px-6">
      ${sectionHeading({
        eyebrow: config.eyebrow,
        title: config.title,
        accent: '',
        subtitle: config.subtitle,
        id: `repo-${sectionId}-heading`,
      })}

      <p class="sr-only" role="status" aria-live="polite" data-repo-status-${sectionId}></p>

      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5"
        data-repo-grid-${sectionId}
      ></div>

      <div class="mt-12 flex justify-center">
        <button
          type="button"
          data-repo-show-more-${sectionId}
          class="btn-enhanced inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070b]"
        >
          <span data-show-more-label-${sectionId}>Show All ${sectionDemos.length} Demos</span>
          <svg class="h-4 w-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const grid = section.querySelector(`[data-repo-grid-${sectionId}]`);
  const showMoreButton = section.querySelector(`[data-repo-show-more-${sectionId}]`);
  const showMoreLabel = section.querySelector(`[data-show-more-label-${sectionId}]`);
  const statusEl = section.querySelector(`[data-repo-status-${sectionId}]`);

  const cardCache = new Map();

  function getCard(demo) {
    if (!cardCache.has(demo.slug)) {
      cardCache.set(demo.slug, createGalleryCard(demo));
    }
    return cardCache.get(demo.slug);
  }

  let expanded = false;

  function render() {
    const initialCount = config.initial || 8;
    const visible = expanded ? sectionDemos : sectionDemos.slice(0, initialCount);

    pauseFramesIn(grid);
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    const fragment = document.createDocumentFragment();
    visible.forEach((demo) => fragment.appendChild(getCard(demo)));
    grid.appendChild(fragment);

    const hasMore = sectionDemos.length > initialCount;
    showMoreButton.parentElement.classList.toggle('hidden', !hasMore);

    if (hasMore) {
      showMoreLabel.textContent = expanded
        ? 'Show Less'
        : 'Show All ' + sectionDemos.length + ' Demos';
      showMoreButton.setAttribute('aria-expanded', String(expanded));
    }

    statusEl.textContent = 'Showing ' + visible.length + ' of ' + sectionDemos.length + ' demos.';

    const disposeReveal = revealOnScroll(grid.querySelectorAll('.mmx-reveal'), { stagger: 45 });

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
  container.setAttribute('aria-label', 'Repo video demos by source and category');

  // Create one section per showcase config
  for (const config of SHOWCASE_SECTIONS) {
    const section = createShowcaseSection(config, ALL_DEMOS);
    if (section) container.appendChild(section);
  }

  // Cleanup function for all child sections
  container.cleanup = () => {
    container.querySelectorAll('section').forEach((s) => {
      if (s._disposeReveal) s._disposeReveal();
      cleanupFrames(s);
    });
  };

  return container;
}

export default ShowcaseRepoVideo;
