// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../supabase.js', () => ({ supabase: {}, primeSupabaseIdentity: vi.fn(async () => {}), getClerkUserId: () => 'u1' }));
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: vi.fn() }));
vi.mock('../../brandStore.js', () => ({ listBrands: () => [] }));
vi.mock('../../loading.js', () => ({ showToast: vi.fn() }));
const mountPage = vi.hoisted(() => vi.fn(() => ({ destroy: vi.fn() })));
vi.mock('../puck/mount.jsx', () => ({ mountPuckPage: mountPage, mountPuckEditor: vi.fn(() => ({ destroy() {} })) }));
import { openLandingPagePicker, filterTemplates, toPickerVideo, CHIPS } from '../pickerModal.js';
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

  const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  const LIB = [{ key: 'gen:1', url: 'https://cdn.test/made.mp4', posterUrl: null, title: 'Made in Video', duration: 8, source: { kind: 'generation', studio: 'video' }, permanent: false }];

  it('without a usable video it opens the video chooser; a link must be https', async () => {
    openLandingPagePicker({ video: { url: 'http://x/a.mp4' }, deps: { loadVideoSources: async () => [] } });
    expect(document.querySelector('[data-video-chooser]')).not.toBeNull();
    expect(document.body.textContent).toContain('Choose a video first');
    const input = document.querySelector('input[aria-label="Video link"]');
    input.value = 'http://nope/a.mp4';
    btn('Use link').click();
    expect(document.body.textContent).toContain('full https://');
    input.value = 'https://cdn.test/ok.mp4';
    btn('Use link').click();
    expect(document.querySelector('[data-video-chooser]')).toBeNull();
    expect(grid()).not.toBeNull();
    expect(document.querySelector('[data-picker-video]').textContent).toContain('ok');
  });

  it('pick a video you already made, then save: that video goes on the page', async () => {
    const createPageFromVideo = vi.fn(async (_c, v, o) => ({ id: 'abcd123456', config: { template: o.template }, video_url: v.url }));
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    openLandingPagePicker({ deps: { loadVideoSources: async () => LIB, mountPuckEditor, createPageFromVideo, updatePage: async (_c, id) => ({ id, published: false }) } });
    await vi.waitFor(() => expect(document.querySelector('[data-video-source="gen:1"]')).not.toBeNull());
    expect(document.body.textContent).toContain('will be copied');
    document.querySelector('[data-video-source="gen:1"]').click();
    grid().querySelector('button').click();
    await tick();
    expect(mountPuckEditor.mock.calls[0][1].page.video_url).toBe('https://cdn.test/made.mp4');
    btn('Save as my page').click();
    await tick(); await tick();
    expect(createPageFromVideo.mock.calls[0][1]).toMatchObject({ url: 'https://cdn.test/made.mp4', title: 'Made in Video' });
  });

  it('an uploaded file is previewed from the computer and handed to save as a file (it is uploaded then)', async () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:local-1');
    const createPageFromVideo = vi.fn(async () => ({ id: 'abcd123456', config: {} }));
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    openLandingPagePicker({ deps: { loadVideoSources: async () => [], mountPuckEditor, createPageFromVideo, updatePage: async (_c, id) => ({ id }) } });
    const f = new File(['x'], 'My pitch.mp4', { type: 'video/mp4' });
    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [f] });
    input.dispatchEvent(new Event('change'));
    expect(document.querySelector('[data-picker-video]').textContent).toContain('My pitch');
    grid().querySelector('button').click();
    await tick();
    expect(mountPuckEditor.mock.calls[0][1].page.video_url).toBe('blob:local-1');
    btn('Save as my page').click();
    await tick(); await tick();
    expect(createPageFromVideo.mock.calls[0][1].file).toBe(f);
  });

  it('Change video in the editor keeps the edits and shows the new video', async () => {
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    openLandingPagePicker({ video: VIDEO, deps: { loadVideoSources: async () => LIB, mountPuckEditor } });
    grid().querySelector('button').click();
    await tick();
    const edited = { content: [{ type: 'Hero', props: { id: 'h', headline: 'My own words' } }], root: { props: {} } };
    mountPuckEditor.mock.calls[0][1].onChange(edited);
    btn('Change video').click();
    expect(document.querySelector('[data-video-chooser]')).not.toBeNull();
    await vi.waitFor(() => expect(document.querySelector('[data-video-source="gen:1"]')).not.toBeNull());
    document.querySelector('[data-video-source="gen:1"]').click();
    await tick();
    const last = mountPuckEditor.mock.calls.at(-1)[1];
    expect(last.page.video_url).toBe('https://cdn.test/made.mp4');
    expect(JSON.stringify(last.data)).toContain('My own words');
  });

  it('`doneLabel` adds a closing button on the saved screen', async () => {
    const onClose = vi.fn();
    openLandingPagePicker({ video: VIDEO, doneLabel: 'Use this page', onClose, deps: { mountPuckEditor: () => ({ destroy() {} }), createPageFromVideo: async () => ({ id: 'abcd123456', config: {} }), updatePage: async (_c, id) => ({ id, published: false }) } });
    grid().querySelector('button').click();
    await tick();
    btn('Save as my page').click();
    await tick(); await tick();
    btn('Use this page').click();
    expect(onClose).toHaveBeenCalled();
  });

  it('opens straight on a chosen design when `template` is given', async () => {
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    const id = TEMPLATES.find((t) => t.puck).id;
    openLandingPagePicker({ video: VIDEO, template: id, deps: { mountPuckEditor } });
    await tick();
    expect(grid()).toBeNull();
    expect(mountPuckEditor).toHaveBeenCalledTimes(1);
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

describe('openLandingPagePicker: edit only (Video Outreach, the page belongs to the video)', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });
  const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);

  it('opens in the editor with your page; Save page hands back the edits and saves nothing in Video Pages', async () => {
    const id = TEMPLATES.find((t) => t.puck).id;
    const start = { content: [{ type: 'Hero', props: { id: 'h', headline: 'Before' } }], root: { props: {} } };
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    const createPageFromVideo = vi.fn();
    const onEdit = vi.fn();
    openLandingPagePicker({ video: VIDEO, template: id, data: start, onEdit, deps: { mountPuckEditor, createPageFromVideo } });
    await tick();
    expect(document.querySelector('[data-design-grid]')).toBeNull();
    expect(mountPuckEditor.mock.calls[0][1].data.content[0].props.headline).toBe('Before');
    expect(mountPuckEditor.mock.calls[0][1].page.video_url).toBe(VIDEO.url);
    expect(btn('Change video')).toBeUndefined();
    expect(btn('← All pages')).toBeUndefined();
    mountPuckEditor.mock.calls[0][1].onChange({ content: [{ type: 'Hero', props: { id: 'h', headline: 'After' } }], root: { props: {} } });
    btn('Save page').click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onEdit.mock.calls[0][0])).toContain('After');
    expect(createPageFromVideo).not.toHaveBeenCalled();
    expect(document.querySelector('[data-landing-picker]')).toBeNull();
    expect(start.content[0].props.headline).toBe('Before');
  });

  it('works before there is a recording', async () => {
    const id = TEMPLATES.find((t) => t.puck).id;
    openLandingPagePicker({ template: id, onEdit: vi.fn(), deps: { mountPuckEditor: () => ({ destroy() {} }), loadVideoSources: async () => [] } });
    await tick();
    expect(document.querySelector('[data-video-chooser]')).toBeNull();
    expect(btn('Save page').disabled).toBe(false);
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
});
