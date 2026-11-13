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
import { TOKEN_PATTERN, canonicalTokenKey, normalizeTokenName } from '../../../components/personalize/tokenSchema.js';

const isHttp = (u) => /^https?:\/\//i.test(String(u || ''));

/** One comparable form per token spelling: its canonical key when known, else the normalized name. */
const tokenForm = (name) => canonicalTokenKey(name) || normalizeTokenName(name);

/** The token a `{{...}}` body reads: `up x`, `d x "fallback"` and `x` all read x. */
function tokenNameOfBody(body) {
  const b = String(body || '').trim();
  const m = b.match(/^(?:d|default)\s+(\S+)\s+(["']).*\2$/) || b.match(/^(?:up|uppercase)\s+(\S+)$/);
  return m ? m[1] : b;
}

/**
 * Every token a video (overlays, clips, CTAs...) reads, as comparable forms. Walks the values instead of
 * stringifying, so quotes in `{{d name "Friend"}}` are not escaped away.
 * @returns {Set<string>}
 */
export function tokensReadBy(value, out = new Set()) {
  if (typeof value === 'string') {
    for (const m of value.matchAll(new RegExp(TOKEN_PATTERN.source, 'g'))) out.add(tokenForm(tokenNameOfBody(m[1])));
  } else if (Array.isArray(value)) value.forEach((v) => tokensReadBy(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => tokensReadBy(v, out));
  return out;
}

/**
 * @param {object} p
 * @param {Array<{id:string,name?:string,businessId?:string,variables?:object}>} p.contacts
 * @param {Record<string, Record<string,string>>} p.assetsByBusiness  businessId -> { slot: durableUrl }
 * @param {string[]} [p.requiredSlots]  slots the video needs (e.g. ['logoUrl','serviceImage'])
 * @param {Set<string>|null} [p.neededTokens]  tokensReadBy(video): a link then carries ONLY the contact fields the video reads (no email etc.); assigned images always travel. null = keep all.
 * @param {Array<{contactId?:string,status:string}>} [p.existing]  recipients already created for this video
 */
export function planBulkLinks({ contacts = [], assetsByBusiness = {}, requiredSlots = [], existing = [], neededTokens = null } = {}) {
  const live = new Set(existing.filter((r) => r.status === 'active' && r.contactId).map((r) => r.contactId));
  return contacts.map((c) => {
    const own = (c.businessId && assetsByBusiness[c.businessId]) || {};
    const assets = {};
    for (const [slot, url] of Object.entries(own)) if (isHttp(url)) assets[slot] = url;
    const missingSlots = requiredSlots.filter((s) => !assets[s] && !isHttp(c.variables?.[s]));
    // The business's assigned images for THIS video win over a same-named variable on the contact (those are mirrors of earlier
    // assignments and would otherwise pin a replaced image). A contact-only image slot with no assignment is kept.
    const kept = {};
    for (const [k, v] of Object.entries(c.variables || {})) if (!neededTokens || neededTokens.has(tokenForm(k))) kept[k] = v;
    const variables = sanitizeRecipientVariables({ ...kept, ...assets });
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
