/**
 * Conversion trackers for published (/watch) videos: Facebook Pixel, Google Analytics 4,
 * TikTok Pixel and Google Tag Manager.
 *
 * Each id lives on the Lead Generator clip or the List Builder in the published project
 * (`fbPixelId`, `gaMeasurementId`, `tiktokPixelId`, `gtmId`). After a lead is saved we fire one
 * bare "lead" event per configured tracker. Form answers are NEVER sent (they are personal data),
 * and nothing loads when the viewer opted out (Do-Not-Track / GPC / ?consent=off|essential),
 * matching the first-party analytics. Ids are validated before they go into a script URL.
 *
 * Only the published player fires the GA4 / TikTok / GTM trackers, so test submissions in the
 * editor never pollute the owner's analytics.
 */
import { consentMode } from './analyticsClient.js';

const FB_ID = /^\d{5,20}$/;
const GA_ID = /^G-[A-Z0-9]{6,12}$/;
const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/;
const TIKTOK_ID = /^[A-Z0-9]{10,30}$/;

const normalize = (raw, re) => {
  const id = String(raw ?? '').trim().toUpperCase();
  return re.test(id) ? id : '';
};

/** The lead config (List Builder if enabled, or the Lead Generator clip) for a lead event. */
function leadConfig(project, kind, clipId) {
  if (kind === 'list-builder' || kind === 'personalizer') {
    return project?.listBuilder?.enabled ? project.listBuilder : null;
  }
  if (kind === 'lead-form') {
    for (const t of Array.isArray(project?.tracks) ? project.tracks : []) {
      const items = Array.isArray(t.items) ? t.items : Array.isArray(t.clips) ? t.clips : [];
      const clip = items.find((c) => String(c.id) === String(clipId) && c.type === 'lead-form');
      if (clip) return clip;
    }
  }
  return null;
}

/** { fb?, ga?, tiktok?, gtm? }: only the trackers that are configured with a valid id. */
export function trackersFor(project, kind, clipId) {
  const c = leadConfig(project, kind, clipId);
  if (!c) return {};
  const out = {};
  const fb = normalize(c.fbPixelId, FB_ID);
  const ga = normalize(c.gaMeasurementId, GA_ID);
  const tiktok = normalize(c.tiktokPixelId, TIKTOK_ID);
  const gtm = normalize(c.gtmId, GTM_ID);
  if (fb) out.fb = fb;
  if (ga) out.ga = ga;
  if (tiktok) out.tiktok = tiktok;
  if (gtm) out.gtm = gtm;
  return out;
}

/** The Facebook pixel id configured for a lead event, or '' when none/invalid. */
export function pixelIdFor(project, kind, clipId) {
  return trackersFor(project, kind, clipId).fb || '';
}

// ---------------------------------------------------------------- loaders

const once = (win, key) => {
  if (!win.__remixTrackers) win.__remixTrackers = new Set();
  if (win.__remixTrackers.has(key)) return false;
  win.__remixTrackers.add(key);
  return true;
};

function addScript(win, src) {
  const s = win.document.createElement('script');
  s.async = true;
  s.src = src;
  win.document.head.appendChild(s);
}

// Standard Meta Pixel loader, only run when a pixel id is configured.
function loadPixel(win) {
  if (win.fbq) return;
  // Meta's standard stub: calls are queued until fbevents.js loads and replaces `callMethod`.
  // (Must queue on `fbq.queue`; pushing onto the function itself throws.)
  const fbq = function fbq() { // eslint-disable-line func-names
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments); // eslint-disable-line prefer-rest-params
    else fbq.queue.push(arguments); // eslint-disable-line prefer-rest-params
  };
  if (!win._fbq) win._fbq = fbq;
  fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
  win.fbq = fbq;
  addScript(win, 'https://connect.facebook.net/en_US/fbevents.js');
}

/** Fire a bare `Lead` for the Facebook pixel `pixelId`. Returns true when it was sent/queued. */
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

// Google Analytics 4: gtag.js, then the standard `generate_lead` event.
function fireGa(win, id) {
  if (!win.dataLayer) win.dataLayer = [];
  // gtag.js reads the `arguments` object itself, so this must be a plain function that pushes it.
  if (!win.gtag) win.gtag = function gtag() { win.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
  if (once(win, `ga:${id}`)) {
    addScript(win, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
    win.gtag('js', new Date());
    win.gtag('config', id, { send_page_view: false });
  }
  win.gtag('event', 'generate_lead', { send_to: id });
}

// Google Tag Manager: the container loader, then a `generate_lead` dataLayer event the container can act on.
function fireGtm(win, id) {
  if (!win.dataLayer) win.dataLayer = [];
  if (once(win, `gtm:${id}`)) {
    win.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    addScript(win, `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
  }
  win.dataLayer.push({ event: 'generate_lead' });
}

const TT_METHODS = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group',
  'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];

// TikTok Pixel: the vendor's standard `ttq` queue + loader (calls made before the script arrives are replayed).
function bootTikTok(win) {
  win.TiktokAnalyticsObject = 'ttq';
  const ttq = (win.ttq = win.ttq || []);
  if (ttq.load) return ttq; // already set up (by us or by the page)
  ttq.methods = TT_METHODS;
  ttq.setAndDefer = (o, m) => { o[m] = (...args) => { o.push([m, ...args]); }; };
  TT_METHODS.forEach((m) => ttq.setAndDefer(ttq, m));
  ttq.instance = (id) => {
    const inst = (ttq._i && ttq._i[id]) || [];
    TT_METHODS.forEach((m) => ttq.setAndDefer(inst, m));
    return inst;
  };
  ttq.load = (id, opts) => {
    const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {};
    ttq._i[id] = [];
    ttq._i[id]._u = src;
    ttq._t = ttq._t || {};
    ttq._t[id] = Date.now();
    ttq._o = ttq._o || {};
    ttq._o[id] = opts || {};
    addScript(win, `${src}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
  };
  return ttq;
}

function fireTikTok(win, id) {
  const ttq = bootTikTok(win);
  if (once(win, `tt:${id}`)) ttq.load(id);
  ttq.instance(id).track('SubmitForm');
}

/**
 * Fire the "lead" event on every configured tracker. Returns the trackers that fired, e.g. ['fb', 'ga'].
 * Does nothing unless the viewer allows tracking; one tracker failing never stops the others.
 */
export function fireLeadTrackers(trackers = {}, { win = globalThis, mode = consentMode() } = {}) {
  const fired = [];
  if (mode !== 'full' || !win?.document) return fired;
  if (trackers.fb && fireLeadPixel(trackers.fb, { win, mode })) fired.push('fb');
  const run = (name, id, fn) => {
    if (!id) return;
    try { fn(win, id); fired.push(name); } catch { /* a blocked or broken tracker must not affect the others */ }
  };
  run('ga', trackers.ga, fireGa);
  run('tiktok', trackers.tiktok, fireTikTok);
  run('gtm', trackers.gtm, fireGtm);
  return fired;
}
