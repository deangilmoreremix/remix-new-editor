// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../supabase.js', () => ({ supabase: {}, primeSupabaseIdentity: vi.fn(async () => {}), getClerkUserId: () => 'u1' }));
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: vi.fn() }));
vi.mock('../../brandStore.js', () => ({ listBrands: () => [] }));
vi.mock('../../loading.js', () => ({ showToast: vi.fn() }));
const mountPage = vi.hoisted(() => vi.fn(() => ({ destroy: vi.fn() })));
vi.mock('../puck/mount.jsx', () => ({ mountPuckPage: mountPage, mountPuckEditor: vi.fn(() => ({ destroy() {} })) }));
import { openLandingPagePicker, filterTemplates, toPickerVideo, CHIPS, CUSTOMER_LOAD_LIMIT_MS } from '../pickerModal.js';
import { TEMPLATES } from '../templates.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const VIDEO = { url: 'https://cdn.test/a.mp4', title: 'Hello', studio: 'video' };

describe('toPickerVideo', () => {
  it('accepts https and blob videos, drops everything else', () => {
    expect(toPickerVideo(VIDEO)).toMatchObject({ url: VIDEO.url, title: 'Hello', source: { studio: 'video' } });
    expect(toPickerVideo({ url: 'blob:abc' }).permanent).toBe(false);
    expect(toPickerVideo({ url: 'http://x/a.mp4' })).toBeNull();
    expect(toPickerVideo({ url: 'javascript:alert(1)' })).toBeNull();
    expect(toPickerVideo(null)).toBeNull();
  });
  it('keeps a poster only when it is a different https url', () => {
    expect(toPickerVideo({ ...VIDEO, thumbnail_url: 'https://cdn.test/p.jpg' }).posterUrl).toBe('https://cdn.test/p.jpg');
    expect(toPickerVideo({ ...VIDEO, thumbnail_url: VIDEO.url }).posterUrl).toBeNull();
  });
});

describe('filterTemplates / chips', () => {
  const all = TEMPLATES.filter((t) => t.puck);
  it('searches name and description', () => {
    const r = filterTemplates(all, { q: 'spa' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThan(all.length);
  });
  it('every design is in at least one category chip', () => {
    const seen = new Set();
    CHIPS.filter((c) => c.id !== 'all').forEach((c) => filterTemplates(all, { chip: c.id }).forEach((t) => seen.add(t.id)));
    expect(all.filter((t) => !seen.has(t.id)).map((t) => t.id)).toEqual([]);
  });
});

describe('openLandingPagePicker', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });
  const grid = () => document.querySelector('[data-design-grid]');

  it('draws a live page preview for every design card and removes them on close', async () => {
    mountPage.mockClear();
    const p = openLandingPagePicker({ video: VIDEO, deps: { mountPuckPage: mountPage } });
    const n = TEMPLATES.filter((t) => t.puck).length;
    await vi.waitFor(() => expect(mountPage).toHaveBeenCalledTimes(n));
    expect(mountPage.mock.calls[0][1].preview).toBe(true);
    const handles = mountPage.mock.results.map((r) => r.value.destroy);
    p.close();
    handles.forEach((d) => expect(d).toHaveBeenCalled());
  });

  it('shows every design, locks scroll and restores it on close', () => {
    const onClose = vi.fn();
    const p = openLandingPagePicker({ video: VIDEO, onClose });
    expect(grid().querySelectorAll('button').length).toBe(TEMPLATES.filter((t) => t.puck).length);
    expect(document.body.style.overflow).toBe('hidden');
    p.close();
    expect(document.querySelector('[data-landing-picker]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(onClose).toHaveBeenCalledTimes(1);
    p.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click a design -> editor with the video; save creates the page and returns the link', async () => {
    const mountPuckEditor = vi.fn(() => ({ destroy: vi.fn() }));
    const createPageFromVideo = vi.fn(async (_c, v, o) => ({ id: 'abcd123456', config: { template: o.template }, video_url: v.url }));
    const updatePage = vi.fn(async (_c, id) => ({ id, published: false, config: {} }));
    const onPick = vi.fn();
    openLandingPagePicker({ video: VIDEO, onPick, deps: { mountPuckEditor, createPageFromVideo, updatePage } });
    const first = grid().querySelector('button');
    first.click();
    await tick();
    expect(mountPuckEditor).toHaveBeenCalledTimes(1);
    expect(mountPuckEditor.mock.calls[0][1].page.video_url).toBe(VIDEO.url);
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page');
    save.click();
    await tick(); await tick();
    expect(createPageFromVideo.mock.calls[0][1].url).toBe(VIDEO.url);
    expect(createPageFromVideo.mock.calls[0][2].template).toBe(first.dataset.template);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'abcd123456', published: false, url: expect.stringContaining('/p/abcd123456') }));
    expect(document.body.textContent).toContain('Saved to Video Pages');
  });

  it('shows the error and keeps the editor when saving fails', async () => {
    const createPageFromVideo = vi.fn(async () => { throw new Error('Upload failed. Sign in and try again.'); });
    openLandingPagePicker({ video: VIDEO, deps: { mountPuckEditor: () => ({ destroy() {} }), createPageFromVideo } });
    grid().querySelector('button').click();
    await tick();
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page').click();
    await tick(); await tick();
    expect(document.body.textContent).toContain('Upload failed');
    expect([...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page').disabled).toBe(false);
  });

  it('without a usable video it asks for a link and rejects non-https', () => {
    openLandingPagePicker({ video: { url: 'http://x/a.mp4' } });
    expect(document.body.textContent).toContain('Paste one below');
    const input = document.querySelector('input[aria-label="Video link"]');
    input.value = 'http://nope/a.mp4';
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Use link').click();
    expect(document.body.textContent).toContain('full https://');
    input.value = 'https://cdn.test/ok.mp4';
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Use link').click();
    expect(document.querySelector('input[aria-label="Video link"]')).toBeNull();
    expect(grid()).not.toBeNull();
  });

  it('opens straight on a chosen design when `template` is given', async () => {
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    const id = TEMPLATES.find((t) => t.puck).id;
    openLandingPagePicker({ video: VIDEO, template: id, deps: { mountPuckEditor } });
    await tick();
    expect(grid()).toBeNull();
    expect(mountPuckEditor).toHaveBeenCalledTimes(1);
  });

  it('opens the chosen design after at most 5 s even if the customers request never answers', async () => {
    vi.useFakeTimers();
    try {
      const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
      const id = TEMPLATES.find((t) => t.puck).id;
      openLandingPagePicker({ video: VIDEO, template: id, deps: { mountPuckEditor, loadCustomers: () => new Promise(() => {}) } });
      await vi.advanceTimersByTimeAsync(CUSTOMER_LOAD_LIMIT_MS - 100);
      expect(mountPuckEditor).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);
      expect(mountPuckEditor).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('Escape goes back from the editor first, then closes', async () => {
    const onClose = vi.fn();
    openLandingPagePicker({ video: VIDEO, onClose, deps: { mountPuckEditor: () => ({ destroy() {} }) } });
    grid().querySelector('button').click();
    await tick();
    expect(grid()).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(grid()).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('personalizing for a customer', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });
  const CUSTOMERS = [
    { id: 'c1', label: 'Riverside Plumbing', source: 'client', tokens: { firstname: 'Dana', lastname: 'Whitfield', company: 'Riverside Plumbing', city: 'Austin', companylogo: 'https://cdn.test/logo.png', role: '' }, email: 'dana@rp.test', business: { name: 'Riverside Plumbing', website: 'https://rp.test', phone: '512 555 0142' }, brand: { accent: '#ff8a1f', logoUrl: 'https://cdn.test/logo.png' } },
    { id: 'c2', label: 'Acme Roofing', source: 'client', tokens: { firstname: 'Sam', lastname: 'Lee', company: 'Acme Roofing', city: 'Denver', companylogo: '', role: '' }, email: '', business: { name: 'Acme Roofing' }, brand: { accent: '', logoUrl: '' } },
  ];
  const loadCustomers = async () => ({ customers: CUSTOMERS, activeId: 'c1' });
  const flushAll = async () => { for (let i = 0; i < 6; i += 1) await tick(); };
  const open = (extra = {}) => {
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    const addContacts = vi.fn(async (_c, _id, rows) => rows.map((r, i) => ({ id: `ct${i}abcdef`, fields: r.fields })));
    const createPageFromVideo = vi.fn(async (_c, v, o) => ({ id: 'pg12345678', config: { template: o.template, theme: o.brand }, video_url: v.url }));
    const updatePage = vi.fn(async (_c, id) => ({ id, published: false, config: {} }));
    const p = openLandingPagePicker({ video: VIDEO, deps: { loadCustomers, mountPuckEditor, addContacts, createPageFromVideo, updatePage, mountPuckPage: () => ({ destroy() {} }) }, ...extra });
    return { p, mountPuckEditor, addContacts, createPageFromVideo, updatePage };
  };
  const pickDesign = () => document.querySelector('[data-design-grid] button').click();
  const save = () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page').click();

  it('lists the customers with the active one selected and the brand option on', async () => {
    open(); await flushAll();
    const boxes = [...document.querySelectorAll('[data-customer-id]')];
    expect(boxes.map((b) => b.dataset.customerId)).toEqual(['c1', 'c2']);
    expect(boxes.find((b) => b.dataset.customerId === 'c1').checked).toBe(true);
    expect(document.querySelector('[data-customer-brand]').checked).toBe(true);
  });

  it('one customer: their brand is written into the page, the preview uses their tokens, and a personal link is made', async () => {
    const { mountPuckEditor, addContacts, createPageFromVideo } = open(); await flushAll();
    pickDesign(); await flushAll();
    const args = mountPuckEditor.mock.calls[0][1];
    expect(args.tokens).toMatchObject({ firstname: 'Dana', company: 'Riverside Plumbing' });
    expect(args.data.root.props.accent).toBe('#ff8a1f');
    expect(document.querySelector('[data-personalized-note]').textContent).toContain('Personalized for Riverside Plumbing');
    save(); await flushAll();
    expect(createPageFromVideo.mock.calls[0][2].brand).toMatchObject({ accent: '#ff8a1f', logoUrl: 'https://cdn.test/logo.png', name: 'Riverside Plumbing' });
    expect(addContacts).toHaveBeenCalledTimes(1);
    expect(addContacts.mock.calls[0][2]).toEqual([{ fields: expect.objectContaining({ firstname: 'Dana', company: 'Riverside Plumbing', email: 'dana@rp.test' }) }]);
    expect(document.querySelector('[data-personal-links]').textContent).toContain('/p/pg12345678?c=ct0abcdef');
  });

  it('several customers: one generic page, one personal link each, no brand written', async () => {
    const { mountPuckEditor, addContacts } = open(); await flushAll();
    document.querySelector('[data-customer-id="c2"]').click(); await flushAll();
    expect(document.querySelector('[data-customer-brand]').disabled).toBe(true);
    pickDesign(); await flushAll();
    expect(mountPuckEditor.mock.calls[0][1].data.root.props.accent).not.toBe('#ff8a1f');
    save(); await flushAll();
    expect(addContacts.mock.calls[0][2].length).toBe(2);
    expect(document.querySelector('[data-personal-links]').textContent).toContain('2 personal links');
  });

  it('nobody selected: the plain design and no contacts', async () => {
    const { addContacts, mountPuckEditor } = open(); await flushAll();
    document.querySelector('[data-customer-none]').click(); await flushAll();
    pickDesign(); await flushAll();
    expect(mountPuckEditor.mock.calls[0][1].tokens).toEqual({ firstname: 'Ann', company: 'Acme' });
    expect(document.querySelector('[data-personalized-note]')).toBeNull();
    save(); await flushAll();
    expect(addContacts).not.toHaveBeenCalled();
  });

  it('"Use the plain design" re-opens the editor without their brand', async () => {
    const { mountPuckEditor } = open(); await flushAll();
    pickDesign(); await flushAll();
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Use the plain design').click(); await flushAll();
    expect(mountPuckEditor).toHaveBeenCalledTimes(2);
    expect(mountPuckEditor.mock.calls[1][1].data.root.props.accent).not.toBe('#ff8a1f');
  });

  it('keeps the page when the personal links fail, and says so', async () => {
    const { addContacts } = open(); await flushAll();
    addContacts.mockRejectedValue(new Error('RLS says no'));
    pickDesign(); await flushAll(); save(); await flushAll();
    expect(document.body.textContent).toContain('The page is saved, but the personal links were not made');
    expect(document.body.textContent).toContain('Saved to Video Pages');
  });

  it('works when there are no customers at all', async () => {
    open({ deps: { loadCustomers: async () => ({ customers: [], activeId: '' }), mountPuckPage: () => ({ destroy() {} }) } }); await flushAll();
    expect(document.querySelector('[data-customer-panel]').textContent).toContain('No customer found yet');
  });

  it('puts the customer\'s personalized picture in the video slot, and lets you switch that off', async () => {
    const withImage = [{ ...CUSTOMERS[0], image: 'https://cdn.test/personal.png' }, CUSTOMERS[1]];
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    openLandingPagePicker({ video: VIDEO, deps: { loadCustomers: async () => ({ customers: withImage, activeId: 'c1' }), mountPuckEditor, mountPuckPage: () => ({ destroy() {} }) } }); await flushAll();
    const box = document.querySelector('[data-customer-image]'); expect(box.checked).toBe(true);
    document.querySelector('[data-template="puck-pc-plumbing"]').click(); await flushAll();
    const slot = (call) => JSON.stringify(mountPuckEditor.mock.calls[call][1].data).includes('"slotImage":"https://cdn.test/personal.png"');
    expect(slot(0)).toBe(true);
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('All pages')).click(); await flushAll();
    document.querySelector('[data-customer-image]').click(); await flushAll();
    document.querySelector('[data-template="puck-pc-plumbing"]').click(); await flushAll();
    expect(slot(1)).toBe(false);
  });
});

describe('toPickerVideo with pictures', () => {
  it('marks a picture as an image (by type or file extension) and names it as a picture', () => {
    expect(toPickerVideo({ url: 'https://cdn.test/a.png', type: 'image' })).toMatchObject({ title: 'My picture', source: { kind: 'image' } });
    expect(toPickerVideo({ url: 'https://cdn.test/b.webp?x=1' })).toMatchObject({ source: { kind: 'image' } });
    expect(toPickerVideo({ url: 'https://cdn.test/c.mp4' })).toMatchObject({ title: 'My video', source: { kind: 'video' } });
  });
});
