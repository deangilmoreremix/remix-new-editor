/**
 * Project store: CRUD over the owner-scoped `timeline_projects` table.
 *
 * The Supabase client is injected (same pattern as publishClient.js) so the
 * module stays transport-agnostic and testable. RLS (Clerk `sub`) is the
 * security boundary; nothing here trusts or sends an owner id.
 *
 * The editable source lives in `data`. Rendering / publishing only touch
 * `render` and `thumbnail_url`, never `data`, so a project stays editable
 * after it is rendered or published.
 */
import { stripForPersist } from '../persistence.js';

export const TABLE = 'timeline_projects';
const LIST_COLUMNS =
  'id, name, tags, thumbnail_url, duration_s, aspect_ratio, render, settings, parent_project_id, followup_context, created_at, updated_at';
export const MAX_NAME = 200;

export const SORTS = Object.freeze({
  updated: { column: 'updated_at', ascending: false },
  created: { column: 'created_at', ascending: false },
  name: { column: 'name', ascending: true },
});

const fail = (error, fallback) => {
  if (!error) return;
  const msg = /JWT|permission|row-level|401|403/i.test(error.message || '')
    ? 'Sign in to manage your projects'
    : (error.message || fallback);
  throw new Error(msg);
};

export function cleanName(name, fallback = 'Untitled project') {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return n || fallback;
}

/** Derive display metadata (duration, aspect ratio) from editor state. */
export function summarizeState(state = {}) {
  const dur = Number(state.timelineSeconds);
  const ar = state.aspectRatio || state.settings?.aspectRatio || null;
  return {
    duration_s: Number.isFinite(dur) && dur >= 0 ? Math.round(dur * 100) / 100 : null,
    aspect_ratio: typeof ar === 'string' && ar.length <= 16 ? ar : null,
  };
}

/** JSON-safe, runtime-singleton-free copy of the editor state. */
export function serializeState(state) {
  return JSON.parse(JSON.stringify(stripForPersist(state)));
}

export async function listProjects(client, { search = '', sort = 'updated', limit = 50, offset = 0 } = {}) {
  const s = SORTS[sort] || SORTS.updated;
  const lim = Math.min(Math.max(1, Number(limit) || 50), 200);
  const off = Math.max(0, Number(offset) || 0);
  let q = client.from(TABLE).select(LIST_COLUMNS).is('deleted_at', null);
  const term = String(search || '').trim().replace(/[%,()]/g, ' ').slice(0, 100);
  if (term) q = q.ilike('name', `%${term}%`);
  q = q.order(s.column, { ascending: s.ascending }).range(off, off + lim - 1);
  const { data, error } = await q;
  fail(error, 'Could not load projects');
  return data || [];
}

export async function loadProject(client, id) {
  const { data, error } = await client.from(TABLE).select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  fail(error, 'Could not open the project');
  return data;
}

export async function createProject(client, { name, state, tags = [], parentProjectId = null, followupContext = null } = {}) {
  const row = {
    name: cleanName(name, state?.projectTitle),
    data: state ? serializeState(state) : {},
    tags: (tags || []).map(String).slice(0, 12),
    ...(state ? summarizeState(state) : {}),
    parent_project_id: parentProjectId,
    followup_context: followupContext,
  };
  const { data, error } = await client.from(TABLE).insert(row).select('*').single();
  fail(error, 'Could not create the project');
  return data;
}

export async function saveProjectData(client, id, state) {
  const patch = { data: serializeState(state), ...summarizeState(state) };
  const { data, error } = await client.from(TABLE).update(patch).eq('id', id).is('deleted_at', null)
    .select('id, updated_at').maybeSingle();
  fail(error, 'Could not save the project');
  return data;
}

export async function renameProject(client, id, name) {
  const { error } = await client.from(TABLE).update({ name: cleanName(name) }).eq('id', id);
  fail(error, 'Could not rename the project');
}

export async function setProjectTags(client, id, tags) {
  const { error } = await client.from(TABLE).update({ tags: (tags || []).map(String).slice(0, 12) }).eq('id', id);
  fail(error, 'Could not update tags');
}

export async function duplicateProject(client, id) {
  const src = await loadProject(client, id);
  if (!src) throw new Error('Project not found');
  const { data, error } = await client.from(TABLE).insert({
    name: cleanName(`${src.name} (copy)`),
    data: src.data,
    tags: src.tags,
    thumbnail_url: src.thumbnail_url,
    duration_s: src.duration_s,
    aspect_ratio: src.aspect_ratio,
    settings: src.settings,
    // The copy is a fresh editable project: no render/publication carried over.
  }).select('*').single();
  fail(error, 'Could not duplicate the project');
  return data;
}

/**
 * A personalized follow-up: a NEW, separately saved project that starts from a
 * copy of the original's timeline (its media references are reused) and stays
 * linked to it (parent_project_id) with the brief that produced it
 * (followup_context). The original is never modified.
 */
export async function createFollowupProject(client, originalId, context = {}) {
  const src = await loadProject(client, originalId);
  if (!src) throw new Error('The original project was not found');
  const topic = String(context.interest || 'follow-up').slice(0, 60);
  const ctx = {
    interest: context.interest || null,
    interestType: context.interestType || null,
    product: context.product || null,
    service: context.service || null,
    ctaPurpose: context.ctaPurpose || null,
    suggestedMessage: context.suggestedMessage || null,
    originalProjectName: src.name,
    createdFrom: 'retarget',
  };
  const { data, error } = await client.from(TABLE).insert({
    name: cleanName(`${src.name}: ${topic} follow-up`),
    data: { ...(src.data || {}), projectId: undefined, publishedVideos: {} }, // fresh project: nothing published yet
    tags: [...new Set([...(src.tags || []), 'follow-up'])].slice(0, 12),
    thumbnail_url: src.thumbnail_url,
    duration_s: src.duration_s,
    aspect_ratio: src.aspect_ratio,
    settings: src.settings,
    parent_project_id: src.id,
    followup_context: ctx,
  }).select('*').single();
  fail(error, 'Could not create the follow-up project');
  return data;
}

/** Follow-up projects created from an original. */
export async function listFollowups(client, parentId) {
  const { data, error } = await client.from(TABLE).select('id, name, followup_context, created_at, updated_at, render')
    .eq('parent_project_id', parentId).is('deleted_at', null).order('created_at', { ascending: false }).limit(50);
  fail(error, 'Could not load follow-ups');
  return data || [];
}

/** Soft delete (recoverable); published videos are unpublished by the caller. */
export async function deleteProject(client, id) {
  const { error } = await client.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  fail(error, 'Could not delete the project');
}

export async function setRenderInfo(client, id, render) {
  const { error } = await client.from(TABLE).update({ render: { ...render, at: render?.at || new Date().toISOString() } }).eq('id', id);
  fail(error, 'Could not record the render');
}

export async function setThumbnail(client, id, thumbnailUrl) {
  const { error } = await client.from(TABLE).update({ thumbnail_url: thumbnailUrl }).eq('id', id);
  fail(error, 'Could not save the thumbnail');
}

// ---------------------------------------------------------------- card view-model

/**
 * Merge a project row with analytics/publication info into the card model.
 * `stats` is null when no tracking data has been collected -> metrics render as
 * "unavailable", never a fabricated number. A real zero stays 0.
 */
export function toCard(row, { published = null, stats = null } = {}) {
  const m = (k) => (stats && Number.isFinite(stats[k]) ? stats[k] : null);
  return {
    id: row.id,
    name: row.name,
    thumbnailUrl: row.thumbnail_url || null,
    durationS: row.duration_s ?? null,
    aspectRatio: row.aspect_ratio || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    renderStatus: row.render?.status || 'not_rendered',
    published: !!published?.published,
    publishedId: published?.id || null,
    parentProjectId: row.parent_project_id || null,
    plays: m('plays'),
    uniqueViewers: m('unique_viewers'),
    completionPct: m('completion_pct'),
    ctaClicks: m('cta_clicks'),
    leads: m('leads'),
    needsFollowUp: !!stats?.needs_follow_up,
    unreadNotifications: Number(stats?.unread_notifications) || 0,
    hasStats: !!stats,
  };
}

const NUM = (v) => (v == null ? -1 : v);
export const CARD_SORTS = Object.freeze({
  updated: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
  created: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
  name: (a, b) => a.name.localeCompare(b.name),
  viewed: (a, b) => NUM(b.plays) - NUM(a.plays),
  engaged: (a, b) => NUM(b.completionPct) - NUM(a.completionPct),
  leads: (a, b) => NUM(b.leads) - NUM(a.leads),
});

/** Client-side filter + sort for already-loaded cards. */
export function filterCards(cards, { search = '', published = 'all', render = 'all', followUp = false, sort = 'updated' } = {}) {
  const term = String(search).trim().toLowerCase();
  let out = cards.filter((c) => {
    if (term && !c.name.toLowerCase().includes(term)) return false;
    if (published === 'published' && !c.published) return false;
    if (published === 'unpublished' && c.published) return false;
    if (render !== 'all' && c.renderStatus !== render) return false;
    if (followUp && !c.needsFollowUp) return false;
    return true;
  });
  out = out.slice().sort(CARD_SORTS[sort] || CARD_SORTS.updated);
  return out;
}
