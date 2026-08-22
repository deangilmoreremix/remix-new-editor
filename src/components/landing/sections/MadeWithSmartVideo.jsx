// "Made With SmartVideo" — premium commercial reel.
//
// Desktop: 3-column grid. Tablet: 2 columns. Mobile: horizontal snap carousel.
// Videos never all autoplay: cards use hover (desktop) / tap (mobile) playback,
// and the shared governor in mediaFrame.js caps concurrent playback at two.

import { minimaxH3Demos, formatDuration } from '../../../data/minimaxH3Demos.js';
import { zeroLuDemos, loadDemoPrompt as loadZeroLuPrompt } from '../../../data/zeroLuDemos.js';
import { createMediaFrame, cleanupFrames, revealOnScroll } from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  sectionHeading,
  createStyleLink,
  createViewPromptButton,
  categoryBadge,
  metaPill,
  escapeHtml,
} from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

const REEL_SLUGS = [
  // MiniMax H3 demos
  'luxury-perfume-commercial',
  'luxury-skincare-storyboard-commercial',
  'yellow-sunglasses-in-a-black-studio',
  'strawberry-drink-transformation-commercial',
  'emerald-bio-serum-product-film',
  'black-and-gold-perfume-commercial',
  // ZeroLu demos
  'adam',
  'bootoshi',
  'guizang',
  'john10',
  'john1',
  'john2',
  'john3',
  'john4',
  'john5',
  'john6',
  'john7',
];

// Build a combined lookup so we can resolve both MiniMax and ZeroLu slugs.
const DEMO_MAP = new Map();
for (const demo of minimaxH3Demos) {
  DEMO_MAP.set(demo.slug, { ...demo, _source: 'minimax' });
}
for (const demo of zeroLuDemos) {
  DEMO_MAP.set(demo.slug, { ...demo, _source: 'zerolu' });
}

function resolveDemo(slug) {
  return DEMO_MAP.get(slug) || null;
}

/**
 * Premium demo card shared by this section.
 * Media sits in a clean black 16:9 frame; metadata and CTAs sit below it.
 */
function createReelCard(demo) {
  const card = document.createElement('article');
  card.className =
    'mmx-card mmx-reveal mmx-snap group flex w-[85vw] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] sm:w-[60vw] md:w-auto md:shrink';

  card.innerHTML = `
    <div class="relative" data-mmx-card-media>
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
        ${categoryBadge(demo.category)}
        ${metaPill(formatDuration(demo))}
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#05070b] to-transparent"></div>
    </div>

    <div class="flex flex-1 flex-col p-5">
      <h3 class="text-base font-bold leading-snug text-white">${escapeHtml(demo.title)}</h3>
      <p class="mt-1.5 flex-1 text-sm leading-relaxed text-gray-400">${escapeHtml(demo.useCase)}</p>
      <div class="mt-5 flex flex-wrap items-center gap-2.5" data-mmx-card-actions></div>
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

  // Play affordance, hidden once the video is running.
  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `
    <svg class="ml-0.5 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>`;
  mediaHost.appendChild(cue);

  const actions = card.querySelector('[data-mmx-card-actions]');
  
  // Use the correct prompt loader based on the demo source.
  const loadPrompt = demo._source === 'zerolu'
    ? async (slug) => loadZeroLuPrompt(slug)
    : undefined;
  
  actions.appendChild(createViewPromptButton(demo, handleViewPrompt, { loadPrompt }));
  actions.appendChild(createStyleLink(demo, { label: 'Create This Style' }));

  return card;
}

export function MadeWithSmartVideo() {
  injectMinimaxStyles();

  // Resolve demos from the combined map so we can mix MiniMax and ZeroLu slugs.
  const demos = REEL_SLUGS.map((slug) => resolveDemo(slug)).filter(Boolean);

  const section = document.createElement('section');
  section.id = 'made-with-smartvideo';
  section.className =
    'relative overflow-hidden bg-gradient-to-b from-[#020205] via-[#05070b] to-[#020205] py-20 md:py-28';
  section.setAttribute('aria-labelledby', 'mmx-reel-heading');
  section.setAttribute('data-testid', 'made-with-smartvideo');

  section.innerHTML = `
    <div class="container mx-auto max-w-7xl px-5 sm:px-6">
      ${sectionHeading({
        eyebrow: 'Showcase',
        title: 'Made With SmartVideo',
        subtitle: 'From a single idea to a finished commercial.',
        id: 'mmx-reel-heading',
      })}
    </div>

    <!-- mobile: horizontal snap reel / md+: responsive grid -->
    <div
      class="mmx-scroller flex snap-x gap-4 overflow-x-auto px-5 pb-4 sm:px-6 md:mx-auto md:grid md:max-w-7xl md:grid-cols-2 md:gap-6 md:overflow-visible md:pb-0 lg:grid-cols-3"
      data-mmx-reel
    ></div>

    <div class="container mx-auto mt-10 max-w-7xl px-5 text-center sm:px-6">
      <p class="mmx-reveal text-sm text-gray-500">
        Every clip on this page was produced from a single text prompt — no crew, no studio, no reshoots.
      </p>
    </div>
  `;

  const reel = section.querySelector('[data-mmx-reel]');
  demos.forEach((demo) => reel.appendChild(createReelCard(demo)));

  const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'));

  section.cleanup = () => {
    disposeReveal();
    cleanupFrames(section);
  };

  return section;
}

export default MadeWithSmartVideo;
