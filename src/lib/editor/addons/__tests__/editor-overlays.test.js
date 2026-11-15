import { describe, it, expect, vi } from 'vitest';
import '../index.js';
import {
  activeOverlays, buildOverlayElement, isEditorOverlay, getAddon, createAddonClip, renderAddonEditor,
  studioDesignFields, geometryFromPlacement, defaultStudioDesignOptions, addonOptions,
} from '../index.js';

const T = 20;
const asTrackClip = (clip, start, end) => ({ ...clip, left: (start / T) * 100, width: ((end - start) / T) * 100 });
const design = {
  id: 'promo-cta', name: 'Promo CTA',
  textSlots: [{ key: 'title', field: 'headline', primary: true }, { key: 'buttonText', field: 'cta' }],
  placement: { x: 0.5, y: 0.8, scale: 0.4 },
};

describe('Hotspot and Studio design clips in the editor', () => {
  it('count as editor overlays, so they get a box you can select, drag and resize', () => {
    expect(isEditorOverlay(getAddon('addon-hotspot'))).toBe(true);
    expect(isEditorOverlay(getAddon('overlay-studio-design'))).toBe(true);
    expect(isEditorOverlay(getAddon('addon-pause'))).toBe(false); // other interactive addons are unchanged
    expect(isEditorOverlay(getAddon('lead-form'))).toBe(false);
    const hs = asTrackClip(createAddonClip('addon-hotspot', { startSec: 2, timelineSeconds: T }), 2, 8);
    const ds = asTrackClip({ ...createAddonClip('overlay-studio-design', { startSec: 4, timelineSeconds: T }), addon: defaultStudioDesignOptions(design) }, 4, 10);
    const pause = asTrackClip(createAddonClip('addon-pause', { startSec: 3, timelineSeconds: T }), 3, 4);
    const tracks = [{ items: [hs, ds, pause] }];
    expect(activeOverlays(tracks, 5, T).map((c) => c.type).sort()).toEqual(['addon-hotspot', 'overlay-studio-design']);
    expect(activeOverlays(tracks, 12, T)).toEqual([]);
  });

  it('draw a labelled box at the clip\'s geometry', () => {
    const hs = createAddonClip('addon-hotspot', { startSec: 0, timelineSeconds: T });
    hs.addon = { ...hs.addon, label: 'Book a demo', geometry: { left: 10, top: 20, width: 30, height: 25 } };
    const el = buildOverlayElement(hs, { editor: true });
    expect(el.classList.contains('addon-placeholder--hotspot')).toBe(true);
    expect(el.textContent).toContain('Book a demo');
    expect(el.style.left).toBe('10%');
    expect(el.style.height).toBe('25%');
    const jump = createAddonClip('addon-hotspot', { startSec: 0, timelineSeconds: T });
    jump.addon = { ...jump.addon, action: 'seek', seekTime: 12 };
    expect(buildOverlayElement(jump).textContent).toContain('Jump to 12s');
    const ds = createAddonClip('overlay-studio-design', { startSec: 0, timelineSeconds: T });
    ds.addon = defaultStudioDesignOptions(design);
    const box = buildOverlayElement(ds);
    expect(box.textContent).toContain('promo-cta');
  });

  it('a new design clip takes the size and place the Studio gives that design', () => {
    expect(geometryFromPlacement({ x: 0.5, y: 0.8, scale: 0.4 })).toEqual({ left: 30, top: 60, width: 40, height: 40 });
    expect(geometryFromPlacement({ x: 0.1, y: 0.1, scale: 0.5 })).toEqual({ left: 0, top: 0, width: 50, height: 50 }); // kept inside the frame
    expect(geometryFromPlacement(undefined)).toBeNull();
    expect(defaultStudioDesignOptions(design).geometry).toEqual({ left: 30, top: 60, width: 40, height: 40 });
    expect(defaultStudioDesignOptions({ id: 'x', textSlots: [] }).geometry).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });
});

describe('Studio design settings form', () => {
  it('has an input for every text slot, image and color the clip holds', () => {
    const keys = studioDesignFields(defaultStudioDesignOptions(design)).map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['slots.title', 'slots.buttonText', 'media.logo', 'media.product', 'colors.primary', 'colors.accent', 'colors.text', 'opacity']));
  });

  it('editing a field changes that slot, color or image on the clip', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const onChange = vi.fn();
    const clip = { ...createAddonClip('overlay-studio-design', { startSec: 0, timelineSeconds: T }), addon: defaultStudioDesignOptions(design) };
    const addon = getAddon('overlay-studio-design');
    renderAddonEditor(box, { fields: addon.fields, fieldsFor: (o) => addon.fieldsFor(o), options: addonOptions(clip), onChange });
    const title = box.querySelector('[data-key="slots.title"]');
    expect(title.value).toBe('{{ctaHeadline}}');
    title.value = 'Spring sale — {{firstName}}';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ slots: expect.objectContaining({ title: 'Spring sale — {{firstName}}', buttonText: '{{callToAction}}' }) }), expect.anything());
    const primary = box.querySelector('[data-key="colors.primary"]');
    primary.value = '#ff0066';
    primary.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange.mock.lastCall[0].colors.primary).toBe('#ff0066');
    const logo = box.querySelector('[data-key="media.logo"]');
    logo.value = 'https://cdn.test/logo.png';
    logo.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange.mock.lastCall[0].media.logo).toBe('https://cdn.test/logo.png');
  });
});
