// src/lib/onboarding/checklist.js
//
// The "Get started" checklist behind the header chip: four things that get a new person to a real result.
// Nothing is stored for the first three (they are read from what the app already keeps); the only saved bits are
// "you published a page" (pages live remotely) and "hide this" (kept like a tour, so it follows the person).
import { apiKeyManager } from '../apiKeyManager.js';
import { listBrands } from '../brandStore.js';
import { hasMuapiKey } from './keySetup.js';
import { getFavorites, loadLocalAppOnboarding } from './store.js';
import { hasSeen, loadLocalTours, markTourSeen } from '../tours/tourState.js';

export const CHECKLIST_ITEMS = Object.freeze([
  { id: 'key', label: 'Connect your Muapi key' },
  { id: 'first-result', label: 'Make your first result' },
  { id: 'brand', label: 'Set up your brand' },
  { id: 'publish', label: 'Publish a page' },
]);
export const CHECKLIST_DISMISSED_ID = 'checklist-dismissed';
export const PUBLISHED_EVENT = 'landing:published';
const PUBLISHED_KEY = 'smartvideo-checklist-published';
const uidKey = (uid) => `${PUBLISHED_KEY}:${String(uid || 'guest').slice(0, 80)}`;

let madeResultThisSession = false;

const hasHistory = (storage) => ['muapi_history', 'video_history'].some((k) => {
  try { const v = JSON.parse(storage?.getItem(k) || '[]'); return Array.isArray(v) && v.length > 0; } catch { return false; }
});

/** { items: [{ id, label, done }], done, total } from what the app already knows. */
export function checklistState(uid, { keys = apiKeyManager, storage = globalThis.localStorage, brands = listBrands, resultSeen = () => madeResultThisSession } = {}) {
  let brandCount = 0;
  try { brandCount = brands().length; } catch { brandCount = 0; }
  let published = false;
  try { published = storage?.getItem(uidKey(uid)) === '1'; } catch { published = false; }
  const done = {
    key: hasMuapiKey(keys),
    'first-result': resultSeen() || hasHistory(storage),
    brand: brandCount > 0,
    publish: published,
  };
  const items = CHECKLIST_ITEMS.map((i) => ({ ...i, done: !!done[i.id] }));
  return { items, done: items.filter((i) => i.done).length, total: items.length };
}

/** Where each item takes you: { kind: 'settings' } or { kind: 'route', route }. */
export function checklistAction(id, uid, storage = globalThis.localStorage) {
  if (id === 'key') return { kind: 'settings' };
  if (id === 'first-result') return { kind: 'route', route: getFavorites(uid, storage)[0] || 'image' };
  if (id === 'brand') return { kind: 'route', route: 'brand' };
  return { kind: 'route', route: 'video-pages' };
}

/** Shown to people who have been through the onboarding (finished or skipped), until hidden or all four are done. */
export function checklistVisible(uid, state, { storage = globalThis.localStorage } = {}) {
  const a = loadLocalAppOnboarding(uid, storage);
  if (!a || !(a.completedAt || a.skippedAt)) return false;
  if (isChecklistDismissed(uid, storage)) return false;
  return state.done < state.total;
}

export const isChecklistDismissed = (uid, storage = globalThis.localStorage) => hasSeen(loadLocalTours(uid, storage), CHECKLIST_DISMISSED_ID);
export const dismissChecklist = (uid) => markTourSeen(uid, CHECKLIST_DISMISSED_ID);

let installed = false;
/** Listens for the events that complete items (a saved generation, a published page). Safe to call twice. */
export function installChecklistListeners(getUid, win = globalThis.window, storage = globalThis.localStorage) {
  if (installed || !win) return;
  installed = true;
  win.addEventListener('generation:saved', () => { madeResultThisSession = true; });
  win.addEventListener(PUBLISHED_EVENT, () => { try { storage?.setItem(uidKey(getUid()), '1'); } catch { /* storage blocked */ } });
}
export const _resetChecklistForTests = () => { installed = false; madeResultThisSession = false; };
