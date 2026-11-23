import { describe, it, expect } from 'vitest';
import appsMap from '../data/muapiStudioAppsMap.json';
import prompts from '../data/muapiAppPrompts.json';
import {
  EDIT_APPS, SKIPPED_APPS, APP_CATEGORY_ORDER, getEditAppBySlug, getEditAppGroups, buildAppPrompt, splitAppControlValues,
} from '../lib/muapiEditApps.js';
import { EDIT_TOOLS } from '../components/EditStudio.js';
import { t2iModels, i2iModels, t2vModels, i2vModels, v2vModels } from '../lib/models.js';

const catalogIds = new Set([t2iModels, i2iModels, t2vModels, i2vModels, v2vModels].flat().map((m) => m.id));
const app = (id) => EDIT_APPS.find((a) => a.appId === id);

describe('muapi apps for the Edit Studio', () => {
  it('adds every app except the ones already in this repo, and drops none of the 16 tools', () => {
    expect(EDIT_TOOLS).toHaveLength(16);
    expect(EDIT_APPS.length + SKIPPED_APPS.length).toBe(78);
    expect(SKIPPED_APPS.map((s) => s.id).sort()).toEqual(['bullet-time-scene', 'expand-image', 'face-swap', 'recast', 'relight', 'skin-enhancer']);
    // Apps that only exist in OpenHiggsBolt are still added here.
    for (const id of ['angles', 'color-grading', 'video-face-swap']) expect(app(id), id).toBeTruthy();
  });

  it('uses slugs that cannot collide with the built-in tools', () => {
    const toolSlugs = new Set(EDIT_TOOLS.map((t) => t.slug));
    const slugs = EDIT_APPS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    slugs.forEach((s) => { expect(s.startsWith('app-')).toBe(true); expect(toolSlugs.has(s)).toBe(false); });
    expect(getEditAppBySlug('app-angles')?.name).toBe('Angles');
    expect(getEditAppBySlug('face-swap')).toBeNull();
  });

  it('groups apps in muapi tab order with real thumbnails', () => {
    const keys = getEditAppGroups().map((g) => g.key);
    expect(keys).toEqual(APP_CATEGORY_ORDER);
    for (const a of EDIT_APPS) expect(a.thumbnail, a.id).toBe(`/thumbnails/muapi-apps/${a.appId}.webp`);
  });

  it('points every app at a real catalog model and the right route', () => {
    for (const a of EDIT_APPS) {
      expect(catalogIds.has(a.model), `${a.id} -> ${a.model}`).toBe(true);
      expect(['i2i', 'i2v', 'v2v']).toContain(a.route);
      expect(a.outputKind).toBe(a.route === 'i2i' ? 'image' : 'video');
    }
    expect(app('angles').route).toBe('i2i');
    expect(app('mukbang').route).toBe('i2v');
    expect(app('video-face-swap').route).toBe('v2v');
    expect(app('video-bg-remover').route).toBe('v2v');
  });

  it('describes each app\'s media inputs', () => {
    expect(app('mukbang').primary).toMatchObject({ type: 'image', param: 'image_url', required: true });
    expect(app('mukbang').secondary).toBeNull();
    expect(app('clipcut').secondary).toMatchObject({ type: 'frame', param: 'last_image_url', required: false });
    expect(app('video-face-swap').secondary).toMatchObject({ type: 'video', param: 'video_url', required: true });
    expect(app('video-bg-remover').primary).toMatchObject({ type: 'video', param: 'video_url' });
  });

  it('carries muapi\'s advanced controls: presets, sliders, selects', () => {
    const angles = app('angles');
    const kinds = angles.controls.map((c) => `${c.type}:${c.key}`);
    expect(kinds).toEqual(expect.arrayContaining(['preset:style_preset', 'range:adj_rotation', 'range:adj_tilt', 'range:adj_zoom', 'select:aspect_ratio', 'select:resolution']));
    expect(angles.controls.find((c) => c.key === 'style_preset').options[0]).toBe('Custom');
    expect(angles.presetValues['Right 45° Front-Quarter']).toEqual({ rotation: 45, tilt: 0, zoom: 0 });
    const grading = app('color-grading');
    expect(grading.controls.filter((c) => c.type === 'range')).toHaveLength(7);
    // A style-only app starts on its first style and has no 'Custom'.
    const hs = app('headshot-generator').controls.find((c) => c.type === 'preset');
    expect(hs.options).not.toContain('Custom');
    expect(hs.default).toBe(hs.options[0]);
    expect(app('mukbang').controls.find((c) => c.key === 'duration').optionLabel(5)).toBe('5s');
  });

  it('builds the prompt from the base text, preset, moved sliders and the user\'s words', () => {
    const p = buildAppPrompt(app('angles'), { style_preset: 'Right 45° Front-Quarter', adjustments: { rotation: 45, tilt: 0, zoom: 20 }, extra: 'a red car' });
    expect(p).toContain('three-quarter view from the right');
    expect(p).toContain('camera rotated 45 degrees');
    expect(p).toContain('zoom adjusted by 20');
    expect(p).not.toMatch(/tilted/); // tilt stayed at its default
    expect(p).toContain('a red car');
    expect(p).not.toContain('{prompt}');
    // Untouched controls give the clean base prompt.
    const plain = buildAppPrompt(app('mukbang'), {});
    expect(plain).toBe(prompts.apps.mukbang.replace(/\s*\{prompt\}/, '').trim());
    expect(plain).not.toMatch(/\s{2,}/);
    expect(plain.endsWith('.')).toBe(true);
  });

  it('keeps virtual control keys out of the request params', () => {
    const { style_preset, adjustments, params } = splitAppControlValues({ style_preset: 'Moody', adj_zoom: 10, aspect_ratio: '16:9', duration: 5 });
    expect(style_preset).toBe('Moody');
    expect(adjustments).toEqual({ zoom: 10 });
    expect(params).toEqual({ aspect_ratio: '16:9', duration: 5 });
  });

  it('every preset app has an original prompt and phrases for all its presets', () => {
    for (const a of EDIT_APPS.filter((x) => x.status === 'preset')) expect(prompts.apps[a.appId], a.appId).toBeTruthy();
    for (const a of appsMap.apps.filter((x) => x.studio.presets.length && EDIT_APPS.some((e) => e.appId === x.id))) {
      a.studio.presets.forEach((p) => expect(prompts.presets[a.id]?.[p.label], `${a.id}/${p.label}`).toBeTruthy());
    }
  });
});
