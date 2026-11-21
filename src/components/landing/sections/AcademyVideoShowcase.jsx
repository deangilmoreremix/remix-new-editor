// Academy Video & GIF Showcase — all video/GIF assets from the AI Creator Academy,
// grouped by track and rendered with the same lazy-load media frame used by the
// MiniMax H3 landing sections.
//
// Each card shows the GIF poster first; the MP4 starts playing when the card
// enters the viewport or on desktop hover.

import {
  ACADEMY_ASSETS,
  ACADEMY_TRACKS,
} from '../../../data/academy/catalog.js';
import {
  createMediaFrame,
  cleanupFrames,
  revealOnScroll,
} from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  escapeHtml,
  metaPill,
  categoryBadge,
  createViewPromptButton,
  createPersonalizeButton,
  createStyleLink,
  createStudioIcon,
} from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';
import { ACADEMY_STUDIO_ADAPTERS } from '../../../data/academyStudioAdapters.js';

const ACADEMY_MODEL = 'SmartVideo Academy';

/** Studio used for "Create This Type of Video" when an asset has no adapter. */
const TRACK_ROUTES = {
  '01-ai-video-ads-ugc': 'commercial',
  '02-ai-filmmaking': 'cinema',
  '05-ai-avatars-and-influencers': 'influencer',
  '07-ai-product-photography': 'commercial',
  '08-ai-fashion-and-virtual-tryon': 'influencer',
  '10-ai-headshots-and-portraits': 'image',
};

/** Only assets that have an actual video or gif source. */
const VIDEO_ASSETS = ACADEMY_ASSETS.filter(
  (a) => a.type === 'video' || a.type === 'gif'
);

/** Build a lookup: track slug -> track meta. */
const TRACK_MAP = new Map(ACADEMY_TRACKS.map((t) => [t.slug, t]));

/** Clean up track titles from the catalog into the user-facing track names. */
function cleanTrackTitle(raw) {
  return raw
    .replace(/^\d+[-–—]\s*/, '')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\s+And\s+/g, ' & ')
    .replace(/\s*\(Virtual Staging\)\s*/g, '')
    .replace(/\s+Design\s*$/g, '')
    .trim();
}

/** Group video assets by their category (track slug). */
function groupByTrack() {
  const groups = new Map();
  for (const asset of VIDEO_ASSETS) {
    const trackSlug = asset.category;
    if (!groups.has(trackSlug)) groups.set(trackSlug, []);
    groups.get(trackSlug).push(asset);
  }
  return groups;
}

/** Hide a card whose media is missing (and its whole track block if none remain). */
function hideUnavailableCard(card) {
  card.classList.add('hidden');
  const block = card.closest('[data-academy-track]');
  if (block && !block.querySelector('article:not(.hidden)')) block.classList.add('hidden');
}

/**
 * Studio prefill for an Academy asset: the curated adapter when one exists
 * (same data the Academy studio uses), otherwise a prompt built from the card.
 */
function buildAcademyDemo(asset) {
  const adapter = ACADEMY_STUDIO_ADAPTERS.find((a) => a.id === asset.id);
  const track = TRACK_MAP.get(asset.category);
  const trackTitle = cleanTrackTitle(track?.title || asset.category);
  const prompt =
    adapter?.prompt ||
    [asset.title, asset.description && asset.description !== asset.title ? asset.description : '', `${trackTitle} example from the AI Creator Academy.`]
      .filter(Boolean)
      .join('. ');
  const route = adapter?.studio || TRACK_ROUTES[asset.category] || 'video';
  const params = { 'academy-template': asset.id, prompt };
  if (adapter?.stylePreset) params.style = adapter.stylePreset;
  if (adapter?.aspectRatio) params.aspect_ratio = adapter.aspectRatio;
  if (adapter?.duration) params.duration = adapter.duration;
  const query = new URLSearchParams(params).toString();

  return {
    demo: {
      slug: asset.id,
      title: asset.title,
      category: trackTitle,
      useCase: asset.description && asset.description !== asset.title ? asset.description : `${trackTitle} example from the AI Creator Academy.`,
      duration: adapter?.duration || null,
      aspectRatio: adapter?.aspectRatio || '16:9',
      prompt,
      videoSrc: asset.videoSrc || asset.src,
      posterSrc: asset.gifSrc || asset.src,
    },
    target: { route, params, href: `/?${query}#/${route}` },
    params,
  };
}

function createAcademyCard(asset) {
  const card = document.createElement('article');
  card.className =
    'mmx-card mmx-reveal group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.025]';

  const { demo, target, params } = buildAcademyDemo(asset);
  const loadPrompt = async () => demo.prompt;

  card.innerHTML = `
    <div class="relative" data-academy-card-media>
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end gap-1.5 p-2.5">
        ${demo.duration ? metaPill(demo.duration + 's') : ''}
        ${categoryBadge(ACADEMY_MODEL, { tone: 'neutral' })}
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#05070b] to-transparent"></div>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400/80">${escapeHtml(demo.category)}</span>
      <h3 class="mt-1.5 line-clamp-2 break-words text-sm font-bold leading-snug text-white" title="${escapeHtml(demo.title)}">${escapeHtml(demo.title)}</h3>
      <p class="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-gray-500">${escapeHtml(demo.useCase)}</p>
      <div class="mt-4 flex flex-col items-center gap-2">
        <div class="flex flex-wrap items-center justify-center gap-2" data-academy-primary-actions></div>
        <div class="flex items-center justify-center gap-1.5" data-mmx-studio-icons></div>
      </div>
    </div>
  `;

  const mediaHost = card.querySelector('[data-academy-card-media]');
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio: 16 / 9,
    className: 'w-full',
    ariaLabel: `${asset.title} — ${demo.category} ${asset.type}`,
    onUnavailable: () => hideUnavailableCard(card),
  });
  mediaHost.insertBefore(frame, mediaHost.firstChild);

  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `<svg class="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  mediaHost.appendChild(cue);

  const primaryActions = card.querySelector('[data-academy-primary-actions]');
  const studioIconsHost = card.querySelector('[data-mmx-studio-icons]');
  const getTarget = () => target;

  primaryActions.appendChild(
    createViewPromptButton(demo, handleViewPrompt, {
      label: 'View Prompt',
      loadPrompt,
      model: ACADEMY_MODEL,
      getTarget,
    })
  );
  primaryActions.appendChild(createPersonalizeButton(demo, { loadPrompt }));
  primaryActions.appendChild(
    createStyleLink(demo, {
      label: 'Create This Type of Video',
      variant: 'ghost',
      getTarget,
      loadPrompt,
      model: ACADEMY_MODEL,
    })
  );

  [
    { route: 'templates', label: 'T', title: 'Open in Template Studio' },
    { route: 'cinema-template', label: 'C', title: 'Open in Cinema Template Studio' },
    { route: 'cinema', label: 'F', title: 'Open in Cinema Studio' },
    { route: 'video', label: 'V', title: 'Open in Video Studio' },
    { route: 'image', label: 'I', title: 'Open in Image Studio' },
    { route: 'personalize', label: 'P', title: 'Personalize this demo', loadPrompt },
  ].forEach((icon) => {
    studioIconsHost.appendChild(
      createStudioIcon(demo, {
        route: icon.route,
        params: icon.route === 'personalize' ? {} : params,
        label: icon.label,
        title: icon.title,
        loadPrompt: icon.loadPrompt,
      })
    );
  });

  return card;
}

export function AcademyVideoShowcase() {
  injectMinimaxStyles();

  const grouped = groupByTrack();
  const sortedTracks = Array.from(grouped.keys()).sort((a, b) => {
    const trackA = TRACK_MAP.get(a);
    const trackB = TRACK_MAP.get(b);
    return (trackA?.order || 999) - (trackB?.order || 999);
  });

  const section = document.createElement('section');
  section.id = 'academy-video-showcase';
  section.className =
    'relative overflow-hidden bg-gradient-to-b from-[#020205] via-[#05070b] to-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'academy-videos-heading');
  section.setAttribute('data-testid', 'academy-video-showcase');

  const container = document.createElement('div');
  container.className = 'container relative z-10 mx-auto max-w-7xl';

  const tracksRoot = document.createElement('div');
  tracksRoot.className = 'mt-12';

  for (const trackSlug of sortedTracks) {
    const track = TRACK_MAP.get(trackSlug);
    const title = cleanTrackTitle(track?.title || trackSlug);
    const assets = grouped.get(trackSlug) || [];

    const trackBlock = document.createElement('div');
    trackBlock.className = 'mb-16 last:mb-0';
    trackBlock.dataset.academyTrack = trackSlug;

    const heading = document.createElement('div');
    heading.className = 'mb-6';
    heading.innerHTML = `
      <h3 class="text-xl font-bold text-white md:text-2xl">${escapeHtml(title)}</h3>
      <p class="mt-1 text-sm text-gray-500">${escapeHtml(track?.summary || '')}</p>
    `;
    trackBlock.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5';

    for (const asset of assets) {
      grid.appendChild(createAcademyCard(asset));
    }

    trackBlock.appendChild(grid);
    tracksRoot.appendChild(trackBlock);
  }

  container.appendChild(tracksRoot);
  section.appendChild(container);

  // Wire up scroll reveal for all academy cards.
  const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'), {
    stagger: 55,
  });

  section.cleanup = () => {
    disposeReveal();
    section.querySelectorAll('.mmx-frame').forEach((frame) => frame.cleanup?.());
  };

  return section;
}

export default AcademyVideoShowcase;
