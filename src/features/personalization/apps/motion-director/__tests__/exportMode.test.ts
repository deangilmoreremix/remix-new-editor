import { afterEach, describe, expect, it } from 'vitest';
import { blurSamples, isExporting, setExportMode } from '../demosrc/_fixtures/ExportMode';

afterEach(() => setExportMode(false));

describe('export mode', () => {
  it('draws every motion-blur sample in the preview', () => {
    expect(isExporting()).toBe(false);
    expect([1, 3, 8, 12, 44].map(blurSamples)).toEqual([1, 3, 8, 12, 44]);
  });

  it('draws about a third while exporting, never fewer than 3, and leaves small counts alone', () => {
    setExportMode(true);
    expect([1, 2, 3].map(blurSamples)).toEqual([1, 2, 3]);
    expect([4, 8, 12, 44].map(blurSamples)).toEqual([3, 3, 4, 15]);
  });
});
