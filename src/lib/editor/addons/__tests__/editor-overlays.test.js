import { describe, it, expect, vi } from 'vitest';
import '../index.js';
import {
  activeOverlays, buildOverlayElement, isEditorOverlay, getAddon, createAddonClip, renderAddonEditor,
  studioDesignFields, switchDesignOptions, geometryFromPlacement, defaultStudioDesignOptions, addonOptions,
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
    expect(el.textContent).toContain('not visible in the video'); // says what it is and that viewers see nothing
    expect(el.textContent).toContain('opens');
    expect(buildOverlayElement(jump).textContent).toContain('jumps to 0:12');
    const tel = createAddonClip('addon-hotspot', { startSec: 0, timelineSeconds: T });
    tel.addon = { ...tel.addon, linkMode: 'phone', phoneNumber: '555 0100' };
    expect(buildOverlayElement(tel).textContent).toContain('calls 555 0100');
  });

  it('a design box names the design and shows the text it will say for the selected contact', () => {
    const ds = createAddonClip('overlay-studio-design', { startSec: 0, timelineSeconds: T });
    ds.addon = defaultStudioDesignOptions(design);
    const ann = { id: 'c-ann', contact: { name: 'Ann' }, variables: {}, personalization: { business: { ctaHeadline: 'Spring roof check', callToAction: 'Book now' } } };
    const box = buildOverlayElement(ds, { profile: ann });
    expect(box.querySelector('.addon-placeholder__tag strong').textContent).toBe('🎨 Promo CTA · Spring roof check');
    expect(box.querySelector('.addon-placeholder__preview').textContent).toBe('Spring roof check · Book now'); // text preview for when the player is off
    const none = buildOverlayElement(ds, {});
    expect(none.textContent).toContain('Pick a contact to preview their details');
    // an older clip without a stored name falls back to the id, tidied
    const old = { ...ds, addon: { ...ds.addon, designName: undefined } };
    expect(buildOverlayElement(old, {}).querySelector('strong').textContent).toContain('Promo cta');
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

  it('offers a named design picker once the catalog is loaded, with the design\'s description', () => {
    const designs = [{ id: 'promo-cta', name: 'Promo CTA', category: 'promo-cta', description: 'A bold call to action.' }, { id: 'logo-reveal', name: 'Logo Reveal', category: 'logo-reveal', description: '' }];
    const fields = studioDesignFields(defaultStudioDesignOptions(design), { designs });
    const pick = fields.find((f) => f.key === 'designId');
    expect(pick.type).toBe('select');
    expect(pick.options).toEqual([['promo-cta', 'Promo CTA — promo-cta'], ['logo-reveal', 'Logo Reveal — logo-reveal']]);
    expect(fields.find((f) => f.type === 'note').text).toBe('A bold call to action.');
    expect(studioDesignFields(defaultStudioDesignOptions(design)).find((f) => f.key === 'designId').type).toBe('text'); // catalog not loaded yet
  });

  it('switching design resets the text but keeps the place, size and opacity', () => {
    const prev = { ...defaultStudioDesignOptions(design), geometry: { left: 5, top: 6, width: 40, height: 30 }, opacity: 70, slots: { title: 'My own words' }, media: { logo: 'https://cdn.test/l.png', product: '{{productImageUrl}}', service: '{{productImageUrl}}' } };
    const next = switchDesignOptions(prev, { id: 'logo-reveal', name: 'Logo Reveal', textSlots: [{ key: 'name', field: 'businessName', primary: true }] });
    expect(next).toMatchObject({ designId: 'logo-reveal', designName: 'Logo Reveal', primarySlot: 'name', slots: { name: '{{businessName}}' }, geometry: prev.geometry, opacity: 70 });
    expect(next.media.logo).toBe('https://cdn.test/l.png'); // an image the user chose stays
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
