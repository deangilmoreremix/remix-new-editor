// UGC ad showcase — creator-style social proof.
//
// Four labelled verticals (Restaurant, Local Business, Beverage, Beauty).
// The upstream clips are not natively 9:16, so each frame uses the clip's own
// aspect ratio inside a social-styled shell rather than stretching it. When
// true 9:16 SmartVideo renders replace the files, set FORCE_VERTICAL to true.

import { getDemoBySlug, formatDuration, ratioToNumber } from '../../../data/minimaxH3Demos.js';
import { createMediaFrame, cleanupFrames, revealOnScroll } from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  sectionHeading,
  createStyleLink,
  categoryBadge,
  metaPill,
  escapeHtml,
} from './minimax/ui.js';
import { createViewPromptButton } from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

/**
 * Flip to true once /media/minimax-h3/videos/*.webm hold true 9:16 renders.
 * Until then we honour the source ratio so nothing is distorted.
 */
const FORCE_VERTICAL = false;

const UGC_CARDS = [
  {
    slug: 'ramen-bowl-ugc-taste-test',
    label: 'Restaurant',
    description: 'Menu items filmed like a creator taste test — no camera crew, no food stylist.',
  },
  {
    slug: 'gourmet-burger-ugc-taste-test',
    label: 'Local Business',
    description: 'Storefront promos that look native to the feed instead of like a paid ad.',
  },
  {
    slug: 'blackberry-vanilla-soda-ugc-vlog',
    label: 'Beverage',
    description: 'Product vlogs and first-sip reactions for CPG launches and seasonal drops.',
  },
  {
    slug: 'morning-lip-oil-ugc-testimonial',
    label: 'Beauty',
    description: 'Routine and testimonial ads with a believable on-camera presenter.',
  },
];

function createUGCCard(config) {
  const demo = getDemoBySlug(config.slug);
  if (!demo) return null;

  const card = document.createElement('article');
  card.className =
    'mmx-card mmx-reveal group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]';

  card.innerHTML = `
    <div class="relative bg-[#05070b]" data-mmx-card-media>
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
        ${categoryBadge(config.label)}
        ${metaPill(formatDuration(demo))}
      </div>

      <!-- social chrome: reads as a vertical feed post without faking the ratio -->
      <div class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex items-end gap-2 bg-gradient-to-t from-[#05070b] via-[#05070b]/70 to-transparent p-3 pt-10">
        <span class="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[9px] font-bold text-white">SV</span>
        <span class="text-[11px] font-medium text-white/80">@smartvideo</span>
        <span class="ml-auto flex items-center gap-1 text-[11px] text-white/60">
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          UGC
        </span>
      </div>
    </div>

    <div class="flex flex-1 flex-col p-5">
      <h3 class="text-base font-bold leading-snug text-white">${escapeHtml(demo.title)}</h3>
      <p class="mt-1.5 flex-1 text-sm leading-relaxed text-gray-400">${escapeHtml(config.description)}</p>
      <div class="mt-5 flex flex-wrap items-center gap-2.5" data-mmx-card-actions></div>
    </div>
  `;

  const mediaHost = card.querySelector('[data-mmx-card-media]');

  // Never distort: use the clip's real ratio unless we own true vertical assets.
  const nativeRatio = ratioToNumber(demo.aspectRatio);
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio: FORCE_VERTICAL ? 9 / 16 : nativeRatio,
    className: 'w-full',
    objectFit: FORCE_VERTICAL ? 'cover' : 'cover',
    ariaLabel: `${config.label} UGC example — ${demo.title}`,
  });
  mediaHost.insertBefore(frame, mediaHost.firstChild);

  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `<svg class="ml-0.5 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  mediaHost.appendChild(cue);

  const actions = card.querySelector('[data-mmx-card-actions]');
  actions.appendChild(createViewPromptButton(demo, handleViewPrompt, { label: 'View Prompt' }));
  actions.appendChild(createStyleLink(demo, { label: 'Create This Type of Video' }));

  return card;
}

export function UGCDemoShowcase() {
  injectMinimaxStyles();

  const section = document.createElement('section');
  section.id = 'ugc-showcase';
  section.className = 'relative overflow-hidden bg-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'mmx-ugc-heading');
  section.setAttribute('data-testid', 'ugc-demo-showcase');

  section.innerHTML = `
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_20%,rgba(34,211,238,0.045),transparent_70%)]" aria-hidden="true"></div>

    <div class="container relative z-10 mx-auto max-w-7xl">
      ${sectionHeading({
        eyebrow: 'Social ads',
        title: 'Create UGC Ads',
        accent: 'Without Hiring Creators',
        subtitle: 'Turn products, ideas and scripts into social-ready ads in minutes.',
        id: 'mmx-ugc-heading',
      })}

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6" data-mmx-ugc-grid></div>
    </div>
  `;

  const grid = section.querySelector('[data-mmx-ugc-grid]');
  UGC_CARDS.forEach((config) => {
    const card = createUGCCard(config);
    if (card) grid.appendChild(card);
  });

  const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'));

  section.cleanup = () => {
    disposeReveal();
    cleanupFrames(section);
  };

  return section;
}

export default UGCDemoShowcase;
