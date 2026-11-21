// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  checklistState, checklistAction, checklistVisible, dismissChecklist, isChecklistDismissed, installChecklistListeners,
  _resetChecklistForTests, PUBLISHED_EVENT,
} from '../checklist.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const keys = (k) => ({ hasMuapiKey: () => !!k, getMuapiKey: () => k });
const base = (over = {}) => ({ keys: keys(null), storage: mem(), brands: () => [], resultSeen: () => false, ...over });

describe('checklist state', () => {
  beforeEach(() => _resetChecklistForTests());

  it('starts at 0 of 4', () => {
    const s = checklistState('u1', base());
    expect(s).toMatchObject({ done: 0, total: 4 });
    expect(s.items.map((i) => i.id)).toEqual(['key', 'first-result', 'brand', 'publish']);
  });
  it('a real key counts, the dev placeholder does not', () => {
    expect(checklistState('u1', base({ keys: keys('realkey1234567') })).items[0].done).toBe(true);
    expect(checklistState('u1', base({ keys: keys('dev') })).items[0].done).toBe(false);
  });
  it('first result: saved history or a generation this session', () => {
    const st = mem(); st.setItem('video_history', JSON.stringify([{ id: 1 }]));
    expect(checklistState('u1', base({ storage: st })).items[1].done).toBe(true);
    const empty = mem(); empty.setItem('muapi_history', '[]');
    expect(checklistState('u1', base({ storage: empty })).items[1].done).toBe(false);
    expect(checklistState('u1', base({ resultSeen: () => true })).items[1].done).toBe(true);
    const bad = mem(); bad.setItem('muapi_history', '{oops');
    expect(checklistState('u1', base({ storage: bad })).items[1].done).toBe(false);
  });
  it('brand: any saved brand; a throwing store counts as none', () => {
    expect(checklistState('u1', base({ brands: () => [{ id: 'b' }] })).items[2].done).toBe(true);
    expect(checklistState('u1', base({ brands: () => { throw new Error('x'); } })).items[2].done).toBe(false);
  });
  it('publish: set by the landing:published event, per user', () => {
    const st = mem(); let uid = 'u1';
    installChecklistListeners(() => uid, window, st);
    expect(checklistState('u1', base({ storage: st })).items[3].done).toBe(false);
    window.dispatchEvent(new CustomEvent(PUBLISHED_EVENT, { detail: { id: 'p' } }));
    expect(checklistState('u1', base({ storage: st })).items[3].done).toBe(true);
    expect(checklistState('u2', base({ storage: st })).items[3].done).toBe(false);
    uid = 'u2';
  });
  it('a generation:saved event marks the first result for this session', () => {
    installChecklistListeners(() => 'u1', window, mem());
    window.dispatchEvent(new CustomEvent('generation:saved', { detail: {} }));
    expect(checklistState('u1', { keys: keys(null), storage: mem(), brands: () => [] }).items[1].done).toBe(true);
  });
});

describe('checklist actions, visibility and dismissal', () => {
  it('maps each item to where it leads', () => {
    const st = mem();
    expect(checklistAction('key', 'u1', st)).toEqual({ kind: 'settings' });
    expect(checklistAction('first-result', 'u1', st)).toEqual({ kind: 'route', route: 'image' });
    st.setItem('smartvideo-app-onboarding-v1:u1', JSON.stringify({ step: 6, tools: ['avatar'], primaryTool: 'avatar' }));
    expect(checklistAction('first-result', 'u1', st)).toEqual({ kind: 'route', route: 'avatar' });
    expect(checklistAction('brand', 'u1', st)).toEqual({ kind: 'route', route: 'brand' });
    expect(checklistAction('publish', 'u1', st)).toEqual({ kind: 'route', route: 'video-pages' });
  });
  it('shows only after the onboarding was finished or skipped, until all done or hidden', () => {
    const st = mem();
    const some = { done: 1, total: 4 };
    expect(checklistVisible('u1', some, { storage: st })).toBe(false); // never onboarded
    st.setItem('smartvideo-app-onboarding-v1:u1', JSON.stringify({ step: 3 }));
    expect(checklistVisible('u1', some, { storage: st })).toBe(false); // still in progress
    st.setItem('smartvideo-app-onboarding-v1:u1', JSON.stringify({ step: 6, completedAt: '2026-11-01T00:00:00Z' }));
    expect(checklistVisible('u1', some, { storage: st })).toBe(true);
    expect(checklistVisible('u1', { done: 4, total: 4 }, { storage: st })).toBe(false);
    st.setItem('smartvideo-app-onboarding-v1:u2', JSON.stringify({ step: 2, skippedAt: '2026-11-01T00:00:00Z' }));
    expect(checklistVisible('u2', some, { storage: st })).toBe(true);
  });
  it('hide this is remembered like a tour', async () => {
    localStorage.clear();
    expect(isChecklistDismissed('')).toBe(false);
    await dismissChecklist('');
    expect(isChecklistDismissed('')).toBe(true);
  });
});
