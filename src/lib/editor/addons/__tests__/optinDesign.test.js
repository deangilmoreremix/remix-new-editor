import { describe, it, expect, vi } from 'vitest';
import {
  defaultOptin, buildOptinForm, buildArrowHint, showOptinOverlay, backdropStyle, renderAddonEditor, listBuilderFields,
  POINTER_DESIGNS, POINTER_THEMES, pointerSvg,
  POINTER_MOTIONS, TARGET_MOTIONS, HINT_STYLES, startPointer,
} from '../index.js';

describe('pointer designs', () => {
  it('ships several designs, each recolourable, plus "none"', () => {
    expect(POINTER_DESIGNS.length).toBeGreaterThanOrEqual(20);
    expect(POINTER_THEMES.length).toBeGreaterThanOrEqual(10);
    for (const d of POINTER_DESIGNS.filter((x) => x.id !== 'none' && x.cursor !== false)) {
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

describe('pointer motions and click demos (ported from Remotion ScreenshotScene + HyperFrames physics-press-reaction)', () => {
  it('has arrow motions, click-demo motions and bubble styles', () => {
    expect(POINTER_MOTIONS.map(([id]) => id)).toEqual(expect.arrayContaining(['nudge', 'bounce', 'pulse', 'wiggle', 'float', 'draw', 'ping', 'none']));
    expect(TARGET_MOTIONS.map(([id]) => id)).toEqual(expect.arrayContaining(['travel-click', 'tap', 'hover']));
    expect(HINT_STYLES.length).toBeGreaterThanOrEqual(7);
  });

  it('applies the motion, bubble style and dim to the hint; mismatched motions fall back', () => {
    const hint = buildArrowHint({ ...defaultOptin(), pointerStyle: 'sketch', pointerMotion: 'draw', hintStyle: 'neon', hintDim: 30 });
    expect(hint.classList.contains('pt-motion-draw')).toBe(true);
    expect(hint.classList.contains('pt-style-neon')).toBe(true);
    expect(hint.style.backgroundColor).toContain('0.3');
    expect(hint.querySelector('.pt-stroke')).not.toBeNull(); // stroke can draw itself
    // a click-demo motion on an arrow design is not valid: falls back to nudge
    expect(buildArrowHint({ ...defaultOptin(), pointerStyle: 'curly', pointerMotion: 'travel-click' }).dataset.motion).toBe('nudge');
    // an arrow motion on a click demo falls back to travel-click
    expect(buildArrowHint({ ...defaultOptin(), pointerStyle: 'click-cursor', pointerMotion: 'bounce' }).dataset.motion).toBe('travel-click');
    expect(buildArrowHint({ ...defaultOptin(), pointerMotion: 'ping' }).querySelector('.pt-ping')).not.toBeNull();
  });

  it('click demos sit on the Play button instead of a corner arrow', () => {
    const hint = buildArrowHint({ ...defaultOptin(), pointerStyle: 'click-hand' });
    expect(hint.classList.contains('pt-target-mode')).toBe(true);
    expect(hint.querySelector('.pointer-target .pointer-cursor')).not.toBeNull();
    expect(hint.querySelector('.arrow-image')).toBeNull();
    expect(buildArrowHint({ ...defaultOptin(), pointerStyle: 'ripple' }).querySelector('.pointer-cursor')).toBeNull();
  });

  it('travel-click: cursor travels in, cursor AND button press to 0.9 together, ripple 10 -> 80px', () => {
    const cfg = { ...defaultOptin(), pointerStyle: 'click-cursor', pointerMotion: 'travel-click' };
    const form = buildOptinForm(cfg);
    const hint = buildArrowHint(cfg);
    const wrap = document.createElement('div');
    wrap.append(form, hint);
    document.body.append(wrap);
    const button = form.querySelector('.buttons-inner button');
    const rect = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h });
    hint.getBoundingClientRect = () => rect(0, 0, 1000, 600);
    button.getBoundingClientRect = () => rect(700, 300, 120, 40);
    const calls = [];
    Element.prototype.animate = vi.fn(function animate(frames, opts) { calls.push({ el: this, frames, opts }); return { cancel: vi.fn() }; });
    const stop = startPointer(hint, form, cfg);
    const holder = hint.querySelector('.pointer-target');
    // tip lands on the button centre (760, 320)
    const [tx, ty] = holder.dataset.tip.split(',').map(Number);
    const size = parseFloat(holder.style.width);
    expect(parseFloat(holder.style.left) + size * tx).toBeCloseTo(760, 0);
    expect(parseFloat(holder.style.top) + size * ty).toBeCloseTo(320, 0);
    const byEl = (el) => calls.find((c) => c.el === el);
    const cursorFrames = byEl(hint.querySelector('.pointer-cursor')).frames;
    expect(cursorFrames[0].opacity).toBe(0); // hard-cut in from off-screen
    expect(cursorFrames.some((f) => f.transform.includes('scale(0.9)'))).toBe(true);
    const buttonFrames = byEl(button).frames;
    expect(buttonFrames.some((f) => f.transform === 'scale(0.9)')).toBe(true);
    const ringFrames = byEl(hint.querySelector('.pointer-ring')).frames;
    expect(ringFrames.some((f) => f.opacity === 0.85)).toBe(true);
    expect(ringFrames.some((f) => f.transform.includes('scale(8)'))).toBe(true); // 10px -> 80px
    expect(byEl(button).opts.iterations).toBe(Infinity);
    stop();
    wrap.remove();
    delete Element.prototype.animate;
  });

  it('settings: grouped design picker, motion list follows the design, one-click motion change', () => {
    const box = document.createElement('div');
    const seen = [];
    renderAddonEditor(box, { options: defaultOptin(), fieldsFor: listBuilderFields, idPrefix: 'm', onChange: (o) => seen.push(o) });
    box.querySelector('[data-addon-tab="Pointer"]').click();
    expect(box.querySelectorAll('.addon-designs__heading').length).toBe(2);
    expect([...box.querySelectorAll('select[data-key="pointerMotion"] option')].map((o) => o.value)).toContain('bounce');
    box.querySelector('[data-design-pick="click-cursor"]').click();
    box.querySelector('[data-addon-tab="Pointer"]')?.click();
    expect([...box.querySelectorAll('select[data-key="pointerMotion"] option')].map((o) => o.value)).toContain('travel-click');
    expect(seen.at(-1).pointerStyle).toBe('click-cursor');
  });
});

describe('editable text', () => {
  it('the Text tab comes first and holds all the copy, incl. the bubble lines', () => {
    const f = listBuilderFields(defaultOptin('list-builder'));
    expect([...new Set(f.map((x) => x.tab))][0]).toBe('Text');
    const textKeys = f.filter((x) => x.tab === 'Text').map((x) => x.key);
    expect(textKeys).toEqual(expect.arrayContaining(['caption', 'btnText', 'skipText', 'successMessage', 'privacyDisclaimer', 'popupHeaderText', 'popupFillOutText', 'popupClickText', 'popupDescriptionText']));
    // a Personalizer has no privacy text
    expect(listBuilderFields(defaultOptin('personalizer')).find((x) => x.key === 'privacyDisclaimer').showIf()).toBe(false);
  });

  it('box hint text can differ from the label (and falls back to it)', () => {
    const form = buildOptinForm({ ...defaultOptin(), elements: [{ id: 0, label: 'Email', token: 'EMAIL', type: 'email', placeholder: 'you@company.com' }, { id: 1, label: 'Name', token: 'NAME', type: 'singleline' }] });
    expect(form.querySelector('[name="EMAIL"]').placeholder).toBe('you@company.com');
    expect(form.querySelector('[name="NAME"]').placeholder.trim()).toBe('Name');
  });

  it('text styling options reach the caption and the Play button', () => {
    const form = buildOptinForm({ ...defaultOptin(), captionColor: '#ffcc00', captionBold: false, buttonFontWeight: '800', buttonFontSize: 150, fontSize: 60, skipText: 'Not now', enableSkipButton: true });
    expect(form.querySelector('.retarget-caption').style.color).toBe('rgb(255, 204, 0)');
    expect(form.querySelector('.retarget-caption').style.fontWeight).toBe('400');
    const btn = form.querySelector('.buttons-inner button');
    expect(btn.style.fontWeight).toBe('800');
    expect(btn.style.fontSize).toBe('90%');
    expect(form.querySelector('.skip-button').textContent).toBe('Not now');
  });

  it('click-to-edit: click the caption / Play / bubble text, type, Enter keeps it, Esc cancels', async () => {
    const layer = document.createElement('div');
    document.body.append(layer);
    const edits = [];
    showOptinOverlay(layer, defaultOptin('list-builder'), { preview: true, onEditText: (k, v) => edits.push([k, v]) });
    const click = (sel) => layer.querySelector(sel).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const type = (value, key) => {
      const box = layer.querySelector('.optin-text-edit');
      box.value = value;
      box.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    click('.retarget-caption');
    expect(layer.querySelector('.optin-text-edit')).not.toBeNull();
    type('Join the club', 'Enter');
    click('.buttons-inner button'); // the Play button edits its text instead of submitting
    expect(layer.querySelector('.optin-text-edit').value).toBe('Play');
    type('Watch now', 'Enter');
    click('.title-hint'); // bubble text, even with the pointer on top
    type('Never saved', 'Escape');
    click('.title-hint');
    type('Your video, your way', 'Enter');
    expect(edits).toEqual([['caption', 'Join the club'], ['btnText', 'Watch now'], ['popupHeaderText', 'Your video, your way']]);
    // a double-click on a box edits its hint text
    layer.querySelector('input[data-edit-key]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    type('name@company.com', 'Enter');
    expect(edits.at(-1)).toEqual(['elements.0.placeholder', 'name@company.com']);
    layer.remove();
  });

  it('click-to-edit is off while playing (no preview) and without a handler', () => {
    const layer = document.createElement('div');
    showOptinOverlay(layer, defaultOptin(), { preview: false, onEditText: () => {} });
    layer.querySelector('.retarget-caption').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(layer.querySelector('.optin-text-edit')).toBeNull();
    const l2 = document.createElement('div');
    showOptinOverlay(l2, defaultOptin(), { preview: true });
    l2.querySelector('.retarget-caption').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(l2.querySelector('.optin-text-edit')).toBeNull();
  });
});
