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

describe('advanced panel empty note', () => {
  it('updates when controls are added or removed while the panel is open', async () => {
    const { createAdvancedPanel } = await import('../components/studio/actionRow.js');
    const container = document.createElement('div');
    const { button, panel } = createAdvancedPanel({ id: 'adv3', elements: [container] });
    document.body.appendChild(panel);
    const note = [...panel.children].find((c) => c.textContent.includes('No advanced options'));
    button.click();
    expect(note.classList.contains('hidden')).toBe(false);

    const input = document.createElement('input');
    container.appendChild(input);
    await new Promise((r) => setTimeout(r, 0));
    expect(note.classList.contains('hidden')).toBe(true);

    container.removeChild(input);
    await new Promise((r) => setTimeout(r, 0));
    expect(note.classList.contains('hidden')).toBe(false);
  });
});

describe('advanced panel empty note with direct controls', () => {
  it('hides the note when a control is passed directly in elements', async () => {
    const { createAdvancedPanel } = await import('../components/studio/actionRow.js');
    const input = document.createElement('input');
    const { button, panel } = createAdvancedPanel({ id: 'adv4', elements: [input] });
    document.body.appendChild(panel);
    button.click();
    const note = [...panel.children].find((c) => c.textContent.includes('No advanced options'));
    expect(note.classList.contains('hidden')).toBe(true);
  });
});
