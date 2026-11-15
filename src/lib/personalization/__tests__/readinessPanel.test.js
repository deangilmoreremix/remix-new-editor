// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderPersonalizationPanel } from '../../editor/panels/personalPanels.js';

const items = [
  { id: 'a', severity: 'blocker', message: 'Logo has no image', fix: { type: 'show-layer', layerId: 'logo', label: 'Show' } },
  { id: 'b', severity: 'warning', message: 'Raj has no logo', contactId: '2', fix: { type: 'open-personalize', label: 'Add it' } },
  { id: 'c', severity: 'info', message: '2 images still have a background (optional).', fix: { type: 'prepare-all', label: 'Prepare' } },
  { id: 'd', severity: 'warning', message: 'No fix for this', fix: null },
];
const base = (readiness, over = {}) => ({
  contacts: () => [{ id: 'c1', name: 'Ann' }],
  active: () => ({ id: 'c1', name: 'Ann', contact: { name: 'Ann' } }),
  select() {}, addText() {}, openPersonalize() {},
  readiness: () => readiness, fix: vi.fn(), checkImages: vi.fn(),
  ...over,
});
const mount = (s) => { const el = document.createElement('div'); renderPersonalizationPanel(el, s); return el; };
const ready = (o = {}) => ({ status: 'ready', items: [], counts: { blockers: 0, warnings: 0, info: 0, imagesChecked: false }, checking: false, ...o });

describe('Ready to export? section', () => {
  it('is absent when the host does not offer it', () => {
    const s = base(null); delete s.readiness;
    expect(mount(s).textContent).not.toContain('Ready to export?');
  });
  it('shows the status, hints that images were not tested, and offers the check', () => {
    const el = mount(base(ready()));
    expect(el.textContent).toContain('✓ Ready to export');
    expect(el.textContent).toContain("haven't been tested for loading");
    expect(el.querySelector('[data-check-images]').textContent).toBe('Check that images load');
  });
  it('lists items by severity with a fix button only where there is a fix', () => {
    const el = mount(base(ready({ status: 'blocked', items, counts: { blockers: 1, warnings: 2, info: 1, imagesChecked: true } })));
    expect(el.textContent).toContain('Fix before exporting');
    expect(el.querySelectorAll('.rp-issue')).toHaveLength(4);
    expect(el.querySelectorAll('[data-fix-item]')).toHaveLength(3);
    expect(el.textContent).toContain('Blocks export');
    expect(el.textContent).toContain('Optional');
    expect(el.querySelector('[data-check-images]').textContent).toBe('Check that images load again');
    expect(el.textContent).not.toContain("haven't been tested");
  });
  it('calls fix with the item, and checkImages', () => {
    const s = base(ready({ status: 'needs-attention', items, counts: { blockers: 1, warnings: 2, info: 1, imagesChecked: false } }));
    const el = mount(s);
    el.querySelector('[data-fix-item="1"]').click();
    expect(s.fix).toHaveBeenCalledWith(items[1], expect.any(Function));
    el.querySelector('[data-check-images]').click();
    expect(s.checkImages).toHaveBeenCalledTimes(1);
  });
  it('disables the check while it is running', () => {
    const b = mount(base(ready({ checking: true }))).querySelector('[data-check-images]');
    expect(b.disabled).toBe(true);
    expect(b.textContent).toBe('Checking images…');
  });
  it('escapes messages', () => {
    const el = mount(base(ready({ status: 'needs-attention', items: [{ id: 'x', severity: 'warning', message: '<img src=x onerror=alert(1)>', fix: null }] })));
    expect(el.querySelector('img')).toBeNull();
  });
});
