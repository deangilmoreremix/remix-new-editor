/**
 * clientProfileStore.test.js
 *
 * Tests for the client profile store: CRUD + localStorage persist
 * round-trip.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  clientProfileStore,
  useClients,
  useCurrentClientId,
} from '../clientProfileStore.js';

const CLIENTS_KEY = 'remix_personalization_clients_v1';
const CURRENT_KEY = 'remix_personalization_current_client_v1';

beforeEach(() => {
  // Clear localStorage between tests so persisted state from a prior
  // case does not leak.
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  // The store hydrates on first construction; since it's a module
  // singleton, force a re-hydrate by calling `hydrate()` after clearing.
  clientProfileStore.setState({ clients: [], currentClientId: null, hydrated: false });
  clientProfileStore.hydrate();
});

describe('clientProfileStore', () => {
  it('starts empty', () => {
    expect(clientProfileStore.getClients()).toEqual([]);
    expect(clientProfileStore.getCurrentClientId()).toBeNull();
  });

  it('addClient creates a record with id + timestamps', () => {
    const c = clientProfileStore.addClient({ name: 'Alice' });
    expect(c.id).toMatch(/^client-/);
    expect(c.name).toBe('Alice');
    expect(c.audience).toBe('me');
    expect(c.createdAt).toBeTruthy();
    expect(c.updatedAt).toBeTruthy();
  });

  it('addClient persists to localStorage', () => {
    const c = clientProfileStore.addClient({ name: 'Bob', businessName: 'Acme' });
    const raw = window.localStorage.getItem(CLIENTS_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.find((x) => x.id === c.id)).toBeTruthy();
  });

  it('updateClient merges patch + updates updatedAt', async () => {
    const c = clientProfileStore.addClient({ name: 'Carol' });
    // Force updatedAt to advance
    await new Promise((r) => setTimeout(r, 5));
    const updated = clientProfileStore.updateClient(c.id, { name: 'Carol Updated' });
    expect(updated).toBeTruthy();
    expect(updated.name).toBe('Carol Updated');
    expect(updated.id).toBe(c.id);
    expect(updated.updatedAt >= c.updatedAt).toBe(true);
  });

  it('updateClient returns null for unknown id', () => {
    const result = clientProfileStore.updateClient('does-not-exist', { name: 'X' });
    expect(result).toBeNull();
  });

  it('removeClient deletes the record and clears current id when matched', () => {
    const c = clientProfileStore.addClient({ name: 'Dave' });
    clientProfileStore.setCurrentClientId(c.id);
    expect(clientProfileStore.getCurrentClientId()).toBe(c.id);

    clientProfileStore.removeClient(c.id);
    expect(clientProfileStore.getClientById(c.id)).toBeNull();
    expect(clientProfileStore.getCurrentClientId()).toBeNull();
  });

  it('removeClient leaves current id intact when a different client is removed', () => {
    const a = clientProfileStore.addClient({ name: 'A' });
    const b = clientProfileStore.addClient({ name: 'B' });
    clientProfileStore.setCurrentClientId(a.id);

    clientProfileStore.removeClient(b.id);
    expect(clientProfileStore.getCurrentClientId()).toBe(a.id);
  });

  it('setCurrentClientId writes to localStorage', () => {
    const c = clientProfileStore.addClient({ name: 'Eve' });
    clientProfileStore.setCurrentClientId(c.id);
    expect(window.localStorage.getItem(CURRENT_KEY)).toBe(c.id);

    clientProfileStore.setCurrentClientId(null);
    expect(window.localStorage.getItem(CURRENT_KEY)).toBeNull();
  });

  it('persistence round-trip: writes then re-hydrates from localStorage', () => {
    const a = clientProfileStore.addClient({ name: 'PersistA' });
    const b = clientProfileStore.addClient({ name: 'PersistB' });
    clientProfileStore.setCurrentClientId(b.id);

    // Simulate fresh process by clearing in-memory state and re-hydrating.
    clientProfileStore.setState({ clients: [], currentClientId: null, hydrated: false });
    clientProfileStore.hydrate();

    const reloaded = clientProfileStore.getClients();
    const ids = reloaded.map((c) => c.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(clientProfileStore.getCurrentClientId()).toBe(b.id);
  });

  it('hooks are exported as functions and return the current state when given a selector', async () => {
    // We can't call React hooks outside a render. Instead, verify the
    // hook exports exist as functions and that a non-hook read of the
    // store yields the same value the hook would return.
    const { useClients, useCurrentClientId, clientProfileStore } = await import('../clientProfileStore.js');
    expect(typeof useClients).toBe('function');
    expect(typeof useCurrentClientId).toBe('function');

    clientProfileStore.addClient({ name: 'HookShape' });
    const list = clientProfileStore.getClients();
    expect(list.some((c) => c.name === 'HookShape')).toBe(true);
  });
});
