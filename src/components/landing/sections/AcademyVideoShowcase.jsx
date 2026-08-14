// Academy Video & GIF Showcase — all video/GIF assets from the AI Creator Academy,
// grouped by track and rendered with the same lazy-load media frame used by the
// MiniMax H3 landing sections.
//
// Each card shows the GIF poster first; the MP4 starts playing when the card
// enters the viewport or on desktop hover.

import {
  ACADEMY_ASSETS,
  ACADEMY_TRACKS,
} from '../../../data/academy/catalog.ts';
import {
  createMediaFrame,
  cleanupFrames,
  revealOnScroll,
} from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  escapeHtml,
} from './minimax/ui.js';

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

function createAcademyCard(asset) {
  const card = document.createElement('article');
  card.className =
    'mmx-card mmx-reveal group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.025]';

  // Use the GIF as poster; fall back to the primary src if no gifSrc.
  const posterSrc = asset.gifSrc || asset.src;
  const videoSrc = asset.videoSrc || asset.src;

  // Build a minimal demo-like object for createMediaFrame.
  const demo = {
    slug: asset.id,
    videoSrc,
    posterSrc,
  };

  card.innerHTML = `
    <div class="relative" data-academy-card-media>
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end p-2.5">
        <span class="inline-flex items-center rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/80 backdrop-blur-sm">
          ${asset.type === 'gif' ? 'GIF' : 'Video'}
        </span>
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#05070b] to-transparent"></div>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400/80">
        ${escapeHtml(asset.category)}
      </span>
      <h3 class="mt-1.5 text-sm font-bold leading-snug text-white">${escapeHtml(asset.title)}</h3>
      ${asset.description ? `<p class="mt-1 flex-1 text-xs leading-relaxed text-gray-500">${escapeHtml(asset.description)}</p>` : ''}
    </div>
  `;

  const mediaHost = card.querySelector('[data-academy-card-media]');
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio: 16 / 9,
    className: 'w-full',
    ariaLabel: `${asset.title} — ${asset.category} ${asset.type}`,
  });
  mediaHost.insertBefore(frame, mediaHost.firstChild);

  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `<svg class="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  mediaHost.appendChild(cue);

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
