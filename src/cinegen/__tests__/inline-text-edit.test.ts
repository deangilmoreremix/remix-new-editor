// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { beginInlineTextEdit } from '../lib/overlays/inline-text-edit';
import { textEditUpdates } from '../lib/overlays/text-edit';
import type { OverlayClip } from '../types/workspace';

const build = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = `<div class="row"><span class="personalizer-input">${html}</span></div>`;
  document.body.appendChild(el);
  return el;
};
const key = (target: Element, k: string, init: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));

describe('Smart Text edited on the video', () => {
  it('opens the text with token chips, and Enter keeps what was typed', () => {
    const el = build('Hi Sam');
    const onCommit = vi.fn();
    expect(beginInlineTextEdit(el, 'Hi {{firstName}}', onCommit)).toBeTypeOf('function');
    const span = el.querySelector('.personalizer-input') as HTMLElement;
    expect(span.getAttribute('contenteditable')).toBe('true');
    expect(span.querySelector('.personalized-token')?.getAttribute('data-token')).toBe('{{firstName}}');
    span.appendChild(document.createTextNode('!'));
    key(span, 'Enter');
    expect(onCommit).toHaveBeenCalledWith('Hi {{firstName}}!');
    expect(span.getAttribute('contenteditable')).toBe('false');
  });
  it('Esc cancels and puts the old text back', () => {
    const el = build('Hi Sam');
    const onCommit = vi.fn();
    beginInlineTextEdit(el, 'Hi {{firstName}}', onCommit);
    const span = el.querySelector('.personalizer-input') as HTMLElement;
    span.appendChild(document.createTextNode('x'));
    key(span, 'Escape');
    expect(onCommit).not.toHaveBeenCalled();
    expect(span.textContent).toBe('Hi Sam');
  });
  it('does not let typing reach the editor shortcuts', () => {
    const el = build('a');
    beginInlineTextEdit(el, 'a', vi.fn());
    const seen = vi.fn();
    window.addEventListener('keydown', seen);
    key(el.querySelector('.personalizer-input') as Element, ' ');
    window.removeEventListener('keydown', seen);
    expect(seen).not.toHaveBeenCalled();
  });
  it('an unchanged text is not saved again', () => {
    const el = build('a');
    const onCommit = vi.fn();
    beginInlineTextEdit(el, 'a', onCommit);
    key(el.querySelector('.personalizer-input') as Element, 'Enter');
    expect(onCommit).not.toHaveBeenCalled();
  });
  it('the edit is saved under the overlay\'s add-on options', () => {
    const o = { id: 'x', type: 'overlay-text', name: 't', start: 0, end: 5, addon: { text: 'old', fontSize: 8 } } as unknown as OverlayClip;
    expect(textEditUpdates(o, 'text', 'new')).toEqual({ addon: { text: 'new', fontSize: 8 } });
  });
});
