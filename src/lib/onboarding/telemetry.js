// src/lib/onboarding/telemetry.js
//
// First-party funnel events for the onboarding (received by netlify/functions/onboarding-events.js).
//   - a random anonymous id (localStorage) and a per-visit session id + sequence (sessionStorage), so a reload in the
//     middle of the flow keeps counting in order and a retried batch is de-duplicated by the server
//   - only choice ids and booleans are sent (never company, website, job title or any free text)
//   - "Do Not Track" / Global Privacy Control turn it off; so does an unavailable network
//   - events are queued and sent in small batches; flush() is awaited before the page navigates away
//   - when signed in, the Clerk token goes along as a Bearer header so the server can attach the verified user
const ANON_KEY = 'smartvideo-anon-id';
const SESSION_KEY = 'smartvideo-onb-session';
const MAX_BATCH = 25;
const MAX_QUEUE = 200;
const ID_VALUE = /^[a-z0-9][a-z0-9_.:-]{0,39}$/;

const randomId = (len = 24) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  try { globalThis.crypto.getRandomValues(bytes); } catch { for (let i = 0; i < len; i += 1) bytes[i] = Math.floor(Math.random() * 256); }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

/** Keeps booleans, small integers and choice ids (and lists of them); drops everything else (free text, objects). */
export function safeProps(p) {
  const out = {};
  if (!p || typeof p !== 'object') return out;
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 999) out[k] = v;
    else if (typeof v === 'string' && ID_VALUE.test(v)) out[k] = v;
    else if (Array.isArray(v)) { const l = v.filter((x) => typeof x === 'string' && ID_VALUE.test(x)).slice(0, 40); if (l.length || !v.length) out[k] = l; }
  }
  return out;
}

export const trackingAllowed = (nav = globalThis.navigator) => !(nav && (nav.doNotTrack === '1' || nav.globalPrivacyControl === true));

export function createTelemetry({
  endpoint = '/api/onboarding-events',
  enabled = true,
  local = globalThis.localStorage,
  session = globalThis.sessionStorage,
  fetchImpl = (...a) => globalThis.fetch(...a),
  getToken = async () => globalThis.window?.Clerk?.session?.getToken?.() || null,
  referrer = () => { try { return new URL(globalThis.document?.referrer || '').hostname; } catch { return ''; } },
  tokenTimeoutMs = 800,
} = {}) {
  const read = (s, k) => { try { return s?.getItem(k) || null; } catch { return null; } };
  const write = (s, k, v) => { try { s?.setItem(k, v); } catch { /* storage blocked: ids live in memory */ } };
  let memAnon = null;
  const anon = () => {
    const have = read(local, ANON_KEY);
    if (have && /^[A-Za-z0-9_-]{16,64}$/.test(have)) return have;
    const id = memAnon || randomId(24);
    memAnon = id;
    write(local, ANON_KEY, id);
    return id;
  };
  let memSession = null;
  const sess = () => {
    let s;
    try { s = JSON.parse(read(session, SESSION_KEY) || 'null'); } catch { /* unreadable: start a new one */ }
    if (!s || !/^[A-Za-z0-9_-]{16,64}$/.test(s.id || '') || !Number.isInteger(s.seq)) s = memSession || { id: `s${randomId(22)}`, seq: 0 };
    memSession = s;
    return s;
  };
  const nextSeq = () => { const s = sess(); const n = s.seq; s.seq += 1; write(session, SESSION_KEY, JSON.stringify(s)); return n; };

  let queue = [];
  let inflight = Promise.resolve();
  let timer = null;
  const on = () => enabled && trackingAllowed();

  const send = async (batch) => {
    const token = await Promise.race([getToken(), new Promise((r) => setTimeout(() => r(null), tokenTimeoutMs))]).catch(() => null);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchImpl(endpoint, {
      method: 'POST', headers, keepalive: true,
      body: JSON.stringify({ anon: anon(), session: sess().id, ref: referrer() || undefined, events: batch }),
    });
    // 4xx (other than rate limit) means the batch itself is bad: drop it instead of retrying forever.
    if (res && !res.ok && (res.status >= 500 || res.status === 429)) throw new Error(`HTTP ${res.status}`);
  };

  const drain = async () => {
    clearTimeout(timer); timer = null;
    while (queue.length) {
      const batch = queue.splice(0, MAX_BATCH);
      try { await send(batch); } catch { queue = [...batch, ...queue].slice(-MAX_QUEUE); break; }
    }
  };

  return {
    /** Queue one event: track('step_view', { step: 2, sub: 'tools', props: { ... } }). */
    track(event, { step, sub, props } = {}) {
      if (!on()) return;
      const e = { event, seq: nextSeq() };
      if (Number.isInteger(step)) e.step = step;
      if (sub) e.sub = sub;
      const p = safeProps(props);
      if (Object.keys(p).length) e.props = p;
      queue.push(e);
      if (queue.length > MAX_QUEUE) queue.shift();
      if (queue.length >= MAX_BATCH) void this.flush();
      else if (!timer) timer = setTimeout(() => { void this.flush(); }, 2000);
    },
    /** Sends everything queued; await it before navigating away. Never throws. */
    flush() {
      if (!queue.length) return inflight;
      inflight = inflight.then(drain).catch(() => {});
      return inflight;
    },
    pending: () => queue.length,
    ids: () => ({ anon: anon(), session: sess().id }),
  };
}

// The app-wide instance (off in local development so the dev server is not spammed with failed requests).
export const telemetry = createTelemetry({ enabled: !import.meta.env?.DEV });
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void telemetry.flush(); });
}
