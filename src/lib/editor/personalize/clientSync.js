/**
 * The Personalize window is the OpenHiggsBolt tool (src/features/personalization).
 * It keeps its clients in `smartvideo_clients` (current one in
 * `smartvideo_current_client_id`, images in `smartvideo_client_assets`) and its
 * saved Lead Finder leads behind /api/personalization/leads; it writes nothing
 * to the contact store the editor reads (src/lib/contactStore.js).
 *
 * This copies them across, one way, so every contact feature in the editor
 * (Preview as, Smart Speech per contact, Batch, personal links, Export per
 * contact, the Personalization panels, the per-contact image tools) sees the
 * contacts made there:
 *   client -> a profile with the same id
 *   lead   -> a profile with id `lead-<id>`
 * Existing profiles are merged, never replaced, so images or edits the editor
 * added are kept. Nothing is deleted.
 */
import * as defaultStore from '../../contactStore.js';

const CLIENTS_KEY = 'smartvideo_clients';
const CURRENT_KEY = 'smartvideo_current_client_id';
const ASSETS_KEY = 'smartvideo_client_assets';
const SYNCED_CURRENT_KEY = 'remix_synced_current_client';
const ASSET_LISTS = ['identities', 'logos', 'products', 'brandReferences'];

const readJson = (storage, key, fallback) => {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== '' && v != null));
const text = (v) => String(v ?? '').trim();

export function splitName(name) {
  const parts = text(name).split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.length > 1 ? parts.slice(1).join(' ') : '' };
}

/** The client's saved images in the shape the token schema reads. */
function assetsFromLibrary(lib) {
  if (!lib || typeof lib !== 'object') return null;
  const out = {};
  ASSET_LISTS.forEach((k) => { if (Array.isArray(lib[k]) && lib[k].length) out[k] = lib[k]; });
  if (lib.primaryIdentity?.id) out.primaryIdentityId = lib.primaryIdentity.id;
  if (lib.primaryLogo?.id) out.primaryLogoId = lib.primaryLogo.id;
  return Object.keys(out).length ? out : null;
}

/** A client from the Personalize window → a contact profile patch. */
export function clientToProfile(client, library = null) {
  const { firstName, lastName } = splitName(client.name);
  const business = clean({
    audience: client.audience,
    name: text(client.name),
    businessName: text(client.businessName),
    industry: text(client.industry),
    location: text(client.location),
    productService: text(client.productService),
    offer: text(client.offer),
    ctaHeadline: text(client.ctaHeadline),
    callToAction: text(client.callToAction),
    phone: text(client.phone),
    website: text(client.website),
    brandDescription: text(client.brandDescription),
  });
  return {
    id: String(client.id),
    name: text(client.name) || text(client.businessName),
    source: 'personalize-client',
    contact: clean({ name: text(client.name) || text(client.businessName), firstName, lastName, company: text(client.businessName), location: text(client.location), phone: text(client.phone) }),
    company: clean({ name: text(client.businessName), industry: text(client.industry), summary: text(client.brandDescription) }),
    social: clean({ website: text(client.website) }),
    personalization: { business, ...(assetsFromLibrary(library) ? { assets: assetsFromLibrary(library) } : {}) },
  };
}

/** A saved Lead Finder lead ({ id, business, stage, niche, location }) → a profile patch. */
export function leadToProfile(lead) {
  const b = lead.business || {};
  const place = [b.city, b.region].filter(Boolean).join(', ') || text(lead.location);
  const name = text(b.name);
  return {
    id: `lead-${lead.id}`,
    name,
    source: 'lead-finder',
    stage: lead.stage || '',
    contact: clean({ name, company: name, email: text(b.email), location: place, phone: text(b.phone) }),
    company: clean({ name, industry: text(b.category) || text(lead.niche) }),
    social: clean({ website: text(b.website) }),
    personalization: { business: clean({ name, businessName: name, industry: text(b.category) || text(lead.niche), location: place, phone: text(b.phone), email: text(b.email), website: text(b.website) }) },
  };
}

function mergeAssets(existing, incoming) {
  if (!incoming) return existing;
  const out = { ...(existing || {}) };
  ASSET_LISTS.forEach((k) => {
    const have = Array.isArray(out[k]) ? out[k] : [];
    const seen = new Set(have.map((a) => a?.id).filter(Boolean));
    const add = (incoming[k] || []).filter((a) => !a?.id || !seen.has(a.id));
    if (have.length || add.length) out[k] = [...have, ...add];
  });
  ['primaryIdentityId', 'primaryLogoId'].forEach((k) => { if (!out[k] && incoming[k]) out[k] = incoming[k]; });
  return out;
}

/** The studio's values win for what it knows; everything else on the profile stays. */
export function mergeProfile(existing, patch) {
  const e = existing || {};
  const assets = mergeAssets(e.personalization?.assets, patch.personalization?.assets);
  return {
    ...e,
    ...patch,
    contact: { ...e.contact, ...patch.contact },
    company: { ...e.company, ...patch.company },
    social: { ...e.social, ...patch.social },
    personalization: { ...e.personalization, ...patch.personalization, business: { ...e.personalization?.business, ...patch.personalization?.business }, ...(assets ? { assets } : {}) },
  };
}

// What counts as "changed": everything except values derived on save.
const fingerprint = (p) => { const { variables, updatedAt, createdAt, ...rest } = p || {}; return JSON.stringify(rest); };

function upsert(store, patch) {
  const existing = store.getProfile?.(patch.id) || null;
  const merged = mergeProfile(existing, patch);
  if (existing && fingerprint(existing) === fingerprint(merged)) return false;
  // Token values are derived from the studio's fields, so recompute them
  // (saveProfile does) rather than keep the previous run's.
  store.saveProfile({ ...merged, variables: {} });
  const c = merged.contact || {};
  store.saveContact({ id: merged.id, name: merged.name || c.name || '', firstName: c.firstName || '', lastName: c.lastName || '', email: c.email || '', company: c.company || '', location: c.location || '', source: merged.source });
  return true;
}

/**
 * Copy clients (and the leads passed in) into the contact store.
 * @returns {{ changed: number, selected: string|null }}
 */
export function syncPersonalizeContacts({ store = defaultStore, storage = globalThis.localStorage, leads = [] } = {}) {
  let changed = 0;
  const clients = Object.values(readJson(storage, CLIENTS_KEY, {}) || {}).filter((c) => c && c.id);
  const library = readJson(storage, ASSETS_KEY, {}) || {};
  clients.forEach((c) => { if (upsert(store, clientToProfile(c, library[c.id]))) changed += 1; });
  (leads || []).filter((l) => l?.id && l.business?.name && l.stage !== 'Not Interested').forEach((l) => { if (upsert(store, leadToProfile(l))) changed += 1; });

  // Picking a client in the Personalize window selects it here, once; the
  // editor's own "Preview as" choice is left alone otherwise.
  let selected = null;
  const current = storage.getItem(CURRENT_KEY);
  const lastSynced = storage.getItem(SYNCED_CURRENT_KEY);
  const known = current && clients.some((c) => c.id === current);
  if (known && (current !== lastSynced || !store.getSelectedContactId?.())) {
    store.selectContact?.(current);
    storage.setItem(SYNCED_CURRENT_KEY, current);
    selected = current;
  }
  if (changed && !selected) {
    try { globalThis.dispatchEvent?.(new CustomEvent('remix:contact-changed', { detail: { contactId: store.getSelectedContactId?.() || null, synced: true } })); } catch { /* no window */ }
  }
  return { changed, selected };
}

/** The signed-in user's saved Lead Finder leads; [] when signed out or offline. */
export async function fetchSavedLeads(fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl('/api/personalization/leads', { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.leads) ? data.leads : [];
  } catch {
    return [];
  }
}

/**
 * Sync controller for the editor:
 *   run({ leads })  now, optionally refetching the leads (async)
 *   check()         cheap: re-syncs the clients only if the studio's storage changed
 */
export function createContactSync({ store = defaultStore, storage = globalThis.localStorage, fetchImpl, leadTtlMs = 60_000, onChange } = {}) {
  let leads = [];
  let leadsAt = 0;
  let last = '';
  const snapshot = () => [CLIENTS_KEY, CURRENT_KEY, ASSETS_KEY].map((k) => storage.getItem(k) || '').join('|');
  const sync = () => {
    last = snapshot();
    const r = syncPersonalizeContacts({ store, storage, leads });
    if (r.changed || r.selected) onChange?.(r);
    return r;
  };
  return {
    sync,
    check() { if (snapshot() !== last) sync(); },
    async run({ leads: refetch = false } = {}) {
      sync();
      if (refetch || !leadsAt || Date.now() - leadsAt > leadTtlMs) {
        const fresh = await fetchSavedLeads(fetchImpl);
        leadsAt = Date.now();
        if (JSON.stringify(fresh) !== JSON.stringify(leads)) { leads = fresh; sync(); }
      }
    },
  };
}
