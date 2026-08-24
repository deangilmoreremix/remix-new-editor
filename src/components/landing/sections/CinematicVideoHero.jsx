// Cinematic video hero — full-bleed MiniMax H3 background with a left copy rail.
//
// Layout: copy occupies the left ~42% on desktop; the video composition stays
// visible on the right. On mobile the video becomes a dimmed backdrop and the
// headline takes priority.
//
// Performance: the poster paints immediately (fetchpriority=high) and the
// <video> element is only created during an idle callback after first paint, so
// hero media never blocks FMP. The frame reserves its box, so there is no CLS.

import { requireDemo } from '../../../data/minimaxH3Demos.js';
import { createMediaFrame, cleanupFrames, prefersReducedMotion } from './minimax/mediaFrame.js';
import { injectMinimaxStyles, goToRoute } from './minimax/ui.js';
import CheckoutCTA from '../common/CheckoutCTA.jsx';

const HERO_SLUG = 'nighttime-motorcycle-chase-synced-to-music';

export function CinematicVideoHero() {
  injectMinimaxStyles();

  const demo = requireDemo(HERO_SLUG);
  const reduced = prefersReducedMotion();

  const section = document.createElement('section');
  section.className = 'relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#020205]';
  section.setAttribute('role', 'banner');
  section.setAttribute('aria-labelledby', 'mmx-hero-headline');
  section.setAttribute('data-testid', 'cinematic-video-hero');

  section.innerHTML = `
    <!-- media layer -->
    <div class="absolute inset-0 -z-10" data-mmx-hero-media aria-hidden="true"></div>

    <!-- legibility scrim: strong on the left, clear on the right so the
         composition stays readable behind the copy without hiding the video -->
    <div class="pointer-events-none absolute inset-0 -z-[9] bg-gradient-to-b from-[#020205]/85 via-[#020205]/55 to-[#020205]/90 md:bg-gradient-to-r md:from-[#020205] md:via-[#020205]/80 md:to-transparent" aria-hidden="true"></div>
    <div class="pointer-events-none absolute inset-0 -z-[8] hidden md:block md:bg-[radial-gradient(ellipse_70%_60%_at_18%_50%,rgba(2,2,5,0.92),transparent_70%)]" aria-hidden="true"></div>

    <!-- vignette -->
    <div class="pointer-events-none absolute inset-0 -z-[7] shadow-[inset_0_0_180px_60px_rgba(2,2,5,0.9)]" aria-hidden="true"></div>

    <!-- blend into the next section -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 -z-[6] h-40 bg-gradient-to-b from-transparent to-[#020205]" aria-hidden="true"></div>

    <div class="container relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-6 md:py-28">
      <div class="max-w-xl md:w-[45%] md:max-w-none lg:w-[42%]">

        <div class="mmx-reveal mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-4 py-1.5 backdrop-blur-sm">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400"></span>
          <span class="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">AI Creative Personalization Platform</span>
        </div>

        <h1 id="mmx-hero-headline" class="mmx-reveal font-black leading-[0.95] tracking-tight text-white" style="font-size: clamp(2.75rem, 7.5vw, 5rem);">
          Create Anything.<br/>
          <span class="italic text-cyan-400">Personalize Everything.</span>
        </h1>

        <p class="mmx-reveal mt-6 max-w-lg text-base leading-relaxed text-gray-300 sm:text-lg">
          Create personalized cinematic images, videos, ads, characters, commercials and viral social media content with AI.
        </p>

        <div class="mmx-reveal mt-9 flex flex-col gap-4 sm:items-center">
          <div id="checkout-cta-primary-host"></div>

          <button
            type="button"
            data-mmx-hero-secondary
            class="btn-enhanced group inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-7 py-3.5 text-base font-bold text-white backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]"
          >
            <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
              <circle cx="12" cy="12" r="9" stroke-width="1.6"/>
            </svg>
            Watch What You Can Make
          </button>
        </div>

        <dl class="mmx-reveal mt-12 flex flex-wrap items-center gap-x-10 gap-y-5">
          <div>
            <dt class="sr-only">AI models available</dt>
            <dd>
              <span class="block text-2xl font-black text-white sm:text-3xl">200+</span>
              <span class="mt-0.5 block text-xs uppercase tracking-[0.14em] text-gray-500">AI Models</span>
            </dd>
          </div>
          <div class="h-9 w-px bg-white/10" aria-hidden="true"></div>
          <div>
            <dt class="sr-only">Professional studios included</dt>
            <dd>
               <span class="block text-2xl font-black text-white sm:text-3xl">34</span>
               <span class="mt-0.5 block text-xs uppercase tracking-[0.14em] text-gray-500">Professional Studios</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- scroll cue -->
    <div class="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center" aria-hidden="true">
      <svg class="h-5 w-5 animate-bounce text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7"/>
      </svg>
    </div>
  `;

  /* ------------------------------------------------------------------ media */

  const mediaHost = section.querySelector('[data-mmx-hero-media]');

  // Decorative background: aria-hidden, no controls, muted+loop+playsInline.
  // On reduced-motion the frame renders the poster only and never creates a video.
  const frame = createMediaFrame(demo, {
    mode: reduced ? 'poster' : 'inview',
    className: 'h-full w-full',
    priority: true,
    ariaLabel: null,
  });

  // Bias the composition to the right half on desktop so the subject is not
  // hidden behind the copy rail; centred on mobile.
  const poster = frame.querySelector('.mmx-poster');
  if (poster) poster.classList.add('object-center', 'md:object-[70%_center]');
  frame.classList.add('mmx-hero-frame');

  mediaHost.appendChild(frame);

  // Keep the video's object-position in sync once it exists.
  const positionObserver = new MutationObserver(() => {
    const video = frame.querySelector('video');
    if (video && !video.dataset.mmxPositioned) {
      video.dataset.mmxPositioned = 'true';
      video.classList.add('object-center', 'md:object-[70%_center]');
    }
  });
  positionObserver.observe(frame, { childList: true });

  /* ---------------------------------------------------------------- checkout cta */

  const checkoutHost = section.querySelector('#checkout-cta-primary-host');
  if (checkoutHost) {
    const checkoutBtn = CheckoutCTA({
      variant: 'primary',
      offer: {
        id: 'cinematic-trailers',
        headline: 'AI Cinematic Story Study',
        description: 'Create movie-quality trailers, story studies, and cinematic content with AI.',
        cta: 'Get AI Cinematic Story Study',
      },
      providers: ['visa', 'mastercard', 'amex', 'discover', 'jcb', 'affirm', 'klarna', 'afterpay'],
      onCheckout: () => {
        window.location.href = 'https://buy.stripe.com/dRmbJ02OoeaAeKx8Mo5Rm07';
      },
    });
    checkoutHost.appendChild(checkoutBtn);
  }

  const secondary = section.querySelector('[data-mmx-hero-secondary]');

  secondary.addEventListener('click', () => {
    // Stay on the page — jump to the showcase reel.
    const target = document.getElementById('made-with-smartvideo');
    if (target) {
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    } else {
      goToRoute('explore');
    }
  });

  /* ---------------------------------------------------------------- reveal in */

  requestAnimationFrame(() => {
    section.querySelectorAll('.mmx-reveal').forEach((el, index) => {
      el.style.transitionDelay = `${index * 90}ms`;
      el.classList.add('mmx-revealed');
    });
  });

  section.cleanup = () => {
    positionObserver.disconnect();
    cleanupFrames(section);
  };

  return section;
}

export default CinematicVideoHero;
