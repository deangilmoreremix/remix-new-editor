// src/lib/brandStore.js
// Lightweight persistence layer for Brand DNA, campaigns, assets, photoshoots, and animations.
// Uses localStorage as the primary store. Can be extended to sync with Supabase.

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const STORE_KEYS = {
  brands: 'brand_dna_list',
  campaigns: 'brand_campaigns',
  assets: 'brand_assets',
  photoshoots: 'brand_photoshoots',
  animations: 'brand_animations',
};

const MAX_STORAGE_BYTES = 4 * 1024 * 1024; // 4MB safety limit for localStorage
const MAX_BRANDS = 50;
const MAX_CAMPAIGNS = 200;
const MAX_ASSETS = 500;
const MAX_PHOTOSHOOTS = 200;
const MAX_ANIMATIONS = 200;

function estimateSize(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

function safeGet(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value, maxItems) {
  try {
    // Enforce max items limit
    if (Array.isArray(value) && maxItems && value.length > maxItems) {
      value = value.slice(0, maxItems);
    }

    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;

    // If this single write would exceed our budget, try to free space
    if (size > MAX_STORAGE_BYTES) {
      console.warn('[brandStore] Item too large for localStorage, truncating...');
      // For large arrays, truncate more aggressively
      if (Array.isArray(value)) {
        value = value.slice(0, Math.max(1, Math.floor(value.length / 2)));
      }
    }

    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('[brandStore] localStorage quota exceeded, attempting cleanup...');
      try {
        // Evict oldest entries from all stores
        evictOldEntries();
        // Retry once
        const retryValue = Array.isArray(value) ? value.slice(0, Math.max(1, Math.floor(value.length / 2))) : value;
        localStorage.setItem(key, JSON.stringify(retryValue));
      } catch (retryError) {
        console.error('[brandStore] localStorage write failed after cleanup:', retryError);
        // Gracefully handle quota exceeded - do not throw
      }
    } else {
      console.error('[brandStore] localStorage write failed:', e);
      throw e;
    }
  }
}

function evictOldEntries() {
  // Remove oldest entries from each store to free up space
  const stores = [
    { key: STORE_KEYS.animations, max: MAX_ANIMATIONS },
    { key: STORE_KEYS.photoshoots, max: MAX_PHOTOSHOOTS },
    { key: STORE_KEYS.assets, max: MAX_ASSETS },
    { key: STORE_KEYS.campaigns, max: MAX_CAMPAIGNS },
    { key: STORE_KEYS.brands, max: MAX_BRANDS },
  ];

  for (const store of stores) {
    try {
      const items = safeGet(store.key, []);
      if (items.length > store.max) {
        const trimmed = items.slice(0, store.max);
        localStorage.setItem(store.key, JSON.stringify(trimmed));
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

function isAuthenticated() {
  return typeof window !== 'undefined' && !!window.Clerk?.user;
}

async function syncBrandToSupabase(brand) {
  if (!isSupabaseConfigured() || !isAuthenticated()) return;
  try {
    await supabase.from('brand_dna').upsert({
      id: brand.id,
      ...brand,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[brandStore] Supabase brand sync failed:', err);
  }
}

async function syncCampaignToSupabase(campaign) {
  if (!isSupabaseConfigured() || !isAuthenticated()) return;
  try {
    await supabase.from('campaigns').upsert({
      id: campaign.id,
      ...campaign,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[brandStore] Supabase campaign sync failed:', err);
  }
}

async function syncAssetToSupabase(asset) {
  if (!isSupabaseConfigured() || !isAuthenticated()) return;
  try {
    await supabase.from('assets').upsert({
      id: asset.id,
      ...asset,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[brandStore] Supabase asset sync failed:', err);
  }
}

async function syncPhotoshootToSupabase(photoshoot) {
  if (!isSupabaseConfigured() || !isAuthenticated()) return;
  try {
    await supabase.from('photoshoots').upsert({
      id: photoshoot.id,
      ...photoshoot,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[brandStore] Supabase photoshoot sync failed:', err);
  }
}

async function syncAnimationToSupabase(animation) {
  if (!isSupabaseConfigured() || !isAuthenticated()) return;
  try {
    await supabase.from('animations').upsert({
      id: animation.id,
      ...animation,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[brandStore] Supabase animation sync failed:', err);
  }
}

// ---- Brand DNA ----
export function listBrands() {
  return safeGet(STORE_KEYS.brands, []);
}

export function getBrand(id) {
  return listBrands().find(b => b.id === id) || null;
}

export function saveBrand(dna) {
  const brands = listBrands();
  const idx = brands.findIndex(b => b.id === dna.id);
  const record = {
    ...dna,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    brands[idx] = record;
  } else {
    brands.unshift(record);
  }
  safeSet(STORE_KEYS.brands, brands, MAX_BRANDS);
  syncBrandToSupabase(record);
  return record;
}

// ---- Campaigns ----
export function listCampaigns(brandId) {
  return safeGet(STORE_KEYS.campaigns, []).filter(c => c.brandId === brandId);
}

export function getCampaign(id) {
  return safeGet(STORE_KEYS.campaigns, []).find(c => c.id === id) || null;
}

export function saveCampaign(campaign) {
  const campaigns = safeGet(STORE_KEYS.campaigns, []);
  const idx = campaigns.findIndex(c => c.id === campaign.id);
  const record = { ...campaign, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    campaigns[idx] = record;
  } else {
    campaigns.push(record);
  }
  safeSet(STORE_KEYS.campaigns, campaigns, MAX_CAMPAIGNS);
  syncCampaignToSupabase(record);
  return record;
}

// ---- Assets ----
export function listAssets(campaignId) {
  return safeGet(STORE_KEYS.assets, []).filter(a => a.campaignId === campaignId);
}

export function saveAsset(asset) {
  const assets = safeGet(STORE_KEYS.assets, []);
  const idx = assets.findIndex(a => a.id === asset.id);
  const record = { ...asset, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    assets[idx] = record;
  } else {
    assets.push(record);
  }
  safeSet(STORE_KEYS.assets, assets, MAX_ASSETS);
  syncAssetToSupabase(record);
  return record;
}

// ---- Photoshoots ----
export function listPhotoshoots(brandId) {
  return safeGet(STORE_KEYS.photoshoots, []).filter(p => p.brandId === brandId);
}

export function savePhotoshoot(photoshoot) {
  const photoshoots = safeGet(STORE_KEYS.photoshoots, []);
  const idx = photoshoots.findIndex(p => p.id === photoshoot.id);
  const record = { ...photoshoot, createdAt: new Date().toISOString() };
  if (idx >= 0) {
    photoshoots[idx] = record;
  } else {
    photoshoots.unshift(record);
  }
  safeSet(STORE_KEYS.photoshoots, photoshoots, MAX_PHOTOSHOOTS);
  syncPhotoshootToSupabase(record);
  return record;
}

// ---- Animations ----
export function listAnimations(brandId) {
  return safeGet(STORE_KEYS.animations, []).filter(a => a.brandId === brandId);
}

export function saveAnimation(animation) {
  const animations = safeGet(STORE_KEYS.animations, []);
  const idx = animations.findIndex(a => a.id === animation.id);
  const record = { ...animation, createdAt: new Date().toISOString() };
  if (idx >= 0) {
    animations[idx] = record;
  } else {
    animations.unshift(record);
  }
  safeSet(STORE_KEYS.animations, animations, MAX_ANIMATIONS);
  syncAnimationToSupabase(record);
  return record;
}

// ---- Utilities ----
export function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function fetchBrandsFromSupabase() {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase.from('brand_dna').select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[brandStore] Failed to fetch brands from Supabase:', err);
    return [];
  }
}
