// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { cleanTours, mergeTours, hasSeen, toursDisabled, loadLocalTours, saveLocalTours, toToursRows, fromToursRows, markTourSeen, setToursDisabled, resetTours, DISABLED_ID } from '../tourState.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const T1 = '2026-11-20T10:00:00.000Z';
const T2 = '2026-11-21T10:00:00.000Z';

describe('tour state', () => {
  it('keeps only valid entries', () => {
    expect(cleanTours({ app: { version: 1, seenAt: T1 }, bad: { version: 0, seenAt: T1 }, nodate: { version: 1 }, '': { version: 1, seenAt: T1 }, x: 5 })).toEqual({ app: { version: 1, seenAt: T1 } });
    expect(cleanTours(null)).toEqual({});
  });
  it('merges as a union: higher version wins, then the later time', () => {
    const m = mergeTours({ a: { version: 1, seenAt: T2 }, b: { version: 2, seenAt: T1 } }, { a: { version: 2, seenAt: T1 }, b: { version: 2, seenAt: T2 }, c: { version: 1, seenAt: T1 } });
    expect(m).toEqual({ a: { version: 2, seenAt: T1 }, b: { version: 2, seenAt: T2 }, c: { version: 1, seenAt: T1 } });
  });
  it('a tour is seen at its version or later, so a bumped version shows again', () => {
    const t = { image: { version: 1, seenAt: T1 } };
    expect(hasSeen(t, 'image', 1)).toBe(true);
    expect(hasSeen(t, 'image', 2)).toBe(false);
    expect(hasSeen(t, 'video', 1)).toBe(false);
  });
  it('keeps one browser copy per user', () => {
    const s = mem();
    saveLocalTours('u1', { app: { version: 1, seenAt: T1 } }, s);
    expect(loadLocalTours('u1', s)).toEqual({ app: { version: 1, seenAt: T1 } });
    expect(loadLocalTours('u2', s)).toEqual({});
  });
  it('round-trips through Supabase rows', () => {
    const t = { app: { version: 1, seenAt: T1 }, image: { version: 3, seenAt: T2 } };
    const rows = toToursRows(t, 'u1');
    expect(rows).toContainEqual({ clerk_user_id: 'u1', tour_id: 'image', version: 3, seen_at: T2 });
    expect(fromToursRows(rows)).toEqual(t);
  });
  it('marks seen, turns tours off and on, and resets (browser copy, signed out)', async () => {
    localStorage.clear();
    let t = await markTourSeen('', 'video', 2, null, T1);
    expect(hasSeen(t, 'video', 2)).toBe(true);
    expect(hasSeen(loadLocalTours(''), 'video', 2)).toBe(true);
    t = await setToursDisabled('', true, t);
    expect(toursDisabled(t)).toBe(true);
    expect(t[DISABLED_ID]).toBeTruthy();
    t = await setToursDisabled('', false, t);
    expect(toursDisabled(t)).toBe(false);
    expect(hasSeen(t, 'video', 2)).toBe(true);
    expect(await resetTours('')).toEqual({});
    expect(loadLocalTours('')).toEqual({});
  });
});
