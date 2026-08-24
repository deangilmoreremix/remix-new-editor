// GTM Boost — a landing-page feature section.
//
// Replaces the floating "GTM Boost" FAB. Instead of an overlay button, GTM
// Boost is presented as a proper feature: what it is, how it works (a static
// input -> output demo that mirrors the real GTMPromptModal UI/UX), and a real
// demo clip whose prompt can be inspected with the same "View Prompt" modal
// used across the rest of the page.
//
// Visual language matches the other MiniMax H3 landing sections: cyan-400
// accent on #020205, white/8 glass surfaces, font-black headline with an
// italic cyan accent clause, and the shared media frame + scroll reveal.

import { getDemoBySlug, formatDuration, loadDemoPrompt, getCreateTarget, ratioToNumber } from '../../../data/minimaxH3Demos.js';
import { createMediaFrame, cleanupFrames, revealOnScroll } from './minimax/mediaFrame.js';
import {
  injectMinimaxStyles,
  sectionHeading,
  categoryBadge,
  metaPill,
  createViewPromptButton,
  createStyleLink,
  createStudioIcon,
  escapeHtml,
} from './minimax/ui.js';
import { handleViewPrompt } from './minimax/DemoPromptModal.js';

/**
 * Opens the real GTM Boost modal (GTMPromptModal) inside the app shell.
 *
 * Mirrors the dynamic-import pattern the old FAB used so the landing page
 * never statically pulls the heavy modal + OpenAI/Supabase deps into the
 * standalone bundle — it only loads when a visitor actually clicks "Try".
 */
function openGtmBoostModal() {
  import('../../../lib/uiIntegration.js')
    .then(({ openGTMPromptModal }) => openGTMPromptModal('timeline-editor', () => {}))
    .catch((err) => console.error('[GTMBoost] failed to open modal:', err));
}

/* ----------------------------------------------------------- the "how it works" demo */

// A realistic before/after that mirrors the GTMPromptModal structured output.
const BASE_PROMPT = 'Make an ad for my new cold brew coffee brand.';

// Chips shown on the "your idea" side — exactly the GTMPromptModal inputs.
const GTM_ANGLE = [
  { label: 'Target Role', value: 'Marketer' },
  { label: 'Industry', value: 'Food & Beverage' },
  { label: 'Methodology', value: 'AIDA' },
  { label: 'Writing Style', value: 'Cinematic' },
];

// The structured cinematic prompt the modal produces — same section labels
// and emoji the live GTMPromptModal uses (Hook / Story Beat / Visual / Audio / CTA).
const GTM_OUTPUT = [
  {
    label: '🎯 Hook',
    body: 'A condensation-beaded can of cold brew hits an ice-filled glass at golden hour — a single, slow-motion splash that stops the scroll.',
  },
  {
    label: '📖 Story Beat 1',
    body: 'Close on the label, then pull back to reveal a sunlit Brooklyn rooftop; a creator cracks the can and the city exhales.',
  },
  {
    label: '📖 Story Beat 2',
    body: 'Quick cuts of the first sip, a friend passing the can, laughter — effortless, unfiltered morning ritual.',
  },
  {
    label: '📖 Story Beat 3',
    body: 'The can rests beside a book and phone; on-screen text lands the promise: "Smooth. Low-acid. Made to slow down."',
  },
  {
    label: '🎬 Visual Direction',
    body: '35mm anamorphic, warm 5600K key, shallow depth of field; slow-motion splash at 120fps; subtle film grain and a soft cyan grade.',
  },
  {
    label: '🔊 Audio Direction',
    body: 'Ambient city hum under a lo-fi acoustic bed; crisp can-open fizz SFX; a single breathy vocal tag on the CTA.',
  },
  {
    label: '🚀 CTA',
    body: 'On-screen: "Get 2 cans free this week." Voice tag: "Cold brew, the slow way — link in bio."',
  },
];

function gtmAngleChip({ label, value }) {
  return `
    <div class="flex flex-col gap-0.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
      <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">${escapeHtml(label)}</span>
      <span class="text-sm font-medium text-white/90">${escapeHtml(value)}</span>
    </div>`;
}

function gtmOutputSection({ label, body }) {
  return `
    <div class="gtm-demo-section">
      <div class="text-[11px] font-semibold text-cyan-300">${escapeHtml(label)}</div>
      <p class="mt-1 text-sm leading-relaxed text-gray-300">${escapeHtml(body)}</p>
    </div>`;
}

/**
 * Builds the static input -> output demo that shows how GTM Boost works.
 * Pure presentational markup; no API calls, so it renders instantly.
 */
function createHowItWorksDemo() {
  const wrap = document.createElement('div');
  wrap.className =
    'mmx-reveal grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto_1.1fr] lg:items-stretch lg:gap-6';

  // Left: the plain idea the user starts with.
  const input = document.createElement('div');
  input.className =
    'flex flex-col rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:p-6';
  input.innerHTML = `
    <div class="mb-3 flex items-center gap-2">
      <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[11px] font-bold text-white/70">1</span>
      <h3 class="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Your idea</h3>
    </div>
    <div class="rounded-xl border border-white/10 bg-[#05070b] p-4">
      <p class="font-mono text-sm leading-relaxed text-gray-300">${escapeHtml(BASE_PROMPT)}</p>
    </div>
    <p class="mt-4 mb-2 text-xs font-medium text-white/50">+ your GTM angle</p>
    <div class="grid grid-cols-2 gap-2.5">
      ${GTM_ANGLE.map(gtmAngleChip).join('')}
    </div>
  `;

  // Middle: arrow (desktop only).
  const arrow = document.createElement('div');
  arrow.className =
    'hidden items-center justify-center lg:flex';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = `
    <div class="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10">
      <svg class="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
      </svg>
    </div>`;

  // Right: the cinematic prompt GTM Boost produces.
  const output = document.createElement('div');
  output.className =
    'flex flex-col rounded-2xl border border-cyan-400/20 bg-gradient-to-b from-cyan-400/[0.06] to-transparent p-5 sm:p-6';
  output.innerHTML = `
    <div class="mb-4 flex items-center gap-2">
      <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-[11px] font-bold text-cyan-300">2</span>
      <h3 class="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-300">GTM Boost gives you</h3>
    </div>
    <div class="flex flex-col gap-3.5">
      ${GTM_OUTPUT.map(gtmOutputSection).join('')}
    </div>
  `;

  wrap.appendChild(input);
  wrap.appendChild(arrow);
  wrap.appendChild(output);
  return wrap;
}

/* --------------------------------------------------------------- a real demo clip */

/**
 * One GTM-boosted result clip, rendered with the shared media frame and the
 * same "View Prompt" modal used everywhere else on the page — this is the
 * live UI/UX demo, not a screenshot.
 */
function createGtmResultCard(demo) {
  if (!demo) return null;

  const card = document.createElement('article');
  card.className =
    'mmx-card mmx-reveal group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]';

  card.innerHTML = `
    <div class="relative bg-[#05070b]" data-gtm-card-media>
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
        ${categoryBadge(demo.category)}
        ${metaPill(formatDuration(demo))}
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#05070b] to-transparent"></div>
    </div>
    <div class="flex flex-1 flex-col p-5">
      <h3 class="text-base font-bold leading-snug text-white">${escapeHtml(demo.title)}</h3>
      <p class="mt-1.5 flex-1 text-sm leading-relaxed text-gray-400">${escapeHtml(demo.useCase)}</p>
      <div class="mt-5 flex flex-col items-center gap-2.5" data-gtm-card-actions>
        <div class="flex flex-wrap items-center justify-center gap-2.5" data-gtm-primary-actions></div>
        <div class="flex items-center justify-center gap-1.5" data-gtm-studio-icons></div>
      </div>
    </div>
  `;

  const mediaHost = card.querySelector('[data-gtm-card-media]');
  const frame = createMediaFrame(demo, {
    mode: 'hover',
    ratio: ratioToNumber(demo.aspectRatio),
    className: 'w-full',
    ariaLabel: `${demo.title} — ${demo.useCase}`,
  });
  mediaHost.insertBefore(frame, mediaHost.firstChild);

  const cue = document.createElement('span');
  cue.className =
    'pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-0';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = `<svg class="ml-0.5 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  mediaHost.appendChild(cue);

  const actions = card.querySelector('[data-gtm-card-actions]');
  const primaryActions = card.querySelector('[data-gtm-primary-actions]');
  const studioIconsHost = card.querySelector('[data-gtm-studio-icons]');

  primaryActions.appendChild(createViewPromptButton(demo, handleViewPrompt, { label: 'View Prompt', loadPrompt: loadDemoPrompt }));
  primaryActions.appendChild(createStyleLink(demo, { label: 'Create This Style' }));

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

/* ------------------------------------------------------------------- section */

export function GTMBoostSection() {
  injectMinimaxStyles();

  const demo = getDemoBySlug('blackberry-vanilla-soda-ugc-vlog');

  const section = document.createElement('section');
  section.id = 'gtm-boost';
  section.className =
    'relative overflow-hidden bg-gradient-to-b from-[#020205] via-[#05070b] to-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'gtm-boost-heading');
  section.setAttribute('data-testid', 'gtm-boost-section');

  section.innerHTML = `
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_10%,rgba(34,211,238,0.05),transparent_70%)]" aria-hidden="true"></div>

    <div class="container relative z-10 mx-auto max-w-7xl">
      ${sectionHeading({
        eyebrow: 'GTM Boost',
        title: 'Turn a basic idea into a',
        accent: 'cinematic prompt that sells',
        subtitle:
          'GTM Boost applies go-to-market methodology and cinematic storytelling to any idea — so your first prompt already reads like a director’s brief, not a rough note.',
        id: 'gtm-boost-heading',
      })}

      <!-- how it works: input -> output demo -->
      <div data-gtm-demo></div>

      <!-- primary CTA: opens the real GTM Boost modal -->
      <div class="mmx-reveal mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row" data-gtm-cta>
        <button
          type="button"
          data-gtm-try
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-[#020205] shadow-lg shadow-cyan-400/20 transition-all duration-300 hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span>Try GTM Boost</span>
        </button>
        <a
          href="#gtm-boost-example"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 px-5 py-3 text-sm font-semibold text-white/85 transition-all duration-300 hover:border-cyan-400/50 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]"
        >
          <span>See what it produces</span>
        </a>
      </div>

      <!-- live example: a real GTM-boosted clip -->
      <div id="gtm-boost-example" class="mt-16 scroll-mt-24">
        <div class="mmx-reveal mb-6 flex flex-col items-center text-center">
          <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Real example</span>
          <p class="mt-2 max-w-2xl text-base text-gray-400">
            Every result below started as a single line. Open <span class="text-white/80">View Prompt</span> to read the full GTM Boost output that produced it.
          </p>
        </div>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6" data-gtm-example-grid></div>
      </div>
    </div>
  `;

  section.querySelector('[data-gtm-demo]').appendChild(createHowItWorksDemo());

  const tryBtn = section.querySelector('[data-gtm-try]');
  tryBtn.addEventListener('click', openGtmBoostModal);

  const grid = section.querySelector('[data-gtm-example-grid]');
  // Feature the beverage clip plus two more commercial-style demos.
  ['blackberry-vanilla-soda-ugc-vlog', 'gourmet-burger-ugc-taste-test', 'strawberry-drink-transformation-commercial']
    .map((slug) => createGtmResultCard(getDemoBySlug(slug)))
    .forEach((card) => {
      if (card) grid.appendChild(card);
    });

  const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'));

  section.cleanup = () => {
    disposeReveal();
    cleanupFrames(section);
  };

  return section;
}

export default GTMBoostSection;
