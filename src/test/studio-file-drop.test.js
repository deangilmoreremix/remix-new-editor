import { describe, it, expect } from 'vitest';
import { enableStudioFileDropDelegation } from '../lib/studioFileDrop.js';

const dragEvent = (type, types) => {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { types, files: [], items: [], dropEffect: 'move' } });
  return ev;
};

describe('studio file drop delegation', () => {
  const setup = () => {
    const root = document.createElement('div');
    const card = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'file';
    const inner = document.createElement('span');
    card.append(input, inner);
    root.appendChild(card);
    document.body.appendChild(root);
    enableStudioFileDropDelegation(root);
    return { root, card, inner };
  };

  it('leaves internal drags (text, e.g. reordering frame cards) alone', () => {
    const { card, inner } = setup();
    let cardSawDragover = false;
    card.addEventListener('dragover', () => { cardSawDragover = true; });
    const over = dragEvent('dragover', ['text/plain']);
    inner.dispatchEvent(over);
    expect(cardSawDragover).toBe(true);          // not swallowed
    expect(over.dataTransfer.dropEffect).toBe('move'); // not forced to "copy"
    expect(card.classList.contains('studio-file-drop-active')).toBe(false);
  });

  it('still takes over file drags', () => {
    const { card, inner } = setup();
    const over = dragEvent('dragover', ['Files']);
    inner.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('copy');
    expect(card.classList.contains('studio-file-drop-active')).toBe(true);
  });
});
