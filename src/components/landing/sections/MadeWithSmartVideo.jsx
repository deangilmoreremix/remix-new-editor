// "Made With SmartVideo" — premium commercial reel.
//
// Desktop: 3-column grid. Tablet: 2 columns. Mobile: horizontal snap carousel.
// Videos never all autoplay: cards use hover (desktop) / tap (mobile) playback,
// and the shared governor in mediaFrame.js caps concurrent playback at two.

import { minimaxH3Demos, formatDuration, getCreateTarget as getMinimaxCreateTarget, ratioToNumber as minimaxRatioToNumber } from '../../../data/minimaxH3Demos.js';
import { seedance25Demos, getCreateTarget as getCreateTargetSeedance, ratioToNumber as seedanceRatioToNumber } from '../../../data/beatapiSeedance25Demos.js';
import { createMediaFrame, cleanupFrames, revealOnScroll } from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  sectionHeading,
  createStyleLink,
  createViewPromptButton,
  createStudioIcon,
  categoryBadge,
  metaPill,
  escapeHtml,
} from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

const REEL_SLUGS = [
  'luxury-perfume-commercial',
  'luxury-skincare-storyboard-commercial',
  'yellow-sunglasses-in-a-black-studio',
  'strawberry-drink-transformation-commercial',
  'emerald-bio-serum-product-film',
  'black-and-gold-perfume-commercial',
];

const CHUNK_SIZE = 20;

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
      <div class="mt-5 flex flex-col items-center gap-2.5" data-mmx-card-actions>
        <div class="flex flex-wrap items-center justify-center gap-2.5" data-mmx-primary-actions></div>
        <div class="flex items-center justify-center gap-1.5" data-mmx-studio-icons></div>
      </div>
    </div>
  `;

  const mediaHost = card.querySelector('[data-mmx-card-media]');
  const ratio = demo._source === 'seedance25'
    ? seedanceRatioToNumber(demo.aspectRatio)
    : minimaxRatioToNumber(demo.aspectRatio);
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio,
    className: 'w-full',
    ariaLabel: `${demo.title} — ${demo.useCase}`,
  });
  mediaHost.insertBefore(frame, mediaHost.firstChild);

  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `
    <svg class="ml-0.5 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>`;
  mediaHost.appendChild(cue);

  const primaryActions = card.querySelector('[data-mmx-primary-actions]');
  const studioIconsHost = card.querySelector('[data-mmx-studio-icons]');

  const getTarget = demo._source === 'seedance25'
    ? (d) => getCreateTargetSeedance(d)
    : undefined;

  primaryActions.appendChild(createViewPromptButton(demo, handleViewPrompt));
  primaryActions.appendChild(createStyleLink(demo, {
    label: 'Create This Style',
    getTarget
  }));

  const target = (getTarget || demo._getCreateTarget)(demo);
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

export function MadeWithSmartVideo() {
  injectMinimaxStyles();

  const curatedDemos = REEL_SLUGS
    .map((slug) => minimaxH3Demos.find((d) => d.slug === slug))
    .filter(Boolean)
    .map((d) => ({ ...d, _source: 'minimax', _getCreateTarget: getMinimaxCreateTarget }));

  const cinemaDemos = seedance25Demos
    .filter((d) => d.category === 'Cinema')
    .map((d) => ({ ...d, _source: 'seedance25', _getCreateTarget: getCreateTargetSeedance }));

  const demos = [...curatedDemos, ...cinemaDemos];

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
  const footerText = section.querySelector('.container.mt-10');

  let visibleCount = CHUNK_SIZE;

  const showMoreButton = document.createElement('button');
  showMoreButton.type = 'button';
  showMoreButton.className = 'btn-enhanced inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070b]';
  showMoreButton.innerHTML = `
    <span data-mmx-show-more-label>Show All ${demos.length} Demos</span>
    <svg class="h-4 w-4 transition-transform duration-300" data-mmx-show-more-icon fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
    </svg>
  `;

  const showMoreLabel = showMoreButton.querySelector('[data-mmx-show-more-label]');
  const showMoreIcon = showMoreButton.querySelector('[data-mmx-show-more-icon]');

  function render() {
    const visible = demos.slice(0, visibleCount);

    cleanupFrames(reel);
    while (reel.firstChild) reel.removeChild(reel.firstChild);

    const fragment = document.createDocumentFragment();
    visible.forEach((demo) => fragment.appendChild(createReelCard(demo)));
    reel.appendChild(fragment);

    const hasMore = demos.length > visibleCount;
    showMoreButton.parentElement.classList.toggle('hidden', !hasMore);

    if (hasMore) {
      const remaining = demos.length - visibleCount;
      const nextBatch = Math.min(CHUNK_SIZE, remaining);
      showMoreLabel.textContent = `Show ${nextBatch} More`;
      showMoreIcon.classList.remove('rotate-180');
      showMoreButton.setAttribute('aria-expanded', 'false');
    } else {
      showMoreLabel.textContent = 'Show Less';
      showMoreIcon.classList.add('rotate-180');
      showMoreButton.setAttribute('aria-expanded', 'true');
    }

    const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'), { stagger: 45 });
    section._disposeReveal = () => {
      disposeReveal();
      cleanupFrames(section);
    };
  }

  showMoreButton.addEventListener('click', () => {
    const hasMore = demos.length > visibleCount;
    if (hasMore) {
      visibleCount = Math.min(demos.length, visibleCount + CHUNK_SIZE);
      render();
    } else {
      visibleCount = CHUNK_SIZE;
      render();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  footerText.insertBefore(showMoreButton, footerText.firstChild);

  render();

  section.cleanup = () => {
    if (section._disposeReveal) section._disposeReveal();
    cleanupFrames(section);
  };

  return section;
}

export default MadeWithSmartVideo;
