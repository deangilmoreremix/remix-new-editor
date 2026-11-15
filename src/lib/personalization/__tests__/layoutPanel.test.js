// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderPersonalizationPanel } from '../../editor/panels/personalPanels.js';

const base = (layoutCheck, over = {}) => ({
  contacts: () => [{ id: 'c1', name: 'Ann Lee' }],
  active: () => ({ id: 'c1', name: 'Ann Lee', contact: { name: 'Ann Lee' } }),
  select() {}, addText() {}, openPersonalize() {},
  layoutCheck: () => layoutCheck,
  showLayer: vi.fn(), applyRecommended: vi.fn(),
  ...over,
});
const mount = (s) => { const el = document.createElement('div'); renderPersonalizationPanel(el, s); return el; };

describe('Layout check section', () => {
  it('shows nothing when the host does not offer it', () => {
    const s = base(null); delete s.layoutCheck;
    expect(mount(s).textContent).not.toContain('Layout check');
  });
  it('says it is loading, then explains what is needed when there are no overlays', () => {
    expect(mount(base({ loading: true })).textContent).toContain('Loading');
    expect(mount(base({ hasLayers: false })).textContent).toMatch(/no text or image overlays on the timeline/);
    expect(mount(base({ hasLayers: false, message: 'Pick a contact first.' })).textContent).toContain('Pick a contact first.');
  });
  it('shows a clean report', () => {
    const el = mount(base({ hasLayers: true, report: { status: 'ready', issues: [], notes: ['frames were not analysed.'] } }));
    expect(el.textContent).toContain('Looks good');
    expect(el.querySelector('[data-apply-recommended]')).toBeNull();
  });
  it('lists issues with Show, and offers Apply only when something is fixable', () => {
    const s = base({ hasLayers: true, report: { status: 'needs-adjustment', notes: ['n'], issues: [
      { code: 'overlay-collision', severity: 'adjust', layerId: 'headline', message: 'Headline overlaps Offer', fixable: true },
      { code: 'missing-media', severity: 'critical', layerId: 'logo', message: 'No logo image', fixable: false },
    ] } });
    const el = mount(s);
    expect(el.querySelectorAll('.rp-issue')).toHaveLength(2);
    expect(el.textContent).toContain('Blocks export');
    el.querySelector('[data-show-layer="headline"]').click();
    expect(s.showLayer).toHaveBeenCalledWith('headline');
    el.querySelector('[data-apply-recommended]').click();
    expect(s.applyRecommended).toHaveBeenCalledTimes(1);
  });
  it('escapes issue text', () => {
    const el = mount(base({ hasLayers: true, report: { status: 'review-required', notes: [''], issues: [{ code: 'x', severity: 'review', layerId: 'a', message: '<img src=x onerror=alert(1)>', fixable: false }] } }));
    expect(el.querySelector('img')).toBeNull();
  });
});

describe('Browse templates button', () => {
  it('is offered only when the host provides it, and calls it', () => {
    const withIt = base(null, { browseTemplates: vi.fn() });
    const el = mount(withIt);
    el.querySelector('[data-rp="templates"]').click();
    expect(withIt.browseTemplates).toHaveBeenCalledTimes(1);
    expect(mount(base(null)).querySelector('[data-rp="templates"]')).toBeNull();
  });
});

describe('Measure readability button', () => {
  const report = { status: 'review-required', issues: [], notes: ['Not checked: whether text covers the subject of the video.'] };
  it('is offered until measured, and calls the host', () => {
    const s = base({ hasLayers: true, report, measured: false }, { measureReadability: vi.fn() });
    const el = mount(s);
    el.querySelector('[data-measure]').click();
    expect(s.measureReadability).toHaveBeenCalledTimes(1);
    expect(mount(base({ hasLayers: true, report, measured: true }, { measureReadability: vi.fn() })).querySelector('[data-measure]')).toBeNull();
  });
  it('is disabled while measuring, and absent when the host cannot measure', () => {
    const b = mount(base({ hasLayers: true, report, measuring: true }, { measureReadability: vi.fn() })).querySelector('[data-measure]');
    expect(b.disabled).toBe(true);
    expect(b.textContent).toBe('Measuring…');
    expect(mount(base({ hasLayers: true, report })).querySelector('[data-measure]')).toBeNull();
  });
  it('shows every note, including what is never checked', () => {
    expect(mount(base({ hasLayers: true, report })).textContent).toContain('whether text covers the subject');
  });
});
