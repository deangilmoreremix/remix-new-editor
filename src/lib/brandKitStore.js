// src/lib/brandKitStore.js
// Where saved Brand Kits live. Brand Kit is its own feature: it has its own list in this browser and shares
// nothing with Brand Studio's brands (lib/brandStore.js).

const KEY = 'sv_brand_kits';
const MAX_KITS = 50;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_KITS))); return true; } catch { return false; }
}

export const newKitId = () => `kit_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Saved kits, newest first. */
export const listBrandKits = () => read();

export const getBrandKit = (id) => read().find((k) => k.id === id) || null;

/** Insert or replace by id; the kit moves to the top. Returns the saved record; throws if the browser would not store it. */
export function putBrandKit(kit) {
  const record = { ...kit, updatedAt: new Date().toISOString() };
  if (!write([record, ...read().filter((k) => k.id !== record.id)])) {
    throw new Error("Couldn't save: this browser's storage is full or blocked.");
  }
  return record;
}
