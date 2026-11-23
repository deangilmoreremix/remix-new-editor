// @vitest-environment jsdom
// Edit Studio: the muapi Studio apps shown next to the 16 built-in tools.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/muapi.js', () => ({
  muapi: {
    generateI2I: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.png' })),
    generateI2V: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.mp4' })),
    processV2V: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/swapped.mp4' })),
    calculateDynamicCost: vi.fn(async () => ({ cost: 0.07 })),
  },
}));
vi.mock('../lib/generationHistory.js', () => ({ registerGeneration: vi.fn() }));
vi.mock('../lib/studioChrome.js', () => ({ mountStudioChrome: vi.fn() }));
vi.mock('../components/AuthModal.js', () => ({ AuthModal: vi.fn() }));
vi.mock('../components/personalize/personalizePopover.js', () => ({ replaceTokensInPrompt: (text) => text }));
vi.mock('../lib/attachmentToolbar.js', () => ({ createAttachmentToolbar: vi.fn(() => ({})) }));
vi.mock('../lib/loading.js', () => ({ showToast: vi.fn() }));
vi.mock('../lib/thumbnails.js', () => ({
  getToolThumbnail: (id) => `/thumbnails/tools/${id}.webp`,
  createThumbnailImg: (src, alt) => Object.assign(document.createElement('img'), { src, alt }),
  createStudioHeader: (_id, title, subtitle) => {
    const el = document.createElement('div');
    el.innerHTML = '<h2></h2><p></p>';
    el.querySelector('h2').textContent = title;
    el.querySelector('p').textContent = subtitle;
    return el;
  },
}));
const pickers = [];
vi.mock('../components/UploadPicker.js', () => ({
  createUploadPicker: vi.fn((opts) => {
    const picker = { opts, trigger: document.createElement('button'), panel: document.createElement('div'), reset: vi.fn(), setMaxImages: vi.fn() };
    pickers.push(picker);
    return picker;
  }),
}));
vi.mock('../lib/muapiStudioMedia.js', () => ({
  resolveMuapiMediaRef: vi.fn(async (ref) => ref.url),
  resolveMuapiMediaRefs: vi.fn(async (refs) => refs.map((ref) => ref.url)),
  ingestStudioUpload: vi.fn(),
}));

import { EditStudio, EDIT_TOOLS } from '../components/EditStudio.js';
import { EDIT_APPS } from '../lib/muapiEditApps.js';
import { muapi } from '../lib/muapi.js';
import { registerGeneration } from '../lib/generationHistory.js';

// Picker order is part of the Edit Studio contract: source, extras, secondary, then the app-only video pickers.
const SOURCE = 0;
const SECONDARY = 2;
const SECONDARY_VIDEO = 3;

function mount(slug) {
  pickers.length = 0;
  window.history.replaceState(null, '', slug ? `/?tool=${slug}#/edit` : '/#/edit');
  const el = EditStudio();
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}
const button = (el, re) => [...el.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const applyBtn = (el) => button(el, /^(Apply Edit|Generate)/);
const hidden = (n) => n.classList.contains('hidden');

beforeEach(() => {
  localStorage.setItem('muapi_key', 'test-key');
  for (const fn of [muapi.generateI2I, muapi.generateI2V, muapi.processV2V, muapi.calculateDynamicCost, registerGeneration]) fn.mockClear();
});

describe('Edit Studio gallery with apps', () => {
  test('keeps the 16 tools and adds every app as a second set of cards', () => {
    const el = mount();
    expect(el.querySelectorAll('[data-edit-tool]')).toHaveLength(16);
    expect(el.querySelectorAll('[data-edit-app]')).toHaveLength(EDIT_APPS.length);
    expect(EDIT_TOOLS).toHaveLength(16);
  });

  test('app cards use the app thumbnail, a name, a description and an image/video tag', () => {
    const el = mount();
    const card = el.querySelector('[data-edit-app="app-angles"]');
    expect(card.querySelector('img').getAttribute('src')).toBe('/thumbnails/muapi-apps/angles.webp');
    expect(card.textContent).toContain('Angles');
    expect(card.querySelector('[data-app-kind]').textContent).toBe('IMAGE');
    expect(el.querySelector('[data-edit-app="app-mukbang"] [data-app-kind]').textContent).toBe('VIDEO');
  });

  test('category chips and search filter the apps but never the tools', () => {
    const el = mount();
    el.querySelector('[data-app-filter="ads"]').click();
    const shown = [...el.querySelectorAll('[data-edit-app]')].filter((c) => !hidden(c));
    expect(shown.length).toBeGreaterThan(5);
    shown.forEach((c) => expect(EDIT_APPS.find((a) => a.slug === c.dataset.editApp).categoryKey).toBe('ads'));
    el.querySelector('[data-app-filter="all"]').click();
    const search = el.querySelector('[data-app-search]');
    search.value = 'mukbang';
    search.dispatchEvent(new Event('input'));
    expect([...el.querySelectorAll('[data-edit-app]')].filter((c) => !hidden(c)).map((c) => c.dataset.editApp)).toEqual(['app-mukbang']);
    expect([...el.querySelectorAll('[data-edit-tool]')].every((c) => !hidden(c))).toBe(true);
  });

  test('the Switch tool list includes the apps, grouped', () => {
    const el = mount();
    const select = el.querySelector('select[aria-label="Switch tool"]');
    expect(select.querySelectorAll('option').length).toBe(16 + EDIT_APPS.length);
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toContain('Apps · Professional');
  });

  test('clicking an app card opens its studio and sets the link', () => {
    const el = mount();
    el.querySelector('[data-edit-app="app-angles"]').click();
    expect(el.querySelector('[data-edit-view="studio"] h1').textContent).toBe('Angles');
    expect(window.location.search).toContain('tool=app-angles');
    expect(hidden(el.querySelector('[data-edit-view="gallery"]'))).toBe(true);
  });
});

describe('An image app (Angles)', () => {
  test('shows its presets, sliders, selects and price', () => {
    const el = mount('app-angles');
    expect([...el.querySelectorAll('[data-preset]')].map((b) => b.dataset.preset)).toContain('Right 45° Front-Quarter');
    for (const key of ['adj_rotation', 'adj_tilt', 'adj_zoom', 'aspect_ratio', 'resolution']) expect(el.querySelector(`[data-control-key="${key}"]`), key).toBeTruthy();
    expect(applyBtn(el).textContent).toBe('Generate (≈ $0.045)');
    expect(hidden(el.querySelector('[aria-label="Edit prompt"]').closest('div'))).toBe(false);
  });

  test('a preset moves the sliders, and moving a slider by hand goes back to Custom', () => {
    const el = mount('app-angles');
    el.querySelector('[data-preset="Right 45° Front-Quarter"]').click();
    expect(el.querySelector('[data-control-key="adj_rotation"]').value).toBe('45');
    expect(el.querySelector('input[data-control-key="style_preset"]').value).toBe('Right 45° Front-Quarter');
    const tilt = el.querySelector('[data-control-key="adj_tilt"]');
    tilt.value = '20';
    tilt.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.querySelector('input[data-control-key="style_preset"]').value).toBe('Custom');
  });

  test('asks for the photo first, then sends it with the built prompt', async () => {
    const el = mount('app-angles');
    applyBtn(el).click();
    expect(el.querySelector('[role="alert"]').textContent).toMatch(/Upload .*first/i);
    expect(muapi.generateI2I).not.toHaveBeenCalled();

    pickers[SOURCE].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    el.querySelector('[data-preset="Right 45° Front-Quarter"]').click();
    el.querySelector('[aria-label="Edit prompt"]').value = 'a red car';
    applyBtn(el).click();
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalledTimes(1));
    const params = muapi.generateI2I.mock.calls[0][0];
    expect(params).toMatchObject({ model: 'bytedance-seedream-5.0-pro-edit', image_url: 'https://x/a.png', aspect_ratio: '1:1', resolution: '1K' });
    expect(params.prompt).toContain('three-quarter view from the right');
    expect(params.prompt).toContain('camera rotated 45 degrees');
    expect(params.prompt).toContain('a red car');
    // Virtual control keys never reach the request.
    expect(Object.keys(params).some((k) => k.startsWith('adj_') || k === 'style_preset')).toBe(false);

    await vi.waitFor(() => expect(registerGeneration).toHaveBeenCalled());
    expect(registerGeneration.mock.calls[0].slice(0, 3)).toEqual(['edit', 'image', 'https://cdn.muapi.ai/result.png']);
    expect(el.querySelector('a[download]').getAttribute('href')).toBe('https://cdn.muapi.ai/result.png');
  });

  test('the button price follows muapi\'s own estimate', async () => {
    const el = mount('app-angles');
    await vi.waitFor(() => expect(applyBtn(el).textContent).toBe('Generate ($0.07)'));
    expect(muapi.calculateDynamicCost.mock.calls[0][0]).toBe('bytedance-seedream-5.0-pro-edit');
  });
});

describe('A video app (Mukbang)', () => {
  test('sends a numeric duration to the image-to-video call and plays the result', async () => {
    const el = mount('app-mukbang');
    pickers[SOURCE].opts.onSelect({ url: 'https://x/me.png', assetId: null });
    const duration = el.querySelector('[data-control-key="duration"]');
    duration.value = '8';
    applyBtn(el).click();
    await vi.waitFor(() => expect(muapi.generateI2V).toHaveBeenCalledTimes(1));
    const params = muapi.generateI2V.mock.calls[0][0];
    expect(params).toMatchObject({ model: 'seedance-2-image-to-video', image_url: 'https://x/me.png', duration: 8, aspect_ratio: '16:9' });
    expect(muapi.generateI2I).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(hidden(el.querySelector('[data-edit-video-box]'))).toBe(false));
    expect(el.querySelector('[data-edit-video-box] video').getAttribute('src')).toBe('https://cdn.muapi.ai/result.mp4');
    expect(registerGeneration.mock.calls[0][1]).toBe('video');
  });
});

describe('Apps with extra inputs', () => {
  test('ClipCut has an optional end frame that is sent only when given', async () => {
    const el = mount('app-clipcut');
    expect(el.textContent).toMatch(/Ending Frame Image \(Optional\)/);
    expect(el.textContent).not.toMatch(/\(Optional\) \(optional\)/i);
    pickers[SOURCE].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    applyBtn(el).click();
    await vi.waitFor(() => expect(muapi.generateI2V).toHaveBeenCalledTimes(1));
    expect(muapi.generateI2V.mock.calls[0][0].last_image_url).toBeUndefined();

    pickers[SECONDARY].opts.onSelect({ url: 'https://x/end.png', assetId: null });
    applyBtn(el).click();
    await vi.waitFor(() => expect(muapi.generateI2V).toHaveBeenCalledTimes(2));
    expect(muapi.generateI2V.mock.calls[1][0].last_image_url).toBe('https://x/end.png');
  });

  test('Video Face Swap needs a target video and runs through the video-to-video call', async () => {
    const el = mount('app-video-face-swap');
    expect(hidden(pickers[SECONDARY_VIDEO].trigger)).toBe(false);
    expect(hidden(pickers[SECONDARY].trigger)).toBe(true);
    pickers[SOURCE].opts.onSelect({ url: 'https://x/face.png', assetId: null });
    applyBtn(el).click();
    expect(el.querySelector('[role="alert"]').textContent).toMatch(/target video/i);
    expect(muapi.processV2V).not.toHaveBeenCalled();

    pickers[SECONDARY_VIDEO].opts.onSelect({ url: 'https://x/clip.mp4', assetId: null });
    applyBtn(el).click();
    await vi.waitFor(() => expect(muapi.processV2V).toHaveBeenCalledTimes(1));
    expect(muapi.processV2V.mock.calls[0][0]).toMatchObject({ model: 'ai-video-face-swap', image_url: 'https://x/face.png', video_url: 'https://x/clip.mp4' });
    expect(muapi.processV2V.mock.calls[0][0].prompt).toBeUndefined();
  });

  test('Video Background Remover takes a video as its source', async () => {
    const el = mount('app-video-bg-remover');
    expect(hidden(pickers[SOURCE].trigger)).toBe(true);
    pickers.at(-1).opts.onSelect({ url: 'https://x/clip.mp4', assetId: null });
    applyBtn(el).click();
    await vi.waitFor(() => expect(muapi.processV2V).toHaveBeenCalledTimes(1));
    expect(muapi.processV2V.mock.calls[0][0]).toMatchObject({ model: 'video-background-remover', video_url: 'https://x/clip.mp4' });
  });
});

describe('Built-in tools are unchanged', () => {
  test('Apply Edit still runs the original path after visiting an app', async () => {
    const el = mount('app-mukbang');
    el.querySelector('select[aria-label="Switch tool"]').value = 'remove-background';
    el.querySelector('select[aria-label="Switch tool"]').dispatchEvent(new Event('change'));
    expect(el.querySelector('[data-edit-view="studio"] h1').textContent).toBe('Remove Background');
    expect(applyBtn(el).textContent).toBe('Apply Edit');
    pickers[SOURCE].opts.onSelect({ url: 'https://x/a.png', assetId: null });
    applyBtn(el).click();
    await vi.waitFor(() => expect(muapi.generateI2I).toHaveBeenCalledTimes(1));
    expect(muapi.generateI2I.mock.calls[0][0]).toMatchObject({ model: 'ai-background-remover', image_url: 'https://x/a.png' });
    expect(muapi.generateI2V).not.toHaveBeenCalled();
  });
});
