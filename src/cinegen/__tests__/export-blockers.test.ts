import { describe, it, expect } from 'vitest';
import { exportBlockers, describeBlockers } from '@cinegen/lib/export-blockers';

const clip = (o: Record<string, unknown> = {}) => ({ id: 'c1', assetId: 'a1', duration: 5, trimStart: 0, trimEnd: 0, speed: 1, ...o }) as never;

describe('exportBlockers', () => {
  it('passes a healthy clip', () => {
    expect(exportBlockers([clip()], [{ id: 'a1', name: 'Roof', url: 'https://x/a.mp4' }])).toEqual([]);
  });
  it('flags media missing from the project', () => {
    expect(exportBlockers([clip()], [])).toEqual([{ clipId: 'c1', name: 'Unknown media', reason: 'media-missing' }]);
  });
  it('flags media with no file link', () => {
    expect(exportBlockers([clip()], [{ id: 'a1', name: 'Roof', url: '' }])[0].reason).toBe('no-file-link');
  });
  it('accepts a local fileRef when there is no url', () => {
    expect(exportBlockers([clip()], [{ id: 'a1', name: 'Roof', fileRef: '/m/a.mp4' }])).toEqual([]);
  });
  it('flags a clip trimmed to nothing', () => {
    expect(exportBlockers([clip({ trimStart: 5 })], [{ id: 'a1', name: 'Roof', url: 'u' }])[0].reason).toBe('zero-length');
  });
  it('describes the first problem and counts the rest', () => {
    const text = describeBlockers(exportBlockers([clip(), clip({ id: 'c2' })], [{ id: 'a1', name: 'Roof', url: '' }]));
    expect(text).toContain('“Roof” (and 1 more)');
    expect(text).toContain('no usable file link');
    expect(describeBlockers([])).toBe('');
  });
});
