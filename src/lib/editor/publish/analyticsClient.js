/**
 * First-party analytics client for the hosted player.
 *
 * Sends meaningful events (page open, play, pause/resume, milestones, replay,
 * section rewatch, CTA / call / form interactions, errors) plus aggregated
 * continuous-playback segments to /api/video-events (netlify/functions/
 * video-events.js). Nothing is sent per second: events are queued and flushed
 * in batches (first flush ~2 s after the first event, then every 15 s, and on
 * page hide via sendBeacon). Every event carries a per-session sequence
 * number, so a retried batch is idempotent on the server.
 *
 * Privacy:
 *   - Do-Not-Track / Global Privacy Control, or ?consent=0|off|no  → nothing is sent.
 *   - ?consent=essential|anonymous → events are sent without a persistent viewer id.
 *   - otherwise a random viewer id is kept in localStorage (never personal data;
 *     hashed again on the server) so returning viewers can be recognised.
 *
 * Watch time counts only continuous foreground playback: seeking, pausing and
 * a hidden tab all end the current segment.
 */

export const ENDPOINT = '/api/video-events';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const MILESTONES = [0.25, 0.5, 0.75, 0.9];
const SEGMENT_FLUSH_SECONDS = 10;
const MAX_BATCH = 20;
const MAX_ATTEMPTS = 3;
const STORAGE_KEY = 'sv_viewer';

export const randomId = (len = 24, rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) =>
  Array.from(rand(len), (b) => ALPHABET[b % ALPHABET.length]).join('');

/** 'off' | 'anonymous' | 'full' */
export function consentMode(search = globalThis.location?.search || '', nav = globalThis.navigator || {}) {
  if (nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || globalThis.doNotTrack === '1' || nav.globalPrivacyControl === true) return 'off';
  const c = String(new URLSearchParams(search).get('consent') || '').toLowerCase();
  if (['0', 'off', 'no', 'false', 'denied'].includes(c)) return 'off';
  if (['essential', 'anonymous', 'necessary'].includes(c)) return 'anonymous';
  return 'full';
}

const NOOP = Object.freeze({
  mode: 'off', sessionId: null, track() {}, trackWatch() {}, onPlayerChange() {}, flush: async () => {}, destroy() {},
});

function referrerHost(doc) {
  try {
    const h = new URL(doc?.referrer || '').hostname;
    return h && h !== doc?.location?.hostname && /^[A-Za-z0-9.-]{1,120}$/.test(h) ? h : null;
  } catch { return null; }
}

/**
 * @param {object} o
 *   videoId      published video id
 *   recipient?   the server-issued recipient token from the personal link (?r=). It identifies the recipient; the server resolves it
 *                (a client-chosen contact id is no longer sent or trusted).
 *   sections?    [{ id, start, end }] seconds; enables section_rewatch
 *   mode?        override consentMode()
 * plus injectables for tests: fetchImpl, beacon, storage, rand, doc, setTimer, clearTimer, flushMs
 */
export function createAnalytics(o = {}) {
  const mode = o.mode || consentMode();
  if (mode === 'off' || !o.videoId) return NOOP;

  const doc = o.doc || globalThis.document;
  const fetchImpl = o.fetchImpl || ((...a) => globalThis.fetch(...a));
  const beacon = o.beacon !== undefined ? o.beacon : (globalThis.navigator?.sendBeacon ? (u, b) => globalThis.navigator.sendBeacon(u, b) : null);
  const setTimer = o.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer || ((t) => clearTimeout(t));
  const flushMs = o.flushMs ?? 15000;
  const sections = Array.isArray(o.sections) ? o.sections.filter((s) => s && s.id && s.end > s.start) : [];

  const sessionId = randomId(24, o.rand);
  let viewerId = null;
  if (mode === 'full') {
    try {
      const store = o.storage || globalThis.localStorage;
      viewerId = store.getItem(STORAGE_KEY);
      if (!viewerId || !/^[A-Za-z0-9_-]{16,64}$/.test(viewerId)) {
        viewerId = randomId(24, o.rand);
        store.setItem(STORAGE_KEY, viewerId);
      }
    } catch { viewerId = null; } // storage blocked: still counts as an anonymous session
  }
  const ref = referrerHost(doc);

  let seq = 0;
  let queue = [];
  let timer = null;
  let sending = false;
  let attempts = 0;
  let destroyed = false;

  const payload = (events) => JSON.stringify({
    video: o.videoId, session: sessionId, ...(viewerId ? { viewer: viewerId } : {}),
    ...(typeof o.recipient === 'string' && /^[A-Za-z0-9_-]{32}$/.test(o.recipient) ? { recipient: o.recipient } : {}), ...(ref ? { ref } : {}), events,
  });

  function schedule(ms) {
    if (timer || destroyed) return;
    timer = setTimer(() => { timer = null; flush(); }, ms);
  }

  // Remove exactly the events that were sent (by identity): a newer event queued while an earlier fetch was still
  // pending must survive, which slicing by the batch length would not guarantee after overlapping flushes.
  const dropSent = (batch) => queue.filter((e) => !batch.includes(e));

  async function flush({ final = false } = {}) {
    if (sending && !final) return;
    if (!queue.length) return;
    const batch = queue.slice(0, MAX_BATCH);
    const body = payload(batch);
    if (final && beacon) {
      let ok = false;
      try { ok = beacon(ENDPOINT, new Blob([body], { type: 'application/json' })); } catch { ok = false; }
      if (ok) { queue = dropSent(batch); if (queue.length) flush({ final: true }); return; }
    }
    sending = true;
    try {
      const res = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        // Delivered, or permanently rejected (e.g. unpublished): don't resend the same batch.
        queue = dropSent(batch);
        attempts = 0;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) { queue = dropSent(batch); attempts = 0; } // give up on this batch
      else schedule(2000 * 2 ** (attempts - 1)); // 2 s, 4 s: same seq numbers, so retries are idempotent
    } finally {
      sending = false;
    }
    if (queue.length && !timer && attempts === 0) schedule(flushMs);
  }

  function track(type, { t, clip, section, props } = {}) {
    if (destroyed) return;
    const e = { type, seq: seq++ };
    if (Number.isFinite(t)) e.t = Math.round(t * 1000) / 1000;
    if (clip != null) e.clip = String(clip).slice(0, 80);
    if (section != null) e.section = String(section).slice(0, 80);
    if (props) e.props = props;
    queue.push(e);
    schedule(queue.length === 1 && seq === 1 ? 2000 : (seq <= 3 ? 2000 : flushMs));
  }

  function trackWatch(t0, t1) {
    if (destroyed || !(t1 - t0 >= 0.5)) return;
    queue.push({ type: 'watch', seq: seq++, t0: Math.round(t0 * 1000) / 1000, t1: Math.round(t1 * 1000) / 1000 });
    schedule(flushMs);
  }

  // ---------------------------------------------------------------- playback tracker
  const st = {
    started: false, wasPlaying: false, completed: false, lastTime: null,
    segStart: null, segEnd: null, fired: new Set(), covered: new Set(), sectionSeconds: {}, activeSection: null,
  };

  function flushSegment() {
    if (st.segStart != null && st.segEnd != null) trackWatch(st.segStart, st.segEnd);
    st.segStart = null; st.segEnd = null;
  }

  const sectionAt = (time) => sections.find((s) => time >= s.start && time < s.end) || null;

  function onPlayerChange({ playing, time, duration }) {
    if (destroyed || !(duration > 0) || !Number.isFinite(time)) return;
    const hidden = !!doc?.hidden;
    const effective = playing && !hidden;
    const continuous = effective && st.lastTime != null && time >= st.lastTime && time - st.lastTime <= 1.5;

    if (effective) {
      if (!st.started) {
        st.started = true;
        track('play', { t: time });
      } else if (!st.wasPlaying) {
        if (st.completed && time < duration * 0.5) {
          st.completed = false; st.fired.clear(); st.covered.clear(); st.sectionSeconds = {};
          track('replay', { t: time });
        } else {
          track('resume', { t: time });
        }
      }
      if (continuous) {
        if (st.segStart == null) st.segStart = st.lastTime;
        st.segEnd = time;
        const delta = time - st.lastTime;
        const bucket = Math.min(99, Math.floor((time / duration) * 100));
        st.covered.add(bucket);

        const sec = sectionAt(time);
        if (sec) st.sectionSeconds[sec.id] = (st.sectionSeconds[sec.id] || 0) + delta;
        if (sec?.id !== st.activeSection) {
          // Re-entering a section the viewer already watched = a rewatch.
          if (sec && (st.sectionSeconds[sec.id] || 0) - delta >= 2) track('section_rewatch', { section: sec.id, t: time });
          st.activeSection = sec?.id || null;
        }

        // Milestones need real viewing: position reached AND ≥80% of the part before it watched.
        for (const m of MILESTONES) {
          const name = `progress_${Math.round(m * 100)}`;
          if (st.fired.has(name) || time / duration < m) continue;
          let seen = 0;
          for (let b = 0; b < Math.floor(m * 100); b += 1) if (st.covered.has(b)) seen += 1;
          if (seen >= 0.8 * Math.floor(m * 100)) { st.fired.add(name); track(name, { t: time }); }
        }
        if (st.segEnd - st.segStart >= SEGMENT_FLUSH_SECONDS) {
          const end = st.segEnd; flushSegment(); st.segStart = end; st.segEnd = end;
        }
      } else {
        flushSegment(); // a seek or the first tick: a new segment starts here
        st.segStart = time; st.segEnd = time;
        const entered = sectionAt(time);
        // Jumping back into a section that was already watched is a rewatch.
        if (entered && entered.id !== st.activeSection && (st.sectionSeconds[entered.id] || 0) >= 2) {
          track('section_rewatch', { section: entered.id, t: time });
        }
        st.activeSection = entered?.id || null;
      }
      if (!st.completed && time >= duration - 0.3) {
        st.completed = true;
        flushSegment();
        track('complete', { t: time });
      }
    } else if (st.wasPlaying) {
      flushSegment();
      if (!hidden && !(time >= duration - 0.3)) track('pause', { t: time });
    }
    st.wasPlaying = effective;
    st.lastTime = effective ? time : null;
  }

  // ---------------------------------------------------------------- lifecycle
  const onHide = () => { flushSegment(); flush({ final: true }); };
  const onVisibility = () => { if (doc?.visibilityState === 'hidden') onHide(); };
  doc?.addEventListener?.('visibilitychange', onVisibility);
  globalThis.addEventListener?.('pagehide', onHide);

  track('page_open');

  return {
    mode,
    sessionId,
    track,
    trackWatch,
    onPlayerChange,
    flush,
    destroy() {
      if (destroyed) return;
      flushSegment();
      flush({ final: true });
      destroyed = true;
      if (timer) clearTimer(timer);
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      globalThis.removeEventListener?.('pagehide', onHide);
    },
    _state: () => ({ queue: queue.slice(), seq }),
  };
}
