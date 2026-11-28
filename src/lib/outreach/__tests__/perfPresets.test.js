import { describe, it, expect } from 'vitest';
import { PERF_PRESETS, PERF_KEY, recommendPreset, chosenPreset, choosePreset, presetId } from '../perfPresets.js';
import { QUALITY } from '../editTools.js';

const env = (nav) => ({ navigator: nav });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('performance presets', () => {
  it('every preset names a real export quality', () => {
    Object.values(PERF_PRESETS).forEach((p) => { expect(QUALITY.some(([k]) => k === p.quality)).toBe(true); expect(p.suggestFrames).toBeGreaterThan(0); });
  });
  it('suggests Light for data saver, a slow connection, little memory or few cores, each with its reason', () => {
    expect(recommendPreset(env({ connection: { saveData: true } }))).toMatchObject({ id: 'light', reason: expect.stringMatching(/data saver/) });
    expect(recommendPreset(env({ connection: { effectiveType: '3g' } }))).toMatchObject({ id: 'light', reason: expect.stringMatching(/slow/) });
    expect(recommendPreset(env({ deviceMemory: 2 }))).toMatchObject({ id: 'light', reason: expect.stringMatching(/2 GB/) });
    expect(recommendPreset(env({ hardwareConcurrency: 2 }))).toMatchObject({ id: 'light', reason: expect.stringMatching(/2 processor cores/) });
    expect(recommendPreset(env({ hardwareConcurrency: 1 })).reason).toMatch(/1 processor core\b/);
  });
  it('suggests Best only when both memory and cores are high, otherwise Balanced', () => {
    expect(recommendPreset(env({ deviceMemory: 8, hardwareConcurrency: 12 })).id).toBe('best');
    expect(recommendPreset(env({ deviceMemory: 8, hardwareConcurrency: 4 })).id).toBe('balanced');
    expect(recommendPreset(env({ deviceMemory: 4, hardwareConcurrency: 8 })).id).toBe('balanced');
  });
  it('says plainly when the browser does not tell', () => {
    expect(recommendPreset(env({}))).toMatchObject({ id: 'balanced', reason: expect.stringMatching(/does not say/) });
    expect(recommendPreset({})).toMatchObject({ id: 'balanced' });
  });
  it('remembers the choice in this browser, and falls back to Balanced', () => {
    const s = memory();
    expect(chosenPreset(s)).toBe('balanced');
    expect(choosePreset('light', s)).toBe(true);
    expect(chosenPreset(s)).toBe('light');
    s.setItem(PERF_KEY, 'junk');
    expect(chosenPreset(s)).toBe('balanced');
    expect(presetId('constructor')).toBe('balanced'); // not a real preset, even though it is a property name
    const blocked = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(chosenPreset(blocked)).toBe('balanced');
    expect(choosePreset('best', blocked)).toBe(false);
  });
});
