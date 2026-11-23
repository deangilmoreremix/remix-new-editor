// @vitest-environment jsdom
// The content tray in the picker's editor: studio results go into the video and picture parts of the page.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploads = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../../supabase.js', () => ({ supabase: {}, primeSupabaseIdentity: vi.fn(async () => {}), getClerkUserId: () => 'u1' }));
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: uploads.upload }));
vi.mock('../../brandStore.js', () => ({ listBrands: () => [] }));
vi.mock('../../loading.js', () => ({ showToast: vi.fn() }));
vi.mock('../editor/mount.jsx', () => ({ mountEditablePage: vi.fn(() => ({ destroy() {} })), mountPageEditor: vi.fn(() => ({ destroy() {} })) }));
import { openLandingPagePicker } from '../pickerModal.js';

const tick = (n = 1) => new Promise((r) => setTimeout(r, n));
const settle = async () => { for (let i = 0; i < 6; i += 1) await tick(5); };
const STORED = (n) => `https://x.supabase.co/storage/v1/object/public/uploads/u/${n}`;
const VIDEO = { url: 'https://cdn.test/clip.mp4', title: 'My clip', thumbnail_url: 'https://cdn.test/clip-thumb.jpg', studio: 'video' };
const SHOT = { url: 'https://provider.test/tmp/shot.png', type: 'image', title: 'Shot A', studio: 'image' };
const SHOT2 = { url: STORED('shot2.png'), type: 'image', title: 'Shot B (stored)', studio: 'image' };

const open = async (opts) => {
  const mountPageEditor = vi.fn(() => ({ destroy: vi.fn() }));
  const createPageFromVideo = vi.fn(async (_c, v, o) => ({ id: 'abcd123456', config: { template: o.template }, video_url: v.url }));
  const updatePage = vi.fn(async (_c, id, patch) => ({ id, published: false, config: patch.config }));
  const onPick = vi.fn();
  openLandingPagePicker({ ...opts, onPick, deps: { mountPageEditor, createPageFromVideo, updatePage } });
  document.querySelector('[data-design-grid] button').click();
  await settle();
  // the tray is filled in the background once the editor's slot list has loaded
  await vi.waitFor(() => expect(document.querySelector('[data-content-tray]')).toBeTruthy(), { timeout: 10000 });
  return { mountPageEditor, createPageFromVideo, updatePage, onPick };
};
const cards = () => [...document.querySelectorAll('[data-tray-card]')];
const menu = (card) => card.querySelector('[data-tray-menu]');
const choose = async (sel, predicate) => { const o = [...sel.options].find(predicate); sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await settle(); return o; };

beforeEach(() => {
  document.body.innerHTML = ''; document.body.style.overflow = ''; uploads.upload.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), { status: 200 })));
});

describe('studio content in the editor', () => {
  it('the requested video fills the viewer, its own thumbnail is the poster, the rest wait in the tray', async () => {
    const { mountPageEditor } = await open({ video: VIDEO, items: [SHOT, SHOT2] });
    expect(mountPageEditor.mock.calls[0][1].page).toMatchObject({ video_url: VIDEO.url, poster_url: 'https://cdn.test/clip-thumb.jpg' });
    expect(cards()).toHaveLength(3);
    expect(cards()[0].textContent).toContain('Main video');
    expect(cards()[1].textContent).toContain('Picture');
    expect(document.querySelector('[data-content-tray]').textContent).toContain('From your studio');
  });

  it('the tray is a compact strip: small fixed-size thumbnails, never full-size pictures', async () => {
    await open({ video: VIDEO, items: [SHOT2] });
    cards().forEach((c) => { expect(c.style.width).toBe('150px'); expect(c.firstElementChild.style.height).toBe('84px'); expect(c.firstElementChild.style.overflow).toBe('hidden'); });
  });

  it('a picture the user asked for is the main item (a still), even with videos in the tray', async () => {
    const { mountPageEditor } = await open({ video: SHOT2, items: [VIDEO] });
    expect(mountPageEditor.mock.calls[0][1].page.video_url).toBe(SHOT2.url);
    expect(cards()[0].textContent).toContain('Main picture');
  });

  it('the editor can ask for the tray (so every picture and video field can offer it)', async () => {
    const { mountPageEditor } = await open({ video: VIDEO, items: [SHOT] });
    const tray = mountPageEditor.mock.calls[0][1].getTray();
    expect(tray.map((t) => [t.title, t.type])).toEqual([['My clip', 'video'], ['Shot A', 'image']]);
  });

  it('duplicates, audio-like and non-https items are not in the tray', async () => {
    await open({ video: VIDEO, items: [VIDEO, { url: 'http://x/a.png', type: 'image' }, { url: 'blob:abc', type: 'image' }, SHOT] });
    expect(cards()).toHaveLength(2);
  });

  it('"Make main" puts a tray item in the viewer and re-mounts the editor on it', async () => {
    const { mountPageEditor } = await open({ video: VIDEO, items: [SHOT2] });
    await choose(menu(cards()[1]), (o) => /Make main picture/.test(o.textContent));
    expect(mountPageEditor).toHaveBeenCalledTimes(2);
    expect(mountPageEditor.mock.calls[1][1].page.video_url).toBe(SHOT2.url);
    expect(cards()[0].textContent).toContain('Main picture');        // it moved to the front
    expect(cards().some((c) => c.textContent.includes('Main video') || /Video$/.test(c.querySelector('span').textContent))).toBe(true);
  });

  it('"Use in…" lists real places for this kind of item and puts it there (stored items need no upload)', async () => {
    const { mountPageEditor } = await open({ video: VIDEO, items: [SHOT2] });
    const sel = menu(cards()[1]);
    const labels = [...sel.options].map((o) => o.textContent);
    expect(labels[0]).toBe('Use in…');
    expect(labels.some((l) => /Hero: Placeholder image/.test(l))).toBe(true);
    expect(labels.some((l) => /Video in the video slot/.test(l))).toBe(false);          // a picture never goes in a video place
    await choose(sel, (o) => /Hero: Placeholder image before the video plays/.test(o.textContent));
    expect(uploads.upload).not.toHaveBeenCalled();
    const hero = mountPageEditor.mock.calls.at(-1)[1].data.content.find((n) => n.type === 'Hero');
    expect(hero.props.photo).toBe(SHOT2.url);
  });

  it('a video offers the video places', async () => {
    await open({ video: SHOT2, items: [VIDEO] });
    const labels = [...menu(cards()[1]).options].map((o) => o.textContent);
    expect(labels.some((l) => /Video in the video slot/.test(l))).toBe(true);
    expect(labels.some((l) => /Placeholder image/.test(l))).toBe(false);
  });

  it('a temporary studio link is saved to the account before it goes on the page', async () => {
    uploads.upload.mockResolvedValue({ url: STORED('uploaded.png') });
    const { mountPageEditor } = await open({ video: VIDEO, items: [SHOT] });
    await choose(menu(cards()[1]), (o) => /Hero: Placeholder image/.test(o.textContent));
    expect(uploads.upload).toHaveBeenCalledTimes(1);
    const hero = mountPageEditor.mock.calls.at(-1)[1].data.content.find((n) => n.type === 'Hero');
    expect(hero.props.photo).toBe(STORED('uploaded.png'));
  });

  it('a failed save names the problem and leaves the page as it was', async () => {
    uploads.upload.mockRejectedValue(new Error('Storage is full'));
    const { mountPageEditor } = await open({ video: VIDEO, items: [SHOT] });
    const before = mountPageEditor.mock.calls.length;
    await choose(menu(cards()[1]), (o) => /Hero: Placeholder image/.test(o.textContent));
    expect(document.querySelector('[data-landing-picker]').textContent).toContain('Storage is full');
    expect(mountPageEditor.mock.calls.length).toBe(before);
  });

  it('save: a tray item placed on the page is stored first, so the page never keeps a temporary link', async () => {
    uploads.upload.mockResolvedValue({ url: STORED('final.png') });
    const { mountPageEditor, updatePage, createPageFromVideo } = await open({ video: VIDEO, items: [SHOT] });
    // the user typed / dropped the tray item's own (temporary) link straight into a field
    const data = JSON.parse(JSON.stringify(mountPageEditor.mock.calls[0][1].data));
    data.content.find((n) => n.type === 'Hero').props.slotImage = SHOT.url;
    mountPageEditor.mock.calls[0][1].onChange(data);
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page').click();
    await settle();
    expect(createPageFromVideo).toHaveBeenCalledTimes(1);
    const saved = updatePage.mock.calls[0][2].config.editor;
    expect(saved.content.find((n) => n.type === 'Hero').props.slotImage).toBe(STORED('final.png'));
    expect(JSON.stringify(saved)).not.toContain('provider.test/tmp');
  });

  it('save: an item that cannot be stored is left out and the user is told', async () => {
    uploads.upload.mockRejectedValue(new Error('quota'));
    const { mountPageEditor, updatePage, onPick } = await open({ video: VIDEO, items: [SHOT] });
    const data = JSON.parse(JSON.stringify(mountPageEditor.mock.calls[0][1].data));
    data.content.find((n) => n.type === 'Hero').props.slotImage = SHOT.url;
    mountPageEditor.mock.calls[0][1].onChange(data);
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page').click();
    await settle();
    expect(updatePage.mock.calls[0][2].config.editor.content.find((n) => n.type === 'Hero').props.slotImage).toBe('');
    expect(onPick.mock.calls[0][0].mediaWarning).toContain('Shot A');
    expect(document.body.textContent).toContain('left out of the page');
  });

  it('with only one item and nothing else, the editor still works and the item can be placed elsewhere', async () => {
    await open({ video: SHOT2 });
    expect(cards()).toHaveLength(1);
    expect([...menu(cards()[0]).options].some((o) => /Hero: Placeholder image/.test(o.textContent))).toBe(true);
  });
});
