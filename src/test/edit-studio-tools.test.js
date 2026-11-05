// @vitest-environment jsdom
// Edit Studio: gallery of 13 tools, each opening its own studio view.
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/muapi.js', () => ({
  muapi: { generateI2I: vi.fn(async () => ({ url: 'https://cdn.muapi.ai/result.png' })) },
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
    const picker = {
      opts,
      trigger: document.createElement('button'),
      panel: document.createElement('div'),
      reset: vi.fn(),
      setMaxImages: vi.fn(),
    };
    pickers.push(picker);
    return picker;
  }),
}));
vi.mock('../lib/muapiStudioMedia.js', () => ({
  resolveMuapiMediaRef: vi.fn(async (ref) => ref.url),
  resolveMuapiMediaRefs: vi.fn(async (refs) => refs.map((ref) => ref.url)),
  ingestStudioUpload: vi.fn(),
}));

import { EditStudio, EDIT_TOOLS, getEditToolBySlug, validateEditInputs, getSchemaControls } from '../components/EditStudio.js';
import { strokesToMaskPixels, MASK_SELECTED, MASK_KEPT } from '../components/edit/maskPainter.js';
import { muapi } from '../lib/muapi.js';

const REQUESTED = [
  'Remove Object', 'Remove Background', 'Extend Image', 'AI Edit', 'Reframe', 'Change Dress',
  'Enhance Skin', 'Colorize', 'Add Watermark', 'Upscale', 'Face Swap', 'Product Shot', 'Ghibli Style',
];

function mount() {
  pickers.length = 0;
  const el = EditStudio();
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}
const isHidden = (el) => el.classList.contains('hidden');
const view = (el, name) => el.querySelector(`[data-edit-view="${name}"]`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Edit Studio gallery', () => {
  beforeEach(() => window.history.replaceState(null, '', '/#/edit'));

  test('has exactly the 13 requested tools, each with a unique link name', () => {
    expect(EDIT_TOOLS.map((tool) => tool.name)).toEqual(REQUESTED);
    expect(new Set(EDIT_TOOLS.map((tool) => tool.slug)).size).toBe(13);
  });

  test('shows only the 13 tool cards — no Browse All Models section', () => {
    const el = mount();
    expect(el.querySelectorAll('[data-edit-tool]').length).toBe(13);
    expect(el.textContent).not.toContain('Browse All Models');
    expect(isHidden(view(el, 'gallery'))).toBe(false);
    expect(isHidden(view(el, 'studio'))).toBe(true);
  });

  test('clicking a card opens that tool studio with its own URL, and back returns', () => {
    const el = mount();
    el.querySelector('[data-edit-tool="face-swap"]').click();
    expect(new URLSearchParams(window.location.search).get('tool')).toBe('face-swap');
    expect(window.location.hash).toBe('#/edit');
    expect(isHidden(view(el, 'gallery'))).toBe(true);
    expect(el.querySelector('h1').textContent).toBe('Face Swap');
    expect(el.textContent).toContain('New face photo');

    [...el.querySelectorAll('button')].find((b) => b.textContent === '← All tools').click();
    expect(window.location.search).toBe('');
    expect(isHidden(view(el, 'gallery'))).toBe(false);
  });

  test('a ?tool= link opens that tool directly', () => {
    window.history.replaceState(null, '', '/?tool=ai-edit#/edit');
    const el = mount();
    expect(isHidden(view(el, 'studio'))).toBe(false);
    expect(el.querySelector('h1').textContent).toBe('AI Edit');
    expect(el.querySelector('[aria-label="Edit prompt"]').closest('.hidden')).toBeNull();
  });

  test('each tool shows the inputs it needs', () => {
    const el = mount();
    const open = (slug) => el.querySelector(`[data-edit-tool="${slug}"]`).click();
    const promptVisible = () => !el.querySelector('[aria-label="Edit prompt"]').closest('.hidden');
    const maskVisible = () => !isHidden(el.querySelector('[data-mask-painter]').parentElement);

    open('remove-background');
    expect(promptVisible()).toBe(false);
    open('product-shot');
    expect(promptVisible()).toBe(true);
    expect(el.textContent).toContain('Scene description');
    open('change-dress');
    expect(el.textContent).toContain('Outfit image');
    open('add-watermark');
    expect(el.querySelector('[data-control-key="position"]')).not.toBeNull();
    expect(el.querySelector('[data-control-key="opacity"]')).not.toBeNull();
    open('remove-object');
    expect(maskVisible()).toBe(true);
  });
});

describe('Edit Studio running a tool', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?tool=face-swap#/edit');
    localStorage.setItem('muapi_key', 'test-key');
    muapi.generateI2I.mockClear();
  });

  test('asks for the missing inputs before calling the API', () => {
    const el = mount();
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Apply Edit').click();
    expect(el.querySelector('[role="alert"]').textContent).toMatch(/source image/i);
    expect(muapi.generateI2I).not.toHaveBeenCalled();
  });

  test('sends the source and face images, then shows a before/after preview', async () => {
    const el = mount();
    const [sourcePicker, facePicker] = pickers;
    sourcePicker.opts.onSelect({ url: 'https://x/source.png', assetId: 'a1' });
    facePicker.opts.onSelect({ url: 'https://x/face.png', assetId: 'a2' });
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Apply Edit').click();
    await flush(); await flush(); await flush();

    expect(muapi.generateI2I).toHaveBeenCalledWith(expect.objectContaining({
      model: 'ai-image-face-swap',
      image_url: 'https://x/source.png',
      swap_url: 'https://x/face.png',
      target_index: 0,
    }));
    expect(el.querySelector('img[alt="After"]').getAttribute('src')).toBe('https://cdn.muapi.ai/result.png');
    expect(el.querySelector('img[alt="Before"]').getAttribute('src')).toBe('https://x/source.png');
    expect(el.querySelector('[aria-label="Before/after slider"]')).not.toBeNull();
    expect([...el.querySelectorAll('a')].find((a) => a.textContent === 'Download').getAttribute('href'))
      .toBe('https://cdn.muapi.ai/result.png');
  });
});

describe('Edit Studio helpers', () => {
  test('validation names what is missing', () => {
    const swap = getEditToolBySlug('face-swap');
    expect(validateEditInputs(swap, { sourceUrl: 'u' })).toMatch(/new face photo/i);
    expect(validateEditInputs(swap, { sourceUrl: 'u', secondaryUrl: 'f' })).toBeNull();
    const eraser = getEditToolBySlug('remove-object');
    expect(validateEditInputs(eraser, { sourceUrl: 'u' })).toMatch(/paint/i);
    expect(validateEditInputs(eraser, { sourceUrl: 'u', hasPaintedMask: true })).toBeNull();
    expect(validateEditInputs(getEditToolBySlug('ai-edit'), { sourceUrl: 'u', prompt: ' ' })).toMatch(/describe/i);
  });

  test('schema controls never duplicate hand-written ones or image fields', () => {
    for (const tool of EDIT_TOOLS) {
      const keys = [...(tool.controls || []), ...getSchemaControls(tool)].map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.some((key) => /_url$|^images_list$/.test(key))).toBe(false);
    }
  });

  test('painted strokes become white on an opaque black mask', () => {
    const rgba = new Uint8ClampedArray([34, 211, 238, 200, 0, 0, 0, 0]);
    expect([...strokesToMaskPixels(rgba)]).toEqual([
      MASK_SELECTED, MASK_SELECTED, MASK_SELECTED, 255,
      MASK_KEPT, MASK_KEPT, MASK_KEPT, 255,
    ]);
  });
});
