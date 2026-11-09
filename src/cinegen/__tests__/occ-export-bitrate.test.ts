// [remix] OpenChatCut export bitrate modes (export/bitrate.ts) as used by the Export tab.
import { describe, it, expect } from 'vitest';
import { requestedVideoBitrateBps, resolveVideoBitrateBps } from '../../openchatcut/export/bitrate';

describe('export bitrate', () => {
  it('auto leaves the renderer default (undefined)', () => {
    expect(requestedVideoBitrateBps({ mode: 'auto', width: 1920, height: 1080, fps: 30, customMbps: 12 })).toBeUndefined();
  });
  it('compact < recommended(auto) < high', () => {
    const base = { width: 1920, height: 1080, fps: 30, customMbps: 12 };
    const c = resolveVideoBitrateBps({ ...base, mode: 'compact' });
    const r = resolveVideoBitrateBps({ ...base, mode: 'recommended' });
    const h = resolveVideoBitrateBps({ ...base, mode: 'high' });
    expect(c).toBeLessThan(r); expect(r).toBeLessThan(h);
  });
  it('custom is clamped to 1–80 Mbps', () => {
    const base = { width: 1920, height: 1080, fps: 30, mode: 'custom' as const };
    expect(resolveVideoBitrateBps({ ...base, customMbps: 500 })).toBe(80_000_000);
    expect(resolveVideoBitrateBps({ ...base, customMbps: 0 })).toBe(1_000_000);
  });
});

import { loadExportAutoQaPreference, saveExportAutoQaPreference } from '../../openchatcut/export/autoQa';
describe('export auto-QA preference', () => {
  it('defaults on and round-trips', () => {
    expect(loadExportAutoQaPreference().enabled).toBe(true);
    saveExportAutoQaPreference({ enabled: false });
    expect(loadExportAutoQaPreference().enabled).toBe(false);
    saveExportAutoQaPreference({ enabled: true });
  });
});

import { defaultBitrateModeForQuality, exportResolutionForCanvas } from '../../openchatcut/media/qualityPolicy';
describe('master quality policy', () => {
  it('master defaults to a high bitrate, balanced to auto', () => {
    expect(defaultBitrateModeForQuality('master')).toBe('high');
    expect(defaultBitrateModeForQuality('balanced')).toBe('auto');
  });
  it('picks an export resolution from the canvas', () => {
    expect(exportResolutionForCanvas({ width: 3840, height: 2160 })).toBe('4k');
    expect(exportResolutionForCanvas({ width: 1920, height: 1080 }, 'master')).toBe('1080p');
  });
});
