import { describe, it, expect, vi } from 'vitest';
import {
  listEffects, getEffectDef, effectParams, effectFields, createEffect, defaultEffectParams,
  loadEffects, buildEffectDescriptors, effectIdsInModel, parsePoints, formatPoints, isCubeLut, EFFECT_CATEGORIES,
} from '../effects.js';
import { EFFECT_LOADERS } from '../effectsLoaders.js';
import { renderEffectsPanel } from '../effectsPanel.js';
import { VIDEO_TRANSITION_OPTIONS } from '../../addons/overlayAddons.js';

describe('effects catalog (generated from @remotion/effects)', () => {
  it('covers every preset with a loader, a category and parameters', () => {
    const all = listEffects();
    expect(all.length).toBe(88);
    all.forEach((e) => {
      expect(EFFECT_LOADERS[e.id], e.id).toBeTypeOf('function');
      expect(EFFECT_CATEGORIES).toContain(e.category);
    });
    expect(getEffectDef('color-correction').category).toBe('Color');
    expect(getEffectDef('blur').category).toBe('Blur');
  });

  it('fills ranges/defaults so every number has a usable slider', () => {
    listEffects().forEach((e) => effectParams(e.id).forEach((p) => {
      if (p.type !== 'number') return;
      expect(Number.isFinite(p.min), `${e.id}.${p.key} min`).toBe(true);
      expect(p.max, `${e.id}.${p.key} max`).toBeGreaterThan(p.min);
      expect(Number.isFinite(p.default), `${e.id}.${p.key} default`).toBe(true);
    }));
    expect(effectParams('color-correction').find((p) => p.key === 'exposure')).toMatchObject({ min: -5, max: 5, default: 0 });
    expect(effectFields('vignette').map((f) => f.type)).toEqual(expect.arrayContaining(['range', 'color', 'select', 'uv']));
    expect(effectFields('curves').some((f) => f.type === 'points')).toBe(true);
    expect(effectFields('lut')[0].type).toBe('cube');
  });

  it('creates stack entries with defaults', () => {
    const fx = createEffect('color-key', { similarity: 0.3 });
    expect(fx).toMatchObject({ id: 'color-key', enabled: true, params: { keyColor: '#00ff00', similarity: 0.3 } });
    expect(fx.uid).toMatch(/^fx-/);
    expect(defaultEffectParams('blur')).toMatchObject({ radius: 10, horizontal: true, vertical: true });
  });

  it('builds Remotion effect descriptors once modules are loaded', async () => {
    const stack = [createEffect('blur', { radius: 4 }), { ...createEffect('grayscale'), enabled: false }, { id: 'unknown-fx', params: {} }];
    expect(buildEffectDescriptors(stack)).toEqual([]); // not loaded yet
    await loadEffects(['blur', 'grayscale']);
    const out = buildEffectDescriptors(stack);
    expect(out).toHaveLength(1); // disabled + unknown skipped
    expect(out[0]).toBeTypeOf('object');
    expect(effectIdsInModel({ layers: [{ effects: stack }, { effects: [] }] })).toEqual(['blur', 'grayscale', 'unknown-fx']);
  });

  it('drops UI-only params (LUT file name) before calling the preset', async () => {
    await loadEffects(['lut']);
    const lut = createEffect('lut', { content: 'LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1', contentName: 'warm.cube' });
    expect(() => buildEffectDescriptors([lut])).not.toThrow();
    expect(buildEffectDescriptors([lut])).toHaveLength(1);
  });

  it('parses curve points and recognises .cube LUTs', () => {
    expect(parsePoints('1,1; 0,0; 0.5, 0.7')).toEqual([[0, 0], [0.5, 0.7], [1, 1]]);
    expect(parsePoints('junk')).toEqual([[0, 0], [1, 1]]);
    expect(formatPoints([[0, 0], [1, 1]])).toBe('0, 0; 1, 1');
    expect(isCubeLut('TITLE "x"\nLUT_3D_SIZE 33\n')).toBe(true);
    expect(isCubeLut('<html>')).toBe(false);
  });
});

describe('Effects & Color panel', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('color sliders write one color-correction effect; green screen adds color-key', () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    renderEffectsPanel(box, { effects: [], onChange });
    const sat = box.querySelector('[data-cc="saturation"]');
    sat.value = '0.2';
    sat.dispatchEvent(new Event('input', { bubbles: true }));
    let last = onChange.mock.calls.at(-1)[0];
    expect(last).toHaveLength(1);
    expect(last[0]).toMatchObject({ id: 'color-correction', params: { saturation: 0.2 } });
    const exp = box.querySelector('[data-cc="exposure"]');
    exp.value = '0.5';
    exp.dispatchEvent(new Event('input', { bubbles: true }));
    last = onChange.mock.calls.at(-1)[0];
    expect(last).toHaveLength(1);
    expect(last[0].params).toMatchObject({ saturation: 0.2, exposure: 0.5 });
    const key = box.querySelector('[data-key-toggle]');
    key.checked = true;
    key.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0].map((e) => e.id)).toEqual(['color-key', 'color-correction']);
  });

  it('adds from the library, edits params, reorders, disables and removes', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const onChange = vi.fn();
    renderEffectsPanel(box, { effects: [], onChange });
    box.querySelector('[data-fx-add-toggle]').click();
    box.querySelector('[data-fx-cat="Blur"]').click();
    box.querySelector('[data-fx-add="blur"]').click();
    expect(onChange.mock.calls.at(-1)[0].map((e) => e.id)).toEqual(['blur']);
    const radius = box.querySelector('[data-key="radius"]');
    radius.value = '40';
    radius.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0][0].params.radius).toBe(40);
    box.querySelector('[data-fx-add-toggle]').click();
    const search = box.querySelector('.fx-search');
    search.value = 'vign';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    box.querySelector('[data-fx-add="vignette"]').click();
    let stack = onChange.mock.calls.at(-1)[0];
    expect(stack.map((e) => e.id)).toEqual(['blur', 'vignette']);
    box.querySelector(`[data-fx-up="${stack[1].uid}"]`).click();
    stack = onChange.mock.calls.at(-1)[0];
    expect(stack.map((e) => e.id)).toEqual(['vignette', 'blur']);
    const toggle = box.querySelector(`[data-fx-toggle="${stack[1].uid}"]`);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0][1].enabled).toBe(false);
    box.querySelector(`[data-fx-remove="${stack[0].uid}"]`).click();
    expect(onChange.mock.calls.at(-1)[0].map((e) => e.id)).toEqual(['blur']);
  });
});

describe('Video Transitions picker', () => {
  it('lists Remotion transitions first and labels the rest with their export', () => {
    expect(VIDEO_TRANSITION_OPTIONS.slice(0, 3).map(([, l]) => l)).toEqual(['Fade (Remotion)', 'Wipe ← (Remotion)', 'Wipe → (Remotion)']);
    expect(VIDEO_TRANSITION_OPTIONS.length).toBe(125);
    expect(VIDEO_TRANSITION_OPTIONS.find(([v]) => v === 'crosswarp')[1]).toMatch(/exports as Fade/);
    expect(VIDEO_TRANSITION_OPTIONS.find(([v]) => v === 'windowblinds')[1]).toMatch(/exports as Wipe/);
  });
});
