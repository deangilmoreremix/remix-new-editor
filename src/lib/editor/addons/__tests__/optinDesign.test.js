import { describe, it, expect, vi } from 'vitest';
import {
  defaultOptin, buildOptinForm, buildArrowHint, showOptinOverlay, backdropStyle, renderAddonEditor, listBuilderFields,
  POINTER_DESIGNS, POINTER_THEMES, pointerSvg,
} from '../index.js';

describe('pointer designs', () => {
  it('ships several designs, each recolourable, plus "none"', () => {
    expect(POINTER_DESIGNS.length).toBeGreaterThanOrEqual(8);
    for (const d of POINTER_DESIGNS.filter((x) => x.id !== 'none')) {
      expect(pointerSvg(d.id, '#12ab34')).toContain('#12ab34');
    }
    expect(pointerSvg('none', '#fff')).toBe('');
  });

  it('refuses markup in a colour', () => {
    expect(pointerSvg('curly', '"/><script>')).not.toContain('script');
  });

  it('hint uses the chosen design, colours, size and corner', () => {
    const hint = buildArrowHint({
      ...defaultOptin('list-builder'), pointerStyle: 'cursor', pointerColor: '#22d3ee', pointerSize: 150,
      hintBackground: '#06222b', hintBorderColor: '#22d3ee', hintTextColor: '#e6fbff', hintRadius: 4, hintPosition: 'top-left',
    });
    expect(hint.classList.contains('hint-pos-top-left')).toBe(true);
    expect(hint.classList.contains('pointer-animated')).toBe(true);
    expect(hint.dataset.pointer).toBe('cursor');
    expect(hint.style.getPropertyValue('--arrow-scale')).toBe('1.5');
    expect(hint.querySelector('.arrow-image').innerHTML).toContain('#22d3ee');
    const bubble = hint.querySelector('.container-hint');
    expect(bubble.style.borderRadius).toBe('4px');
    expect(bubble.style.color).toBe('rgb(230, 251, 255)');
  });

  it('can be switched off, or have no arrow but keep the bubble', () => {
    expect(buildArrowHint({ ...defaultOptin(), pointerEnabled: false })).toBeNull();
    const hint = buildArrowHint({ ...defaultOptin(), pointerStyle: 'none' });
    expect(hint.querySelector('.arrow-image')).toBeNull();
    expect(hint.querySelector('.container-hint')).not.toBeNull();
  });

  it('Lead Generator defaults to no pointer; List Builder to the classic one', () => {
    expect(defaultOptin('lead-generator').pointerEnabled).toBe(false);
    expect(defaultOptin('list-builder')).toMatchObject({ pointerEnabled: true, pointerStyle: 'curly', pointerColor: '#eb5054' });
  });
});

describe('everything is editable (one design for all kinds)', () => {
  it('Play button, inputs and backdrop follow the options', () => {
    const form = buildOptinForm({
      ...defaultOptin('list-builder'), buttonBackground: '#00aa00', buttonFontColor: '#000000', buttonBorderRadius: 20, btnText: 'Watch now',
      buttonHoverColor: '#008800', inputBackground: '#111111', inputFontColor: '#eeeeee', inputBorderColor: '#ff0000', inputBorderRadius: 12,
    });
    const btn = form.querySelector('.buttons-inner button');
    expect(btn.textContent).toBe('Watch now');
    expect(btn.style.background).toContain('rgb(0, 170, 0)');
    expect(btn.style.borderRadius).toBe('20px');
    expect(form.style.getPropertyValue('--optin-btn-hover')).toBe('#008800');
    const input = form.querySelector('input');
    expect(input.style.background).toContain('rgb(17, 17, 17)');
    expect(input.style.borderRadius).toBe('12px');
    expect(input.required).toBe(true); // List Builder fields are mandatory
  });

  it('a registration wall hides the video; editor preview stays see-through', () => {
    const lb = defaultOptin('list-builder');
    expect(lb.backdropOpacity).toBe(100);
    expect(backdropStyle(lb)).toMatch(/rgba\(62, 62, 81, 1\)/);
    expect(backdropStyle(lb, { preview: true })).toMatch(/0\.67/);
    expect(defaultOptin('lead-generator').backdropOpacity).toBe(67);
  });

  it('shows over the video, requires every field, and removes itself after a good submit', async () => {
    const layer = document.createElement('div');
    const onSubmit = vi.fn(async () => '');
    showOptinOverlay(layer, defaultOptin('list-builder'), { onSubmit });
    const form = layer.querySelector('form');
    form.querySelector('input').value = '   ';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(form.querySelector('.addon-optin__status').textContent).toMatch(/complete all fields/i);
    form.querySelector('input').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onSubmit).toHaveBeenCalledWith({ EMAIL: 'a@b.co' });
    expect(layer.querySelector('.addon-overlay--optin')).toBeNull();
  });

  it('pointer hides after hintDuration seconds', () => {
    vi.useFakeTimers();
    const layer = document.createElement('div');
    showOptinOverlay(layer, { ...defaultOptin(), hintDuration: 2 }, {});
    const hint = layer.querySelector('.overlay-arrow');
    expect(hint.classList.contains('on')).toBe(true);
    vi.advanceTimersByTime(2100);
    expect(hint.classList.contains('off')).toBe(true);
    vi.useRealTimers();
  });
});

describe('settings panel pickers', () => {
  it('picks an arrow design and a whole colour scheme with one click', () => {
    const box = document.createElement('div');
    const seen = [];
    renderAddonEditor(box, { options: defaultOptin(), fieldsFor: listBuilderFields, idPrefix: 't', onChange: (o) => seen.push(o) });
    box.querySelector('[data-addon-tab="Pointer"]').click();
    box.querySelector('[data-design-pick="cursor"]').click();
    expect(seen.at(-1).pointerStyle).toBe('cursor');
    box.querySelector('[data-addon-tab="Pointer"]')?.click();
    const cyan = POINTER_THEMES.find((t) => t.id === 'cyan');
    box.querySelector('[data-theme-pick="cyan"]').click();
    expect(seen.at(-1)).toMatchObject({ pointerColor: cyan.pointerColor, hintBackground: cyan.hintBackground, hintBorderColor: cyan.hintBorderColor });
  });
});
