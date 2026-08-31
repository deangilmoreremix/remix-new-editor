import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPersonalizerHandoff,
  savePersonalizerHandoff,
  getPersonalizerHandoff,
  consumePersonalizerHandoff,
  clearPersonalizerHandoff,
  HANDOFF_STORAGE_KEY,
} from '../lib/personalizerHandoff.js';

// Use a simple in-memory sessionStorage mock so these tests are stable
// across vitest/jsdom environments where the native implementation may
// not persist data reliably.
const sessionStore = {};
const originalSessionStorage = global.sessionStorage;
// @ts-ignore
global.sessionStorage = {
  getItem(key) { return sessionStore[key] || null; },
  setItem(key, value) { sessionStore[key] = String(value); },
  removeItem(key) { delete sessionStore[key]; },
  clear() { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); },
};

const VALID_HANDOFF = {
  version: 1,
  source: { studioId: 'video', studioName: 'Video Studio', route: 'video' },
  project: { id: 'p1', title: 'Roofing Campaign' },
  asset: {
    id: 'video-current',
    type: 'video',
    title: 'Test video',
    previewUrl: 'https://example.com/video.mp4',
    fields: [
      { id: 'prompt', label: 'Prompt', type: 'text', value: 'Hello {{firstName}}', supportsPersonalization: true },
      { id: 'model', label: 'Model', type: 'text', value: 'seedance-2.5', supportsPersonalization: false },
    ],
    metadata: { studio: 'VideoStudio' },
  },
  selectedProfileId: 'profile-1',
  returnRoute: 'video',
  createdAt: '2026-08-31T02:00:00.000Z',
};

describe('personalizerHandoff', () => {
  beforeEach(() => {
    try { sessionStorage.clear(); } catch {}
    try { localStorage.clear(); } catch {}
  });

  it('creates a valid handoff', () => {
    const handoff = createPersonalizerHandoff({
      studioId: 'video',
      studioName: 'Video Studio',
      route: 'video',
      project: { id: 'p1', title: 'Roofing Campaign' },
      asset: VALID_HANDOFF.asset,
      selectedProfileId: 'profile-1',
      returnRoute: 'video',
    });
    expect(handoff.version).toBe(1);
    expect(handoff.source.studioId).toBe('video');
    expect(handoff.asset.type).toBe('video');
    expect(handoff.asset.fields).toHaveLength(2);
  });

  it('defaults missing studioId to unknown', () => {
    const handoff = createPersonalizerHandoff({});
    expect(handoff.source.studioId).toBe('unknown');
  });

  it('saves and loads a handoff', () => {
    const saved = savePersonalizerHandoff(VALID_HANDOFF);
    expect(saved).toBe(true);

    const loaded = getPersonalizerHandoff();
    expect(loaded).not.toBeNull();
    expect(loaded.source.studioId).toBe('video');
    expect(loaded.asset.type).toBe('video');
  });

  it('consumes and removes the handoff', () => {
    savePersonalizerHandoff(VALID_HANDOFF);
    const consumed = consumePersonalizerHandoff();
    expect(consumed).not.toBeNull();
    expect(consumed.source.studioId).toBe('video');

    const after = getPersonalizerHandoff();
    expect(after).toBeNull();
  });

  it('clears the handoff', () => {
    savePersonalizerHandoff(VALID_HANDOFF);
    clearPersonalizerHandoff();
    expect(getPersonalizerHandoff()).toBeNull();
  });

  it('returns null for missing handoff', () => {
    expect(getPersonalizerHandoff()).toBeNull();
    expect(consumePersonalizerHandoff()).toBeNull();
  });

  it('rejects malformed JSON', () => {
    try { sessionStorage.setItem(HANDOFF_STORAGE_KEY, 'not-json'); } catch {}
    expect(getPersonalizerHandoff()).toBeNull();
  });

  it('rejects missing source', () => {
    expect(savePersonalizerHandoff({ version: 1 })).toBe(false);
    expect(getPersonalizerHandoff()).toBeNull();
  });

  it('rejects invalid asset type', () => {
    const handoff = createPersonalizerHandoff({
      studioId: 'video',
      asset: { ...VALID_HANDOFF.asset, type: 'invalid' },
    });
    expect(handoff.asset.type).toBe('other');
  });

  it('trims string fields', () => {
    const handoff = createPersonalizerHandoff({
      studioId: '  video  ',
      asset: VALID_HANDOFF.asset,
    });
    expect(handoff.source.studioId).toBe('video');
  });

  it('preserves selected profile id', () => {
    const handoff = createPersonalizerHandoff({
      studioId: 'video',
      selectedProfileId: 'profile-42',
      asset: VALID_HANDOFF.asset,
    });
    expect(handoff.selectedProfileId).toBe('profile-42');
  });

  it('preserves return route', () => {
    const handoff = createPersonalizerHandoff({
      studioId: 'video',
      returnRoute: 'video',
      asset: VALID_HANDOFF.asset,
    });
    expect(handoff.returnRoute).toBe('video');
  });

  it('handles sessionStorage unavailability', () => {
    const originalSetItem = sessionStorage.setItem;
    sessionStorage.setItem = vi.fn(() => { throw new Error('denied'); });
    const saved = savePersonalizerHandoff(VALID_HANDOFF);
    expect(saved).toBe(false);
    sessionStorage.setItem = originalSetItem;
  });

  it('handles empty asset fields array', () => {
    const handoff = createPersonalizerHandoff({
      studioId: 'video',
      asset: { ...VALID_HANDOFF.asset, fields: [] },
    });
    expect(handoff.asset.fields).toHaveLength(0);
  });
});
