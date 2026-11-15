// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderPersonalizationPanel } from '../../editor/panels/personalPanels.js';

const base = (prepareInfo, over = {}) => ({
  contacts: () => [{ id: 'c1', name: 'Ann' }],
  active: () => ({ id: 'c1', name: 'Ann', contact: { name: 'Ann' } }),
  select() {}, addText() {}, openPersonalize() {},
  prepareInfo: () => prepareInfo, prepareAll: vi.fn(), cancelPrepare: vi.fn(),
  ...over,
});
const mount = (s) => { const el = document.createElement('div'); renderPersonalizationPanel(el, s); return el; };

describe('Prepare images section', () => {
  it('is absent when the host does not offer it', () => {
    const s = base(null); delete s.prepareInfo;
    expect(mount(s).textContent).not.toContain('Prepare images');
  });
  it('explains what is needed when the video uses no personalized image', () => {
    expect(mount(base({ hasKeys: false, items: [], running: null })).textContent).toMatch(/Add a Personalized Image/);
  });
  it('offers one button with the count, and calls it', () => {
    const s = base({ hasKeys: true, items: [{}, {}, {}], running: null });
    const el = mount(s);
    const b = el.querySelector('[data-prepare-all]');
    expect(b.textContent).toContain('(3)');
    b.click();
    expect(s.prepareAll).toHaveBeenCalledTimes(1);
  });
  it('says everything is prepared when nothing is left', () => {
    const el = mount(base({ hasKeys: true, items: [], running: null }));
    expect(el.textContent).toContain('already prepared');
    expect(el.querySelector('[data-prepare-all]')).toBeNull();
  });
  it('shows progress with Cancel while running', () => {
    const s = base({ hasKeys: true, items: [{}], running: { progress: 40, message: '2 of 5 · Ann · Logo' } });
    const el = mount(s);
    expect(el.textContent).toMatch(/40%/);
    expect(el.querySelector('[data-prepare-all]')).toBeNull();
    el.querySelector('[data-prepare-cancel]').click();
    expect(s.cancelPrepare).toHaveBeenCalled();
  });
  it('escapes names', () => {
    const el = mount(base({ hasKeys: true, items: [{}], running: { progress: 1, message: '<img src=x onerror=alert(1)>' } }));
    expect(el.querySelector('img')).toBeNull();
  });
});
