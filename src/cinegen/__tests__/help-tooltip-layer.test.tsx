// [remix] The hover card: appears after a short delay with the name, expands to the full definition + steps, and never leaves a stale native title.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { HelpTooltipLayer } from '../components/ui/help-tooltip-layer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function hover(el: Element) {
  act(() => { el.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, relatedTarget: document.body })); });
}

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<><button id="blade" title="Blade Tool (B)">B</button><button id="nohelp" title="No help written for this">x</button><HelpTooltipLayer /></>); });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.querySelectorAll('.help-tip').forEach((n) => n.remove());
  vi.useRealTimers();
});

describe('HelpTooltipLayer', () => {
  it('shows the name first, then expands to the definition and steps', () => {
    hover(document.getElementById('blade')!);
    expect(document.querySelector('.help-tip')).toBeNull();                      // not before the delay
    act(() => { vi.advanceTimersByTime(400); });
    const card = document.querySelector('.help-tip')!;
    expect(card.querySelector('.help-tip__name')!.textContent).toBe('Blade tool');
    expect(card.querySelector('.help-tip__key')!.textContent).toBe('B');
    expect(card.querySelector('.help-tip__more')).toBeNull();                    // short form
    act(() => { vi.advanceTimersByTime(700); });
    expect(document.querySelector('.help-tip__more')).not.toBeNull();            // expanded
    expect(document.querySelectorAll('.help-tip__how li').length).toBeGreaterThan(1);
  });

  it('replaces the native title bubble and puts the title back when the pointer leaves', () => {
    const b = document.getElementById('blade')!;
    hover(b);
    expect(b.getAttribute('title')).toBeNull();
    act(() => { b.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })); vi.advanceTimersByTime(300); });
    expect(document.querySelector('.help-tip')).toBeNull();
    expect(b.getAttribute('title')).toBe('Blade Tool (B)');
  });

  it('leaves controls without help alone (native title stays)', () => {
    const n = document.getElementById('nohelp')!;
    hover(n);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(document.querySelector('.help-tip')).toBeNull();
    expect(n.getAttribute('title')).toBe('No help written for this');
  });

  it('Escape closes the card', () => {
    hover(document.getElementById('blade')!);
    act(() => { vi.advanceTimersByTime(400); });
    expect(document.querySelector('.help-tip')).not.toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('.help-tip')).toBeNull();
  });
});
