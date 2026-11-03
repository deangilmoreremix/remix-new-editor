import { describe, it, expect, vi } from 'vitest';
import {
  createActionRow,
  createAdvancedButton,
  arrangeActionRow,
  styleThumbnailButton,
  ACTION_PILL_CLASS,
} from '../components/studio/actionRow.js';

const btn = (label) => {
  const b = document.createElement('button');
  b.textContent = label;
  return b;
};

describe('studio action row', () => {
  it('orders buttons Thumbnail · Advanced · Tools · Personalize and skips missing ones', () => {
    const row = createActionRow();
    const personalize = btn('Personalize');
    const tools = btn('Tools');
    row.appendChild(personalize);
    row.appendChild(tools);
    const thumbnail = styleThumbnailButton(btn('x'));
    const advanced = createAdvancedButton({ id: 'adv' });
    arrangeActionRow(row, { personalize, tools, thumbnail, advanced });
    const labels = [...row.children].map((c) => c.textContent.trim());
    expect(labels).toEqual(['🖼 Thumbnail', 'Advanced', 'Tools', 'Personalize']);
    expect(thumbnail.className).toBe('btn-action-secondary shrink-0');
    expect(advanced.className).toBe(ACTION_PILL_CLASS);
  });

  it('advanced pill toggles its label and notifies', () => {
    const onToggle = vi.fn();
    const advanced = createAdvancedButton({ id: 'adv2', onToggle });
    advanced.click();
    expect(advanced.querySelector('#adv2-label').textContent).toBe('Less');
    expect(advanced.getAttribute('aria-expanded')).toBe('true');
    expect(onToggle).toHaveBeenCalledWith(true);
    advanced.click();
    expect(advanced.querySelector('#adv2-label').textContent).toBe('Advanced');
  });
});
