/**
 * DOM builders for the overlay addons, recreating upstream's plugin markup
 * and class names so the look matches (styles in styles/timeline-addons.css):
 *
 *   Smart Text      .popcorn-text.text-custom > .text-inner-div > div.{align} > span.personalizer-input
 *   Image           .popcorn-image > .image-plugin-link > .image-plugin-img
 *   Personalized    .personalized-image > .image-plugin-link > .image-plugin-img
 *   Text Mask       .popcorn-see-through-text > .inner-canvas > svg.knockout__svg (mask)
 *   Wrapper         .popcorn-background
 *   Stickers        .popcorn-lottie-json (img, or a lottie-web animation)
 *
 * Every element is tagged data-overlay="overlay-clip" + data-clip-id so the
 * page's compositor can diff them and other overlays (pause prompt, List
 * Builder) are never cleared by mistake.
 */
import { resolveToken, TOKEN_PATTERN } from '../../../components/personalize/tokenSchema.js';
import { personalizedImageLook } from '../../personalization/imageStyle.js';
import { getAddon, addonOptions } from './registry.js';
import { ensureFormFont } from './addonOverlay.js';
import { buildLowerThirdLottie, lowerThirdFrame } from './lowerThirds.js';
import { loadGlTransitions, createTransitionRenderer } from './glTransitionRenderer.js';
import { ctaTarget } from './ctaLink.js';

export const OVERLAY_TAG = 'overlay-clip';
export const PERSONALIZED_PLACEHOLDER = '/static/images/personalized-image-placeholder.svg';
export const PERSONALIZED_PLACEHOLDER_CIRCLE = '/static/images/circle-placeholder.svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- tokens

/**
 * Resolve upstream token syntax against a personalization profile:
 *   {{firstname}}            value (any spelling resolveToken accepts)
 *   {{up firstname}}         upper-cased value
 *   {{d firstname "Friend"}} value, or the quoted fallback
 * Unresolved plain tokens are left as written so the editor shows them.
 */
export function resolveOverlayText(text, profile) {
  if (text == null) return '';
  return String(text).replace(TOKEN_PATTERN, (match, raw) => {
    const body = raw.trim();
    const fallbackMatch = body.match(/^(?:d|default)\s+(\S+)\s+(["'])(.*)\2$/);
    if (fallbackMatch) {
      const value = profile ? resolveToken(profile, fallbackMatch[1]) : null;
      return value ?? fallbackMatch[3];
    }
    const upMatch = body.match(/^(?:up|uppercase)\s+(\S+)$/);
    if (upMatch) {
      const value = profile ? resolveToken(profile, upMatch[1]) : null;
      return value === null ? match : value.toUpperCase();
    }
    const value = profile ? resolveToken(profile, body) : null;
    return value === null ? match : value;
  });
}

/** http(s) and tel: only (upstream's "URL (Call-to-action)" accepted both). */
export function safeHref(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  if (/^tel:\+?[0-9()\-.\s]{5,}$/i.test(value)) return value.replace(/\s+/g, '');
  if (/^\+?[0-9()\-.\s]{10,}$/.test(value)) return `tel:${value.replace(/[^0-9+]/g, '')}`;
  if (/^mailto:/i.test(value)) return /^mailto:[^\s@<>"'()]+@[^\s@<>"'()]+\.[a-z]{2,}(\?[^\s<>"']*)?$/i.test(value) ? value : null;
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Image URLs we will render: http(s), same-origin paths, blob: and data:image. */
export function safeImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  if (/^\/[^/]/.test(value) || /^blob:/i.test(value) || /^data:image\//i.test(value)) return value;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- CSS (Wrapper)

// Wrapper "Styles": upstream applied any raw CSS inline. Only visual
// properties are kept so a style can't reposition the overlay over the
// editor UI or load non-http resources.
const ALLOWED_CSS = /^(background(-[a-z]+)?|border(-[a-z]+)*|box-shadow|filter|backdrop-filter|opacity|outline(-[a-z]+)*|mix-blend-mode|clip-path|mask(-[a-z]+)*)$/;

export function sanitizeWrapperStyles(css) {
  const out = {};
  String(css || '').split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value || !ALLOWED_CSS.test(prop)) return;
    if (/expression\s*\(|javascript:|@import|<|>/i.test(value)) return;
    const urls = value.match(/url\(([^)]*)\)/gi) || [];
    if (urls.some((u) => !/^url\(\s*['"]?https?:\/\//i.test(u))) return;
    out[prop] = value;
  });
  return out;
}

// ---------------------------------------------------------------- geometry / look

export function applyGeometry(el, opts, { fullFrame = false } = {}) {
  const g = fullFrame ? { left: 0, top: 0, width: 100, height: 100 } : { left: 0, top: 0, width: 100, height: 100, ...(opts.geometry || {}) };
  Object.assign(el.style, {
    position: 'absolute',
    left: `${g.left}%`,
    top: `${g.top}%`,
    width: `${g.width}%`,
    height: `${g.height}%`,
    transform: opts.rotation ? `rotate(${Number(opts.rotation)}deg)` : '',
    mixBlendMode: opts.blendMode || 'normal',
    opacity: String((opts.opacity ?? 100) / 100),
  });
  if (opts.zindex != null) el.style.zIndex = String(opts.zindex);
}

function wrapLink(child, opts, editor) {
  const href = ctaTarget(opts)?.href;
  if (!href) return child;
  const a = document.createElement('a');
  a.href = href;
  a.className = 'overlay-link';
  // In the editor a "current tab" link would navigate away from the
  // project, so links always open in a new tab there.
  a.target = editor || opts.linkTarget !== '_parent' ? '_blank' : '_parent';
  a.rel = 'noopener noreferrer';
  a.appendChild(child);
  return a;
}

// ---------------------------------------------------------------- text fitting

/**
 * Upstream ran jquery-textfill ("Scale To Fit"); this binary-searches the
 * largest font size at which `inner` fits inside `box`.
 */
export function fitText(box, inner, { min = 4, max = 400 } = {}) {
  const w = box.clientWidth;
  const h = box.clientHeight;
  if (!w || !h) return null;
  let lo = min;
  let hi = Math.min(max, h);
  let best = lo;
  for (let i = 0; i < 18 && lo <= hi; i++) {
    const mid = (lo + hi) / 2;
    inner.style.fontSize = `${mid}px`;
    if (inner.scrollWidth <= w && inner.scrollHeight <= h) {
      best = mid;
      lo = mid + 0.5;
    } else {
      hi = mid - 0.5;
    }
  }
  inner.style.fontSize = `${best}px`;
  return best;
}

/** Text Mask: start at 20em and shrink by 0.5em until the SVG text fits (upstream textfillSvg). */
export function fitSvgText(svg, textEl) {
  const box = svg.getBoundingClientRect?.();
  if (!box || !box.width || typeof textEl.getBBox !== 'function') return null;
  let em = 20;
  for (; em > 0.5; em -= 0.5) {
    textEl.style.fontSize = `${em}em`;
    let bb;
    try { bb = textEl.getBBox(); } catch { return null; }
    if (bb.width <= box.width * 0.96 && bb.height <= box.height * 0.96) break;
  }
  return em;
}

// ---------------------------------------------------------------- builders

function buildText(opts, ctx) {
  const el = document.createElement('div');
  el.className = 'popcorn-text text-custom';
  const deco = opts.fontDecorations || {};
  ensureFormFont(opts.fontFamily);
  const inner = document.createElement('div');
  inner.className = 'text-inner-div';
  Object.assign(inner.style, {
    color: opts.fontColor || '#FFFFFF',
    fontFamily: opts.fontFamily ? `"${opts.fontFamily}"` : '',
    fontWeight: deco.bold ? 'bold' : 'normal',
    fontStyle: deco.italics ? 'italic' : 'normal',
  });
  const shadows = [];
  if (opts.shadow) shadows.push(`0 1px 5px ${opts.shadowColor}`, `0 1px 10px ${opts.shadowColor}`);
  if (opts.stroke) {
    inner.style.webkitTextStroke = `0.04em ${opts.strokeColor}`;
    inner.style.paintOrder = 'stroke fill';
  }
  if (shadows.length) inner.style.textShadow = shadows.join(', ');
  if (opts.background) el.style.background = opts.backgroundColor || '#888888';

  const row = document.createElement('div');
  const align = opts.alignment || 'center';
  row.className = align;
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
    textAlign: align,
    height: '100%',
  });
  const span = document.createElement('span');
  span.className = 'personalizer-input';
  span.textContent = resolveOverlayText(opts.text, ctx.profile);
  row.appendChild(wrapLink(span, opts, ctx.editor));
  inner.appendChild(row);
  el.appendChild(inner);

  if (deco.responsive !== false) {
    el.dataset.fit = 'text';
  } else {
    // Fixed size: % of the frame height (upstream fontSize% of its 22.5em base).
    span.style.fontSize = `calc(var(--ovl-h, 450px) * ${(Number(opts.fontSize) || 8) / 100})`;
    el.style.height = 'auto';
  }
  return el;
}

function buildImage(opts, ctx, { personalized = false } = {}) {
  const el = document.createElement('div');
  el.className = personalized ? 'personalized-image' : 'popcorn-image';
  const link = document.createElement('div');
  link.className = 'image-plugin-link';
  const img = document.createElement('div');
  img.className = 'image-plugin-img';
  let src;
  if (personalized) {
    const resolved = resolveOverlayText(opts.src, ctx.profile);
    const fromToken = /\{\{/.test(resolved) ? null : safeImageUrl(resolved);
    // Same order as the Remotion composition (timelineToComposition): the
    // token, then the fallback image. ({{image}} itself resolves to the
    // contact's photo through the token schema, so a logo slot no longer
    // falls back to someone's face.)
    src = fromToken || safeImageUrl(opts.fallbackSrc)
      || (opts.imageshape === 'circle' ? PERSONALIZED_PLACEHOLDER_CIRCLE : PERSONALIZED_PLACEHOLDER);
    link.style.borderRadius = `${Number(opts.cornerRadius) || 0}%`;
  } else {
    src = safeImageUrl(opts.src);
    if (opts.cornerRadius) link.style.borderRadius = '50%';
  }
  if (src) img.style.backgroundImage = `url(${JSON.stringify(src)})`;
  else el.classList.add('is-empty');
  // Matches the Remotion composition: personalized images fill their box
  // unless set to fit inside it (logos).
  img.style.backgroundSize = opts.fit === 'contain' ? 'contain' : (opts.fill || personalized ? 'cover' : 'contain');
  if (personalized && src) {
    // Per-contact crop focus and logo backing plate (same as the export).
    const look = personalizedImageLook(opts, src, ctx.profile);
    img.style.backgroundPosition = look.objectPosition;
    if (look.plateColor) {
      link.style.background = look.plateColor;
      link.style.padding = '6%';
      link.style.boxSizing = 'border-box';
      if (!Number(opts.cornerRadius)) link.style.borderRadius = '10%';
    }
  }
  if (opts.title) el.title = opts.title;
  link.appendChild(img);
  el.appendChild(wrapLink(link, opts, ctx.editor));
  if (opts.transition && opts.transition !== 'popcorn-none') el.classList.add(opts.transition);
  return el;
}

function buildTextMask(opts, ctx, id) {
  const el = document.createElement('div');
  el.className = 'popcorn-see-through-text';
  ensureFormFont(opts.fontFamily);
  const canvas = document.createElement('div');
  canvas.className = 'inner-canvas';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'knockout__svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  const maskId = `text-clip-${String(id).replace(/[^a-z0-9_-]/gi, '')}`;
  const mask = document.createElementNS(SVG_NS, 'mask');
  mask.setAttribute('id', maskId);
  const white = document.createElementNS(SVG_NS, 'rect');
  white.setAttribute('width', '100%');
  white.setAttribute('height', '100%');
  white.setAttribute('fill', 'white');
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', '50%');
  text.setAttribute('y', '50%');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('fill', '#000');
  text.style.fontFamily = `"${opts.fontFamily || 'Bowlby One SC'}"`;
  text.style.fontWeight = opts.fontDecorations?.bold ? 'bold' : 'normal';
  text.style.fontSize = '10em';
  text.textContent = resolveOverlayText(opts.text, ctx.profile);
  mask.append(white, text);
  const fill = document.createElementNS(SVG_NS, 'rect');
  fill.setAttribute('width', '100%');
  fill.setAttribute('height', '100%');
  fill.setAttribute('fill', opts.backgroundColor || '#000000');
  fill.setAttribute('mask', `url(#${maskId})`);
  svg.append(mask, fill);
  canvas.appendChild(svg);
  el.appendChild(canvas);
  el.dataset.fit = 'svg';
  return el;
}

function buildWrapper(opts) {
  const el = document.createElement('div');
  el.className = 'popcorn-background';
  el.style.background = opts.background || '#888888';
  const styles = sanitizeWrapperStyles(opts.styles);
  for (const [prop, value] of Object.entries(styles)) el.style.setProperty(prop, value);
  return el;
}

function buildSticker(opts) {
  const el = document.createElement('div');
  el.className = 'popcorn-lottie-json';
  const src = safeImageUrl(opts.src);
  if (!src) {
    el.classList.add('is-empty');
    return el;
  }
  if (opts.kind === 'lottie') {
    el.dataset.lottie = src;
  } else {
    const img = document.createElement('img');
    img.src = src;
    img.alt = opts.name || '';
    img.draggable = false;
    el.appendChild(img);
  }
  return el;
}

function buildLowerThird(opts, ctx) {
  const el = document.createElement('div');
  el.className = 'popcorn-json-animation';
  ensureFormFont(opts.fontFamily);
  el._lottieData = buildLowerThirdLottie({
    ...opts,
    name: resolveOverlayText(opts.name, ctx.profile),
    title: resolveOverlayText(opts.title, ctx.profile),
  });
  el.dataset.sync = 'lower-third';
  return el;
}

// Overlay Transitions: a Pixabay/Pexels video played full-frame, blended
// with "screen" by default so its black background drops out.
function buildOverlayTransition(opts) {
  const el = document.createElement('div');
  el.className = 'popcorn-json-transition';
  const src = safeImageUrl(opts.src);
  if (!src) {
    el.classList.add('is-empty');
    return el;
  }
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  el.appendChild(video);
  el.dataset.sync = 'video';
  return el;
}

// Video Transitions: gl-transitions blend of the outgoing and incoming
// clips, drawn on a canvas covering the frame.
function buildVideoTransition(opts) {
  const el = document.createElement('div');
  el.className = 'popcorn-video-transition';
  const canvas = document.createElement('canvas');
  el.appendChild(canvas);
  el.dataset.sync = 'gl';
  el.dataset.transition = opts.transition || 'fade';
  return el;
}

const BUILDERS = {
  'overlay-transition': (o) => buildOverlayTransition(o),
  'overlay-video-transition': (o) => buildVideoTransition(o),
  'overlay-lower-third': (o, ctx) => buildLowerThird(o, ctx),
  'overlay-text': (o, ctx) => buildText(o, ctx),
  'overlay-image': (o, ctx) => buildImage(o, ctx),
  'overlay-personalized-image': (o, ctx) => buildImage(o, ctx, { personalized: true }),
  'overlay-text-mask': (o, ctx, id) => buildTextMask(o, ctx, id),
  'overlay-background': (o) => buildWrapper(o),
  'overlay-sticker': (o) => buildSticker(o),
};

const FULL_FRAME = new Set(['overlay-text-mask', 'overlay-background', 'overlay-transition', 'overlay-video-transition']);

/**
 * Build the overlay element for a clip. `ctx`:
 *   { profile, editor: true }   profile = active personalization profile
 */
export function buildOverlayElement(clip, ctx = {}) {
  const build = BUILDERS[clip.type];
  if (!build) return null;
  const opts = addonOptions(clip);
  const el = build(opts, ctx, clip.id);
  el.classList.add('addon-overlay-clip');
  el.dataset.overlay = OVERLAY_TAG;
  el.dataset.clipId = String(clip.id);
  el.dataset.type = clip.type;
  applyGeometry(el, opts, { fullFrame: FULL_FRAME.has(clip.type) || (clip.type === 'overlay-image' && opts.fill) });
  if (clip.type === 'overlay-text' && opts.fontDecorations?.responsive === false) el.style.height = 'auto';
  return el;
}

/** Run post-attach work that needs layout: text fitting and Lottie loading. */
export async function finishOverlayElement(el, { playing = false } = {}) {
  if (el.dataset.fit === 'text') {
    const span = el.querySelector('.personalizer-input');
    if (span) fitText(el, span);
  } else if (el.dataset.fit === 'svg') {
    const svg = el.querySelector('svg');
    const text = el.querySelector('text');
    if (svg && text) fitSvgText(svg, text);
  }
  if (el._lottieData && !el._lottie) {
    // Lower thirds are driven frame-by-frame from the timeline (syncOverlayTime).
    try {
      const { default: lottie } = await import('lottie-web');
      if (!el.isConnected || el._lottie) return;
      el._lottie = lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: el._lottieData });
      if (el._pendingFrame != null) el._lottie.goToAndStop(el._pendingFrame, true);
    } catch (err) {
      el.classList.add('is-error');
      el.title = `Couldn't render lower third: ${err.message || err}`;
    }
    return;
  }
  if (el.dataset.lottie && !el._lottie) {
    try {
      const [{ default: lottie }, data] = await Promise.all([
        import('lottie-web'),
        fetch(el.dataset.lottie).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      ]);
      if (!el.isConnected) return;
      el._lottie = lottie.loadAnimation({ container: el, renderer: 'svg', loop: true, autoplay: playing, animationData: data });
      if (!playing) el._lottie.goToAndStop(0, true);
    } catch (err) {
      el.classList.add('is-error');
      el.title = `Couldn't load animated sticker: ${err.message || err}`;
    }
  }
}

export function destroyOverlayElement(el) {
  try { el._lottie?.destroy(); } catch { /* already gone */ }
  try { el._gl?.destroy(); } catch { /* already gone */ }
  Object.values(el._media || {}).forEach((m) => { try { m.pause(); m.removeAttribute('src'); m.load?.(); } catch { /* ignore */ } });
  el.remove();
}

/** Seek a media element to `time` when it has drifted (or always while paused). */
function seekMedia(media, time, playing, tolerance = 0.3) {
  if (!media || !Number.isFinite(time)) return;
  const target = Math.max(0, time);
  if (!playing || Math.abs((media.currentTime || 0) - target) > tolerance) {
    try { media.currentTime = target; } catch { /* not seekable yet */ }
  }
  if (playing && media.paused) media.play?.().catch(() => {});
  if (!playing && !media.paused) media.pause?.();
}

function mediaFor(el, role, info) {
  el._media = el._media || {};
  const current = el._media[role];
  if (!info?.src) return null;
  if (current && current.dataset.src === info.src) return current;
  let m;
  if (info.type === 'image') {
    m = new Image();
    m.crossOrigin = 'anonymous';
    m.src = info.src;
  } else {
    m = document.createElement('video');
    m.crossOrigin = 'anonymous';
    m.muted = true;
    m.playsInline = true;
    m.preload = 'auto';
    m.src = info.src;
  }
  m.dataset.src = info.src;
  m.className = `vt-media vt-media--${role}`;
  el._media[role] = m;
  return m;
}

/** CSS crossfade used when WebGL can't read the media (no CORS / no WebGL). */
function crossfadeFallback(el, from, to, progress) {
  [from, to].forEach((m) => { if (m && m.parentNode !== el) el.appendChild(m); });
  el.classList.add('vt-fallback');
  if (from) from.style.opacity = String(1 - progress);
  if (to) to.style.opacity = String(progress);
}

function renderVideoTransition(el, span, t, playing) {
  const progress = Math.max(0, Math.min(1, (t - span.start) / (span.duration || 1)));
  const from = mediaFor(el, 'from', span.from);
  const to = mediaFor(el, 'to', span.to);
  if (from && span.from.type !== 'image') seekMedia(from, t - span.from.start, playing);
  if (to && span.to.type !== 'image') seekMedia(to, t - span.to.start, playing);
  // Redraw when a frame becomes available (load / seek finished), so a
  // paused scrub shows the right blend without waiting for another tick.
  const redraw = () => { if (el.isConnected && el._lastSync) renderVideoTransition(el, ...el._lastSync); };
  [from, to].forEach((m) => {
    if (m && !m._vtHooked) {
      m._vtHooked = true;
      ['loadeddata', 'seeked', 'load'].forEach((ev) => m.addEventListener(ev, redraw));
      m.addEventListener('error', () => {
        // Media that can't load with CORS: retry without it and crossfade.
        if (m.crossOrigin) {
          el._glFailed = true;
          m.removeAttribute('crossorigin');
          m.src = m.dataset.src;
          redraw();
        }
      }, { once: true });
    }
  });
  if (el._glFailed) {
    crossfadeFallback(el, from, to, progress);
    return;
  }
  if (!el._gl) {
    if (!el._glLoading) {
      el._glLoading = loadGlTransitions().then((list) => {
        const def = list.find((x) => x.name === el.dataset.transition) || list.find((x) => x.name === 'fade');
        el._gl = createTransitionRenderer(el.querySelector('canvas'));
        el._gl.setTransition(def);
        redraw();
      }).catch(() => { el._glFailed = true; redraw(); });
    }
    return;
  }
  try {
    el._gl.render(from, to, progress);
  } catch {
    // Cross-origin media without CORS headers taints WebGL: fall back.
    el._glFailed = true;
    el.querySelector('canvas')?.remove();
    crossfadeFallback(el, from, to, progress);
  }
}

/**
 * Keep time-driven overlays in step with the playhead. `times` maps clip id
 * → { start, duration, from?, to? } (seconds; from/to = { src, type, start }
 * of the clips a video transition blends).
 */
export function syncOverlayTime(layer, t, times, { playing = false } = {}) {
  layer.querySelectorAll(`[data-overlay="${OVERLAY_TAG}"][data-sync]`).forEach((el) => {
    const span = times.get(el.dataset.clipId);
    if (!span) return;
    if (el.dataset.sync === 'lower-third') {
      const frame = lowerThirdFrame(t - span.start, span.duration);
      if (el._lottie) el._lottie.goToAndStop(frame, true);
      else el._pendingFrame = frame;
    } else if (el.dataset.sync === 'video') {
      seekMedia(el.querySelector('video'), t - span.start, playing);
    } else if (el.dataset.sync === 'gl') {
      el._lastSync = [span, t, playing];
      renderVideoTransition(el, span, t, playing);
    }
  });
}

/** Keep Lottie stickers in step with the editor's play/pause state. */
export function setOverlayPlaying(layer, playing) {
  layer.querySelectorAll(`[data-overlay="${OVERLAY_TAG}"]`).forEach((el) => {
    if (!el._lottie || el.dataset.sync) return;
    if (playing) el._lottie.play();
    else el._lottie.pause();
  });
}

// ---------------------------------------------------------------- animations

/** In (once) → idle (infinite), like upstream's popcorn-animation.js. */
export function playInAnimation(el, animation) {
  const a = animation || {};
  if (!a.in && !a.idle) return;
  el.classList.add('animated');
  const startIdle = () => {
    if (a.in) el.classList.remove(a.in);
    if (a.idle) el.classList.add(a.idle, 'infinite');
  };
  if (a.in) {
    el.classList.add(a.in);
    el.addEventListener('animationend', startIdle, { once: true });
  } else {
    startIdle();
  }
}

/** Play the out animation, then remove. Resolves when the element is gone. */
export function playOutAndRemove(el, animation) {
  const out = animation?.out;
  if (!out || typeof window === 'undefined') {
    destroyOverlayElement(el);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    el.classList.remove('infinite', ...(animation.idle ? [animation.idle] : []), ...(animation.in ? [animation.in] : []));
    el.classList.add('animated', out);
    const done = () => { destroyOverlayElement(el); resolve(); };
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 1200);
  });
}

// ---------------------------------------------------------------- active set

/** Overlay clips active at time t (s), in paint order: earlier tracks first. */
export function activeOverlays(tracks, t, timelineSeconds) {
  const out = [];
  (tracks || []).forEach((track, trackIndex) => {
    (track.items || track.clips || []).forEach((clip) => {
      const addon = getAddon(clip.type);
      if (!addon || addon.category !== 'overlay') return;
      const start = (clip.left / 100) * timelineSeconds;
      const end = start + (clip.width / 100) * timelineSeconds;
      if (t >= start && t < end) out.push({ clip, trackIndex, start });
    });
  });
  // Full-frame Wrapper/Text Mask sit under positioned overlays on the same
  // track; then by track order and start time (later tracks paint on top).
  const rank = (c) => (c.clip.type === 'overlay-background' ? 0 : c.clip.type === 'overlay-text-mask' ? 1 : 2);
  return out
    .sort((a, b) => a.trackIndex - b.trackIndex || rank(a) - rank(b) || a.start - b.start)
    .map((c) => c.clip);
}
