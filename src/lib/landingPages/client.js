/**
 * Landing pages data layer (public.landing_pages and friends,
 * supabase/migrations/20261113120000_create_landing_pages.sql).
 *
 * Owner calls take a signed-in supabase-js client (RLS on the Clerk `sub`).
 * Viewer calls use the REST API with the anon key and no SDK, like
 * src/lib/editor/publish/publishClient.js, so the public page stays light.
 */
import { makeSlug } from '../editor/publish/publishClient.js';
import { sanitizeConfig, safeImageUrl } from './templates.js';

export const PAGE_ID_RE = /^[A-Za-z0-9_-]{8,32}$/;
export const CONTACT_ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
export const PAGE_EVENT_KINDS = Object.freeze(['view', 'play', 'progress_25', 'progress_50', 'progress_75', 'complete', 'cta_click', 'lead', 'like']);

export const pageUrl = (id, origin = globalThis.location?.origin || '') => `${origin}/p/${encodeURIComponent(id)}`;
export const personalUrl = (id, contactId, origin) => `${pageUrl(id, origin)}?c=${encodeURIComponent(contactId)}`;

export function embedCode(id, origin) {
  const src = `${pageUrl(id, origin)}?embed=1`;
  return `<iframe src="${src}" width="960" height="540" style="border:0;max-width:100%;aspect-ratio:16/9;height:auto" allow="autoplay; fullscreen" allowfullscreen title="Video"></iframe>`;
}

const fail = (error, fallback) => {
  if (!error) return;
  const msg = /JWT|permission|row-level|401|403/i.test(error.message || '') ? 'Sign in to manage landing pages' : (error.message || fallback);
  throw new Error(msg);
};

const PAGE_COLUMNS = 'id, title, video_url, poster_url, duration, source, config, published, view_count, created_at, updated_at';

// ------------------------------------------------------------------ owner API

export async function createPage(client, { title, videoUrl, posterUrl = null, duration = null, source = {}, config }) {
  if (!/^https:\/\//i.test(String(videoUrl || ''))) throw new Error('The video needs a permanent https link before it can be published');
  const row = {
    id: makeSlug(10),
    title: String(title || 'Untitled page').slice(0, 200),
    video_url: videoUrl,
    poster_url: safeImageUrl(posterUrl) || null,
    duration: Number.isFinite(Number(duration)) ? Number(duration) : null,
    source: source && typeof source === 'object' ? source : {},
    config: sanitizeConfig(config),
    published: false,
  };
  const { data, error } = await client.from('landing_pages').insert(row).select(PAGE_COLUMNS).single();
  fail(error, 'Could not create the page');
  return data;
}

export async function updatePage(client, id, patch = {}) {
  const row = {};
  if ('title' in patch) row.title = String(patch.title || 'Untitled page').slice(0, 200);
  if ('config' in patch) row.config = sanitizeConfig(patch.config);
  if ('posterUrl' in patch) row.poster_url = safeImageUrl(patch.posterUrl) || null;
  if ('published' in patch) row.published = !!patch.published;
  const { data, error } = await client.from('landing_pages').update(row).eq('id', id).select(PAGE_COLUMNS).single();
  fail(error, 'Could not save the page');
  return data;
}

export const setPagePublished = (client, id, published) => updatePage(client, id, { published });

export async function listPages(client) {
  const { data, error } = await client.from('landing_pages').select(PAGE_COLUMNS).order('updated_at', { ascending: false });
  fail(error, 'Could not load your pages');
  return Array.isArray(data) ? data : [];
}

export async function deletePage(client, id) {
  const { error } = await client.from('landing_pages').delete().eq('id', id);
  fail(error, 'Could not delete the page');
}

const num = (v) => Number(v) || 0;

export async function fetchPageStats(client, id) {
  const { data, error } = await client.rpc('page_stats', { page_id: id });
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) || {};
  return {
    views: num(r.views), plays: num(r.plays), completes: num(r.completes),
    ctaClicks: num(r.cta_clicks), leads: num(r.leads), likes: num(r.likes), uniqueContacts: num(r.unique_contacts),
  };
}

export async function fetchContactStats(client, id) {
  const { data, error } = await client.rpc('page_events_by_contact', { page_id: id });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((r) => ({
    contactId: r.contact_id,
    views: num(r.views), plays: num(r.plays), maxProgress: num(r.max_progress),
    completes: num(r.completes), ctaClicks: num(r.cta_clicks), leads: num(r.leads),
    lastSeen: r.last_seen || null,
  }));
}

// -------------------------------------------------------------------- contacts

export const makeContactId = () => makeSlug(12);

/**
 * Insert contacts (already parsed/deduped, see csv.js) in chunks.
 * @returns {Promise<Array>} stored rows `{id, fields}`
 */
export async function addContacts(client, pageId, contacts, { chunk = 200 } = {}) {
  const rows = contacts.map((c) => ({ id: makeContactId(), page_id: pageId, fields: c.fields || {} }));
  const stored = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const { data, error } = await client.from('landing_page_contacts').insert(rows.slice(i, i + chunk)).select('id, fields, external, created_at');
    fail(error, 'Could not save contacts');
    stored.push(...(data || []));
  }
  return stored;
}

export async function listContacts(client, pageId) {
  const { data, error } = await client.from('landing_page_contacts')
    .select('id, fields, external, created_at').eq('page_id', pageId).order('created_at', { ascending: true });
  fail(error, 'Could not load contacts');
  return Array.isArray(data) ? data : [];
}

export async function removeContact(client, id) {
  const { error } = await client.from('landing_page_contacts').delete().eq('id', id);
  fail(error, 'Could not remove the contact');
}

// ------------------------------------------------------- public API (viewers)

function env() {
  const e = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  return { url: String(e.VITE_SUPABASE_URL || '').replace(/\/$/, ''), key: e.VITE_SUPABASE_ANON_KEY || '' };
}

const anonHeaders = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });

/** Load a published page for a viewer. Null when missing or unpublished. */
export async function fetchPublicPage(id, { url, key, fetchImpl = fetch } = env()) {
  if (!PAGE_ID_RE.test(String(id || ''))) return null;
  if (!url || !key) throw new Error('Page service is not configured');
  const res = await fetchImpl(`${url}/rest/v1/landing_pages?id=eq.${encodeURIComponent(id)}&published=eq.true&select=id,title,video_url,poster_url,duration,config,updated_at`, {
    headers: anonHeaders(key, { Accept: 'application/json' }),
  });
  if (!res.ok) throw new Error(`Could not load the page (HTTP ${res.status})`);
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** Display tokens for one contact (?c=<contactId>); never includes email. */
export async function fetchContactTokens(pageId, contactId, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key || !CONTACT_ID_RE.test(String(contactId || ''))) return {};
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/landing_page_contact_tokens`, {
      method: 'POST',
      headers: anonHeaders(key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ page_id: pageId, contact_id: contactId }),
    });
    if (!res.ok) return {};
    const body = await res.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

/** Best-effort viewer analytics; personal links attribute events to the contact. */
export async function recordPageEvent(pageId, { kind, contactId = null } = {}, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key || !PAGE_EVENT_KINDS.includes(kind)) return;
  try {
    await fetchImpl(`${url}/rest/v1/rpc/record_page_event`, {
      method: 'POST',
      headers: anonHeaders(key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        page_id: pageId,
        kind,
        contact_id: contactId && /^[A-Za-z0-9_-]{1,80}$/.test(String(contactId)) ? String(contactId) : null,
      }),
    });
  } catch { /* analytics is best-effort */ }
}

/** Send a lead-form submission to the page owner (lead-capture edge function). */
export async function submitPageLead({ pageId, contactId = null, data }, { url, key, fetchImpl = fetch } = env()) {
  if (!url || !key) return { stored: false, error: 'Lead service is not configured' };
  try {
    const res = await fetchImpl(`${url}/functions/v1/lead-capture`, {
      method: 'POST',
      headers: anonHeaders(key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        pageId, contactId, kind: 'lead-form', data,
        source: { page: globalThis.location?.href || null, userAgent: globalThis.navigator?.userAgent || null },
      }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok && body.ok ? { stored: !!body.stored, error: null } : { stored: false, error: body.error || `HTTP ${res.status}` };
  } catch (err) {
    return { stored: false, error: err?.message || String(err) };
  }
}
