/**
 * Owner side of stored personal links (public.video_personalizations,
 * supabase/migrations/20261115000000_video_personalizations.sql).
 *
 * A personal link is /watch/<id>?p=<link id>. The row behind it holds the
 * values that recipient's copy of the video is filled with:
 *   variables  synced from the contact (this file's syncPersonalLinks)
 *   overrides  what the owner typed for this one link (wins over `variables`
 *              and survives a re-sync)
 * The owner changes a link by editing its values, giving it a new address
 * (the old one stops working), revoking it, or removing it.
 */
import { makeSlug, slugify } from './publishClient.js';
import { isImageTokenKey, shareableImageValue } from '../../personalization/imageReadiness.js';

const COLS = 'id, video_id, contact_id, name, variables, overrides, revoked, created_at, updated_at';
const VALUE_MAX = 500;
const KEY_RE = /^[A-Za-z0-9_][A-Za-z0-9_ .-]{0,39}$/;

/** True when the database has not had the personal-links migration applied. */
export const personalLinksMissing = (error) => /video_personalizations|get_personalization|PGRST20[25]|42P01|schema cache|relation .* does not exist/i.test(String(error?.message || error?.code || error || ''));

const fail = (error, fallback) => {
  if (!error) return;
  if (personalLinksMissing(error)) throw Object.assign(new Error('Personal links need the database update (20261115000000_video_personalizations.sql).'), { code: 'links_unavailable' });
  const msg = /JWT|permission|row-level|401|403/i.test(error.message || '') ? 'You can only change links from the browser or account that published this video' : (error.message || fallback);
  throw new Error(msg);
};

/**
 * A link id that reads like the contact ("acme-dental-k7x2p9ab") yet stays unguessable: the id gates a contact's
 * details, so a readable prefix is always followed by at least 12 random characters (about 70 bits; 16-32 chars in
 * all, the database's rule: a prefix of at most 19 characters keeps the total within 32). Pass a business name,
 * never a person's name. Without a usable label it is plain random (20 characters, about 114 bits).
 */
export function readableLinkId(label, rand) {
  const base = slugify(label, '').slice(0, 19).replace(/-+$/g, '');
  if (!base) return makeSlug(20, rand);
  return `${base}-${makeSlug(Math.max(12, 15 - base.length), rand)}`;
}
export const newLinkId = (label) => readableLinkId(label);

/** The values a link shows: synced values, then the owner's own edits on top. */
export const effectiveVariables = (link) => ({ ...(link?.variables || {}), ...(link?.overrides || {}) });

/**
 * The owner's edits as safe override values: text only, sane keys, image values
 * must be http(s) (a link cannot carry data:/blob: images), empty = no override.
 * @returns {{ overrides: object, rejected: string[] }}
 */
export function sanitizeOverrides(input) {
  const overrides = {};
  const rejected = [];
  Object.entries(input && typeof input === 'object' ? input : {}).forEach(([key, raw]) => {
    if (!KEY_RE.test(key)) { rejected.push(key); return; }
    const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
    if (!value) return;
    if (isImageTokenKey(key)) {
      const href = shareableImageValue(value);
      if (href) overrides[key] = href; else rejected.push(key);
      return;
    }
    overrides[key] = value.slice(0, VALUE_MAX);
  });
  return { overrides, rejected };
}

const toRow = (r) => ({
  id: r.id,
  videoId: r.video_id,
  contactId: r.contact_id || null,
  name: r.name || '',
  variables: r.variables && typeof r.variables === 'object' ? r.variables : {},
  overrides: r.overrides && typeof r.overrides === 'object' ? r.overrides : {},
  revoked: !!r.revoked,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** All personal links of one published video, oldest first. */
export async function listPersonalLinks(client, videoId) {
  const { data, error } = await client.from('video_personalizations').select(COLS).eq('video_id', videoId).order('created_at', { ascending: true });
  fail(error, 'Could not load personal links');
  return (data || []).map(toRow);
}

/**
 * One link per contact. A contact without a link gets one; a contact whose
 * details changed gets its synced values refreshed (the owner's edits stay).
 * @param {Array<{contactId: string, name: string, variables: object}>} items
 * @returns {Promise<{ links: object[], created: number, updated: number }>}
 */
export async function syncPersonalLinks(client, videoId, items, { makeId = newLinkId } = {}) {
  const existing = await listPersonalLinks(client, videoId);
  const byContact = new Map(existing.filter((l) => l.contactId).map((l) => [l.contactId, l]));
  const inserts = [];
  let updated = 0;
  for (const item of items || []) {
    const contactId = String(item.contactId || '');
    if (!contactId) continue;
    const name = String(item.name || '').slice(0, 120);
    const variables = item.variables && typeof item.variables === 'object' ? item.variables : {};
    const have = byContact.get(contactId);
    if (!have) {
      inserts.push({ id: makeId(item.company), video_id: videoId, contact_id: contactId, name, variables });
    } else if (have.name !== name || JSON.stringify(have.variables) !== JSON.stringify(variables)) {
      const { error } = await client.from('video_personalizations').update({ name, variables }).eq('id', have.id);
      fail(error, 'Could not update a personal link');
      updated += 1;
    }
  }
  if (inserts.length) {
    const { error } = await client.from('video_personalizations').insert(inserts);
    fail(error, 'Could not create personal links');
  }
  return { links: await listPersonalLinks(client, videoId), created: inserts.length, updated };
}

/** Change a link's name, its own values (overrides), or turn it off/on (revoked). */
export async function updatePersonalLink(client, id, patch = {}) {
  const row = {};
  if (patch.name !== undefined) row.name = String(patch.name).slice(0, 120);
  if (patch.overrides !== undefined) {
    const { overrides, rejected } = sanitizeOverrides(patch.overrides);
    if (rejected.length) throw new Error(`These values can't be used in a link: ${rejected.join(', ')}. Images must be web (https) addresses.`);
    row.overrides = overrides;
  }
  if (patch.revoked !== undefined) row.revoked = !!patch.revoked;
  if (!Object.keys(row).length) return null;
  const { data, error } = await client.from('video_personalizations').update(row).eq('id', id).select(COLS).maybeSingle();
  fail(error, 'Could not update the link');
  if (!data) throw new Error('That link no longer exists.');
  return toRow(data);
}

/** Give a link a new address. The old address stops working; the values stay. */
export async function regeneratePersonalLink(client, id, { makeId = newLinkId } = {}) {
  const { data: cur } = await client.from('video_personalizations').select('variables').eq('id', id).maybeSingle();
  const next = makeId(cur?.variables?.businessName || '');
  const { data, error } = await client.from('video_personalizations').update({ id: next }).eq('id', id).select(COLS).maybeSingle();
  fail(error, 'Could not change the link');
  if (!data) throw new Error('That link no longer exists.');
  return toRow(data);
}

export async function deletePersonalLink(client, id) {
  const { error } = await client.from('video_personalizations').delete().eq('id', id);
  fail(error, 'Could not remove the link');
}
