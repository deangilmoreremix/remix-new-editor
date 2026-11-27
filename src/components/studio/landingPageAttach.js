// src/components/studio/landingPageAttach.js
//
// "Create landing page" next to the Download link of every studio that shows its result as a plain
// <a href="…" download class="…">Download</a> (Avatar, Video Tools, Character, Commercial, Upscale, Influencer,
// Animate, Photo Studio, Template Studio, AI VFX, Director, Edit). One observer, mounted once from main.js, finds such links
// and inserts a sibling button cloned from the link, so it looks like it belongs in that studio.
//
// Only https images and videos get one. Audio, zips, CSV, blob: and data: links are left alone, as is anything in the
// landing page picker/editor, the media preview window (it has its own button) or marked data-lp-skip.
import { routeHash } from '../../lib/routeUrl.js';
import { createLandingPageButton, openLandingPageFor, canMakeLandingPage } from './landingPageAction.js';

const VIDEO = /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i;
const IMAGE = /\.(png|jpe?g|webp|gif|avif)(?:[?#]|$)/i;
const SKIP_INSIDE = '[data-lp-skip], [data-landing-picker], [data-ai-image-modal], [class*="mdv-"]';

/** Pure: { url, type } for a link's href, or null when it is not an https image or video. `nearby` is a hint for links with no file extension. */
export function mediaFromHref(href, nearby = null) {
  const url = String(href || '').trim();
  if (!/^https:\/\//i.test(url)) return null;
  const path = url.split(/[?#]/)[0];
  if (VIDEO.test(path)) return { url, type: 'video' };
  if (IMAGE.test(path)) return { url, type: 'image' };
  if (/\.(mp3|wav|m4a|ogg|aac|flac|zip|csv|json|txt|pdf|docx?|xlsx?)$/i.test(path)) return null;
  if (nearby === 'video' || nearby === 'image') return { url, type: nearby };
  return null;
}

/** What kind of media sits beside the link (a <video> or <img> showing the same address), for links with no file extension. */
function nearbyKind(a, url) {
  const box = a.closest('div, section, article, li') || a.parentElement;
  if (!box) return null;
  const same = (el) => el.currentSrc === url || el.getAttribute('src') === url;
  if ([...box.querySelectorAll('video')].some(same)) return 'video';
  if ([...box.querySelectorAll('img')].some(same)) return 'image';
  return null;
}

const mediaOf = (a) => { const href = a.getAttribute('href') || ''; return mediaFromHref(href, nearbyKind(a, href)); };
// The landing page button is one of the action buttons right after the link.
const buttonFor = (a) => {
  for (let n = a.nextElementSibling; n && n.dataset?.action; n = n.nextElementSibling) {
    if (n.dataset.action === 'create-landing-page') return n;
  }
  return null;
};

/** Add (or update) the button for one download link. Returns the button, or null when this link gets none. */
export function attachTo(a, { studio = '' } = {}) {
  if (!a || a.tagName !== 'A' || !a.hasAttribute('download') || !a.isConnected) return null;
  if (a.closest(SKIP_INSIDE)) return null;
  const media = mediaOf(a);
  let btn = buttonFor(a);
  if (!media) { if (btn) btn.hidden = true; return null; }          // the link stopped being a picture or video
  if (btn) { btn.hidden = false; return btn; }
  btn = createLandingPageButton({ like: a });
  btn.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const now = mediaOf(a);
    if (!now || !canMakeLandingPage(now)) return;
    void openLandingPageFor({ url: now.url, type: now.type, studio });
  };
  a.after(btn);
  return btn;
}

/** Add buttons to every download link under `root` (and `root` itself). */
export function scan(root, opts) {
  if (!root || root.nodeType !== 1) return;
  if (root.matches?.('a[download]')) attachTo(root, opts);
  root.querySelectorAll?.('a[download]').forEach((a) => attachTo(a, opts));
}

/**
 * Watch the page for studio results. Call once. Returns { stop }.
 * (Links whose href is filled in after they are inserted are picked up when the href appears.)
 */
export function mountLandingPageButtons({ root = document.body, observerClass = globalThis.MutationObserver } = {}) {
  if (!root || !observerClass) return { stop() {} };
  const route = () => String(routeHash(globalThis.location).replace(/^#\/?/, '').split(/[/?]/)[0] || '');
  const obs = new observerClass((records) => {
    for (const r of records) {
      if (r.type === 'attributes') { if (r.target.matches?.('a[download]')) attachTo(r.target, { studio: route() }); continue; }
      r.addedNodes.forEach((n) => scan(n, { studio: route() }));
    }
  });
  obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  scan(root, { studio: route() });
  return { stop: () => obs.disconnect() };
}
