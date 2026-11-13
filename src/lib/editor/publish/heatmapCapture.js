/**
 * Heatmap capture for the hosted watch page (Stage 7). Rides on the existing analyticsClient (createAnalytics):
 * it only calls analytics.track(), so batching, retries, idempotent (session, seq) numbers, and the consent gates
 * (DNT / GPC / ?consent=) are exactly the existing ones. When analytics is off (mode 'off') nothing is observed.
 *
 * Captured (all aggregated server-side, see supabase/migrations/20261114100000_heatmap_analytics.sql):
 *   heat_click      normalized x/y (0..1 of the watch-page container), page-height bucket, viewport class,
 *                   CTA clip id + kind + the owner's label when a CTA was hit. Capped per session, de-duplicated.
 *   cta_impression  a CTA was >= 50% visible, once per session per CTA (valid CTR denominator).
 *   scroll_depth    25/50/75/100 milestones, once per session.
 *   watch_buckets   seconds of continuous playback as [first,last] ranges (batched, never per tick).
 * Not captured: pointer movement, element text/selectors, form values, keystrokes.
 */
import { viewportClass, normalizePoint, pageBucket, ctaKind, toRanges, scrollDepth, milestonesReached, createClickGate } from './heatmap/geometry.js';

const CTA_SELECTOR = 'a.wf-cta, a.wf-linkbox, [data-cta-id]';
const SKIP_TARGET = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const MAX_WATCH_EVENTS = 60;
const FLUSH_SECONDS = 30;

/** Id of the project's lead-form clip when there is exactly one (else null: impressions then have no join key). */
export function singleLeadClipId(project) {
  const ids = [];
  for (const t of Array.isArray(project?.tracks) ? project.tracks : []) {
    for (const c of Array.isArray(t?.items) ? t.items : Array.isArray(t?.clips) ? t.clips : []) if (c?.type === 'lead-form' && c.id != null) ids.push(String(c.id));
  }
  return ids.length === 1 ? ids[0] : null;
}

const NOOP = Object.freeze({ active: false, onPlayerChange() {}, destroy() {} });

/**
 * @param {object} o
 *   analytics    result of createAnalytics()
 *   container    the watch-page container element (coordinates are relative to it)
 *   frame?       element that contains the player's CTA elements (default: container)
 *   labelFor?    (clipId) => owner's label for that CTA, or null
 *   leadClipId?  id of the project's lead-form clip when there is exactly one (key for lead_capture impressions)
 *   win/doc?     injectable for tests
 */
export function createHeatmapCapture(o = {}) {
  const analytics = o.analytics;
  if (!analytics || analytics.mode === 'off' || !o.container) return NOOP;
  const win = o.win || globalThis.window || globalThis;
  const doc = o.doc || globalThis.document;
  const container = o.container;
  const frame = o.frame || container;
  const labelFor = o.labelFor || (() => null);
  const now = o.now || (() => Date.now());

  const vp = () => viewportClass(win.innerWidth);
  const pageHeight = () => Math.max(doc?.documentElement?.scrollHeight || 0, doc?.body?.scrollHeight || 0, container.scrollHeight || 0, container.getBoundingClientRect?.().height || 0);
  const gate = createClickGate();
  let destroyed = false;

  // ------------------------------------------------------------ clicks
  const ctaOf = (target) => {
    const el = target?.closest?.(CTA_SELECTOR);
    if (!el) return null;
    const id = el.dataset?.clipId || el.dataset?.ctaId || null;
    if (!id) return null;
    const label = labelFor(id) || null;
    return { id: String(id).slice(0, 80), label, kind: ctaKind({ href: el.getAttribute?.('href') || '', label, lead: !!el.matches?.('form.addon-optin') }) };
  };
  function onClick(e) {
    if (destroyed || (!e.isTrusted && !o.allowUntrusted)) return;
    if (e.target?.closest?.(SKIP_TARGET)) return;                    // never record clicks on form fields
    if (e.detail === 0 && !e.clientX && !e.clientY) return;           // keyboard-activated click: no real position
    const p = normalizePoint(e.clientX, e.clientY, container.getBoundingClientRect());
    if (!p || !gate.allow(p, now())) return;
    const cta = ctaOf(e.target);
    const props = { vp: vp(), x: p.x, y: p.y, pb: pageBucket(pageHeight()) };
    if (cta) { props.cta = cta.id; props.kind = cta.kind; if (cta.label) props.label = cta.label.slice(0, 80); }
    analytics.track('heat_click', { props });
  }
  container.addEventListener('click', onClick, true);

  // ------------------------------------------------------------ CTA impressions (>= 50% visible, once per session)
  const seen = new Set();
  const impress = (id, kind, label) => {
    if (seen.has(id)) return;
    seen.add(id);
    analytics.track('cta_impression', { props: { vp: vp(), cta: id, kind, ...(label ? { label: label.slice(0, 80) } : {}) } });
  };
  // The lead form carries the id of the project's single lead-form clip (data-cta-id) and the 'lead_capture' kind.
  const resolve = ctaOf;
  const IO = o.IntersectionObserver || win.IntersectionObserver;
  const MO = o.MutationObserver || win.MutationObserver;
  const watching = new WeakSet();
  const io = IO ? new IO((entries) => {
    for (const en of entries) {
      if (!(en.isIntersecting && en.intersectionRatio >= 0.5)) continue;
      const cta = resolve(en.target);
      if (cta) { impress(cta.id, cta.kind, cta.label); io.unobserve(en.target); }
    }
  }, { threshold: [0.5] }) : null;
  const observeAll = () => {
    if (!io || destroyed) return;
    frame.querySelectorAll?.(CTA_SELECTOR).forEach((el) => { if (!watching.has(el)) { watching.add(el); io.observe(el); } });
    const form = frame.querySelector?.('form.addon-optin');
    if (form && o.leadClipId && !watching.has(form)) { watching.add(form); form.dataset.ctaId = String(o.leadClipId); io.observe(form); }
  };
  const mo = MO ? new MO(observeAll) : null;
  mo?.observe(frame, { childList: true, subtree: true });
  observeAll();

  // ------------------------------------------------------------ scroll depth
  const reached = new Set();
  let scrollTimer = null;
  function checkScroll() {
    scrollTimer = null;
    if (destroyed) return;
    const depth = scrollDepth({
      scrollTop: win.scrollY ?? doc?.documentElement?.scrollTop ?? 0,
      viewportHeight: win.innerHeight, pageHeight: pageHeight(),
    });
    for (const m of milestonesReached(depth, reached)) {
      reached.add(m);
      analytics.track('scroll_depth', { props: { vp: vp(), v: m } });
    }
  }
  const scheduleScroll = () => { if (!scrollTimer && !destroyed) scrollTimer = setTimeout(checkScroll, 150); };
  win.addEventListener?.('scroll', scheduleScroll, { passive: true });
  win.addEventListener?.('resize', scheduleScroll);
  checkScroll(); // the part of the page visible on load counts as reached

  // ------------------------------------------------------------ per-second watch buckets
  let last = null;
  let runSeen = new Set();
  let pending = [];
  let watchEvents = 0;
  function flushPending() {
    if (!pending.length) return;
    const r = toRanges(pending);
    pending = [];
    if (!r.length || watchEvents >= MAX_WATCH_EVENTS) return;
    watchEvents += 1;
    analytics.track('watch_buckets', { props: { vp: vp(), r: r.slice(0, 30) } });
  }
  function endRun() { flushPending(); runSeen = new Set(); last = null; }
  function onPlayerChange({ playing, time, duration } = {}) {
    if (destroyed || !(duration > 0) || !Number.isFinite(time)) return;
    const effective = !!playing && !doc?.hidden;
    if (!effective) { endRun(); return; }
    const continuous = last != null && time >= last && time - last <= 1.5;
    if (!continuous) { flushPending(); runSeen = new Set(); } // a seek starts a new play-through
    else {
      const s = Math.floor(time);
      if (s >= 0 && s <= 3599 && !runSeen.has(s)) { runSeen.add(s); pending.push(s); }
      if (pending.length >= FLUSH_SECONDS) flushPending();
    }
    last = time;
  }
  const onHide = () => { if (doc?.visibilityState === 'hidden') { endRun(); analytics.flush?.({ final: true }); } };
  doc?.addEventListener?.('visibilitychange', onHide);

  return {
    active: true,
    onPlayerChange,
    destroy() {
      if (destroyed) return;
      endRun();
      destroyed = true;
      container.removeEventListener('click', onClick, true);
      win.removeEventListener?.('scroll', scheduleScroll);
      win.removeEventListener?.('resize', scheduleScroll);
      doc?.removeEventListener?.('visibilitychange', onHide);
      if (scrollTimer) clearTimeout(scrollTimer);
      io?.disconnect(); mo?.disconnect();
    },
  };
}
