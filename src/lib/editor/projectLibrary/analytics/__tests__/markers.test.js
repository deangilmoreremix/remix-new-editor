import { describe, it, expect } from 'vitest';
import { buildMarkers, retentionAtMs, markerStats } from '../markers.js';

const project = {
  timelineSeconds: 100,
  listBuilder: { enabled: true },
  tracks: [
    { type: 'video', items: [{ id: 'v1', type: 'video', start: 0, end: 100 }] },
    { type: 'text', items: [
      { id: 'lf', type: 'lead-form', start: 45, end: 55 },
      { id: 'cta1', type: 'click-to-call', start: 80, end: 90, buttonText: 'Call us now' },
      { id: 'img', type: 'overlay-image', start: 10, end: 20, linkUrl: 'https://x.test' },
      { id: 'plain', type: 'overlay-text', start: 5, end: 8 },
      { id: 'late', type: 'lead-form', start: 20, end: 30, trigger: 'end' },
      { id: 'beyond', type: 'click-to-call', start: 150, end: 160 },
    ] },
  ],
};

describe('buildMarkers: CTA settings under clip.addon', () => {
  it('finds overlays and hotspots whose link / phone / button text live in the nested addon options', () => {
    const p = { timelineSeconds: 100, tracks: [{ type: 'text', items: [
      { id: 'a1', type: 'overlay-text', start: 10, end: 20, addon: { linkUrl: 'https://x.test', buttonText: 'Shop now' } },
      { id: 'a2', type: 'overlay-image', start: 30, end: 40, addon: { linkMode: 'phone', phoneNumber: '+15551234567' } },
      { id: 'stale', type: 'overlay-text', start: 52, end: 58, addon: { linkMode: 'url', linkUrl: '', phoneNumber: '+15551234567' } },   // switched back to URL mode: the hidden phone number is not a CTA
      { id: 'a3', type: 'overlay-text', start: 50, end: 60, addon: { linkUrl: '   ' } },      // blank: not a CTA
      { id: 'a4', type: 'overlay-text', start: 70, end: 80, addon: 'nope' },                    // not an object: ignored
    ] }] };
    expect(buildMarkers(p)).toEqual([
      { id: 'cta:a1', kind: 'cta', label: 'CTA: Shop now', startMs: 10000, endMs: 20000 },
      { id: 'cta:a2', kind: 'cta', label: 'CTA button', startMs: 30000, endMs: 40000 },
    ]);
  });
});

describe('buildMarkers', () => {
  it('finds lead forms, the List Builder wall and CTA / link overlays, sorted by time', () => {
    expect(buildMarkers(project)).toEqual([
      { id: 'list-builder', kind: 'list-builder', label: 'List Builder wall', startMs: 0, endMs: 0 },
      { id: 'cta:img', kind: 'cta', label: 'CTA button', startMs: 10000, endMs: 20000 },
      { id: 'lead-form:lf', kind: 'lead-form', label: 'Lead form', startMs: 45000, endMs: 55000 },
      { id: 'cta:cta1', kind: 'cta', label: 'CTA: Call us now', startMs: 80000, endMs: 90000 },
      { id: 'lead-form:late', kind: 'lead-form', label: 'Lead form', startMs: 100000, endMs: 100000 }, // trigger "end"
    ]);
  });
  it('reads left/width percentages like the sections code, and is empty without a duration or overlays', () => {
    const m = buildMarkers({ timelineSeconds: 200, tracks: [{ items: [{ id: 'a', type: 'lead-form', left: 25, width: 10 }] }] });
    expect(m).toEqual([{ id: 'lead-form:a', kind: 'lead-form', label: 'Lead form', startMs: 50000, endMs: 70000 }]);
    expect(buildMarkers({ tracks: [] })).toEqual([]);
    expect(buildMarkers({})).toEqual([]);
    expect(buildMarkers({ timelineSeconds: 30, tracks: [{ items: [{ type: 'overlay-text', start: 1, end: 2 }] }] })).toEqual([]);
    expect(buildMarkers({ timelineSeconds: 30, listBuilder: { enabled: false }, tracks: 'nope' })).toEqual([]);
  });
});

describe('retention at a marker', () => {
  const retention = [0, 25, 50, 75, 100].map((p, i) => ({ positionPercent: p, retentionPercent: [100, 80, 60, 40, 20][i] }));
  it('interpolates between points and clamps', () => {
    expect(retentionAtMs(retention, 100000, 0)).toBe(100);
    expect(retentionAtMs(retention, 100000, 37500)).toBe(70);
    expect(retentionAtMs(retention, 100000, 999999)).toBe(20);
    expect(retentionAtMs([], 100000, 10)).toBeNull();
    expect(retentionAtMs(retention, 0, 10)).toBeNull();
  });
  it('reports retention at the start and the drop across the visible window', () => {
    const [wall, form] = markerStats([
      { id: 'w', kind: 'list-builder', label: 'List Builder wall', startMs: 0, endMs: 0 },
      { id: 'f', kind: 'lead-form', label: 'Lead form', startMs: 40000, endMs: 60000 },
    ], retention, 100000);
    expect(wall).toMatchObject({ retentionPercent: 100, dropPoints: null });
    expect(form).toMatchObject({ retentionPercent: 68, dropPoints: 16 });
  });
  it('keeps working with empty retention', () => {
    expect(markerStats([{ id: 'f', kind: 'lead-form', label: 'Lead form', startMs: 1000, endMs: 3000 }], [], 100000))
      .toEqual([{ id: 'f', kind: 'lead-form', label: 'Lead form', startMs: 1000, endMs: 3000, retentionPercent: null, dropPoints: null }]);
    expect(markerStats(undefined, [], 0)).toEqual([]);
  });
});
