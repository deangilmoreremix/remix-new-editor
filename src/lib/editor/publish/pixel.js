/**
 * Facebook Pixel for published (/watch) videos.
 *
 * The editor preview already fires `Lead`; the public player never did. The
 * pixel id lives on the Lead Generator clip (`fbPixelId`) or the List Builder
 * (`listBuilder.fbPixelId`) in the published project. We fire a bare `Lead`
 * event only: no form answers are sent to Facebook (they are personal data),
 * and nothing loads when the viewer opted out (Do-Not-Track / GPC /
 * ?consent=off|essential), matching the first-party analytics.
 */
import { consentMode } from './analyticsClient.js';

const PIXEL_ID = /^\d{5,20}$/;

/** The pixel id configured for a lead event, or '' when none/invalid. */
export function pixelIdFor(project, kind, clipId) {
  let raw = '';
  if (kind === 'list-builder' || kind === 'personalizer') {
    raw = project?.listBuilder?.enabled ? project.listBuilder.fbPixelId : '';
  } else if (kind === 'lead-form') {
    for (const t of Array.isArray(project?.tracks) ? project.tracks : []) {
      const items = Array.isArray(t.items) ? t.items : Array.isArray(t.clips) ? t.clips : [];
      const clip = items.find((c) => String(c.id) === String(clipId) && c.type === 'lead-form');
      if (clip) { raw = clip.fbPixelId; break; }
    }
  }
  const id = String(raw ?? '').trim();
  return PIXEL_ID.test(id) ? id : '';
}

// Standard Meta Pixel loader, only run when a pixel id is configured.
function loadPixel(win) {
  if (win.fbq) return;
  const doc = win.document;
  const fbq = function (...args) { (fbq.callMethod ? fbq.callMethod : fbq.queue.push).apply(fbq, args); };
  if (!win._fbq) win._fbq = fbq;
  fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
  win.fbq = fbq;
  const s = doc.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  doc.head.appendChild(s);
}

/** Fire a bare `Lead` for `pixelId`. Returns true when it was sent/queued. */
export function fireLeadPixel(pixelId, { win = globalThis, mode = consentMode() } = {}) {
  if (!pixelId || mode !== 'full' || !win?.document) return false;
  try {
    loadPixel(win);
    win.fbq('init', pixelId);
    win.fbq('trackSingle', pixelId, 'Lead');
    return true;
  } catch {
    return false;
  }
}
