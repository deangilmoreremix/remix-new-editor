// src/lib/assetStore.js
//
// JS facade for the @remix/assets package. Vanilla JS modules
// (the inline personalize popover, the Netlify function orchestrator)
// can use this instead of importing the TS package directly.
//
// In the browser path, asset uploads go through the Netlify function
// `/api/intelligence/assets/{contactId}` (added separately) so the
// Supabase service key never leaves the server.

import { listContacts, getContact, getProfile } from './contactStore.js';

const ASSETS_KEY = 'remix_contact_assets';

function readAssets() {
  try { return JSON.parse(localStorage.getItem(ASSETS_KEY) || '{}'); } catch { return {}; }
}

function writeAssets(map) {
  localStorage.setItem(ASSETS_KEY, JSON.stringify(map));
}

export function getAssetsForContact(contactId) {
  return readAssets()[contactId] || [];
}

export function setAssetsForContact(contactId, assets) {
  const map = readAssets();
  map[contactId] = assets;
  writeAssets(map);
}

export function addAssetForContact(contactId, asset) {
  const map = readAssets();
  const list = map[contactId] || [];
  if (!list.some((a) => a.url === asset.url)) list.push({ ...asset, createdAt: new Date().toISOString() });
  map[contactId] = list;
  writeAssets(map);
  return list;
}

export function removeAssetForContact(contactId, url) {
  const map = readAssets();
  const list = (map[contactId] || []).filter((a) => a.url !== url);
  map[contactId] = list;
  writeAssets(map);
  return list;
}

/**
 * Best-effort local asset discovery (no Supabase, no network).
 * Mirrors what the server-side orchestrator does but uses the data
 * already available in localStorage. Useful for instant previews.
 */
export function discoverAssetsLocal(contactId) {
  const profile = getProfile(contactId);
  const contact = getContact(contactId);
  if (!profile) return { logos: [], avatars: [], brandColors: {}, errors: [{ source: 'local', error: 'profile not found' }] };

  const assets = profile.assets || {};
  const brand = profile.brand || {};
  const website = profile.website || {};
  return {
    logos: (assets.logos || []).map((url) => ({ assetType: 'logo', url, source: { source: 'local', discoveredAt: new Date().toISOString() } })),
    avatars: (assets.avatar || []).map((url) => ({ assetType: 'headshot', url, source: { source: 'local', discoveredAt: new Date().toISOString() } })),
    screenshots: website.screenshotUrl ? [{ assetType: 'screenshot', url: website.screenshotUrl, source: { source: 'local', discoveredAt: new Date().toISOString() } }] : [],
    icons: [],
    productImages: assets.productImages || [],
    brandColors: {
      primary: brand.colors?.primary,
      secondary: brand.colors?.secondary,
      accent: brand.colors?.accent,
    },
    errors: [],
    durationMs: 0,
    contact: contact ? { name: contact.name, company: contact.company } : null,
  };
}

/**
 * Trigger server-side asset discovery (downloads + Supabase mirror).
 * Returns the server's AssetDiscoveryResult.
 */
export async function discoverAssetsRemote(contactId, { session } = {}) {
  let token = session?.access_token;
  if (!token) {
    try {
      const { createClient } = await import('./supabase.js');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {}
  }
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`/api/intelligence/assets/${contactId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Asset discovery failed (${res.status})`);
  }
  return res.json();
}

export function listAllContactsWithAssets() {
  return listContacts().map((c) => ({
    contact: c,
    profile: getProfile(c.id),
    assets: getAssetsForContact(c.id),
  }));
}
