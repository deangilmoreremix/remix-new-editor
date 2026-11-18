/**
 * Gathers every customer this browser knows about, as normalized customers (see customerProfile.js):
 *   - the Personalize window's clients (`smartvideo_clients`, current one first, logos from `smartvideo_client_assets`)
 *   - the editor's contact profiles (contactStore, which also holds synced clients/leads), the selected one first
 *   - saved Lead Finder leads (signed-in users; [] otherwise)
 *   - Brand DNA (the last used brand first)
 * The same customer seen in several places is merged into one (richest value wins).
 */
import * as defaultStore from '../contactStore.js';
import { listBrands as defaultBrands } from '../brandStore.js';
import { fetchSavedLeads } from '../editor/personalize/clientSync.js';
import { normalizeCustomer, dedupeCustomers, attachPersonalImages } from './customerProfile.js';

const CLIENTS_KEY = 'smartvideo_clients';
const CURRENT_KEY = 'smartvideo_current_client_id';
const ASSETS_KEY = 'smartvideo_client_assets';

const readJson = (storage, key, fallback) => {
  try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

/** Customers that need no network. Returns { customers, activeId }. */
export function loadLocalCustomers({ store = defaultStore, storage = globalThis.localStorage, brands = defaultBrands } = {}) {
  const clients = readJson(storage, CLIENTS_KEY, {});
  const assets = readJson(storage, ASSETS_KEY, {});
  const currentClient = storage?.getItem?.(CURRENT_KEY) || '';
  let selectedProfile = '';
  try { selectedProfile = store.getSelectedContactId?.() || ''; } catch { /* store unavailable */ }

  const fromClients = Object.values(clients && typeof clients === 'object' ? clients : {}).map((c) => normalizeCustomer(c, 'client', { assets: assets[c?.id] }));
  let profiles = [];
  try { profiles = store.listProfiles?.() || []; } catch { /* ignore */ }
  const fromProfiles = profiles.map((p) => normalizeCustomer(p, 'profile'));
  let brandList = [];
  try { brandList = brands?.() || []; } catch { /* ignore */ }
  const fromBrands = brandList.map((b) => normalizeCustomer(b, 'brand'));

  const activeId = currentClient || selectedProfile || '';
  const rank = (c) => (c.id === currentClient ? 0 : c.id === selectedProfile ? 1 : 2);
  const people = [...fromClients, ...fromProfiles].filter(Boolean).sort((a, b) => rank(a) - rank(b));
  return { customers: dedupeCustomers([...people, ...fromBrands]), activeId };
}

/** The signed-in user's saved Personalization projects (their generated pictures); [] when signed out or offline. */
export async function fetchSavedProjects(fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl('/api/personalization/project?list=true', { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

/** Local customers plus the signed-in user's saved Lead Finder leads (and their personalized pictures). */
export async function loadCustomers({ includeLeads = true, fetchImpl, ...local } = {}) {
  const base = loadLocalCustomers(local);
  if (!includeLeads) return base;
  const [leadRows, projects] = await Promise.all([fetchSavedLeads(fetchImpl), fetchSavedProjects(fetchImpl)]);
  const leads = leadRows.map((l) => normalizeCustomer(l, 'lead')).filter(Boolean);
  return { customers: attachPersonalImages(dedupeCustomers([...base.customers, ...leads]), projects), activeId: base.activeId };
}
