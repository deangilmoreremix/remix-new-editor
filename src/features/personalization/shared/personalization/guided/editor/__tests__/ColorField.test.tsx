// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ColorField } from '../ColorField';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { try { window.localStorage.clear(); } catch { /* ignore */ } });

const BRAND = { primary: '#d9ff00', accent: '#28c98b', text: '#ffffff' };
const mounted: { root: ReturnType<typeof createRoot>; el: HTMLElement }[] = [];
const changes: string[] = [];

function Harness({ initial = '#ffffff' }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return <ColorField id="c" label="Color" ariaLabel="Text color" value={v} onChange={(h) => { changes.push(h); setV(h); }} brand={BRAND} />;
}
function mount(initial?: string) {
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el); mounted.push({ root, el });
  act(() => { root.render(<Harness initial={initial} />); });
  return el;
}
afterEach(() => { changes.length = 0; for (const { root, el } of mounted.splice(0)) { act(() => root.unmount()); el.remove(); } });

const q = (el: HTMLElement, sel: string) => el.querySelector(sel) as HTMLElement | null;
const click = (n: Element | null) => act(() => { (n as HTMLElement).click(); });
function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const key = (n: Element, k: string, init: KeyboardEventInit = {}) => act(() => { n.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });

describe('ColorField', () => {
  it('shows the current color on a named button and opens a dialog', () => {
    const el = mount('#28c98b');
    const trigger = q(el, '[data-testid="color-field-trigger"]')!;
    expect(trigger.getAttribute('aria-label')).toBe('Text color');
    expect(trigger.textContent).toContain('#28C98B');
    expect(q(el, '[data-testid="color-field-popover"]')).toBeNull();
    click(trigger);
    expect(q(el, '[role="dialog"]')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('applies a valid hex typed by the user and ignores an invalid one', () => {
    const el = mount('#ffffff');
    click(q(el, '[data-testid="color-field-trigger"]'));
    const hex = q(el, '[data-testid="color-field-hex"]') as HTMLInputElement;
    typeInto(hex, '#12');
    expect(changes).toEqual([]);
    typeInto(hex, '#ABCDEF');
    expect(changes).toEqual(['#abcdef']);
    expect(q(el, '[data-testid="color-field-trigger"]')!.textContent).toContain('#ABCDEF');
  });

  it('offers the brand colors as swatches and applies one on click', () => {
    const el = mount('#000000');
    click(q(el, '[data-testid="color-field-trigger"]'));
    click(q(el, '[aria-label="Use #28c98b"]'));
    expect(changes).toEqual(['#28c98b']);
  });

  it('moves the saturation/brightness picker with the arrow keys', () => {
    const el = mount('#ff0000'); // s=1, v=1
    click(q(el, '[data-testid="color-field-trigger"]'));
    const area = q(el, '[data-testid="color-field-area"]')!;
    key(area, 'ArrowDown');
    expect(changes).toHaveLength(1);
    expect(changes[0]).not.toBe('#ff0000');
    key(area, 'ArrowLeft', { shiftKey: true });
    expect(changes).toHaveLength(2);
    expect(area.getAttribute('aria-valuetext')).toMatch(/Saturation 9\d%/);
  });

  it('changes the hue from the hue slider', () => {
    const el = mount('#ff0000');
    click(q(el, '[data-testid="color-field-trigger"]'));
    const hue = q(el, '[data-testid="color-field-hue"]') as HTMLInputElement;
    typeInto(hue, '120');
    expect(changes.at(-1)).toBe('#00ff00');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const el = mount();
    const trigger = q(el, '[data-testid="color-field-trigger"]')!;
    click(trigger);
    key(document.body, 'Escape');
    expect(q(el, '[data-testid="color-field-popover"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when clicking outside', () => {
    const el = mount();
    click(q(el, '[data-testid="color-field-trigger"]'));
    act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(q(el, '[data-testid="color-field-popover"]')).toBeNull();
  });

  it('remembers a color that was changed as a recent swatch for next time', () => {
    const el = mount('#ffffff');
    click(q(el, '[data-testid="color-field-trigger"]'));
    typeInto(q(el, '[data-testid="color-field-hex"]') as HTMLInputElement, '#123456');
    key(document.body, 'Escape');
    click(q(el, '[data-testid="color-field-trigger"]'));
    expect(q(el, '[aria-label="Use #123456"]')).toBeTruthy();
  });

  it('does not record a recent color when nothing changed', () => {
    const el = mount('#ffffff');
    click(q(el, '[data-testid="color-field-trigger"]'));
    key(document.body, 'Escape');
    expect(window.localStorage.getItem('personalization:recent-colors')).toBeNull();
  });

  it('hides the video-dependent controls when there is no frame to read', () => {
    const el = mount();
    click(q(el, '[data-testid="color-field-trigger"]'));
    expect(q(el, '[data-testid="color-field-auto"]')).toBeNull();
    expect(q(el, '[data-testid="color-field-contrast"]')).toBeNull();
  });
});
