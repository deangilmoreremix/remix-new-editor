// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/muapi.js', () => ({ muapi: {} }));
const { createChecklistChip } = await import('../ChecklistChip.js');
const { _resetChecklistForTests } = await import('../../lib/onboarding/checklist.js');

const key = 'smartvideo-app-onboarding-v1:guest';
const mount = (answers, navigate = vi.fn()) => {
  localStorage.clear(); sessionStorage.clear(); document.body.innerHTML = ''; _resetChecklistForTests();
  if (answers) localStorage.setItem(key, JSON.stringify(answers));
  const c = createChecklistChip(navigate);
  document.body.appendChild(c.element);
  return { c, navigate };
};
const $ = (s) => document.querySelector(s);

describe('Get started chip', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('is hidden before the onboarding is done', () => {
    mount({ step: 3 });
    expect($('[data-checklist]').classList.contains('hidden')).toBe(true);
  });

  it('shows n/4 once onboarding is finished and opens a popover that is not a dialog', () => {
    mount({ step: 6, completedAt: '2026-11-01T00:00:00Z' });
    expect($('[data-checklist]').classList.contains('hidden')).toBe(false);
    expect($('[data-checklist-chip]').textContent).toContain('0/4');
    expect($('[data-checklist-popover]').classList.contains('hidden')).toBe(true);
    $('[data-checklist-chip]').click();
    const pop = $('[data-checklist-popover]');
    expect(pop.classList.contains('hidden')).toBe(false);
    expect(pop.getAttribute('role')).toBe('group');
    expect(pop.getAttribute('aria-modal')).toBeNull();
    expect(pop.querySelectorAll('[data-checklist-item]')).toHaveLength(4);
  });

  it('Escape and an outside click close it', () => {
    mount({ step: 6, skippedAt: '2026-11-01T00:00:00Z' });
    $('[data-checklist-chip]').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('[data-checklist-popover]').classList.contains('hidden')).toBe(true);
    $('[data-checklist-chip]').click();
    document.body.click();
    expect($('[data-checklist-popover]').classList.contains('hidden')).toBe(true);
  });

  it('an item runs its action and closes the popover', () => {
    const { navigate } = mount({ step: 6, completedAt: '2026-11-01T00:00:00Z', tools: ['avatar'], primaryTool: 'avatar' });
    $('[data-checklist-chip]').click();
    $('[data-checklist-go="first-result"]').click();
    expect(navigate).toHaveBeenCalledWith('avatar');
    expect($('[data-checklist-popover]').classList.contains('hidden')).toBe(true);
    const seen = [];
    window.addEventListener('navigate', (e) => seen.push(e.detail.page), { once: true });
    $('[data-checklist-chip]').click();
    $('[data-checklist-go="key"]').click();
    expect(seen).toEqual(['settings']);
  });

  it('a saved generation moves it to 1/4; the published event completes the last item', () => {
    mount({ step: 6, completedAt: '2026-11-01T00:00:00Z' });
    window.dispatchEvent(new CustomEvent('generation:saved', { detail: {} }));
    expect($('[data-checklist-chip]').textContent).toContain('1/4');
    window.dispatchEvent(new CustomEvent('landing:published', { detail: { id: 'p' } }));
    expect($('[data-checklist-chip]').textContent).toContain('2/4');
  });

  it('Hide this removes the chip and it stays hidden', async () => {
    const { c } = mount({ step: 6, completedAt: '2026-11-01T00:00:00Z' });
    $('[data-checklist-chip]').click();
    $('[data-checklist-hide]').click();
    await new Promise((r) => setTimeout(r, 10));
    expect($('[data-checklist]').classList.contains('hidden')).toBe(true);
    c.refresh();
    expect($('[data-checklist]').classList.contains('hidden')).toBe(true);
  });
});
