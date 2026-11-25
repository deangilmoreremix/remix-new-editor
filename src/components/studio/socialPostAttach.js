// src/components/studio/socialPostAttach.js
//
// "Schedule post" next to the Download link of every studio result (the same links "Create landing page"
// uses, see landingPageAttach.js). One observer, mounted once from main.js, adds a sibling button cloned
// from the link so it matches that studio's own buttons. It goes after the landing page button when there is one.
import { routeHash } from '../../lib/routeUrl.js';
import { mediaFromHref } from './landingPageAttach.js';
import { createSchedulePostButton, openSocialPostFor } from './socialPostAction.js';

const SKIP_INSIDE = '[data-lp-skip], [data-sp-skip], [data-schedule-post], [data-landing-picker], [data-ai-image-modal], [class*="mdv-"]';
const ACTION = 'schedule-post';

/** The media a download link points at ({ url, type }) or null. */
function mediaOf(a) {
  const href = a.getAttribute('href') || '';
  let nearby = null;
  const box = a.closest('div, section, article, li') || a.parentElement;
  if (box) {
    const same = (e) => e.currentSrc === href || e.getAttribute('src') === href;
    if ([...box.querySelectorAll('video')].some(same)) nearby = 'video';
    else if ([...box.querySelectorAll('img')].some(same)) nearby = 'image';
  }
  return mediaFromHref(href, nearby);
}

// The buttons that follow a link, in order (ours and the landing page one are both data-action buttons).
function followingActions(a) {
  const out = [];
  for (let n = a.nextElementSibling; n && n.dataset?.action; n = n.nextElementSibling) out.push(n);
  return out;
}

/** Add (or update) the button for one download link. Returns the button, or null when this link gets none. */
export function attachSchedule(a, { studio = '' } = {}) {
  if (!a || a.tagName !== 'A' || !a.hasAttribute('download') || !a.isConnected) return null;
  if (a.closest(SKIP_INSIDE)) return null;
  const media = mediaOf(a);
  const actions = followingActions(a);
  let btn = actions.find((n) => n.dataset.action === ACTION) || null;
  if (!media) { if (btn) btn.hidden = true; return null; }
  if (btn) { btn.hidden = false; return btn; }
  btn = createSchedulePostButton({ like: a });
  btn.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const now = mediaOf(a);
    if (now) void openSocialPostFor({ url: now.url, type: now.type, studio });
  };
  (actions[actions.length - 1] || a).after(btn);
  return btn;
}

/** Add buttons to every download link under `root` (and `root` itself). */
export function scanSchedule(root, opts) {
  if (!root || root.nodeType !== 1) return;
  if (root.matches?.('a[download]')) attachSchedule(root, opts);
  root.querySelectorAll?.('a[download]').forEach((a) => attachSchedule(a, opts));
}

/** Watch the page for studio results. Call once. Returns { stop }. */
export function mountSchedulePostButtons({ root = document.body, observerClass = globalThis.MutationObserver } = {}) {
  if (!root || !observerClass) return { stop() {} };
  const route = () => String(routeHash(globalThis.location).replace(/^#\/?/, '').split(/[/?]/)[0] || '');
  const obs = new observerClass((records) => {
    for (const r of records) {
      if (r.type === 'attributes') { if (r.target.matches?.('a[download]')) attachSchedule(r.target, { studio: route() }); continue; }
      r.addedNodes.forEach((n) => scanSchedule(n, { studio: route() }));
    }
  });
  obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  scanSchedule(root, { studio: route() });
  return { stop: () => obs.disconnect() };
}
