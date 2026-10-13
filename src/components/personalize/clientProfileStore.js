/**
 * clientProfileStore.js
 *
 * Client profile store for the personalization system.
 *
 * Ported from OpenHiggsBolt/src/shared/personalization/clientProfile.ts
 * (localStorage CRUD on top of React-free helpers).
 *
 * DEVIATION FROM SOURCE:
 *   - Source uses React Context (DemoPersonalizeProvider.tsx) with
 *     localStorage. The integration worktree's package.json does NOT list
 *     zustand, and the rule "DO NOT introduce new npm dependencies"
 *     forbids adding it. The repo's own idiom is
 *     `src/stores/base/Store.js` (vanilla pub/sub). This store therefore
 *     extends `Store` and is exposed both as a plain singleton
 *     (`clientProfileStore`) and as a React-friendly hook
 *     (`useClientProfileStore`) built on React 19's
 *     `useSyncExternalStore`. The localStorage key is also changed
 *     from `smartvideo_clients` to `remix_personalization_clients_v1`
 *     to avoid collision with the OpenHiggsBolt install.
 *
 *   - localStorage keys:
 *       remix_personalization_clients_v1          (array of ClientProfile)
 *       remix_personalization_current_client_v1  (string id | null)
 */

import Store from '../../stores/base/Store.js';
import { useSyncExternalStore } from 'react';

const CLIENTS_KEY = 'remix_personalization_clients_v1';
const CURRENT_KEY = 'remix_personalization_current_client_v1';

const initialState = {
  /** @type {import('./types.js').ClientProfile[]} */
  clients: [],
  /** @type {string | null} */
  currentClientId: null,
  /** Whether the store has finished hydrating from localStorage. */
  hydrated: false,
};

function readClientsFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCurrentFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

function writeClientsToStorage(clients) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch (err) {
    console.warn('[personalize/clientProfileStore] persist failed', err);
  }
}

function writeCurrentToStorage(id) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (id) {
      window.localStorage.setItem(CURRENT_KEY, id);
    } else {
      window.localStorage.removeItem(CURRENT_KEY);
    }
  } catch (err) {
    console.warn('[personalize/clientProfileStore] persist current failed', err);
  }
}

function sortByUpdatedDesc(clients) {
  return [...clients].sort((a, b) => {
    const aT = a?.updatedAt || '';
    const bT = b?.updatedAt || '';
    return bT.localeCompare(aT);
  });
}

class ClientProfileStore extends Store {
  constructor() {
    super({ ...initialState });
    if (typeof window !== 'undefined') {
      // Hydrate from localStorage on construction. Done lazily because the
      // store is a module-level singleton and may be imported in non-browser
      // contexts (tests, SSR).
      this.hydrate();
    }
  }

  hydrate() {
    if (this.get('hydrated')) return;
    this.setState({
      clients: sortByUpdatedDesc(readClientsFromStorage()),
      currentClientId: readCurrentFromStorage(),
      hydrated: true,
    });
  }

  _persist() {
    writeClientsToStorage(this.get('clients'));
    writeCurrentToStorage(this.get('currentClientId'));
  }

  /** Add a new client. Accepts a partial ClientProfile; returns the full record. */
  addClient(partial) {
    const id =
      partial && partial.id
        ? partial.id
        : `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const client = {
      id,
      audience: partial?.audience || 'me',
      name: partial?.name || '',
      businessName: partial?.businessName || '',
      industry: partial?.industry || '',
      location: partial?.location || '',
      productService: partial?.productService || '',
      offer: partial?.offer || '',
      ctaHeadline: partial?.ctaHeadline || '',
      callToAction: partial?.callToAction || '',
      phone: partial?.phone || '',
      website: partial?.website || '',
      brandDescription: partial?.brandDescription || '',
      createdAt: partial?.createdAt || now,
      updatedAt: now,
    };
    const next = sortByUpdatedDesc([...this.get('clients'), client]);
    this.setState({ clients: next });
    this._persist();
    return client;
  }

  /** Update an existing client by id. Returns the updated record or null. */
  updateClient(id, patch) {
    let updated = null;
    const next = this.get('clients').map((c) => {
      if (c.id !== id) return c;
      const merged = { ...c, ...patch, id, updatedAt: new Date().toISOString() };
      updated = merged;
      return merged;
    });
    if (!updated) return null;
    this.setState({ clients: sortByUpdatedDesc(next) });
    this._persist();
    return updated;
  }

  /** Remove a client by id. Clears currentClientId if it matched. */
  removeClient(id) {
    const next = this.get('clients').filter((c) => c.id !== id);
    const current = this.get('currentClientId');
    const patch = { clients: next };
    if (current === id) patch.currentClientId = null;
    this.setState(patch);
    this._persist();
  }

  /** Set or clear the currently selected client. */
  setCurrentClientId(id) {
    this.setState({ currentClientId: id || null });
    this._persist();
  }

  /** Read-only selectors (return current values, not reactive). */
  getClients() {
    return this.get('clients');
  }

  getCurrentClientId() {
    return this.get('currentClientId');
  }

  getClientById(id) {
    return this.get('clients').find((c) => c.id === id) || null;
  }
}

export const clientProfileStore = new ClientProfileStore();
export default clientProfileStore;

/**
 * React hook: subscribe to the entire store state. Components only
 * re-render when the selected slice changes (shallow equality).
 *
 * @template T
 * @param {(state: { clients: import('./types.js').ClientProfile[]; currentClientId: string | null; hydrated: boolean }) => T} [selector]
 * @returns {T}
 */
export function useClientProfileStore(selector) {
  const sel = selector || ((s) => /** @type {any} */ (s));
  return useSyncExternalStore(
    (cb) => clientProfileStore.subscribe(() => cb()),
    () => sel(clientProfileStore.getState()),
    () => sel(clientProfileStore.getState()),
  );
}

/**
 * Convenience hook: returns the clients array (sorted by updatedAt desc).
 * @returns {import('./types.js').ClientProfile[]}
 */
export function useClients() {
  return useClientProfileStore((s) => s.clients);
}

/** @returns {string | null} */
export function useCurrentClientId() {
  return useClientProfileStore((s) => s.currentClientId);
}
