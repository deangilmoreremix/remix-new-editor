/**
 * Publishing interactive videos (Share panel → /watch/<id>).
 *
 * A published video is a snapshot of the timeline in `public.published_videos`
 * (supabase/migrations/20261105120000_create_published_videos.sql). The
 * public viewer (src/pages/WatchPage.jsx) plays it with its interactive
 * addons. Owner writes go through the signed-in Supabase client (RLS on the
 * Clerk `sub`); public reads go straight to the REST API with the anon key.
 */

import { isImageTokenKey, shareableImageValue } from '../../personalization/imageReadiness.js';

export const PROJECT_VERSION = 1;
export const SLUG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Unguessable share id (10 chars ≈ 57 bits). */
export function makeSlug(length = 10, rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = rand(length);
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('');
}

export const watchUrl = (id, origin = globalThis.location?.origin || '') => `${origin}/watch/${encodeURIComponent(id)}`;

export function embedCode(id, origin) {
  const src = `${watchUrl(id, origin)}?embed=1`;
  return `<iframe src="${src}" width="960" height="540" style="border:0;max-width:100%;aspect-ratio:16/9;height:auto" allow="autoplay; fullscreen" allowfullscreen title="Interactive video"></iframe>`;
}

// ------------------------------------------------------------ slugs + links

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;
export const RESERVED_SLUGS = Object.freeze(['watch', 'v', 'api', 'admin', 'embed', 'login', 'signup', 'app', 'static', 'assets', 'www', 'null', 'undefined']);

/** "Smith Roofing & Sons!" -> "smith-roofing-sons" ('' when nothing usable is left). */
export function slugify(text) {
  return String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
}

export const isValidSlug = (slug) => SLUG_RE.test(String(slug || '')) && !RESERVED_SLUGS.includes(String(slug));

/**
 * Public link for a published video. A readable slug gives /v/<slug>, otherwise the
 * permanent /watch/<id>. `recipient` is an opaque token (never a name or email).
 */
export function publicUrl({ id, slug = null, campaign = null, recipient = null }, origin = globalThis.location?.origin || '') {
  const base = slug && isValidSlug(slug)
    ? `${origin}/v/${encodeURIComponent(slug)}${campaign && SLUG_RE.test(campaign) ? `/${encodeURIComponent(campaign)}` : ''}`
    : watchUrl(id, origin);
  return recipient && /^[A-Za-z0-9_-]{16,128}$/.test(recipient) ? `${base}?recipient=${recipient}` : base;
}

// blob: files, and inline audio (an OpenAI voice whose upload failed), are
// uploaded before publishing so the published project stays small.
const isLocal = (v) => typeof v === 'string' && (v.startsWith('blob:') || /^data:audio\//.test(v));

/** Every blob: URL a project still uses (clip media, overlay images, posters). */
export function localSources(tracks = []) {
  const out = new Set();
  const visit = (v) => {
    if (isLocal(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  tracks.forEach((t) => (t.items || t.clips || []).forEach(visit));
  return [...out];
}

/** Deep copy without runtime-only keys (_submitted, _gating, lastError, …). */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (k.startsWith('_') || k === 'lastError' || typeof v === 'function' || v === undefined) return;
      out[k] = clean(v);
    });
    return out;
  }
  return value;
}

/**
 * The JSON snapshot that gets published.
 * @throws when local (unsaved) media is still referenced
 */
export function preparePublishProject(state, { title } = {}) {
  const tracks = (state?.tracks || []).map((t) => ({
    id: t.id, name: t.name, type: t.type, muted: !!t.muted, solo: !!t.solo,
    items: clean(t.items || t.clips || []),
  }));
  const local = localSources(tracks);
  if (local.length) {
    const err = new Error(`${local.length} file(s) in this video are only on this computer — they must be uploaded before publishing`);
    err.code = 'local_media';
    err.sources = local;
    throw err;
  }
  return {
    version: PROJECT_VERSION,
    title: String(title || state?.projectTitle || 'Untitled video').slice(0, 200),
    timelineSeconds: Number(state?.timelineSeconds) || 60,
    tracks,
    listBuilder: state?.listBuilder ? clean(state.listBuilder) : null,
    multiCam: state?.multiCam ? clean(state.multiCam) : null,
  };
}

/**
 * Upload local files and point the live timeline at the uploaded copies.
 * @param {object} o { getBlob(url) → Blob|null, upload(File) → url }
 * @returns {Promise<number>} files uploaded
 */
export async function uploadLocalMedia(state, { getBlob, upload }) {
  const sources = localSources(state?.tracks || []);
  if (!sources.length) return 0;
  const replaced = new Map();
  for (const url of sources) {
    let blob = getBlob?.(url) || null;
    if (!blob) {
      try { blob = await (await fetch(url)).blob(); } catch { blob = null; }
    }
    if (!blob) throw new Error('A local file is no longer available — re-add it to the timeline');
    const ext = (blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5);
    const file = new File([blob], `published-${Date.now()}.${ext}`, { type: blob.type || 'application/octet-stream' });
    const res = await upload(file);
    const remote = typeof res === 'string' ? res : res?.url;
    if (!remote || isLocal(remote)) throw new Error('Upload failed — sign in and try again');
    replaced.set(url, remote);
  }
  const swap = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).forEach(([k, v]) => {
      if (isLocal(v) && replaced.has(v)) obj[k] = replaced.get(v);
      else if (v && typeof v === 'object') swap(v);
    });
  };
  state.tracks.forEach((t) => (t.items || t.clips || []).forEach(swap));
  return replaced.size;
}

// ------------------------------------------------------------------ owner API (signed-in supabase-js client)

const fail = (error, fallback) => {
  if (!error) return;
  const msg = /JWT|permission|row-level|401|403/i.test(error.message || '') ? 'Sign in to publish videos' : (error.message || fallback);
  throw new Error(msg);
};

export async function publishVideo(client, { id, project }) {
  const row = { id, title: project.title, project, published: true };
  const { data, error } = await client.from('published_videos').upsert(row, { onConflict: 'id' }).select('id, title, view_count, updated_at').single();
  fail(error, 'Publishing failed');
  return data;
}

export async function setPublished(client, id, published) {
  const { error } = await client.from('published_videos').update({ published: !!published }).eq('id', id);
  fail(error, 'Could not update the video');
}

export async function getMyVideo(client, id) {
  // slug / live_revision exist only after 20261112130000_publish_links.sql; fall back so the Publish card keeps working without it.
  let res = await client.from('published_videos').select('id, title, published, view_count, updated_at, slug, live_revision').eq('id', id).maybeSingle();
  if (res.error && /column|slug|live_revision/i.test(res.error.message || '')) {
    res = await client.from('published_videos').select('id, title, published, view_count, updated_at').eq('id', id).maybeSingle();
  }
  fail(res.error, 'Could not load the video');
  return res.data;
}

// ------------------------------------------------------------------ owner: slugs, drafts, recipients

const VAR_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/**
 * Only plain strings with sane keys; image-token values must be durable http(s)
 * URLs (a blob: URL would break for every viewer). Anything else is dropped.
 */
export function sanitizeRecipientVariables(vars = {}) {
  const out = {};
  for (const [k, v] of Object.entries(vars || {})) {
    if (!VAR_KEY.test(k) || v == null) continue;
    if (isImageTokenKey(k)) {
      const href = shareableImageValue(v);
      if (href) out[k] = href;
    } else if (typeof v === 'string' || typeof v === 'number') {
      out[k] = String(v).slice(0, 500);
    }
  }
  return out;
}

export async function setSlug(client, id, slug) {
  const clean = String(slug || '').trim().toLowerCase();
  if (!isValidSlug(clean)) throw new Error('Use 3-63 lowercase letters, numbers or hyphens (not a reserved word).');
  const { error } = await client.from('published_videos').update({ slug: clean }).eq('id', id);
  if (error) throw new Error(error.code === '23505' || /slug_taken|duplicate/i.test(error.message || '') ? 'That link name is already taken.' : (error.message || 'Could not change the link name'));
  return clean;
}

/** Save the project as a DRAFT revision; the live link is not touched until promoteRevision. */
export async function publishDraft(client, { id, project }) {
  const { data: last, error: e1 } = await client.from('published_video_revisions').select('revision').eq('video_id', id).order('revision', { ascending: false }).limit(1);
  fail(e1, 'Could not save the draft');
  const revision = ((last && last[0] && last[0].revision) || 0) + 1;
  const { error } = await client.from('published_video_revisions').insert({ video_id: id, revision, kind: 'draft', project });
  fail(error, 'Could not save the draft');
  return revision;
}

/** Make a draft the live version of the SAME url. Recipient tokens keep working. */
export async function promoteRevision(client, id, revision) {
  const { error } = await client.rpc('promote_video_revision', { p_video_id: id, p_revision: revision });
  fail(error, 'Could not publish the draft');
  return revision;
}

/**
 * rows: [{ label, businessId?, contactRef?, variables, expiresAt? }] -> [{ id, token, label, contact_ref }].
 * Tokens are server-generated. Large batches are inserted in chunks; one video can hold only one ACTIVE link per contactRef.
 */
export async function createRecipients(client, videoId, rows = [], { chunk = 100 } = {}) {
  const insert = rows.map((r) => ({
    video_id: videoId,
    label: r.label ? String(r.label).slice(0, 200) : null,
    business_id: r.businessId || null,
    contact_ref: r.contactRef && /^[A-Za-z0-9_-]{1,80}$/.test(String(r.contactRef)) ? String(r.contactRef) : null,
    variables: sanitizeRecipientVariables(r.variables),
    expires_at: r.expiresAt || null,
  }));
  const out = [];
  for (let i = 0; i < insert.length; i += chunk) {
    const { data, error } = await client.from('video_recipients').insert(insert.slice(i, i + chunk)).select('id, token, label, contact_ref');
    if (error?.code === '23505') throw new Error('Some of these contacts already have an active link.');
    fail(error, 'Could not create the links');
    out.push(...(data || []));
  }
  return out;
}

export async function listRecipients(client, videoId) {
  const { data, error } = await client.from('video_recipients')
    .select('id, token, label, business_id, contact_ref, variables, status, expires_at, created_at, revoked_at').eq('video_id', videoId).order('created_at', { ascending: false });
  fail(error, 'Could not load the links');
  return data || [];
}

export async function revokeRecipient(client, recipientId) {
  const { error } = await client.from('video_recipients').update({ status: 'revoked' }).eq('id', recipientId);
  fail(error, 'Could not revoke the link');
}

/** Owner: replace one recipient's variables (sanitized). Use bulkLinks.mergeAssetVariables to refresh only asset slots. */
export async function updateRecipientVariables(client, recipientId, variables) {
  const { error } = await client.from('video_recipients').update({ variables: sanitizeRecipientVariables(variables) }).eq('id', recipientId);
  fail(error, 'Could not update the link');
}

/** Owner export: label,url,status (the label is owner-facing only and never part of the URL). */
export function recipientsCsv(recipients = [], { id, slug = null, origin } = {}) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
  const rows = recipients.map((r) => [r.label || '', publicUrl({ id, slug, recipient: r.token }, origin), r.status].map(q).join(','));
  return ['"name","url","status"', ...rows].join('\n');
}

// ------------------------------------------------------------------ public API (viewer, no SDK)

function env() {
  const e = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  return { url: String(e.VITE_SUPABASE_URL || '').replace(/\/$/, ''), key: e.VITE_SUPABASE_ANON_KEY || '' };
}

/**
 * Load a published video for the viewer by permanent id or readable slug
 * (including a slug it used to have). Returns null when missing/unpublished.
 * Legacy ids keep the original REST read first, so existing /watch/<id> links are
 * untouched; anything else goes through the single-row `get_published_video` RPC.
 */
export async function fetchPublishedVideo(id, { url, key, fetchImpl = fetch } = env()) {
  const k = String(id || '');
  const legacy = /^[A-Za-z0-9_-]{8,32}$/.test(k);
  const bySlug = SLUG_RE.test(k.toLowerCase());
  if (!legacy && !bySlug) return null;
  if (!url || !key) throw new Error('Video service is not configured');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
  if (legacy) {
    const res = await fetchImpl(`${url}/rest/v1/published_videos?id=eq.${encodeURIComponent(k)}&published=eq.true&select=id,title,project,updated_at`, { headers });
    if (!res.ok) throw new Error(`Could not load the video (HTTP ${res.status})`);
    const rows = await res.json();
    if (Array.isArray(rows) && rows[0]) return rows[0];
  }
  // Not a (readable) id: resolve as a slug or an old slug. This RPC also answers ids, so it keeps
  // working if the public table read is later restricted.
  const res = await fetchImpl(`${url}/rest/v1/rpc/get_published_video`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_key: k }),
  });
  if (!res.ok) throw new Error(`Could not load the video (HTTP ${res.status})`);
  const v = await res.json();
  return v && v.project ? { id: v.id, title: v.title, project: v.project, slug: v.slug || null, revision: v.revision || 1, canonical: v.canonical || v.id } : null;
}

/**
 * Resolve an opaque recipient token to that recipient's variables (text + image
 * URLs). null for unknown / revoked / expired tokens - the viewer then sees the
 * generic video, never anyone else's data.
 */
export async function resolveRecipient(videoKey, token, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key || !/^[A-Za-z0-9_-]{16,128}$/.test(String(token || ''))) return null;
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/resolve_recipient`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_video_id: String(videoKey), p_token: String(token) }),
    });
    if (!res.ok) return null;
    const vars = await res.json();
    return vars && typeof vars === 'object' && !Array.isArray(vars) ? sanitizeRecipientVariables(vars) : null;
  } catch { return null; }
}

export async function countView(id, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key) return;
  try {
    await fetchImpl(`${url}/rest/v1/rpc/increment_video_view`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: id }),
    });
  } catch { /* counting is best-effort */ }
}

export const VIDEO_EVENT_KINDS = Object.freeze(['view', 'play', 'complete', 'cta_click', 'lead']);

/**
 * Record what a viewer did on /watch/<id> (best-effort). Personal links
 * (?c=<contactId>) attribute it to that contact.
 */
export async function recordVideoEvent(id, { kind, contactId = null, clipId = null } = {}, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key || !VIDEO_EVENT_KINDS.includes(kind)) return;
  try {
    await fetchImpl(`${url}/rest/v1/rpc/record_video_event`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: id,
        kind,
        contact_id: contactId && /^[A-Za-z0-9_-]{1,80}$/.test(String(contactId)) ? String(contactId) : null,
        clip_id: clipId != null ? String(clipId).slice(0, 80) : null,
      }),
    });
  } catch { /* analytics is best-effort */ }
}

/** Owner: totals per contact for one of their videos. */
export async function fetchVideoStats(client, id) {
  const { data, error } = await client.rpc('video_events_by_contact', { video_id: id });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((r) => ({
    contactId: r.contact_id || null,
    views: Number(r.views) || 0,
    plays: Number(r.plays) || 0,
    completes: Number(r.completes) || 0,
    ctaClicks: Number(r.cta_clicks) || 0,
    leads: Number(r.leads) || 0,
    lastSeen: r.last_seen || null,
  }));
}

/** Submit a viewer's lead for a published video (stored for its owner). */
export async function submitViewerLead({ publishedId, clipId, kind, data }, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key) return { stored: false, error: 'Lead service is not configured' };
  try {
    const res = await fetchImpl(`${url}/functions/v1/lead-capture`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publishedId, clipId: clipId != null ? String(clipId) : null, kind, data,
        source: { page: globalThis.location?.href || null, userAgent: globalThis.navigator?.userAgent || null },
      }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok && body.ok ? { stored: !!body.stored, error: null } : { stored: false, error: body.error || `HTTP ${res.status}` };
  } catch (err) {
    return { stored: false, error: err?.message || String(err) };
  }
}

/** Personalization from the link: ?firstname=Ann&company=Acme → token profile. */
export function profileFromQuery(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search);
  const variables = {};
  // Per-image style carried by personal links: `<token>__f=x,y` (crop focus)
  // and `<token>__l=0.9` (brightness), restored below as saved assets.
  const style = {};
  params.forEach((v, k) => {
    const m = /^(.{1,40})__(f|l)$/.exec(k);
    if (!m || !isImageTokenKey(m[1])) return;
    (style[m[1]] ||= {})[m[2]] = v;
  });
  params.forEach((v, k) => {
    if (['embed', 'autoplay', 't', 'c'].includes(k) || k.length > 40) return;
    if (/__(f|l)$/.test(k) && isImageTokenKey(k.replace(/__(f|l)$/, ''))) return;
    // Image URLs from personal links ({{logoUrl}}, …) are kept whole — a cut
    // URL is a broken image — but only http(s) ones of sane length.
    if (isImageTokenKey(k)) {
      const href = shareableImageValue(v);
      if (href) variables[k] = href;
      return;
    }
    variables[k] = String(v).slice(0, 200);
  });
  // Personal links (?c=<contactId>) pick that contact's Smart Speech voice line.
  const id = params.get('c');
  const contactId = id && /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : null;
  if (!Object.keys(variables).length && !contactId) return null;
  const profile = contactId ? { id: contactId, variables } : { variables };
  const restored = [];
  for (const [key, s] of Object.entries(style)) {
    const url = variables[key];
    if (!url) continue;
    const asset = { url, originalUrl: url };
    const f = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(String(s.f || ''));
    if (f) asset.focus = { x: Math.max(0, Math.min(100, Number(f[1]))), y: Math.max(0, Math.min(100, Number(f[2]))) };
    const lum = s.l != null && String(s.l).trim() !== '' ? Number(s.l) : NaN;
    if (Number.isFinite(lum) && lum >= 0 && lum <= 1) asset.luminance = lum;
    if (asset.focus || asset.luminance != null) restored.push(asset);
  }
  if (restored.length) profile.personalization = { assets: { savedReferences: restored } };
  return profile;
}
