import { describe, it, expect, vi } from 'vitest';
import {
  OVERLAY_ADDONS, getAddon, createAddonClip, addonOptions, applyPositionPreset,
  buildOverlayElement, activeOverlays, resolveOverlayText, sanitizeWrapperStyles, safeHref, safeImageUrl,
  dragGeometry, clampGeometry, renderAddonEditor, OVERLAY_FONTS, OVERLAY_ANIMATIONS, BLEND_MODES, STICKER_LIBRARY,
  playOutAndRemove,
} from '../index.js';

const T = 60;
const onTrack = (clip, start, end) => ({ ...clip, left: (start / T) * 100, width: ((end - start) / T) * 100 });

describe('overlay registry (upstream toolbar)', () => {
  it('lists BASIC then CREATIVE entries with upstream labels and icons', () => {
    expect(OVERLAY_ADDONS.map((a) => [a.label, a.section])).toEqual([
      ['Smart Text', 'Basic'], ['Text Mask', 'Basic'], ['Personalized Image', 'Basic'],
      ['Image', 'Basic'], ['Stickers', 'Basic'], ['Wrapper', 'Creative'],
    ]);
    expect(OVERLAY_ADDONS.map((a) => a.iconSrc.split('/').pop())).toEqual([
      'vrText.svg', 'textMask.svg', 'vrImage.svg', 'image.svg', 'stickers.svg', 'background.svg',
    ]);
    OVERLAY_ADDONS.forEach((a) => expect(a.category).toBe('overlay'));
  });

  it('uses upstream defaults', () => {
    const text = getAddon('overlay-text').defaults();
    expect(text).toMatchObject({
      text: 'Enter Text Here', fontFamily: 'Anton', fontColor: '#FFFFFF', fontSize: 8,
      fontDecorations: { bold: false, italics: false, responsive: true },
      shadowColor: '#444444', strokeColor: '#000000', backgroundColor: '#888888', linkTarget: '_blank',
      geometry: { left: 39, top: 42, width: 22, height: 10 },
    });
    expect(getAddon('overlay-text-mask').defaults()).toMatchObject({ text: 'Video Mask', fontFamily: 'Bowlby One SC', backgroundColor: '#000000' });
    expect(getAddon('overlay-background').defaults().background).toBe('#888888');
    expect(getAddon('overlay-sticker').defaults().geometry).toMatchObject({ width: 30, height: 30 });
    expect(getAddon('overlay-image').defaults()).toMatchObject({ transition: 'popcorn-fade', geometry: { left: 0, top: 0, width: 100, height: 100 } });
    expect(getAddon('overlay-personalized-image').defaults().src).toBe('{{image}}');
  });

  it('ships upstream data lists', () => {
    expect(OVERLAY_FONTS.length).toBeGreaterThan(100);
    expect(OVERLAY_FONTS).toEqual(expect.arrayContaining(['Anton', 'Bowlby One SC', 'Raleway']));
    expect(OVERLAY_ANIMATIONS.in.length).toBe(33);
    expect(OVERLAY_ANIMATIONS.idle.length).toBe(11);
    expect(OVERLAY_ANIMATIONS.out.length).toBe(33);
    expect(BLEND_MODES[0]).toEqual(['normal', 'No blend']);
    expect(STICKER_LIBRARY.emoticons.length).toBeGreaterThan(50);
    expect(STICKER_LIBRARY.shapes.length).toBeGreaterThan(10);
  });

  it('Smart Text position presets use upstream 3% padding', () => {
    const o = { geometry: { left: 39, top: 42, width: 22, height: 10 } };
    expect(applyPositionPreset(o, 'left').geometry.left).toBe(3);
    expect(applyPositionPreset(o, 'right').geometry.left).toBe(75);
    expect(applyPositionPreset(o, 'bottom').geometry.top).toBe(87);
    expect(applyPositionPreset(o, 'middle').geometry.top).toBe(45);
  });

  it('Personalized Image shape resizes like upstream (portrait 50 / circle 28)', () => {
    const d = getAddon('overlay-personalized-image');
    const circle = d.onFieldChange('imageshape', { ...d.defaults(), imageshape: 'circle' });
    expect(circle.geometry.width).toBe(28);
    expect(circle.cornerRadius).toBe(50);
  });
});

describe('tokens and safety', () => {
  const profile = { id: 'p', variables: { firstName: 'Ann', company: 'Acme' } };
  it('resolves upstream token forms', () => {
    expect(resolveOverlayText('Hi {{firstname}} from {{company}}', profile)).toBe('Hi Ann from Acme');
    expect(resolveOverlayText('{{up firstname}}', profile)).toBe('ANN');
    expect(resolveOverlayText('{{d lastname "Friend"}}', profile)).toBe('Friend');
    expect(resolveOverlayText('Hi {{firstname}}', null)).toBe('Hi {{firstname}}');
  });

  it('links: http(s) and phone only', () => {
    expect(safeHref('example.com')).toBe('https://example.com/');
    expect(safeHref('+1 555 123 4567')).toBe('tel:+15551234567');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('/assets/sticker/x.svg')).toBe('/assets/sticker/x.svg');
    expect(safeImageUrl('javascript:x')).toBeNull();
  });

  it('Wrapper styles keep visual CSS only', () => {
    expect(sanitizeWrapperStyles('border: 10px solid #fff; position: fixed; top: 0; background: url(javascript:x); box-shadow: inset 0 0 40px #000; background-image: url(https://x.test/a.png)'))
      .toEqual({ border: '10px solid #fff', 'box-shadow': 'inset 0 0 40px #000', 'background-image': 'url(https://x.test/a.png)' });
  });
});

describe('overlay DOM (upstream markup)', () => {
  const make = (type, extra = {}) => ({ ...createAddonClip(type, { startSec: 0, timelineSeconds: T, id: `c-${type}` }), ...extra });

  it('Smart Text: .popcorn-text > .text-inner-div > div > span, link wrapped', () => {
    const clip = make('overlay-text');
    clip.addon = { ...clip.addon, text: 'Hello {{firstname}}', linkUrl: 'example.com', shadow: true, background: true };
    const el = buildOverlayElement(clip, { profile: { variables: { firstName: 'Zoe' } }, editor: true });
    expect(el.classList.contains('popcorn-text')).toBe(true);
    expect(el.dataset.overlay).toBe('overlay-clip');
    const span = el.querySelector('.text-inner-div > div > a > span.personalizer-input');
    expect(span.textContent).toBe('Hello Zoe');
    expect(el.querySelector('a').target).toBe('_blank');
    expect(el.style.left).toBe('39%');
    expect(el.style.background).toContain('136');
    expect(el.querySelector('.text-inner-div').style.textShadow).toMatch(/#444444|68, 68, 68/);
  });

  it('Image: .popcorn-image > .image-plugin-link > .image-plugin-img, fill forces full frame', () => {
    const clip = make('overlay-image');
    clip.addon = { ...clip.addon, src: 'https://x.test/a.png', fill: true, cornerRadius: true, geometry: { left: 10, top: 10, width: 20, height: 20 } };
    const el = buildOverlayElement(clip);
    const img = el.querySelector('.image-plugin-link > .image-plugin-img');
    expect(img.style.backgroundImage).toContain('https://x.test/a.png');
    expect(img.style.backgroundSize).toBe('cover');
    expect(el.querySelector('.image-plugin-link').style.borderRadius).toBe('50%');
    expect(el.style.width).toBe('100%');
    expect(el.classList.contains('popcorn-fade')).toBe(true);
  });

  it('Personalized Image falls back to the placeholder', () => {
    const el = buildOverlayElement(make('overlay-personalized-image'));
    expect(el.classList.contains('personalized-image')).toBe(true);
    expect(el.querySelector('.image-plugin-img').style.backgroundImage).toContain('personalized-image-placeholder.svg');
  });

  it('Text Mask: SVG mask knocks the text out of a full-frame colour', () => {
    const el = buildOverlayElement(make('overlay-text-mask'));
    const svg = el.querySelector('svg.knockout__svg');
    const mask = svg.querySelector('mask');
    expect(mask.querySelector('rect').getAttribute('fill')).toBe('white');
    expect(mask.querySelector('text').textContent).toBe('Video Mask');
    expect(mask.querySelector('text').getAttribute('fill')).toBe('#000');
    const fill = svg.querySelector(':scope > rect');
    expect(fill.getAttribute('mask')).toBe(`url(#${mask.id})`);
    expect(el.style.width).toBe('100%');
  });

  it('Wrapper and Sticker', () => {
    const wrapper = make('overlay-background');
    wrapper.addon.styles = 'border: 8px solid red';
    const w = buildOverlayElement(wrapper);
    expect(w.classList.contains('popcorn-background')).toBe(true);
    expect(w.style.border).toContain('8px');
    const st = make('overlay-sticker');
    st.addon.src = '/assets/sticker/emoji_ape.png';
    expect(buildOverlayElement(st).querySelector('img').getAttribute('src')).toBe('/assets/sticker/emoji_ape.png');
    st.addon = { ...st.addon, kind: 'lottie', src: 'https://x.test/a.json' };
    expect(buildOverlayElement(st).dataset.lottie).toBe('https://x.test/a.json');
  });

  it('out animation removes the element', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const p = playOutAndRemove(el, { out: 'fadeOut' });
    expect(el.classList.contains('fadeOut')).toBe(true);
    el.dispatchEvent(new Event('animationend'));
    await p;
    expect(el.isConnected).toBe(false);
  });
});

describe('compositing and handles', () => {
  it('activeOverlays returns overlays under the playhead in paint order', () => {
    const tracks = [
      { items: [onTrack({ id: 'v', type: 'video' }, 0, 30), onTrack({ id: 'txt', type: 'overlay-text' }, 5, 10)] },
      { items: [onTrack({ id: 'wrap', type: 'overlay-background' }, 0, 20), onTrack({ id: 'pause', type: 'addon-pause' }, 6, 7)] },
    ];
    expect(activeOverlays(tracks, 6, T).map((c) => c.id)).toEqual(['txt', 'wrap']);
    expect(activeOverlays(tracks, 12, T).map((c) => c.id)).toEqual(['wrap']);
    expect(activeOverlays(tracks, 25, T)).toEqual([]);
  });

  it('drag math clamps to the stage and keeps ratio when asked', () => {
    expect(dragGeometry({ left: 10, top: 10, width: 20, height: 20 }, 'move', 90, 0)).toMatchObject({ left: 80 });
    const se = dragGeometry({ left: 10, top: 10, width: 20, height: 20 }, 'se', 10, 0, { preserveRatio: true, stageAspect: 1 });
    expect(se.width).toBeCloseTo(30);
    expect(se.height).toBeCloseTo(30);
    const nw = dragGeometry({ left: 10, top: 10, width: 20, height: 20 }, 'nw', 5, 5);
    expect(nw).toMatchObject({ left: 15, top: 15, width: 15, height: 15 });
    expect(clampGeometry({ left: -5, top: 95, width: 20, height: 20 })).toMatchObject({ left: 0, top: 80 });
  });
});

describe('overlay settings form', () => {
  const services = {
    tokens: [['firstName', 'First Name']],
    stickers: { emoticons: [{ name: 'ape', src: '/assets/sticker/emoji_ape.png' }], shapes: [] },
    mediaImages: () => [{ name: 'Logo', src: 'https://x.test/logo.png' }],
  };

  it('Smart Text: tabs, token insert and position presets', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const onChange = vi.fn();
    const d = getAddon('overlay-text');
    renderAddonEditor(box, { fields: d.fields, options: d.defaults(), onChange, services, onFieldChange: d.onFieldChange });
    expect([...box.querySelectorAll('[data-addon-tab]')].map((b) => b.textContent)).toEqual(['Basic', 'Advanced']);
    const ta = box.querySelector('textarea[data-key="text"]');
    ta.setSelectionRange(0, 0);
    const insert = box.querySelector('.addon-token-insert');
    insert.value = 'firstName';
    insert.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0].text).toBe('{{firstName}}Enter Text Here');
    box.querySelector('[data-position-value="right"]').click();
    expect(onChange.mock.calls.at(-1)[0].geometry.left).toBe(75);
    box.querySelector('[data-addon-tab="Advanced"]').click();
    expect(box.querySelector('select.addon-font-select').value).toBe('Anton');
  });

  it('Stickers picker sets src/kind/name; animated tab takes a Lottie URL', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const onChange = vi.fn();
    const d = getAddon('overlay-sticker');
    renderAddonEditor(box, { fields: d.fields, options: d.defaults(), onChange, services });
    box.querySelector('[data-sticker-src]').click();
    expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ src: '/assets/sticker/emoji_ape.png', kind: 'image', name: 'ape' });
    box.querySelector('[data-sticker-tab="animated"]').click();
    box.querySelector('.addon-lottie-url').value = 'https://x.test/party.json';
    box.querySelector('[data-lottie-use]').click();
    expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ src: 'https://x.test/party.json', kind: 'lottie', name: 'party' });
  });

  it('Image picker lists media library images and animations accept None', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const onChange = vi.fn();
    const d = getAddon('overlay-image');
    renderAddonEditor(box, { fields: d.fields, options: d.defaults(), onChange, services });
    box.querySelector('[data-image-pick]').click();
    expect(onChange.mock.calls.at(-1)[0].src).toBe('https://x.test/logo.png');
    const inSel = box.querySelector('select[data-key="animation.in"]');
    inSel.value = 'fadeIn';
    inSel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0].animation.in).toBe('fadeIn');
    const again = box.querySelector('select[data-key="animation.in"]');
    again.value = '';
    again.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0].animation.in).toBeNull();
    expect(addonOptions({ type: 'overlay-image', addon: { src: 'x' } }).transition).toBe('popcorn-fade');
  });
});
