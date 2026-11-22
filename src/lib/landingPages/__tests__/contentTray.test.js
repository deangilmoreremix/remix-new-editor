import { describe, it, expect, vi } from 'vitest';
import { normalizeItems, routeContent, typeOfItem, listSlots, slotsFor, setSlot, persistTrayMedia, MAX_ITEMS } from '../contentTray.js';

const V = (n, extra = {}) => ({ url: `https://cdn.test/${n}.mp4`, title: n, source: { kind: 'video' }, ...extra });
const P = (n, extra = {}) => ({ url: `https://cdn.test/${n}.png`, title: n, source: { kind: 'image' }, ...extra });

describe('normalizeItems', () => {
  it('keeps https videos and pictures, drops everything else, removes duplicates, tags the type', () => {
    const out = normalizeItems([V('a'), P('b'), V('a'), { url: 'http://x/a.mp4' }, { url: 'blob:x' }, null, { url: 'https://cdn.test/c.webp' }]);
    expect(out.map((i) => [i.url.split('/').pop(), i.type])).toEqual([['a.mp4', 'video'], ['b.png', 'image'], ['c.webp', 'image']]);
  });
  it('takes a single item or a list, and runs each through the normalizer', () => {
    expect(normalizeItems(V('a'))).toHaveLength(1);
    const norm = vi.fn((x) => ({ url: x.link, source: { kind: 'image' } }));
    expect(normalizeItems([{ link: 'https://cdn.test/z.png' }], norm)[0]).toMatchObject({ url: 'https://cdn.test/z.png', type: 'image' });
  });
  it('caps the tray', () => {
    const many = Array.from({ length: 30 }, (_, i) => P(`p${i}`));
    expect(normalizeItems(many)).toHaveLength(MAX_ITEMS);
  });
  it('types by kind, by declared type, then by file extension', () => {
    expect(typeOfItem({ url: 'https://x/a.jpg' })).toBe('image');
    expect(typeOfItem({ url: 'https://x/a.mp4' })).toBe('video');
    expect(typeOfItem({ url: 'https://x/obj/1', type: 'image' })).toBe('image');
    expect(typeOfItem({ url: 'https://x/a.png', source: { kind: 'video' } })).toBe('video');
  });
});

describe('routeContent: the viewer gets the right item', () => {
  it('a video fills the viewer; a picture next to it stays in the tray', () => {
    const r = routeContent(normalizeItems([P('shot'), V('clip')]));
    expect(r.main.url).toContain('clip.mp4');
    expect(r.extras.map((i) => i.title)).toEqual(['shot']);
    expect(r.all.map((i) => i.title)).toEqual(['clip', 'shot']);
  });
  it('a picture-only tray makes a still viewer', () => {
    const r = routeContent(normalizeItems([P('a'), P('b')]));
    expect(r.main.title).toBe('a'); expect(r.poster).toBeNull();
  });
  it('the item the user asked for is always the main one, even a picture beside videos', () => {
    const items = normalizeItems([V('v1'), P('asked'), V('v2')]);
    expect(routeContent(items, { prefer: 'https://cdn.test/asked.png' }).main.title).toBe('asked');
  });
  it('a video keeps only its own thumbnail as poster; an unrelated picture is never guessed', () => {
    expect(routeContent(normalizeItems([V('clip', { posterUrl: 'https://cdn.test/own.jpg' }), P('other')])).poster).toBe('https://cdn.test/own.jpg');
    const r = routeContent(normalizeItems([V('clip'), P('other')]));
    expect(r.poster).toBeNull(); expect(r.main.posterUrl).toBeFalsy();
  });
  it('an empty tray routes to nothing', () => {
    expect(routeContent([])).toEqual({ main: null, poster: null, extras: [], all: [] });
  });
});

// A tiny stand-in for the editor config: a Hero with viewer slots, a Grid-held testimonial card list, a footer logo.
const slot = (label, kind) => ({ type: 'custom', label, slotKind: kind });
const COMPONENTS = {
  Hero: { label: 'Hero (headline, video, form)', fields: { headline: { type: 'text', label: 'Headline' }, slotVideo: slot('Video in the video slot (a video you made)', 'video'), slotImage: slot('Picture in the video slot (e.g. a personalized image)', 'image'), photo: slot('Placeholder image before the video plays', 'image') } },
  Grid: { label: 'Card grid', fields: { items: { type: 'array', label: 'Cards', arrayFields: {} } } },
  QuoteCard: { label: 'Testimonial card', fields: { quotes: { type: 'array', label: 'Testimonials', arrayFields: { avatar: slot('Photo (https link)', 'image'), name: { type: 'text', label: 'Name' } } } } },
  Footer: { label: 'Footer', fields: { logo: slot('Footer logo (https link)', 'image') } },
};
const DATA = { root: { props: {} }, content: [
  { type: 'Hero', props: { headline: 'Hi', slotVideo: '', slotImage: '', photo: 'https://cdn.test/old.png' } },
  { type: 'Grid', props: { items: [{ type: 'QuoteCard', props: { quotes: [{ avatar: '', name: 'A' }, { avatar: 'https://cdn.test/f.png', name: 'B' }] } }] } },
  { type: 'Footer', props: { logo: '' } },
] };

describe('listSlots / setSlot', () => {
  const slots = listSlots(DATA, COMPONENTS);
  it('names every picture and video place on the page, in order', () => {
    expect(slots.map((s) => s.label)).toEqual([
      'Hero: Video in the video slot',
      'Hero: Picture in the video slot',
      'Hero: Placeholder image before the video plays',
      'Card grid › Testimonial card Testimonials 1: Photo',
      'Card grid › Testimonial card Testimonials 2: Photo',
      'Footer: Footer logo',
    ]);
    expect(slots.map((s) => s.kind)).toEqual(['video', 'image', 'image', 'image', 'image', 'image']);
    expect(slots[2].value).toBe('https://cdn.test/old.png');
  });
  it('videos go to video places, pictures to picture places', () => {
    expect(slotsFor(slots, 'video')).toHaveLength(1);
    expect(slotsFor(slots, 'image')).toHaveLength(5);
  });
  it('numbers a second component of the same kind', () => {
    const two = { content: [...DATA.content, { type: 'Footer', props: { logo: '' } }] };
    expect(listSlots(two, COMPONENTS).at(-1).label).toBe('Footer 2: Footer logo');
  });
  it('sets one place without touching the original, including inside a list in a grid', () => {
    const before = JSON.stringify(DATA);
    const next = setSlot(DATA, slots[4].path, 'https://cdn.test/new.png');
    expect(next.content[1].props.items[0].props.quotes[1].avatar).toBe('https://cdn.test/new.png');
    expect(JSON.stringify(DATA)).toBe(before);
    expect(setSlot(DATA, slots[1].path, 'https://cdn.test/v.png').content[0].props.slotImage).toBe('https://cdn.test/v.png');
  });
  it('a place that no longer exists is an error, not a silent change', () => {
    expect(() => setSlot(DATA, ['content', 9, 'props', 'logo'], 'https://x/y.png')).toThrow(/no longer exists/);
  });
  it('an empty page or an unknown component has no places', () => {
    expect(listSlots(undefined, COMPONENTS)).toEqual([]);
    expect(listSlots({ content: [{ type: 'Mystery', props: {} }] }, COMPONENTS)).toEqual([]);
  });
});

describe('persistTrayMedia: placed items must not keep temporary links', () => {
  const TEMP = 'https://provider.test/tmp/abc.png';
  const STORED = 'https://x.supabase.co/storage/v1/object/public/uploads/u/old.png';
  const isPermanent = (u) => u.includes('/storage/v1/object/public/');
  const data = { content: [{ type: 'Hero', props: { photo: TEMP, slotImage: STORED, nested: [{ a: TEMP }] } }] };
  const blobFetch = async () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), { status: 200 });

  it('uploads only tray items that are on the page and not stored yet, and replaces the link everywhere', async () => {
    const upload = vi.fn(async () => ({ url: 'https://x.supabase.co/storage/v1/object/public/uploads/u/new.png' }));
    const tray = [{ url: TEMP, title: 'temp', type: 'image' }, { url: 'https://provider.test/tmp/unused.png', title: 'unused', type: 'image' }, { url: STORED, title: 'stored', type: 'image' }];
    const r = await persistTrayMedia(data, { tray, upload, fetchImpl: blobFetch, isPermanent });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(r.replaced).toBe(1); expect(r.failed).toEqual([]);
    expect(r.data.content[0].props.photo).toContain('/new.png');
    expect(r.data.content[0].props.nested[0].a).toContain('/new.png');
    expect(r.data.content[0].props.slotImage).toBe(STORED);
    expect(data.content[0].props.photo).toBe(TEMP);                       // original untouched
  });
  it('removes (and reports) an item it cannot save instead of leaving a link that will break', async () => {
    const upload = vi.fn(async () => { throw new Error('quota'); });
    const r = await persistTrayMedia(data, { tray: [{ url: TEMP, title: 'My picture', type: 'image' }], upload, fetchImpl: blobFetch, isPermanent });
    expect(r.failed).toEqual([{ url: TEMP, title: 'My picture', message: expect.any(String) }]);
    expect(r.data.content[0].props.photo).toBe('');
    expect(r.data.content[0].props.slotImage).toBe(STORED);
  });
  it('does nothing when no tray item is on the page', async () => {
    const upload = vi.fn();
    const r = await persistTrayMedia({ content: [] }, { tray: [{ url: TEMP, type: 'image' }], upload, isPermanent });
    expect(upload).not.toHaveBeenCalled(); expect(r.replaced).toBe(0);
  });
});
