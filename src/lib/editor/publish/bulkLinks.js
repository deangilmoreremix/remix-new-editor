/**
 * bulkLinks.js — plan one personalized link per contact/business for ONE published video.
 *
 * Pure logic (no network): turns contacts + each business's saved assets into recipient
 * rows for publishClient.createRecipients. No video is duplicated: every row points at the
 * same published video and carries only its own variables.
 *
 * Rules:
 *  - A contact only ever receives assets saved for ITS OWN business. A missing slot is
 *    reported ("missing"), never filled from another business.
 *  - Required slots missing => status "missing-assets" (the UI offers: search again, upload,
 *    pick a saved asset, fallback, or leave the optional overlay empty).
 *  - Contacts that already have an active link are skipped, so re-running is idempotent.
 *  - Only durable http(s) URLs are carried (publishClient.sanitizeRecipientVariables enforces it too).
 */
import { sanitizeRecipientVariables } from './publishClient.js';
import { isImageTokenKey } from '../../personalization/imageReadiness.js';

const isHttp = (u) => /^https?:\/\//i.test(String(u || ''));

/**
 * @param {object} p
 * @param {Array<{id:string,name?:string,businessId?:string,variables?:object}>} p.contacts
 * @param {Record<string, Record<string,string>>} p.assetsByBusiness  businessId -> { slot: durableUrl }
 * @param {string[]} [p.requiredSlots]  slots the video needs (e.g. ['logoUrl','serviceImage'])
 * @param {Array<{contactId?:string,status:string}>} [p.existing]  recipients already created for this video
 */
export function planBulkLinks({ contacts = [], assetsByBusiness = {}, requiredSlots = [], existing = [] } = {}) {
  const live = new Set(existing.filter((r) => r.status === 'active' && r.contactId).map((r) => r.contactId));
  return contacts.map((c) => {
    const own = (c.businessId && assetsByBusiness[c.businessId]) || {};
    const assets = {};
    for (const [slot, url] of Object.entries(own)) if (isHttp(url)) assets[slot] = url;
    const missingSlots = requiredSlots.filter((s) => !assets[s] && !isHttp(c.variables?.[s]));
    // asset URLs win over free-text variables of the same name only when the contact has none of its own
    const variables = sanitizeRecipientVariables({ ...assets, ...(c.variables || {}) });
    let status = 'ready';
    if (!c.id) status = 'invalid';
    else if (live.has(c.id)) status = 'already-linked';
    else if (missingSlots.length) status = 'missing-assets';
    return { contactId: c.id || null, label: c.name || '', businessId: c.businessId || null, variables, missingSlots, status };
  });
}

/** Rows to hand to createRecipients: only 'ready' ones (missing-assets rows wait for the user's decision). */
export const rowsToCreate = (plan, { allowMissing = false } = {}) =>
  plan.filter((r) => r.status === 'ready' || (allowMissing && r.status === 'missing-assets'))
    .map((r) => ({ label: r.label, businessId: r.businessId, variables: r.variables, contactRef: r.contactId }));

/** One-line summary for the bulk table header. */
export function summarizePlan(plan) {
  const n = (s) => plan.filter((r) => r.status === s).length;
  return { total: plan.length, ready: n('ready'), missingAssets: n('missing-assets'), alreadyLinked: n('already-linked'), invalid: n('invalid') };
}

/**
 * Refresh ONE existing recipient from the business's current assets: image-slot values are replaced (or removed
 * when the business no longer has one, so the viewer gets the fallback instead of a stale image); every other
 * variable - names, offers, text - is left exactly as it was.
 */
export function mergeAssetVariables(existing = {}, planned = {}) {
  const out = {};
  for (const [k, v] of Object.entries(existing || {})) if (!isImageTokenKey(k)) out[k] = v;
  for (const [k, v] of Object.entries(planned || {})) if (isImageTokenKey(k) && isHttp(v)) out[k] = v;
  return out;
}

/** True when the merge would change something (avoids pointless writes). */
export const assetVariablesChanged = (existing = {}, merged = {}) => JSON.stringify(sortKeys(existing)) !== JSON.stringify(sortKeys(merged));
const sortKeys = (o) => Object.fromEntries(Object.entries(o || {}).sort(([a], [b]) => (a < b ? -1 : 1)));
