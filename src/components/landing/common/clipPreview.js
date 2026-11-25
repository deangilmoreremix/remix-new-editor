// Short silent motion previews for the Studio Demos picker tiles.
//
// A tile shows its still thumbnail. On hover or keyboard focus (and for the selected tile) a
// muted, looping, inline clip plays on top of it. Nothing is downloaded until then. If a clip
// is missing or fails to load, it is removed and the still thumbnail stays - so listing a clip
// in studioClips.json before it is uploaded is harmless.
import CLIPS from '../../../data/studioClips.json';
import { prefersReducedMotion } from './landingVideo.js';

const SLUGS = new Set(CLIPS.slugs || []);

/** URL of a studio's preview clip, or null when it has none. */
export function clipUrl(slug) {
  return SLUGS.has(slug) ? `${CLIPS.base}/${slug}.mp4` : null;
}

/** Start the preview in a tile. `tile` is the button; the clip goes inside its [data-clip-frame]. */
export function startClip(tile) {
  if (!tile || prefersReducedMotion()) return;
  const frame = tile.querySelector('[data-clip-frame]');
  const src = clipUrl(tile.getAttribute('data-demo-slug'));
  if (!frame || !src) return;
  let v = frame.querySelector('video');
  if (!v) {
    v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'none';
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.tabIndex = -1;
    v.className = 'absolute inset-0 w-full h-full object-cover';
    v.addEventListener('error', () => v.remove(), { once: true });
    v.src = src;
    frame.appendChild(v);
  }
  const p = v.play();
  if (p && p.catch) p.catch(() => {});
}

/** Pause a tile's preview (the element is kept so it can resume without downloading again). */
export function stopClip(tile) {
  const v = tile && tile.querySelector('[data-clip-frame] video');
  if (v) v.pause();
}

/**
 * Hover and focus preview for every [data-demo-slug] tile under `picker`.
 * `isSelected(tile)` keeps the selected tile playing after the pointer leaves.
 */
export function attachClipPreviews(picker, isSelected = () => false) {
  const tileOf = (e) => (e.target.closest ? e.target.closest('[data-demo-slug]') : null);
  const leave = (e) => {
    const tile = tileOf(e);
    if (tile && !tile.contains(e.relatedTarget) && !isSelected(tile)) stopClip(tile);
  };
  picker.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') startClip(tileOf(e)); }, true);
  picker.addEventListener('focusin', (e) => startClip(tileOf(e)));
  picker.addEventListener('pointerleave', leave, true);
  picker.addEventListener('focusout', leave);
}
