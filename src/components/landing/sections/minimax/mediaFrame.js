// Shared media engine for the MiniMax H3 landing sections.
//
// Every demo video on the landing page goes through createMediaFrame() so that
// loading, playback and teardown behave identically everywhere:
//
//   - poster image renders first; the <video> element is not created at all
//     until the card approaches the viewport (IntersectionObserver),
//   - a global governor caps concurrent playback so we never have 30 decoders
//     running at once,
//   - videos pause and release as soon as they leave the viewport,
//   - prefers-reduced-motion short-circuits everything to a static poster,
//   - missing media degrades to a branded placeholder instead of a black box.
//
// No video file is ever imported through JS; sources are plain public URLs.

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Max number of <video> elements allowed to play at the same time. */
const MAX_CONCURRENT_PLAYBACK = 2;

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function isCoarsePointer() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/* ------------------------------------------------------------ playback governor */

/** Videos currently playing, in activation order (oldest first). */
const activeVideos = [];

function releaseVideo(video) {
  const index = activeVideos.indexOf(video);
  if (index !== -1) activeVideos.splice(index, 1);
}

function requestPlayback(video) {
  if (!video || video.dataset.mmxFailed === 'true') return;

  if (!activeVideos.includes(video)) {
    while (activeVideos.length >= MAX_CONCURRENT_PLAYBACK) {
      const oldest = activeVideos.shift();
      if (oldest && oldest !== video) {
        try {
          oldest.pause();
        } catch {
          /* ignore */
        }
      }
    }
    activeVideos.push(video);
  }

  const attempt = video.play();
  if (attempt && typeof attempt.catch === 'function') {
    // Autoplay rejection is expected on some browsers/power modes — the poster
    // simply stays visible. Never let it surface as an unhandled rejection.
    attempt.catch(() => {
      releaseVideo(video);
    });
  }
}

function pausePlayback(video) {
  if (!video) return;
  releaseVideo(video);
  try {
    video.pause();
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------- observer */

/** frame element -> frame state */
const frameState = new WeakMap();

let sharedObserver = null;

function getObserver() {
  if (sharedObserver || typeof IntersectionObserver === 'undefined') return sharedObserver;

  sharedObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const state = frameState.get(entry.target);
        if (!state) return;

        if (entry.isIntersecting) {
          // Near the viewport: it is now worth creating the video element.
          ensureVideo(entry.target, state);

          const visibleEnough = entry.intersectionRatio >= 0.35;
          if (state.mode === 'inview' && visibleEnough && state.video) {
            requestPlayback(state.video);
          }
        } else if (state.video) {
          pausePlayback(state.video);
        }
      });
    },
    // rootMargin gives the source a head start before the card is on screen.
    { rootMargin: '200px 0px', threshold: [0, 0.35, 0.75] }
  );

  return sharedObserver;
}

/* --------------------------------------------------------------- video element */

function mp4SiblingFor(videoSrc) {
  return videoSrc.replace(/\.webm$/i, '.mp4');
}

/**
 * Creates the <video> lazily. Emits both a .webm and a .mp4 <source>: the mp4 is
 * only ever fetched if the browser cannot play webm, so shipping the tag costs
 * nothing today and works automatically once mp4 renditions exist.
 */
function ensureVideo(frame, state) {
  if (state.video || state.reducedMotion || !state.demo.videoSrc) return;

  const video = document.createElement('video');
  video.className =
    'mmx-video absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 ease-out';
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = state.priority ? 'metadata' : 'none';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('disablepictureinpicture', '');
  video.setAttribute('disableremoteplayback', '');
  video.controls = false;
  video.poster = state.demo.posterSrc || '';

  if (state.ariaLabel) {
    video.setAttribute('aria-label', state.ariaLabel);
  } else {
    // Decorative background media is hidden from assistive tech.
    video.setAttribute('aria-hidden', 'true');
  }

  const webm = document.createElement('source');
  webm.src = state.demo.videoSrc;
  webm.type = 'video/webm';
  video.appendChild(webm);

  const mp4 = document.createElement('source');
  mp4.src = mp4SiblingFor(state.demo.videoSrc);
  mp4.type = 'video/mp4';
  video.appendChild(mp4);

  video.addEventListener(
    'loadeddata',
    () => {
      video.classList.remove('opacity-0');
      video.classList.add('opacity-100');
      frame.dataset.mmxVideoReady = 'true';
    },
    { once: true }
  );

  video.addEventListener('error', () => {
    // Media absent or undecodable — keep the poster, stop retrying.
    video.dataset.mmxFailed = 'true';
    pausePlayback(video);
    video.remove();
    state.video = null;
    state.failed = true;
    frame.dataset.mmxVideoFailed = 'true';
  });

  state.video = video;
  frame.appendChild(video);

  // preload="none" means we must explicitly kick the network for in-view media.
  if (!state.priority) video.preload = 'metadata';
  video.load();
}

/* -------------------------------------------------------------------- factory */

/**
 * Builds a poster-first media frame for a demo.
 *
 * @param {object} demo    entry from src/data/minimaxH3Demos.ts
 * @param {object} options
 * @param {'inview'|'hover'|'poster'} options.mode
 *        inview - autoplay while sufficiently visible (hero, reel)
 *        hover  - desktop hover / mobile tap starts muted playback
 *        poster - never plays
 * @param {number}  [options.ratio]      numeric w/h override for the frame box
 * @param {string}  [options.className]  extra classes on the frame
 * @param {string}  [options.ariaLabel]  accessible label; omit for decorative
 * @param {boolean} [options.priority]   hero media: eager poster, metadata preload
 * @param {string}  [options.objectFit]  'cover' (default) or 'contain'
 * @returns {HTMLElement} frame element with a `cleanup()` method
 */
export function createMediaFrame(demo, options = {}) {
  const {
    mode = 'inview',
    ratio,
    className = '',
    ariaLabel = null,
    priority = false,
    objectFit = 'cover',
  } = options;

  const reducedMotion = prefersReducedMotion();

  const frame = document.createElement('div');
  frame.className = `mmx-frame relative overflow-hidden bg-[#05070b] ${className}`.trim();
  frame.dataset.mmxSlug = demo.slug;
  if (ratio) frame.style.aspectRatio = String(ratio);

  // Poster first — reserves the box so media can never shift layout.
  const poster = document.createElement('img');
  poster.className = `mmx-poster absolute inset-0 h-full w-full object-${objectFit}`;
  poster.src = demo.posterSrc;
  poster.alt = ariaLabel ? `${demo.title} — preview frame` : '';
  if (!ariaLabel) poster.setAttribute('aria-hidden', 'true');
  poster.loading = priority ? 'eager' : 'lazy';
  poster.decoding = 'async';
  poster.draggable = false;
  if (priority) poster.setAttribute('fetchpriority', 'high');

  poster.addEventListener('error', () => {
    // No poster on disk: show a branded gradient rather than an empty black box.
    poster.remove();
    frame.dataset.mmxPosterFailed = 'true';
    const fallback = document.createElement('div');
    fallback.className =
      'absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#05070b] to-[#0a0f18] flex items-center justify-center';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.innerHTML = `
      <div class="text-center px-4">
        <div class="mx-auto mb-2 h-8 w-8 rounded-full border border-cyan-400/30 bg-cyan-400/10 flex items-center justify-center">
          <svg class="h-4 w-4 text-cyan-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        </div>
        <p class="text-[11px] uppercase tracking-[0.18em] text-white/35">Preview pending</p>
      </div>`;
    frame.insertBefore(fallback, frame.firstChild);
  });

  frame.appendChild(poster);

  const state = {
    demo,
    mode: reducedMotion ? 'poster' : mode,
    video: null,
    reducedMotion,
    priority,
    ariaLabel,
    failed: false,
  };
  frameState.set(frame, state);

  const listeners = [];
  const addListener = (target, type, handler, opts) => {
    target.addEventListener(type, handler, opts);
    listeners.push(() => target.removeEventListener(type, handler, opts));
  };

  if (!reducedMotion && mode !== 'poster') {
    const observer = getObserver();
    if (observer) {
      observer.observe(frame);
    } else {
      // No IntersectionObserver (very old browser / jsdom): stay on the poster.
      state.mode = 'poster';
    }
  }

  if (!reducedMotion && mode === 'hover') {
    const start = () => {
      ensureVideo(frame, state);
      if (state.video) requestPlayback(state.video);
    };
    const stop = () => {
      if (state.video) pausePlayback(state.video);
    };

    if (isCoarsePointer()) {
      // Mobile: tap toggles muted playback.
      addListener(frame, 'click', () => {
        if (state.video && !state.video.paused) stop();
        else start();
      });
    } else {
      addListener(frame, 'pointerenter', start);
      addListener(frame, 'pointerleave', stop);
      // Keyboard parity for the focusable card wrapper.
      addListener(frame, 'focusin', start);
      addListener(frame, 'focusout', stop);
    }
  }

  if (priority && !reducedMotion) {
    // Hero: create the element immediately but still after first paint so the
    // video never competes with the headline for the critical path.
    const kick = () => {
      ensureVideo(frame, state);
      if (state.video && state.mode === 'inview') requestPlayback(state.video);
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(kick, { timeout: 1200 });
    } else {
      setTimeout(kick, 200);
    }
  }

  frame.cleanup = () => {
    listeners.forEach((off) => off());
    listeners.length = 0;
    if (sharedObserver) sharedObserver.unobserve(frame);
    if (state.video) {
      pausePlayback(state.video);
      state.video.removeAttribute('src');
      state.video.innerHTML = '';
      state.video.load?.();
      state.video.remove();
      state.video = null;
    }
    frameState.delete(frame);
  };

  return frame;
}

/**
 * Recursively calls cleanup() on every media frame inside a section.
 * Landing sections expose this as section.cleanup so the router can tear down.
 */
export function cleanupFrames(root) {
  root.querySelectorAll('.mmx-frame').forEach((frame) => frame.cleanup?.());
}

/**
 * Pauses (but keeps) every video inside a subtree.
 *
 * Used when cards are detached from the DOM by filtering / "Show less":
 * a detached element stops reporting intersections, so it would otherwise keep
 * playing forever in the background.
 */
export function pauseFramesIn(root) {
  root.querySelectorAll('.mmx-frame').forEach((frame) => {
    const state = frameState.get(frame);
    if (state?.video) pausePlayback(state.video);
  });
}

/**
 * Scroll reveal used by the MiniMax sections.
 *
 * Reuses the existing `.animate-in` / `.visible` CSS contract already defined by
 * LandingPage.jsx instead of pulling in an animation dependency.
 */
export function revealOnScroll(elements, { stagger = 80, rootMargin = '0px 0px -10% 0px' } = {}) {
  const items = Array.from(elements);
  if (!items.length) return () => {};

  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    items.forEach((el) => {
      el.classList.remove('opacity-0', 'translate-y-6', 'translate-y-8');
      el.classList.add('mmx-revealed');
    });
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = items.indexOf(entry.target);
        entry.target.style.transitionDelay = `${Math.max(0, index % 8) * stagger}ms`;
        entry.target.classList.remove('opacity-0', 'translate-y-6', 'translate-y-8');
        entry.target.classList.add('mmx-revealed');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin, threshold: 0.1 }
  );

  items.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}
