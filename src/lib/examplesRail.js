// examplesRail.js
// A reusable, clickable "inspiration rail" any studio can mount. Each card
// shows a preview (image/gif/video), a title, optional badges, and a
// "Create This Style" button. Clicking the card or its CTA stages a studio
// prefill (see studioPrefill.js) and navigates — so the destination studio
// opens pre-filled with the example's prompt + model.
//
// Used by: Video/Cinema/Commercial/Influencer/Character/Effects/Storyboard
// studios (MiniMax demos) and the Academy assets gallery.

import { navigate } from '../router.js';
import { stageStudioPrefill, consumeStudioPrefill } from '../studioPrefill.js';
import {
  getDemoBySlug,
  getMiniMaxDemosWithTargets,
  openDemoInStudio,
} from '../data/minimaxH3Demos.js';

const DEFAULT_TARGETS = {
  video: 'minimax-hailuo-2.3-standard-t2v',
  cinema: 'minimax-hailuo-2.3-standard-t2v',
  commercial: 'ai-product-shot',
  influencer: 'minimax-hailuo-2.3-standard-t2v',
  character: 'minimax-hailuo-2.3-standard-t2v',
  effects: 'minimax-hailuo-2.3-standard-t2v',
  storyboard: 'minimax-hailuo-2.3-standard-t2v',
  image: 'minimax-image-01',
  audio: 'minimax-music',
};

/**
 * Normalise an arbitrary upstream aspect ratio to one Hailuo accepts.
 * Supported: 16:9, 9:16, 1:1, 4:3, 3:4.
 */
export function normalizeAspectRatio(ratio) {
  if (!ratio) return '16:9';
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return '16:9';
  if (w < h) return '9:16';
  if (Math.abs(w - h) < Math.max(w, h) * 0.08) return '1:1';
  if (w / h >= 1.3 && w / h <= 1.55) return '4:3';
  if (w / h >= 0.65 && w / h <= 0.85) return '3:4';
  return '16:9';
}

/**
 * Open a style example inside its target studio.
 * @param {object} opts
 * @param {string} opts.prompt      prompt text to pre-fill
 * @param {string} opts.route       studio route to navigate to
 * @param {string} [opts.model]     model id to pre-select
 * @param {object} [opts.params]     extra params (aspect_ratio, duration, etc.)
 * @param {string} [opts.ref]        source ref for analytics
 */
export function openStyleInStudio({ prompt, route, model, params = {}, ref = 'minimax-h3' }) {
  stageStudioPrefill({
    route,
    prompt,
    model: model || DEFAULT_TARGETS[route] || DEFAULT_TARGETS.video,
    params,
    ref,
  });
  // Pass params to navigate so the studio can resolve the template from the URL
  navigate(route, params);
}

/**
 * Build the rail.
 * @param {object} cfg
 * @param {Array} cfg.items            items to render (see normalizeItem)
 * @param {string} [cfg.title]         section title
 * @param {string} [cfg.subtitle]
 * @param {string} [cfg.ref]           analytics ref prefix
 * @param {(item)=>void} [cfg.onUse]   override what "Create This Style" does
 */
export function createExamplesRail(cfg = {}) {
  const { title, subtitle, ref = 'minimax-h3', onUse } = cfg;
  const items = (cfg.items || []).map(normalizeItem).filter(Boolean);

  const section = document.createElement('section');
  section.className = 'sv-examples-rail w-full';
  section.setAttribute('data-examples-rail', ref);

  const head = document.createElement('div');
  head.className = 'flex items-end justify-between gap-3 mb-3';
  head.innerHTML = `
    <div>
      ${title ? `<h3 class="text-sm font-bold uppercase tracking-[0.14em] text-white/70">${escapeHtml(title)}</h3>` : ''}
      ${subtitle ? `<p class="text-xs text-white/40 mt-0.5">${escapeHtml(subtitle)}</p>` : ''}
    </div>
    <span class="text-[11px] text-white/30 shrink-0">${items.length} styles</span>
  `;
  if (title || subtitle) section.appendChild(head);

  const scroller = document.createElement('div');
  scroller.className =
    'sv-examples-scroller flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x scrollbar-thin';
  scroller.style.scrollSnapType = 'x mandatory';

  items.forEach((item) => {
    scroller.appendChild(renderCard(item, ref, onUse));
  });

  section.appendChild(scroller);
  return section;
}

function normalizeItem(raw) {
  // Already-normalised item from an explicit source
  if (raw && raw.__normalized) return raw;

  // MiniMax manifest demo
  if (raw && raw.videoSrc) {
    return {
      __normalized: true,
      id: raw.slug,
      title: raw.title,
      preview: raw.posterSrc,
      video: raw.videoSrc,
      badge: raw.category,
      meta: raw.aspectRatio,
      route: raw.__route || 'video',
      model: raw.__model,
      promptSlug: raw.slug,
      useCase: raw.useCase,
    };
  }

  // Academy asset
  if (raw && raw.src) {
    const isVideo = raw.type === 'video';
    return {
      __normalized: true,
      id: raw.id,
      title: raw.title,
      preview: isVideo ? raw.thumbnail : raw.src,
      video: isVideo ? raw.videoSrc || raw.src : null,
      badge: raw.tags && raw.tags[0] ? String(raw.tags[0]).replace(/-/g, ' ') : 'academy',
      meta: null,
      route: raw.__route || 'image',
      model: raw.__model,
      promptText: raw.prompt || raw.description,
      useCase: raw.description,
    };
  }
  return null;
}

function renderCard(item, ref, onUse) {
  const card = document.createElement('article');
  card.className =
    'sv-example-card group relative shrink-0 snap-start w-[200px] sm:w-[220px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-cyan-400/40 transition-colors cursor-pointer';
  card.setAttribute('data-style-id', item.id);

  const media = document.createElement('div');
  media.className = 'relative aspect-video bg-black/40 overflow-hidden';

  if (item.video) {
    const vid = document.createElement('video');
    vid.src = item.video;
    vid.poster = item.preview;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = 'none';
    vid.className = 'h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity';
    media.appendChild(vid);
    media.addEventListener('mouseenter', () => vid.play().catch(() => {}));
    media.addEventListener('mouseleave', () => {
      vid.pause();
      vid.currentTime = 0;
    });
  } else {
    const img = document.createElement('img');
    img.src = item.preview;
    img.loading = 'lazy';
    img.className = 'h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity';
    media.appendChild(img);
  }

  // hover scrub overlay gradient
  const grad = document.createElement('div');
  grad.className = 'pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent';
  media.appendChild(grad);

  if (item.badge) {
    const badge = document.createElement('span');
    badge.className =
      'absolute top-2 left-2 inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-300';
    badge.textContent = item.badge;
    media.appendChild(badge);
  }
  if (item.meta) {
    const meta = document.createElement('span');
    meta.className =
      'absolute top-2 right-2 inline-flex items-center rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-white/80 backdrop-blur-sm';
    meta.textContent = item.meta;
    media.appendChild(meta);
  }

  const body = document.createElement('div');
  body.className = 'p-3';
  body.innerHTML = `
    <h4 class="text-sm font-semibold text-white leading-snug line-clamp-2">${escapeHtml(item.title)}</h4>
    ${item.useCase ? `<p class="mt-1 text-[11px] text-white/45 line-clamp-2">${escapeHtml(item.useCase)}</p>` : ''}
  `;

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className =
    'mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-400 text-[#020205] text-xs font-bold py-2 hover:bg-cyan-300 transition-colors';
  cta.innerHTML =
    'Create This Style <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>';
  cta.setAttribute('aria-label', `Create this style: ${item.title}`);
  cta.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerUse(item, ref, onUse);
  });
  body.appendChild(cta);

  card.appendChild(media);
  card.appendChild(body);

  // Clicking the card (not the CTA) previews/uses the style too.
  card.addEventListener('click', () => triggerUse(item, ref, onUse));

  return card;
}

async function triggerUse(item, ref, onUse) {
  if (onUse) {
    onUse(item);
    return;
  }
  // MiniMax demo: hand off to the manifest's own open action (lazy prompt).
  if (item.promptSlug) {
    const demo = getDemoBySlug(item.promptSlug);
    if (demo) {
      await openDemoInStudio(demo);
      return;
    }
  }
  // Academy asset or other: stage directly with its text.
  const prompt = item.promptText || '';
  const aspect = item.meta ? normalizeAspectRatio(item.meta) : '16:9';
  openStyleInStudio({
    prompt,
    route: item.route,
    model: item.model,
    params: { aspect_ratio: aspect, _sourceSlug: item.id, _sourceTitle: item.title },
    ref,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------- MiniMax helper */

/**
 * Consume any staged prefill for `route` and hand it to the studio's own
 * apply function. Keeps every studio's "Create This Style" wiring identical:
 * one call at mount, e.g.
 *   consumeAndApply('commercial', (staged) => { if (staged.model) selectedModel = staged.model; ... });
 * @returns {boolean} whether a prefill was applied
 */
export function consumeAndApply(route, apply) {
  const staged = consumeStudioPrefill(route);
  if (staged && typeof apply === 'function') {
    try {
      apply(staged);
    } catch (e) {
      console.error('[examplesRail] apply prefill failed', e);
    }
    return true;
  }
  return false;
}

/**
 * Build + return the rail DOM node (does not append). Lets a studio place the
 * rail wherever it fits its layout.
 */
export function renderExamplesRail(opts) {
  return createExamplesRail(opts);
}

export { getMiniMaxDemosWithTargets, getDemoBySlug, consumeStudioPrefill };
