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

// ---------------------------------------------------------------- readable URLs
// Mirrors public.slug_is_valid() (supabase/migrations/20261112010000_*). The
// database is the authority (reserved words, uniqueness, ownership); this is
// for instant feedback and for suggesting slugs.
export const RESERVED_SLUGS = Object.freeze([
  'admin', 'api', 'app', 'assets', 'auth', 'billing', 'account', 'profile', 'dashboard', 'embed',
  'help', 'login', 'logout', 'new', 'null', 'undefined', 'settings', 'signin', 'signup', 'static',
  'support', 'v', 'watch', 'www', 'openthorn', 'netlify', 'supabase', 'smartvideo', 'smartvid',
  'official', 'root', 'system', 'video', 'videos', 'edit', 'preview', 'public', 'private',
]);

/** null when valid, otherwise a short human reason. */
export function validateSlug(raw) {
  const s = String(raw ?? '');
  if (s.length < 3 || s.length > 48) return 'Use 3-48 characters';
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)) return 'Use lowercase letters, numbers and single hyphens; start and end with a letter or number';
  if (s.includes('--')) return 'Use single hyphens only';
  if (RESERVED_SLUGS.includes(s)) return 'That name is reserved';
  return null;
}

/** "My Spring Promo!" -> "my-spring-promo" (may still need a suffix / validation). */
export function slugify(text, fallback = 'video') {
  const s = String(text ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
  return validateSlug(s) ? fallback : s;
}

/** Canonical public URL: /v/<business>/<slug> when set, else /watch/<id>. */
export function canonicalUrl(video, origin = globalThis.location?.origin || '') {
  if (video?.business && video?.slug) return `${origin}/v/${encodeURIComponent(video.business)}/${encodeURIComponent(video.slug)}`;
  return watchUrl(video.id, origin);
}

const SLUG_ERRORS = {
  slug_taken: 'That name is already taken. Try another.',
  invalid_slug: 'That name is not allowed. Use 3-48 lowercase letters, numbers and hyphens.',
  business_required: 'Choose a business name first.',
  not_found: 'Publish the video first.',
  not_authenticated: 'Sign in to change your link.',
};
const slugFail = (error) => {
  if (!error) return;
  const key = Object.keys(SLUG_ERRORS).find((k) => String(error.message || '').includes(k));
  throw new Error(key ? SLUG_ERRORS[key] : (error.message || 'Could not update the link'));
};

export function embedCode(id, origin) {
  const src = `${watchUrl(id, origin)}?embed=1`;
  return `<iframe src="${src}" width="960" height="540" style="border:0;max-width:100%;aspect-ratio:16/9;height:auto" allow="autoplay; fullscreen" allowfullscreen title="Interactive video"></iframe>`;
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
    // The owner's mapping of sections to products/services (Projects > Retarget): lets the
    // server score viewer interest from observed behaviour. Absent when not mapped.
    ...(Array.isArray(state?.interestMap) && state.interestMap.length ? { interestMap: clean(state.interestMap.slice(0, 20)) } : {}),
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

export async function publishVideo(client, { id, project, projectId = null }) {
  const row = { id, title: project.title, project, published: true };
  if (projectId) row.project_id = projectId; // link to the editable source project
  const { data, error } = await client.from('published_videos').upsert(row, { onConflict: 'id' })
    .select('id, title, view_count, updated_at, slug, privacy, revision').single();
  fail(error, 'Publishing failed');
  return data;
}

export async function setPublished(client, id, published) {
  const { error } = await client.from('published_videos').update({ published: !!published }).eq('id', id);
  fail(error, 'Could not update the video');
}

export async function getMyVideo(client, id) {
  const { data, error } = await client.from('published_videos').select('id, title, published, view_count, updated_at, slug, privacy, revision').eq('id', id).maybeSingle();
  fail(error, 'Could not load the video');
  if (!data) return data;
  const { business } = await getMyBusiness(client).catch(() => ({ business: null }));
  return { ...data, business };
}

export async function getMyBusiness(client) {
  const { data, error } = await client.from('video_owner_profiles').select('business_slug, display_name').maybeSingle();
  fail(error, 'Could not load your business name');
  return { business: data?.business_slug || null, displayName: data?.display_name || null };
}

export async function claimBusinessSlug(client, slug, displayName = null) {
  const { data, error } = await client.rpc('claim_business_slug', { p_slug: slug, p_display: displayName });
  slugFail(error);
  return data;
}

export async function setVideoSlug(client, id, slug) {
  const { data, error } = await client.rpc('set_video_slug', { p_video_id: id, p_slug: slug });
  slugFail(error);
  return data;
}

export async function setVideoPrivacy(client, id, privacy) {
  if (!['public', 'unlisted'].includes(privacy)) throw new Error('Unknown privacy setting');
  const { error } = await client.from('published_videos').update({ privacy }).eq('id', id);
  fail(error, 'Could not update privacy');
}

/** Immutable published revisions, newest first. */
export async function listRevisions(client, id) {
  const { data, error } = await client.from('published_video_revisions')
    .select('revision, title, created_at').eq('video_id', id).order('revision', { ascending: false }).limit(20);
  fail(error, 'Could not load revisions');
  return data || [];
}

// ------------------------------------------------------------------ public API (viewer, no SDK)

function env() {
  const e = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  return { url: String(e.VITE_SUPABASE_URL || '').replace(/\/$/, ''), key: e.VITE_SUPABASE_ANON_KEY || '' };
}

/**
 * Load a published video for the viewer through get_published_video() (the
 * table itself is not publicly readable). Look up by id (/watch/<id>) or by
 * { business, slug } (/v/<business>/<slug>). Resolves to the sanitized video,
 * { redirect: {id, business, slug} } for a renamed link, or null when missing
 * or unpublished.
 */
export async function fetchPublishedVideo(ref, { url, key, fetchImpl = fetch } = env()) {
  const byId = typeof ref === 'string';
  const args = byId
    ? { p_id: ref }
    : { p_business: String(ref?.business || ''), p_slug: String(ref?.slug || '') };
  if (byId && !/^[A-Za-z0-9_-]{8,32}$/.test(ref)) return null;
  if (!byId && (validateSlug(args.p_business) || validateSlug(args.p_slug))) return null;
  if (!url || !key) throw new Error('Video service is not configured');
  const res = await fetchImpl(`${url}/rest/v1/rpc/get_published_video`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Could not load the video (HTTP ${res.status})`);
  const data = await res.json();
  return data && typeof data === 'object' ? data : null;
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
export async function submitViewerLead({ publishedId, clipId, kind, data, attribution = {} }, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key) return { stored: false, error: 'Lead service is not configured' };
  try {
    const res = await fetchImpl(`${url}/functions/v1/lead-capture`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publishedId, clipId: clipId != null ? String(clipId) : null, kind, data,
        source: {
          page: globalThis.location?.href || null,
          userAgent: globalThis.navigator?.userAgent || null,
          ...(attribution.utm ? { utm: attribution.utm } : {}),
          ...(attribution.referrer ? { referrer: attribution.referrer } : {}),
        },
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
