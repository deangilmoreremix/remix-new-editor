// Video Resolution in the bundled model definitions agrees with MuAPI's live catalog.
import { describe, test, expect } from 'vitest';
import {
  t2vModels, i2vModels, getResolutionsForVideoModel, getResolutionsForI2VModel,
} from '../lib/models.js';
import live from '../lib/muapi/liveModels.json';

const liveByName = new Map(live.models.map((m) => [m.name, m]));
const liveFor = (m) => liveByName.get(m.endpoint || m.id) || liveByName.get(m.id);

describe('video Resolution matches the live catalog', () => {
  test('every video model whose live model list declares `resolution` offers it', () => {
    const missing = [];
    for (const [kind, list] of [['t2v', t2vModels], ['i2v', i2vModels]]) {
      for (const m of list) {
        const L = liveFor(m);
        if (!L?.declared?.includes('resolution')) continue;
        if (!m.inputs?.resolution?.enum?.length) missing.push(`${kind}:${m.id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('each patched model lists values the live request schema allows, with an allowed default', () => {
    for (const [list, read] of [[t2vModels, getResolutionsForVideoModel], [i2vModels, getResolutionsForI2VModel]]) {
      for (const m of list) {
        const L = liveFor(m);
        const field = L?.fields.find((f) => f.name === 'resolution');
        if (!m.inputs?.resolution || !field?.enum || !L.declared?.includes('resolution')) continue;
        const shown = read(m.id);
        // The API reads the value case-insensitively (estimate-cost prices '4K' like '4k'), and two older entries use '4K'.
        const allowed = field.enum.map((v) => v.toLowerCase());
        for (const v of shown) expect(allowed, `${m.id} ${v}`).toContain(v.toLowerCase());
        if (m.inputs.resolution.default !== undefined) expect(shown.map((v) => v.toLowerCase()), m.id).toContain(String(m.inputs.resolution.default).toLowerCase());
      }
    }
  });

  test('an endpoint that lists `resolution` in openapi but ignores it stays without one', () => {
    // Real estimate-cost calls: seedance-2-image-to-video costs $1.25 at 720p and at 4k, so the setting does nothing.
    expect(getResolutionsForI2VModel('seedance-2-image-to-video')).toEqual([]);
  });

  test('spot checks', () => {
    expect(getResolutionsForVideoModel('grok-imagine-text-to-video')).toEqual(['480p', '720p']);
    expect(getResolutionsForI2VModel('seedance-2-vip-image-to-video')).toEqual(['720p', '1080p', '4k']);
    expect(getResolutionsForI2VModel('seedance-2.5-image-to-video')).toEqual(['480p', '720p', '1080p', '4k']);
  });
});
